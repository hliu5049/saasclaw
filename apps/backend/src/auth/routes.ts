import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import bcrypt from "bcryptjs";
import type { ApiResponse } from "@enterprise-openclaw/shared";
import prisma from "../lib/prisma";

// ── JWT payload shape ──────────────────────────────────────────────────────

export interface JwtPayload {
  sub: string;   // userId
  role: string;  // UserRole
}

// ── Route body types ───────────────────────────────────────────────────────

interface RegisterBody {
  email: string;
  password: string;
  name: string;
}

interface LoginBody {
  email: string;
  password: string;
}

// ── Safe user shape returned to clients ───────────────────────────────────

function safeUser(u: { id: string; email: string; name: string; role: string; createdAt: Date }) {
  return { id: u.id, email: u.email, name: u.name, role: u.role, createdAt: u.createdAt };
}

// ── Plugin ────────────────────────────────────────────────────────────────

export default async function authRoutes(app: FastifyInstance) {
  // ── POST /api/auth/register ────────────────────────────────────────────

  app.post<{ Body: RegisterBody }>(
    "/api/auth/register",
    {
      schema: {
        body: {
          type: "object",
          required: ["email", "password", "name"],
          properties: {
            email:    { type: "string", format: "email" },
            password: { type: "string", minLength: 6 },
            name:     { type: "string", minLength: 1 },
          },
        },
      },
    },
    async (req, reply): Promise<ApiResponse> => {
      const { email, password, name } = req.body;

      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) {
        return reply.status(409).send({ success: false, error: "Email already registered" });
      }

      const hashed = await bcrypt.hash(password, 10);
      const user = await prisma.user.create({
        data: { email, password: hashed, name },
      });

      const token = app.jwt.sign(
        { sub: user.id, role: user.role } satisfies JwtPayload,
        { expiresIn: "7d" },
      );

      return reply.status(201).send({ success: true, data: { token, user: safeUser(user) } });
    },
  );

  // ── POST /api/auth/login ───────────────────────────────────────────────

  app.post<{ Body: LoginBody }>(
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
      if (!user) {
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
