#!/bin/bash

# 停止脚本执行如果出现错误
set -e

echo "🚀 开始部署流程..."

# 1. 拉取最新代码
echo "📥 正在拉取最新代码..."
git pull origin main

# 2. 重新构建并启动容器
# --build: 强制重新构建镜像
# -d: 后台运行
# --remove-orphans: 清理未定义的容器
echo "🏗️ 正在构建并启动容器..."
docker-compose up -d --build --remove-orphans

# 3. 清理未使用的镜像（释放磁盘空间）
echo "🧹 清理旧镜像..."
docker image prune -f

echo "✅ 部署完成！"
