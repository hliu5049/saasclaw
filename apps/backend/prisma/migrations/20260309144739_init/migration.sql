-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'MEMBER');

-- CreateEnum
CREATE TYPE "GatewayStatus" AS ENUM ('ONLINE', 'OFFLINE', 'ERROR');

-- CreateEnum
CREATE TYPE "AgentStatus" AS ENUM ('ACTIVE', 'PAUSED', 'DELETED');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('PROCESSING', 'READY', 'FAILED');

-- CreateEnum
CREATE TYPE "ChannelType" AS ENUM ('WEBCHAT', 'WECOM', 'DINGTALK', 'FEISHU');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'MEMBER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gateways" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "wsUrl" TEXT NOT NULL,
    "token" TEXT,
    "status" "GatewayStatus" NOT NULL DEFAULT 'ONLINE',
    "agentCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gateways_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agents" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "soulMd" TEXT NOT NULL DEFAULT '',
    "agentsMd" TEXT NOT NULL DEFAULT '',
    "model" TEXT NOT NULL DEFAULT 'anthropic/claude-opus-4-6',
    "status" "AgentStatus" NOT NULL DEFAULT 'ACTIVE',
    "colorIdx" INTEGER NOT NULL DEFAULT 0,
    "workspacePath" TEXT NOT NULL,
    "gatewayId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_rag" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "collectionName" TEXT NOT NULL,
    "namespace" TEXT NOT NULL,
    "embeddingModel" TEXT NOT NULL DEFAULT 'text-embedding-3-small',
    "chunkSize" INTEGER NOT NULL DEFAULT 512,
    "chunkOverlap" INTEGER NOT NULL DEFAULT 64,

    CONSTRAINT "agent_rag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rag_documents" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "status" "DocumentStatus" NOT NULL DEFAULT 'PROCESSING',
    "chunkCount" INTEGER NOT NULL DEFAULT 0,
    "errorMsg" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rag_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mcp_servers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "endpoint" TEXT NOT NULL,
    "authType" TEXT NOT NULL DEFAULT 'none',
    "icon" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mcp_servers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_mcp" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "mcpServerId" TEXT NOT NULL,
    "authConfig" JSONB NOT NULL DEFAULT '{}',
    "toolsAllowed" JSONB NOT NULL DEFAULT '[]',

    CONSTRAINT "agent_mcp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "skills" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "skillMd" TEXT NOT NULL,
    "icon" TEXT,
    "version" TEXT NOT NULL DEFAULT '1.0.0',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "skills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_skills" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,
    "config" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "agent_skills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_channels" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "channelType" "ChannelType" NOT NULL,
    "channelConfig" JSONB NOT NULL DEFAULT '{}',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_channels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_sessions" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "channelType" TEXT NOT NULL DEFAULT 'webchat',
    "sessionKey" TEXT NOT NULL,
    "lastActive" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "agent_rag_agentId_key" ON "agent_rag"("agentId");

-- CreateIndex
CREATE UNIQUE INDEX "agent_mcp_agentId_mcpServerId_key" ON "agent_mcp"("agentId", "mcpServerId");

-- CreateIndex
CREATE UNIQUE INDEX "agent_skills_agentId_skillId_key" ON "agent_skills"("agentId", "skillId");

-- CreateIndex
CREATE UNIQUE INDEX "agent_channels_agentId_channelType_key" ON "agent_channels"("agentId", "channelType");

-- CreateIndex
CREATE UNIQUE INDEX "chat_sessions_sessionKey_key" ON "chat_sessions"("sessionKey");

-- AddForeignKey
ALTER TABLE "agents" ADD CONSTRAINT "agents_gatewayId_fkey" FOREIGN KEY ("gatewayId") REFERENCES "gateways"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agents" ADD CONSTRAINT "agents_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_rag" ADD CONSTRAINT "agent_rag_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "agents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rag_documents" ADD CONSTRAINT "rag_documents_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "agents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_mcp" ADD CONSTRAINT "agent_mcp_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "agents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_mcp" ADD CONSTRAINT "agent_mcp_mcpServerId_fkey" FOREIGN KEY ("mcpServerId") REFERENCES "mcp_servers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_skills" ADD CONSTRAINT "agent_skills_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "agents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_skills" ADD CONSTRAINT "agent_skills_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "skills"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_channels" ADD CONSTRAINT "agent_channels_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "agents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_sessions" ADD CONSTRAINT "chat_sessions_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "agents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_sessions" ADD CONSTRAINT "chat_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
