# 🚀 快速启动指南

## 📋 前置要求

- Node.js 20+
- pnpm
- PostgreSQL
- Redis
- Google OAuth 凭据

## ⚡ 5 分钟快速启动

### 1. 配置 Google OAuth（2分钟）

1. 访问 https://console.cloud.google.com/
2. 创建项目 → APIs & Services → Credentials
3. 创建 OAuth 2.0 Client ID
4. 配置授权来源：`http://localhost:5173`
5. 复制 Client ID 和 Secret

### 2. 配置环境变量（1分钟）

```bash
# 后端配置
cat > apps/backend/.env << EOF
DATABASE_URL="postgresql://openclaw:openclaw_dev@localhost:5432/enterprise_openclaw?schema=public"
REDIS_URL="redis://localhost:6379"
QDRANT_URL="http://localhost:6333"
JWT_SECRET="your-super-secret-jwt-key-$(openssl rand -hex 32)"
GOOGLE_CLIENT_ID="your-google-client-id.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
OPENCLAW_GATEWAY_URL="ws://127.0.0.1:18789"
OPENCLAW_WORKSPACE_ROOT="/tmp/openclaw-workspaces"
EOF

# 前端配置
cat > apps/web/.env << EOF
VITE_API_URL=http://localhost:3001
VITE_GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
EOF
```

### 3. 安装依赖（1分钟）

```bash
pnpm install
```

### 4. 运行数据库迁移（30秒）

```bash
./scripts/migrate.sh
```

### 5. 启动服务（30秒）

```bash
# 终端 1 - 后端
OPENCLAW_GATEWAY_URL=ws://127.0.0.1:18789 pnpm --filter @enterprise-openclaw/backend dev

# 终端 2 - 前端
pnpm --filter @enterprise-openclaw/web dev
```

### 6. 访问应用

打开浏览器访问：http://localhost:5173

点击 "Sign in with Google" 登录！

## 🎯 核心功能

### ✅ 已实现
- Google OAuth 登录
- 模型管理（CRUD）
- Agent 管理（CRUD）
- Dashboard 统计
- 实时数据更新
- Toast 通知

### 🚧 待实现
- Agent 详情页
- Settings 页面
- Agent 启动/停止
- 实时状态更新

## 📚 详细文档

- [前后端集成指南](./FRONTEND_BACKEND_INTEGRATION.md)
- [API 集成完成文档](./API_INTEGRATION_COMPLETE.md)
- [部署脚本说明](./scripts/)

## 🐛 常见问题

### Q: CORS 错误？
A: 确保后端配置了正确的 CORS 来源

### Q: Google 登录失败？
A: 检查 Client ID 是否正确，授权来源是否包含 `http://localhost:5173`

### Q: 数据库连接失败？
A: 确保 PostgreSQL 正在运行，DATABASE_URL 正确

### Q: 前端无法连接后端？
A: 检查 VITE_API_URL 是否正确，后端是否在运行

## 💡 提示

- 使用 `./scripts/logs.sh backend` 查看后端日志
- 使用 `./scripts/logs.sh web` 查看前端日志
- 使用 `./scripts/stop-dev.sh` 停止所有服务
- 使用 `./scripts/deploy.sh` 一键部署（拉取代码 + 迁移 + 重启）

## 🎉 开始使用

1. 登录后，先添加一个模型（Models 页面）
2. 然后创建一个 Agent（Agents 页面）
3. 在 Dashboard 查看统计信息

祝你使用愉快！🚀
