#!/bin/bash
# 完整部署脚本（拉取代码 + 迁移 + 重启）

set -e

cd "$(dirname "$0")/.."

echo "🚀 Starting deployment..."

# 1. 拉取代码
echo "📥 Pulling latest code..."
git pull

# 2. 安装依赖
echo "📦 Installing dependencies..."
pnpm install

# 3. 运行迁移
echo "🔄 Running migrations..."
./scripts/migrate.sh

# 4. 构建（如果需要）
# echo "🔨 Building..."
# pnpm build

# 5. 重启服务
echo "🔄 Restarting services..."
./scripts/stop-dev.sh
sleep 2
./scripts/start-dev.sh

echo ""
echo "✅ Deployment completed!"
