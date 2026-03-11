import type { FastifyRequest, FastifyReply } from "fastify";
import type { JwtPayload } from "../auth/routes";

declare module "fastify" {
  interface FastifyInstance {
    authenticate(req: FastifyRequest, reply: FastifyReply): Promise<void>;
  }

  interface FastifyRequest {
    user: JwtPayload;
  }
}
