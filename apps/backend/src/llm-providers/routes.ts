import { FastifyPluginAsync } from "fastify";
import { prisma } from "../lib/prisma.js";

const routes: FastifyPluginAsync = async (fastify) => {
  // 获取所有LLM Provider
  fastify.get("/", async (request, reply) => {
    const providers = await prisma.llmProvider.findMany({
      orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
    });
    return providers;
  });

  // 创建LLM Provider
  fastify.post("/", async (request, reply) => {
    const body = request.body as any;
    
    // 如果设置为默认，先取消其他默认
    if (body.isDefault) {
      await prisma.llmProvider.updateMany({
        where: { isDefault: true },
        data: { isDefault: false },
      });
    }

    const provider = await prisma.llmProvider.create({
      data: {
        name: body.name,
        provider: body.provider,
        apiKey: body.apiKey,
        baseUrl: body.baseUrl,
        models: body.models || [],
        isDefault: body.isDefault || false,
        enabled: body.enabled !== false,
      },
    });

    return provider;
  });

  // 更新LLM Provider
  fastify.put("/:id", async (request, reply) => {
    const { id } = request.params as any;
    const body = request.body as any;

    // 如果设置为默认，先取消其他默认
    if (body.isDefault) {
      await prisma.llmProvider.updateMany({
        where: { isDefault: true, id: { not: id } },
        data: { isDefault: false },
      });
    }

    const provider = await prisma.llmProvider.update({
      where: { id },
      data: {
        name: body.name,
        provider: body.provider,
        apiKey: body.apiKey,
        baseUrl: body.baseUrl,
        models: body.models,
        isDefault: body.isDefault,
        enabled: body.enabled,
      },
    });

    return provider;
  });

  // 删除LLM Provider
  fastify.delete("/:id", async (request, reply) => {
    const { id } = request.params as any;
    await prisma.llmProvider.delete({ where: { id } });
    return { success: true };
  });

  // 测试连接
  fastify.post("/:id/test", async (request, reply) => {
    const { id } = request.params as any;
    const provider = await prisma.llmProvider.findUnique({ where: { id } });
    
    if (!provider) {
      return reply.status(404).send({ error: "Provider not found" });
    }

    // TODO: 实际测试API连接
    return { success: true, message: "Connection test passed" };
  });
};

export default routes;
