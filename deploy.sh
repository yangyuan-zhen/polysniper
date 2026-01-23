#!/bin/bash

# 停止脚本执行如果出现错误
set -e

echo "🚀 开始部署流程 (CI/CD Mode)..."

# 1. 拉取最新代码 (主要为了获取最新的 docker-compose.yml 和 .env 配置)
echo "📥 正在拉取最新配置..."
git pull origin main

# 2. 拉取最新镜像 (从 GitHub Container Registry)
echo "⬇️ 正在拉取最新镜像..."
docker compose pull

# 3. 启动容器
echo "🚀 正在启动容器..."
docker compose up -d --remove-orphans

# 4. 清理未使用的镜像
echo "🧹 清理旧镜像..."
docker image prune -f

echo "✅ 部署完成！"
