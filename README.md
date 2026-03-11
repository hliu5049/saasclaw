<div align="center">

# Enterprise OpenClaw

**Enterprise AI Agent Management Platform**

[中文版](./README.zh-CN.md)

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-20+-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![pnpm](https://img.shields.io/badge/pnpm-monorepo-f69220?logo=pnpm&logoColor=white)](https://pnpm.io)
[![Docker](https://img.shields.io/badge/Docker-ready-2496ed?logo=docker&logoColor=white)](https://www.docker.com)

</div>

## Overview

Enterprise OpenClaw is a full-stack enterprise AI Agent management platform built on top of the [OpenClaw Gateway](https://github.com/openclaw) inference engine. It provides complete Agent lifecycle management including RAG knowledge bases, tool integration (MCP), skill management, multi-channel delivery, and real-time streaming chat.

## Features

#### 🤖 Agent Management
- Create, configure, and manage multiple AI Agents visually
- 5-step guided creation wizard (Basic Info → Knowledge Base → MCP Tools → Skills → Channels)
- Custom Agent persona (SOUL.md) and long-term memory (AGENTS.md)
- Multi-model support via OpenClaw Gateway

#### 📚 RAG Knowledge Base
- Upload PDF, DOCX, and TXT documents
- Automatic parsing, chunking, and vectorization (stored in Qdrant)
- Real-time processing status (PROCESSING / READY / FAILED)
- Per-agent namespace isolation

#### 🛠️ Tool Integration
- **MCP (Model Context Protocol)**: Bind external tools from a registry
- **Skills**: Attach structured Prompt skills to extend Agent capabilities
- Dynamic bind/unbind with immediate effect

#### 📡 Multi-Channel Delivery
- **Web Chat**: Built-in browser chat interface, zero configuration
- **WeChat Work (WeCom)**: Full enterprise WeChat integration with callback verification and message relay
- **DingTalk / Feishu**: Coming soon

#### 💬 Real-time Chat
- Streaming responses via Server-Sent Events (SSE)
- Thinking-block display (chain-of-thought visibility)
- Tool Call Cards with live loading → done state transitions
- Markdown rendering (code highlighting, tables, GFM)
- Paste-image preview support
- Exponential-backoff auto-reconnect (1s → 2s → 4s → … → 30s)

#### 🔐 Security
- JWT authentication stored in httpOnly cookies
- Middleware-level route protection
- Server-side API proxy (browser never reaches the backend directly)
- Role-based access control (MEMBER / ADMIN)

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | Next.js 15 (App Router) · React 19 · TypeScript · Tailwind CSS v4 |
| **Backend** | Fastify 5 · TypeScript · Prisma ORM |
| **Databases** | PostgreSQL 16 · Qdrant (vector) · Redis 7 |
| **AI Gateway** | OpenClaw Gateway (WebSocket RPC) |
| **Package Manager** | pnpm Workspaces (Monorepo) |
| **Containerization** | Docker · Docker Compose |
| **UI Components** | Radix UI · Lucide Icons |

## Project Structure

```
enterprise-openclaw/
├── apps/
│   ├── backend/                 # Fastify API server
│   │   ├── src/
│   │   │   ├── agents/          # Agent CRUD + workspace management
│   │   │   ├── auth/            # JWT register / login
│   │   │   ├── channels/        # Channel management (WeCom etc.)
│   │   │   ├── chat/            # SSE streaming chat
│   │   │   ├── gateway/         # OpenClaw Gateway connection pool
│   │   │   ├── mcp/             # MCP tool bindings
│   │   │   ├── rag/             # Document processing + vector search
│   │   │   └── skills/          # Skill bindings
│   │   └── prisma/              # Schema + migration files
│   └── web/                     # Next.js frontend
│       └── src/
│           ├── app/
│           │   ├── (auth)/      # Login page
│           │   ├── api/         # Proxy routes (proxy + stream)
│           │   ├── chat/        # Standalone chat page
│           │   └── dashboard/   # Workbench + Agent detail
│           ├── components/
│           │   ├── chat/        # MessageList · InputBar
│           │   └── ui/          # Button · Input · Dialog etc.
│           └── hooks/
│               ├── use-agent-stream.ts  # SSE + auto-reconnect
│               └── use-chat.ts          # Chat state management
├── packages/
│   └── shared/                  # Shared type definitions
├── docker-compose.yml
├── DEPLOYMENT.md                # Detailed deployment guide
└── README.md
```

## Quick Start

### Prerequisites

- Node.js 20+, pnpm 9+, Docker Desktop

### Development

```bash
# 1. Clone
git clone https://github.com/hliu5049/saasclaw.git
cd saasclaw

# 2. Install dependencies
pnpm install

# 3. Start infrastructure
docker compose up -d postgres qdrant redis

# 4. Configure backend
cp apps/backend/.env.example apps/backend/.env
# Edit apps/backend/.env — set JWT_SECRET at minimum

# 5. Run database migrations
cd apps/backend && pnpm exec prisma migrate deploy && cd ../..

# 6. Configure frontend
echo "BACKEND_URL=http://localhost:3001" > apps/web/.env.local

# 7. Start services
PORT=3001 pnpm --filter @enterprise-openclaw/backend dev &
pnpm --filter @enterprise-openclaw/web dev
```

Open **http://localhost:3000**, register an account, and start using the platform.

### Production (Docker)

```bash
# Set production secrets
echo "JWT_SECRET=your-strong-secret" > .env

# Build and start the full stack
docker compose up -d --build
```

See [DEPLOYMENT.md](./DEPLOYMENT.md) for the complete guide.

## API Reference

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/auth/register` | Register a new user |
| `POST` | `/api/auth/login` | Login, returns JWT |
| `GET` | `/api/agents` | List agents |
| `POST` | `/api/agents` | Create agent |
| `GET` | `/api/agents/:id` | Get agent detail |
| `PATCH` | `/api/agents/:id` | Update agent |
| `POST` | `/api/agents/:id/rag/documents` | Upload document |
| `GET` | `/api/agents/:id/channels` | List channels |
| `PUT` | `/api/agents/:id/channels/:type` | Configure channel |
| `POST` | `/api/chat/:agentId/send` | Send message |
| `GET` | `/api/chat/:agentId/stream` | SSE stream |
| `GET` | `/api/chat/:agentId/history` | Chat history |
| `DELETE` | `/api/chat/:agentId/session` | Reset session |

## License

[MIT](LICENSE)
