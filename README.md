<div align="center">

# Enterprise OpenClaw

**企业级 AI Agent 管理平台 · Enterprise AI Agent Management Platform**

[English](#english) · [中文](#中文)

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-20+-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![pnpm](https://img.shields.io/badge/pnpm-monorepo-f69220?logo=pnpm&logoColor=white)](https://pnpm.io)
[![Docker](https://img.shields.io/badge/Docker-ready-2496ed?logo=docker&logoColor=white)](https://www.docker.com)

</div>

---

## 中文

### 项目简介

Enterprise OpenClaw 是一个面向企业的 AI Agent 全栈管理平台，基于 [OpenClaw Gateway](https://github.com/openclaw) 推理引擎构建。平台提供完整的 Agent 生命周期管理，涵盖知识库（RAG）、工具集成（MCP）、技能管理、多渠道接入以及实时对话等核心功能。

### 功能特性

#### 🤖 Agent 管理
- 可视化创建、配置、管理多个 AI Agent
- 5 步引导式创建向导（基本信息 → 知识库 → MCP 工具 → 技能 → 渠道）
- 支持自定义 Agent 人设（SOUL.md）和长期记忆（AGENTS.md）
- 多模型支持（通过 OpenClaw Gateway 接入）

#### 📚 RAG 知识库
- 支持 PDF、DOCX、TXT 等格式文档上传
- 自动文档解析、切片、向量化（Qdrant 存储）
- 实时处理状态追踪（PROCESSING / READY / FAILED）
- 按 Agent 命名空间隔离的知识库

#### 🛠️ 工具集成
- **MCP（Model Context Protocol）**：从工具注册中心绑定外部工具
- **Skills（技能）**：绑定结构化 Prompt 技能，扩展 Agent 能力
- 支持动态绑定/解绑，实时生效

#### 📡 多渠道接入
- **Web Chat**：内置网页聊天界面，即开即用
- **企业微信（WeCom）**：完整的企业微信应用接入，含回调验证与消息收发
- **钉钉 / 飞书**：即将支持

#### 💬 实时对话
- 基于 Server-Sent Events（SSE）的流式响应
- 支持 Thinking（思考过程）展示
- 工具调用卡片（Tool Call Cards）实时状态更新
- Markdown 渲染（含代码高亮、表格、GFM）
- 支持粘贴图片（预览功能）
- 指数退避自动重连（1s → 2s → 4s → … → 30s）

#### 🔐 安全
- JWT 认证，Token 存储于 httpOnly Cookie
- 中间件层路由保护
- Server 端 API 代理（浏览器无法直接访问后端）
- 基于角色的访问控制（MEMBER / ADMIN）

### 技术栈

| 层级 | 技术 |
|------|------|
| **前端** | Next.js 15 (App Router) · React 19 · TypeScript · Tailwind CSS v4 |
| **后端** | Fastify 5 · TypeScript · Prisma ORM |
| **数据库** | PostgreSQL 16 · Qdrant（向量库）· Redis 7 |
| **AI 接入** | OpenClaw Gateway（WebSocket RPC） |
| **包管理** | pnpm Workspaces（Monorepo） |
| **容器化** | Docker · Docker Compose |
| **UI 组件** | Radix UI · Lucide Icons |

### 项目结构

```
enterprise-openclaw/
├── apps/
│   ├── backend/                 # Fastify API 服务
│   │   ├── src/
│   │   │   ├── agents/          # Agent CRUD + 工作区管理
│   │   │   ├── auth/            # JWT 注册 / 登录
│   │   │   ├── channels/        # 渠道管理（WeCom 等）
│   │   │   ├── chat/            # SSE 流式对话
│   │   │   ├── gateway/         # OpenClaw Gateway 连接池
│   │   │   ├── mcp/             # MCP 工具绑定
│   │   │   ├── rag/             # 文档处理 + 向量检索
│   │   │   └── skills/          # 技能绑定
│   │   └── prisma/              # Schema + 迁移文件
│   └── web/                     # Next.js 前端
│       └── src/
│           ├── app/
│           │   ├── (auth)/      # 登录页
│           │   ├── api/         # 代理路由（proxy + stream）
│           │   ├── chat/        # 独立对话页
│           │   └── dashboard/   # 工作台 + Agent 详情
│           ├── components/
│           │   ├── chat/        # MessageList · InputBar
│           │   └── ui/          # Button · Input · Dialog 等
│           └── hooks/
│               ├── use-agent-stream.ts  # SSE + 自动重连
│               └── use-chat.ts          # 对话状态管理
├── packages/
│   └── shared/                  # 共享类型定义
├── docker-compose.yml
├── DEPLOYMENT.md                # 详细部署文档
└── README.md
```

### 快速开始

#### 前置要求
- Node.js 20+、pnpm 9+、Docker Desktop

#### 一键启动（开发环境）

```bash
# 1. 克隆
git clone https://github.com/hliu5049/saasclaw.git
cd saasclaw

# 2. 安装依赖
pnpm install

# 3. 启动基础设施
docker compose up -d postgres qdrant redis

# 4. 配置后端环境变量
cp apps/backend/.env.example apps/backend/.env
# 编辑 apps/backend/.env，设置 JWT_SECRET 等

# 5. 初始化数据库
cd apps/backend && pnpm exec prisma migrate deploy && cd ../..

# 6. 配置前端
echo "BACKEND_URL=http://localhost:3001" > apps/web/.env.local

# 7. 启动服务
PORT=3001 pnpm --filter @enterprise-openclaw/backend dev &
pnpm --filter @enterprise-openclaw/web dev
```

访问 **http://localhost:3000** 注册账号开始使用。

#### 生产部署（Docker）

```bash
# 配置生产密钥
echo "JWT_SECRET=your-strong-secret" > .env

# 构建并启动全栈
docker compose up -d --build
```

详见 [DEPLOYMENT.md](./DEPLOYMENT.md)。

### API 概览

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/api/auth/register` | 注册 |
| `POST` | `/api/auth/login` | 登录，返回 JWT |
| `GET` | `/api/agents` | Agent 列表 |
| `POST` | `/api/agents` | 创建 Agent |
| `GET` | `/api/agents/:id` | Agent 详情 |
| `PATCH` | `/api/agents/:id` | 更新 Agent |
| `POST` | `/api/agents/:id/rag/documents` | 上传文档 |
| `GET` | `/api/agents/:id/channels` | 渠道列表 |
| `PUT` | `/api/agents/:id/channels/:type` | 配置渠道 |
| `POST` | `/api/chat/:agentId/send` | 发送消息 |
| `GET` | `/api/chat/:agentId/stream` | SSE 流式接收 |
| `GET` | `/api/chat/:agentId/history` | 历史消息 |
| `DELETE` | `/api/chat/:agentId/session` | 重置会话 |

---

## English

### Overview

Enterprise OpenClaw is a full-stack enterprise AI Agent management platform built on top of the [OpenClaw Gateway](https://github.com/openclaw) inference engine. It provides complete Agent lifecycle management including RAG knowledge bases, tool integration (MCP), skill management, multi-channel delivery, and real-time streaming chat.

### Features

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

### Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | Next.js 15 (App Router) · React 19 · TypeScript · Tailwind CSS v4 |
| **Backend** | Fastify 5 · TypeScript · Prisma ORM |
| **Databases** | PostgreSQL 16 · Qdrant (vector) · Redis 7 |
| **AI Gateway** | OpenClaw Gateway (WebSocket RPC) |
| **Package Manager** | pnpm Workspaces (Monorepo) |
| **Containerization** | Docker · Docker Compose |
| **UI Components** | Radix UI · Lucide Icons |

### Project Structure

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

### Quick Start

#### Prerequisites
- Node.js 20+, pnpm 9+, Docker Desktop

#### Development

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

#### Production (Docker)

```bash
# Set production secrets
echo "JWT_SECRET=your-strong-secret" > .env

# Build and start the full stack
docker compose up -d --build
```

See [DEPLOYMENT.md](./DEPLOYMENT.md) for the complete guide.

### API Reference

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

### License

[MIT](LICENSE)
