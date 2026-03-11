# Enterprise OpenClaw — 部署文档

## 目录

1. [架构概览](#1-架构概览)
2. [环境要求](#2-环境要求)
3. [本地开发部署](#3-本地开发部署)
4. [生产 Docker 部署](#4-生产-docker-部署)
5. [环境变量参考](#5-环境变量参考)
6. [Nginx 反向代理（可选）](#6-nginx-反向代理可选)
7. [升级与回滚](#7-升级与回滚)
8. [常见问题](#8-常见问题)

---

## 1. 架构概览

```
┌─────────────────────────────────────────────────────────┐
│                      用户浏览器                          │
└──────────────────────────┬──────────────────────────────┘
                           │ :80 / :443
                    ┌──────▼──────┐
                    │    Nginx    │  (可选反代)
                    └──────┬──────┘
              ┌────────────┴────────────┐
              │ :3000                   │ :3001
       ┌──────▼──────┐          ┌──────▼──────┐
       │  Next.js    │─────────▶│  Fastify    │
       │  (web)      │ 内网      │  (backend)  │
       └─────────────┘          └──────┬──────┘
                                       │
              ┌────────────────────────┼──────────────┐
              │                        │              │
       ┌──────▼──────┐   ┌─────────────▼──┐   ┌──────▼──────┐
       │ PostgreSQL  │   │    Qdrant      │   │    Redis    │
       │  :5432      │   │  :6333/:6334   │   │   :6379     │
       └─────────────┘   └────────────────┘   └─────────────┘
```

| 服务 | 职责 |
|------|------|
| **web** (Next.js 15) | 前端页面、SSE 代理、API 代理（httpOnly Cookie → JWT） |
| **backend** (Fastify) | REST API、Agent 管理、Chat、RAG、MCP、渠道管理 |
| **PostgreSQL 16** | 主数据库（用户、Agent、会话、文档元数据） |
| **Qdrant** | 向量数据库（RAG 知识库检索） |
| **Redis 7** | 消息队列 / 会话缓存 |
| **OpenClaw Gateway** | AI 推理网关（WebSocket RPC，需单独部署） |

---

## 2. 环境要求

### 本地开发
| 工具 | 最低版本 |
|------|---------|
| Node.js | 20+ |
| pnpm | 9+ |
| Docker Desktop | 4.x |
| Git | 2.x |

### 生产服务器
| 资源 | 最低配置 | 推荐配置 |
|------|---------|---------|
| CPU | 2 核 | 4 核 |
| 内存 | 4 GB | 8 GB |
| 磁盘 | 20 GB | 50 GB SSD |
| 系统 | Ubuntu 22.04 / Debian 12 | 同左 |
| Docker | 24+ | 同左 |
| Docker Compose | 2.x | 同左 |

---

## 3. 本地开发部署

### 3.1 克隆仓库

```bash
git clone https://github.com/hliu5049/saasclaw.git
cd saasclaw
```

### 3.2 安装依赖

```bash
# 安装 pnpm（如未安装）
npm install -g pnpm

# 安装所有工作区依赖
pnpm install
```

### 3.3 启动基础设施

```bash
# 启动 PostgreSQL、Qdrant、Redis
docker compose up -d postgres qdrant redis

# 等待 healthy（约 15 秒）
docker compose ps
```

### 3.4 配置后端环境变量

```bash
cp apps/backend/.env.example apps/backend/.env
```

编辑 `apps/backend/.env`，至少修改以下字段：

```env
JWT_SECRET=your-strong-random-secret-here
OPENCLAW_WORKSPACE_ROOT=/tmp/openclaw-workspaces   # 或绝对路径
```

### 3.5 初始化数据库

```bash
# 生成 Prisma Client（首次克隆或 schema 变更后必须执行）
pnpm --filter @enterprise-openclaw/backend exec prisma generate

# 应用数据库迁移
pnpm --filter @enterprise-openclaw/backend exec prisma migrate deploy

# 可选：导入种子数据
pnpm --filter @enterprise-openclaw/backend exec prisma db seed
```

### 3.6 配置前端环境变量

```bash
echo "BACKEND_URL=http://localhost:3001" > apps/web/.env.local
```

### 3.7 启动服务

```bash
# 后台启动后端，等待 3 秒再启动前端（确保 backend 先就绪）
PORT=3001 pnpm --filter @enterprise-openclaw/backend dev &
sleep 3 && pnpm --filter @enterprise-openclaw/web dev
```

或者开两个终端分别运行：

```bash
# 终端 1：后端
PORT=3001 pnpm --filter @enterprise-openclaw/backend dev

# 终端 2：前端
pnpm --filter @enterprise-openclaw/web dev
```

访问 **http://localhost:3000**，注册账号后即可使用。

---

## 4. 生产 Docker 部署

### 4.1 服务器初始化

```bash
# Ubuntu / Debian
sudo apt update && sudo apt install -y docker.io docker-compose-plugin git

# 将当前用户加入 docker 组（免 sudo）
sudo usermod -aG docker $USER && newgrp docker
```

### 4.2 克隆代码

```bash
git clone https://github.com/hliu5049/saasclaw.git
cd saasclaw
```

### 4.3 配置生产环境变量

创建 `.env` 文件（放在 monorepo 根目录，供 docker-compose 读取）：

```bash
cat > .env << 'EOF'
# ── 必填 ──────────────────────────────────────────────────────
JWT_SECRET=请替换为至少32位的随机字符串

# ── OpenClaw 推理网关 ──────────────────────────────────────────
# 如果网关运行在同一台宿主机上：
OPENCLAW_GATEWAY_URL=ws://host.docker.internal:18789
# 如果网关运行在其他机器上：
# OPENCLAW_GATEWAY_URL=ws://192.168.1.100:18789

# ── 可选：企业微信渠道 ────────────────────────────────────────
WECOM_CORP_ID=
WECOM_CORP_SECRET=
WECOM_AGENT_ID=
WECOM_TOKEN=
WECOM_ENCODING_AES_KEY=
EOF
```

> **安全提示**：`.env` 已加入 `.dockerignore`，不会被打入镜像；但请确保该文件权限为 `600`：
> ```bash
> chmod 600 .env
> ```

### 4.4 构建并启动

```bash
# 首次部署：构建镜像 + 启动全部服务
docker compose up -d --build

# 查看启动状态
docker compose ps

# 查看日志
docker compose logs -f backend
docker compose logs -f web
```

启动顺序由健康检查控制：

```
postgres + redis  →  backend（自动跑 prisma migrate deploy）  →  web
```

### 4.5 验证部署

```bash
# 后端健康检查
curl http://localhost:3001/health
# 期望返回：{"success":true,"data":{"status":"ok"}}

# 前端是否可访问
curl -I http://localhost:3000
# 期望返回：HTTP/1.1 200 OK 或 307 Redirect
```

访问 **http://your-server-ip:3000** 完成注册登录。

### 4.6 后续更新

```bash
# 拉取最新代码
git pull origin main

# 重新构建并滚动重启（数据库 volume 不受影响）
docker compose up -d --build backend web
```

---

## 5. 环境变量参考

### 5.1 后端（`apps/backend/.env`）

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `PORT` | `3001` | 监听端口 |
| `DATABASE_URL` | — | PostgreSQL 连接串 |
| `REDIS_URL` | `redis://localhost:6379` | Redis 连接串 |
| `QDRANT_URL` | `http://localhost:6333` | Qdrant HTTP 地址 |
| `JWT_SECRET` | `change-me-in-production` | JWT 签名密钥（**生产必须修改**） |
| `OPENCLAW_GATEWAY_URL` | `ws://127.0.0.1:18789` | 推理网关 WebSocket 地址 |
| `OPENCLAW_WORKSPACE_ROOT` | `/var/openclaw/workspaces` | Agent 工作区根目录 |
| `WECOM_CORP_ID` | — | 企业微信 Corp ID（可选） |
| `WECOM_CORP_SECRET` | — | 企业微信 Secret（可选） |
| `WECOM_AGENT_ID` | — | 企业微信应用 AgentId（可选） |
| `WECOM_TOKEN` | — | 企业微信回调 Token（可选） |
| `WECOM_ENCODING_AES_KEY` | — | 企业微信消息加密密钥（可选） |

### 5.2 前端（`apps/web/.env.local`）

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `BACKEND_URL` | `http://localhost:3001` | 后端地址（仅 Next.js Server 端使用） |

> Docker 部署时此变量通过 `docker-compose.yml` 的 `environment` 注入，无需 `.env.local`。

---

## 6. Nginx 反向代理（可选）

如需通过域名 + HTTPS 访问，推荐在前面加一层 Nginx。

### 6.1 安装 Certbot（Let's Encrypt）

```bash
sudo apt install -y nginx certbot python3-certbot-nginx
```

### 6.2 Nginx 配置

创建 `/etc/nginx/sites-available/openclaw`：

```nginx
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate     /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    # 前端
    location / {
        proxy_pass         http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
    }

    # SSE 长连接：关闭缓冲
    location /api/stream/ {
        proxy_pass         http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header   Connection        "";
        proxy_buffering    off;
        proxy_cache        off;
        proxy_read_timeout 3600s;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/openclaw /etc/nginx/sites-enabled/
sudo certbot --nginx -d your-domain.com
sudo nginx -t && sudo systemctl reload nginx
```

---

## 7. 升级与回滚

### 升级

```bash
git pull origin main
docker compose up -d --build backend web
```

数据库迁移由 `backend` 容器启动时自动执行（`prisma migrate deploy`），无需手动干预。

### 回滚

```bash
# 回退到上一个 commit
git checkout HEAD~1

# 重新构建
docker compose up -d --build backend web
```

> 如果新版本包含不可逆的数据库迁移，回滚前请先备份数据库：
> ```bash
> docker compose exec postgres pg_dump -U openclaw enterprise_openclaw > backup_$(date +%Y%m%d).sql
> ```

### 数据备份

```bash
# PostgreSQL 备份
docker compose exec postgres pg_dump -U openclaw enterprise_openclaw \
  | gzip > backup_$(date +%Y%m%d_%H%M%S).sql.gz

# Qdrant 数据目录备份（停服后）
docker run --rm -v enterprise-openclaw_qdrantdata:/data \
  -v $(pwd):/backup alpine tar czf /backup/qdrant_$(date +%Y%m%d).tar.gz /data
```

---

## 8. 常见问题

### Q: `backend` 容器启动失败，日志显示 `No gateway available`

**原因**：OpenClaw 推理网关未启动或地址配置错误。

**解决**：
1. 确认网关进程已运行并监听 `18789` 端口
2. 检查 `.env` 中的 `OPENCLAW_GATEWAY_URL`
3. 若网关在宿主机：`OPENCLAW_GATEWAY_URL=ws://host.docker.internal:18789`
4. Agent 创建操作会正常返回（网关推送是非阻塞的），但 Chat 功能需要网关在线

---

### Q: `prisma migrate deploy` 失败，提示连接数据库超时

**原因**：`backend` 容器在 `postgres` 完全就绪前启动。

**解决**：`docker-compose.yml` 已配置 `depends_on: condition: service_healthy`，通常不会出现此问题。如仍然失败，手动重启：

```bash
docker compose restart backend
```

---

### Q: 前端页面空白或 401 错误

**可能原因**：
- `JWT_SECRET` 与之前签发 token 时不一致（更换了密钥）
- Cookie 未正确设置（需通过 `/login` 页面登录，不能直接访问）

**解决**：清除浏览器 Cookie 后重新登录。

---

### Q: Windows 本地执行 `pnpm build`（web）报 `EPERM symlink` 错误

**原因**：Windows 默认不允许非管理员进程创建符号链接，Next.js standalone 模式依赖此能力。

**解决方案（三选一）**：
1. 开启 Windows **开发者模式**（设置 → 开发者选项 → 开发人员模式）
2. 以管理员身份运行终端
3. 仅在 Docker/Linux 环境中执行 `pnpm build`（推荐用于生产构建）

本地开发使用 `pnpm dev` 不受影响。

---

### Q: 启动后端报错 `@prisma/client did not initialize yet`

**原因**：`pnpm install` 不会自动触发 `prisma generate`，Prisma Client 的原生查询引擎二进制文件未生成。

**解决**：在启动服务前先执行一次生成命令：

```bash
pnpm --filter @enterprise-openclaw/backend exec prisma generate
```

> 凡是**首次克隆**、**切换机器**、**`prisma/schema.prisma` 有改动**、或 **`@prisma/client` 版本升级**后，都需要重新执行此命令。

---

### Q: Next.js 启动时警告 `inferred your workspace root` / `detected multiple lockfiles`

**原因**：服务器 `$HOME` 目录（如 `/root`）存在无关的 `package-lock.json`，Next.js Turbopack 将其误识别为 monorepo 根目录。

**解决**：删除该文件即可（它通常是 npm 全局操作留下的空文件，不影响任何项目）：

```bash
rm -f ~/package-lock.json
```

---

### Q: 如何重置所有数据（清空数据库）

```bash
# 停止并删除所有容器和数据卷（不可恢复！）
docker compose down -v

# 重新启动（会重新初始化数据库并运行迁移）
docker compose up -d --build
```
