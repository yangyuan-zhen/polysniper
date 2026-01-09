# PolySniper VPS 部署指南

本指南将帮助你在 VPS (Virtual Private Server) 上使用 Docker 部署 PolySniper。

## 📋 前置要求

1.  **VPS 服务器**：建议 Ubuntu 20.04/22.04 LTS。
2.  **Docker & Docker Compose**：必须已安装。

### 安装 Docker (Ubuntu)

```bash
# 更新源
sudo apt update
sudo apt install -y curl

# 安装 Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# 启动 Docker
sudo systemctl start docker
sudo systemctl enable docker

# 安装 Docker Compose (如果未包含在 Docker 中)
sudo apt install -y docker-compose-plugin
```

## 🚀 部署步骤

### 1. 获取代码

将代码上传到 VPS，或者使用 git 克隆：

```bash
git clone <your-repo-url> polysniper
cd polysniper
```

### 2. 配置环境变量

在项目根目录创建 `.env` 文件。你可以基于 `server/.env.example` 创建：

```bash
# 复制示例配置
cp server/.env.example .env

# 编辑配置
nano .env
```

**关键配置修改**：

*   **POLYMARKET_WS_PROXY**: 如果你的 VPS 在国外（可以直接访问 Polymarket），请设置为 `none` 或留空。
*   **NODE_ENV**: 设置为 `production`。
*   **REDIS_ENABLED**: 推荐设置为 `true`（docker-compose 已包含 Redis）。

示例 `.env` 内容：

```env
PORT=3000
NODE_ENV=production

# VPS 通常不需要代理
POLYMARKET_WS_PROXY=none

# WebSocket 配置
POLYMARKET_WS_ENABLED=true
POLYMARKET_WS_URL=wss://ws-subscriptions-clob.polymarket.com/ws/market

# Redis (Docker 内部连接)
REDIS_ENABLED=true
REDIS_URL=redis://redis:6379

# CORS (允许前端访问)
CORS_ORIGIN=*
```

### 3. 启动服务

使用 Docker Compose 构建并启动所有服务：

```bash
# 构建并后台启动
sudo docker compose up -d --build
```

> 注意：如果是旧版 Docker Compose，命令可能是 `sudo docker-compose up -d --build`

### 4. 验证部署

查看容器状态：

```bash
sudo docker compose ps
```

查看日志：

```bash
# 查看所有日志
sudo docker compose logs -f

# 查看后端日志
sudo docker compose logs -f server
```

### 5. 访问应用

*   **前端**: `http://<你的VPS_IP>`
*   **后端 API**: `http://<你的VPS_IP>:3000`

## 🔄 更新部署

当代码有更新时：

```bash
# 拉取最新代码
git pull

# 重新构建并重启
sudo docker compose up -d --build
```

## 🛠️ 常见问题

### 1. WebSocket 连接失败
*   检查 VPS 防火墙是否开放了 3000 端口（后端）和 80 端口（前端）。
*   检查 `.env` 中的 `POLYMARKET_WS_PROXY` 是否正确设置（国外 VPS 应设为 `none`）。

### 2. 数据库持久化
*   SQLite 数据库文件存储在 Docker 卷 `server_data` 中，重启容器不会丢失数据。
*   Redis 数据存储在 `redis_data` 卷中。

### 3. 端口冲突
*   如果 80 或 3000 端口被占用，请修改 `docker-compose.yml` 中的端口映射。
