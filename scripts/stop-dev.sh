#!/bin/bash
# 停止开发服务器

cd "$(dirname "$0")/.."

echo "🛑 Stopping development servers..."

# 停止 screen 会话
screen -S backend -X quit 2>/dev/null && echo "✅ Backend stopped" || echo "⚠️  Backend not running"
screen -S web -X quit 2>/dev/null && echo "✅ Web stopped" || echo "⚠️  Web not running"

echo ""
echo "✅ All services stopped"
