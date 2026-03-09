import Fastify from "fastify";
import cors from "@fastify/cors";
import type { ApiResponse } from "@enterprise-openclaw/shared";

const app = Fastify({ logger: true });

await app.register(cors);

app.get("/health", async (): Promise<ApiResponse> => {
  return { success: true, data: { status: "ok" } };
});

const start = async () => {
  try {
    await app.listen({ port: 3001, host: "0.0.0.0" });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
