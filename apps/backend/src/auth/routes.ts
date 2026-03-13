import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import bcrypt from "bcryptjs";
import type { ApiResponse } from "@enterprise-openclaw/shared";
import prisma from "../lib/prisma";
import redis from "../lib/redis";
import { sendOtpEmail } from "../lib/mailer";

// ── JWT payload shape ──────────────────────────────────────────────────────

export interface JwtPayload {
  sub: string;   // userId
  role: string;  // UserRole
}

// ── Safe user shape returned to clients ───────────────────────────────────

function safeUser(u: { id: string; email: string; name: string; role: string; createdAt: Date }) {
  return { id: u.id, email: u.email, name: u.name, role: u.role, createdAt: u.createdAt };
}

// ── Plugin ────────────────────────────────────────────────────────────────

export default async function authRoutes(app: FastifyInstance) {
  // ── POST /api/auth/send-otp ────────────────────────────────────────────
  // Send a 6-digit OTP to the given email address (TTL: 5 minutes).

  app.post<{ Body: { email: string } }>(
    "/api/auth/send-otp",
    {
      schema: {
        body: {
          type: "object",
          required: ["email"],
          properties: { email: { type: "string", format: "email" } },
        },
      },
    },
    async (req, reply): Promise<ApiResponse> => {
      const { email } = req.body;

      // Rate-limit: at most one OTP per 60 seconds
      const ttl = await redis.ttl(`otp:${email}`);
      if (ttl > 240) {   // was just issued (< 60 s ago means TTL still > 240)
        return reply
          .status(429)
          .send({ success: false, error: "请稍后再试（60 秒内只能发送一次）" });
      }

      const code = String(Math.floor(100000 + Math.random() * 900000));
      await redis.set(`otp:${email}`, code, "EX", 300);  // 5 min

      try {
        await sendOtpEmail(email, code);
      } catch (err) {
        app.log.error(err, "Failed to send OTP email");
        return reply.status(500).send({ success: false, error: "邮件发送失败，请检查 SMTP 配置" });
      }

      return { success: true, data: { message: "验证码已发送" } };
    },
  );

  // ── POST /api/auth/verify-otp ──────────────────────────────────────────
  // Verify OTP, find-or-create user, return JWT.

  app.post<{ Body: { email: string; code: string } }>(
    "/api/auth/verify-otp",
    {
      schema: {
        body: {
          type: "object",
          required: ["email", "code"],
          properties: {
            email: { type: "string" },
            code:  { type: "string", minLength: 6, maxLength: 6 },
          },
        },
      },
    },
    async (req, reply): Promise<ApiResponse> => {
      const { email, code } = req.body;

      const stored = await redis.get(`otp:${email}`);
      if (!stored || stored !== code) {
        return reply.status(401).send({ success: false, error: "验证码错误或已过期" });
      }

      await redis.del(`otp:${email}`);

      // Find or create user (first login auto-creates the account)
      let user = await prisma.user.findUnique({ where: { email } });
      if (!user) {
        const name = email.split("@")[0];
        user = await prisma.user.create({ data: { email, name } });
      }

      const token = app.jwt.sign(
        { sub: user.id, role: user.role } satisfies JwtPayload,
        { expiresIn: "7d" },
      );

      return { success: true, data: { token, user: safeUser(user) } };
    },
  );

  // ── POST /api/auth/login (password fallback for admin accounts) ────────

  app.post<{ Body: { email: string; password: string } }>(
    "/api/auth/login",
    {
      schema: {
        body: {
          type: "object",
          required: ["email", "password"],
          properties: {
            email:    { type: "string" },
            password: { type: "string" },
          },
        },
      },
    },
    async (req, reply): Promise<ApiResponse> => {
      const { email, password } = req.body;

      const user = await prisma.user.findUnique({ where: { email } });
      if (!user || !user.password) {
        return reply.status(401).send({ success: false, error: "Invalid credentials" });
      }

      const match = await bcrypt.compare(password, user.password);
      if (!match) {
        return reply.status(401).send({ success: false, error: "Invalid credentials" });
      }

      const token = app.jwt.sign(
        { sub: user.id, role: user.role } satisfies JwtPayload,
        { expiresIn: "7d" },
      );

      return { success: true, data: { token, user: safeUser(user) } };
    },
  );

  // ── POST /api/auth/google ──────────────────────────────────────────────
  // Google OAuth login - verify Google token and create/login user

  app.post<{ Body: { credential: string } }>(
    "/api/auth/google",
    {
      schema: {
        body: {
          type: "object",
          required: ["credential"],
          properties: {
            credential: { type: "string" },
          },
        },
      },
    },
    async (req, reply): Promise<ApiResponse> => {
      const { credential } = req.body;

      try {
        // Verify Google token
        const response = await fetch(
          `https://oauth2.googleapis.com/tokeninfo?id_token=${credential}`
        );
        
        if (!response.ok) {
          return reply.status(401).send({ 
            success: false, 
            error: "Invalid Google token" 
          });
        }

        const googleUser = await response.json();
        const { sub: googleId, email, name } = googleUser;

        if (!email) {
          return reply.status(400).send({ 
            success: false, 
            error: "Email not provided by Google" 
          });
        }

        // Find or create user
        let user = await prisma.user.findUnique({ 
          where: { email } 
        });

        if (!user) {
          // Create new user with Google ID
          user = await prisma.user.create({
            data: {
              email,
              name: name || email.split("@")[0],
              googleId,
            },
          });
        } else if (!user.googleId) {
          // Link Google ID to existing user
          user = await prisma.user.update({
            where: { id: user.id },
            data: { googleId },
          });
        }

        // Generate JWT
        const token = app.jwt.sign(
          { sub: user.id, role: user.role } satisfies JwtPayload,
          { expiresIn: "7d" },
        );

        return { 
          success: true, 
          data: { token, user: safeUser(user) } 
        };
      } catch (err) {
        app.log.error(err, "Google OAuth error");
        return reply.status(500).send({ 
          success: false, 
          error: "Google authentication failed" 
        });
      }
    },
  );

  // ── GET /api/auth/me ───────────────────────────────────────────────────

  app.get(
    "/api/auth/me",
    { preHandler: [app.authenticate] },
    async (req, reply): Promise<ApiResponse> => {
      const payload = req.user as JwtPayload;

      const user = await prisma.user.findUnique({ where: { id: payload.sub } });
      if (!user) {
        return reply.status(404).send({ success: false, error: "User not found" });
      }

      return { success: true, data: { user: safeUser(user) } };
    },
  );
}

// ── authenticate preHandler ────────────────────────────────────────────────

export async function authenticate(req: FastifyRequest, reply: FastifyReply) {
  try {
    await req.jwtVerify();
  } catch (err) {
    reply.send(err);
  }
}
