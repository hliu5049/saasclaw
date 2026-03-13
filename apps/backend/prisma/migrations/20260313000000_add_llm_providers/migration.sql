-- CreateEnum
CREATE TYPE "ProviderType" AS ENUM ('ANTHROPIC', 'OPENAI', 'AZURE_OPENAI', 'GOOGLE', 'CUSTOM');

-- CreateTable
CREATE TABLE "llm_providers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "provider" "ProviderType" NOT NULL,
    "apiKey" TEXT NOT NULL,
    "baseUrl" TEXT,
    "models" JSONB NOT NULL DEFAULT '[]',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "llm_providers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "llm_providers_name_key" ON "llm_providers"("name");
