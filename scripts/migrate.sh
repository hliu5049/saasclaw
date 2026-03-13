#!/bin/bash
# 数据库迁移脚本

set -e

echo "🔄 Running database migrations..."

cd "$(dirname "$0")/.."

# 进入后端目录
cd apps/backend

# 运行迁移
echo "📦 Deploying migrations..."
npx prisma migrate deploy

# 生成 Prisma Client
echo "🔧 Generating Prisma Client..."
npx prisma generate

echo "✅ Migrations completed successfully!"
