#!/bin/bash
# 开发模式启动脚本

set -e

cd "$(dirname "$0")/.."

# 检查环境变量
if [ -z "$OPENCLAW_GATEWAY_URL" ]; then
  export OPENCLAW_GATEWAY_URL="ws://127.0.0.1:18789"
fi

echo "🚀 Starting development servers..."
echo "📍 Gateway URL: $OPENCLAW_GATEWAY_URL"

# 停止已存在的 screen 会话
screen -S backend -X quit 2>/dev/null || true
screen -S web -X quit 2>/dev/null || true

# 启动后端
echo "🔧 Starting backend..."
screen -S backend -dm bash -c "OPENCLAW_GATEWAY_URL=$OPENCLAW_GATEWAY_URL pnpm --filter @enterprise-openclaw/backend dev"

# 等待后端启动
sleep 3

# 启动前端
echo "🎨 Starting web..."
screen -S web -dm bash -c "pnpm --filter @enterprise-openclaw/web dev"

echo ""
echo "✅ Services started!"
echo ""
echo "📊 View logs:"
echo "  Backend: screen -r backend"
echo "  Web:     screen -r web"
echo ""
echo "🛑 Stop services:"
echo "  ./scripts/stop-dev.sh"
echo ""
echo "💡 Detach from screen: Ctrl+A then D"
