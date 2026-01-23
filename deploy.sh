#!/bin/bash

# 停止脚本执行如果出现错误
set -e

echo "🚀 开始部署流程..."

# 1. 拉取最新代码
echo "📥 正在拉取最新代码..."
git pull origin main

# 2. 单独构建镜像（使用host网络模式解决网络问题）
echo "🏗️ 正在构建 server 镜像..."
docker build --network=host -t polysniper-server -f Dockerfile.server .

echo "🏗️ 正在构建 client 镜像..."
docker build --network=host -t polysniper-client -f Dockerfile.client .

# 3. 启动容器（不需要再构建）
echo "🚀 正在启动容器..."
docker compose up -d --remove-orphans

# 3. 清理未使用的镜像（释放磁盘空间）
echo "🧹 清理旧镜像..."
docker image prune -f

echo "✅ 部署完成！"
