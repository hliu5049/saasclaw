#!/bin/bash
# 查看日志脚本

SERVICE=${1:-backend}

case $SERVICE in
  backend|be)
    echo "📊 Viewing backend logs (Ctrl+A then D to detach)..."
    screen -r backend
    ;;
  web|fe)
    echo "📊 Viewing web logs (Ctrl+A then D to detach)..."
    screen -r web
    ;;
  *)
    echo "Usage: ./scripts/logs.sh [backend|web]"
    echo ""
    echo "Available services:"
    screen -ls | grep -E "backend|web" || echo "  No services running"
    ;;
esac
