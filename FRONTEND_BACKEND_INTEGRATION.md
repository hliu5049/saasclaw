# 前后端集成指南

## 📋 概述

本文档说明如何将新的 React + Vite 前端与 Fastify 后端集成，并实现 Google OAuth 登录。

## 🏗️ 架构

```
┌─────────────────┐         ┌──────────────────┐         ┌─────────────────┐
│   React SPA     │────────▶│  Fastify API     │────────▶│   PostgreSQL    │
│  (Port 5173)    │  HTTP   │  (Port 3001)     │         │                 │
└─────────────────┘         └──────────────────┘         └─────────────────┘
        │                            │
        │                            │
        ▼                            ▼
┌─────────────────┐         ┌──────────────────┐
│  Google OAuth   │         │  OpenClaw        │
│                 │         │  Gateway         │
└─────────────────┘         └──────────────────┘
```

## 🔐 Google OAuth 配置

### 1. 创建 Google OAuth 应用

1. 访问 [Google Cloud Console](https://console.cloud.google.com/)
2. 创建新项目或选择现有项目
3. 启用 "Google+ API"
4. 创建 OAuth 2.0 凭据：
   - 应用类型：Web 应用
   - 授权的 JavaScript 来源：
     - `http://localhost:5173` (开发环境)
     - `https://your-domain.com` (生产环境)
   - 授权的重定向 URI：
     - `http://localhost:5173` (开发环境)
     - `https://your-domain.com` (生产环境)

5. 获取 Client ID 和 Client Secret

### 2. 配置环境变量

**后端 (`apps/backend/.env`):**
```bash
# 数据库
DATABASE_URL="postgresql://openclaw:openclaw_dev@localhost:5432/enterprise_openclaw?schema=public"
REDIS_URL="redis://localhost:6379"
QDRANT_URL="http://localhost:6333"

# JWT
JWT_SECRET="your-super-secret-jwt-key-change-in-production"

# SMTP (用于 OTP 登录，可选)
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_SECURE="false"
SMTP_USER="your-email@gmail.com"
SMTP_PASS="your-app-password"
SMTP_FROM="AI Agent Manager <your-email@gmail.com>"

# Google OAuth
GOOGLE_CLIENT_ID="your-google-client-id.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="your-google-client-secret"

# OpenClaw Gateway
OPENCLAW_GATEWAY_URL="ws://127.0.0.1:18789"
OPENCLAW_WORKSPACE_ROOT="/tmp/openclaw-workspaces"
```

**前端 (`apps/web/.env`):**
```bash
# 后端 API 地址
VITE_API_URL=http://localhost:3001

# Google OAuth Client ID
VITE_GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
```

## 🚀 启动步骤

### 开发环境

**1. 启动后端服务：**
```bash
cd ~/saasclaw

# 运行数据库迁移
./scripts/migrate.sh

# 启动后端
OPENCLAW_GATEWAY_URL=ws://127.0.0.1:18789 pnpm --filter @enterprise-openclaw/backend dev
```

**2. 启动前端服务：**
```bash
# 新开一个终端
cd ~/saasclaw

# 启动前端
pnpm --filter @enterprise-openclaw/web dev
```

**3. 访问应用：**
- 前端：http://localhost:5173
- 后端 API：http://localhost:3001

### 生产环境

**使用 Docker Compose：**
```bash
cd ~/saasclaw

# 构建并启动
docker-compose up -d --build

# 查看日志
docker-compose logs -f
```

## 📡 API 端点

### 认证相关

| 方法 | 端点 | 描述 |
|------|------|------|
| POST | `/api/auth/google` | Google OAuth 登录 |
| POST | `/api/auth/send-otp` | 发送 OTP 验证码 |
| POST | `/api/auth/verify-otp` | 验证 OTP 并登录 |
| POST | `/api/auth/login` | 密码登录（管理员） |
| GET | `/api/auth/me` | 获取当前用户信息 |

### 模型管理

| 方法 | 端点 | 描述 |
|------|------|------|
| GET | `/api/llm-providers` | 获取所有模型 |
| POST | `/api/llm-providers` | 创建模型 |
| PUT | `/api/llm-providers/:id` | 更新模型 |
| DELETE | `/api/llm-providers/:id` | 删除模型 |

### Agent 管理

| 方法 | 端点 | 描述 |
|------|------|------|
| GET | `/api/agents` | 获取所有 Agent |
| POST | `/api/agents` | 创建 Agent |
| GET | `/api/agents/:id` | 获取 Agent 详情 |
| PUT | `/api/agents/:id` | 更新 Agent |
| DELETE | `/api/agents/:id` | 删除 Agent |

## 🔒 认证流程

### Google OAuth 流程

```
1. 用户点击 "Sign in with Google"
   ↓
2. Google 弹出登录窗口
   ↓
3. 用户授权后，Google 返回 credential (JWT)
   ↓
4. 前端发送 credential 到后端 /api/auth/google
   ↓
5. 后端验证 Google token
   ↓
6. 后端查找或创建用户
   ↓
7. 后端生成 JWT token
   ↓
8. 前端保存 token 到 localStorage
   ↓
9. 前端使用 token 访问受保护的 API
```

### JWT Token 使用

所有受保护的 API 请求都需要在 Header 中携带 token：

```
Authorization: Bearer <your-jwt-token>
```

Token 有效期：7 天

## 🔧 前端状态管理

### Zustand Stores

**1. Auth Store (`store/auth.ts`)**
- 管理用户登录状态
- 存储用户信息
- 处理登录/登出

**2. Models Store (`store/models.ts`)**
- 管理模型列表
- CRUD 操作
- 需要连接后端 API

**3. Agents Store (`store/agents.ts`)**
- 管理 Agent 列表
- CRUD 操作
- 需要连接后端 API

## 📝 待办事项

### 前端

- [ ] 将 Models Store 连接到后端 API
- [ ] 将 Agents Store 连接到后端 API
- [ ] 实现 Agent 详情页
- [ ] 实现 Settings 页面
- [ ] 添加错误边界
- [ ] 添加加载状态
- [ ] 优化移动端体验

### 后端

- [x] 添加 Google OAuth 支持
- [ ] 添加 CORS 配置
- [ ] 添加 Rate Limiting
- [ ] 优化错误响应格式
- [ ] 添加 API 文档 (Swagger)

## 🐛 常见问题

### 1. CORS 错误

如果遇到 CORS 错误，确保后端已配置 CORS：

```typescript
// apps/backend/src/server.ts
await app.register(cors, {
  origin: ['http://localhost:5173', 'https://your-domain.com'],
  credentials: true,
})
```

### 2. Google OAuth 不工作

检查：
- Google Client ID 是否正确配置
- 授权的 JavaScript 来源是否包含当前域名
- 浏览器控制台是否有错误信息

### 3. Token 过期

Token 默认 7 天过期，过期后需要重新登录。可以实现 refresh token 机制来自动刷新。

## 📚 参考资料

- [Google Identity Services](https://developers.google.com/identity/gsi/web)
- [Fastify JWT](https://github.com/fastify/fastify-jwt)
- [Zustand](https://github.com/pmndrs/zustand)
- [React Router](https://reactrouter.com/)
