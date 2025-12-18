# PolySniper Backend - 产品需求文档 (PRD)

## 1. 项目概述

### 1.1 项目背景
PolySniper 是一个专为 Polymarket NBA 比赛预测市场设计的实时监控系统。当前前端直接调用 Polymarket API 存在多个限制，需要开发独立的后端服务来解决这些问题。

### 1.2 核心问题
- **CORS 跨域限制**：浏览器安全策略限制直接 WebSocket 连接
- **API Key 管理**：前端无法安全存储 API 密钥
- **请求频率限制**：多个前端实例分别请求，容易触发限流
- **性能优化**：缺乏统一的缓存和请求合并机制

### 1.3 解决方案
开发基于 Node.js 的后端服务，提供：
- WebSocket 代理服务
- REST API 接口
- 数据缓存和合并
- API Key 安全管理
- 请求频率控制

---

## 2. 功能需求

### 2.1 核心功能

#### 2.1.1 Polymarket WebSocket 代理
- 后端统一连接 Polymarket WebSocket
- 实时接收价格更新数据
- 通过 Socket.IO 向前端推送数据
- 自动重连机制
- 连接状态监控

#### 2.1.2 REST API 服务

**市场数据接口**
```
GET /api/markets
功能：获取所有市场数据
参数：
  - status: 可选，筛选状态 (live/upcoming/ended)
  - sport: 可选，运动类型 (basketball)
返回：市场列表及实时价格
```

```
GET /api/markets/:id
功能：获取单个市场详情
参数：
  - id: 市场ID
返回：市场详细信息和价格数据
```

**价格数据接口**
```
GET /api/prices/:tokenId
功能：获取特定 token 的价格数据
参数：
  - tokenId: Token ID
返回：当前价格和历史数据
```

**健康检查接口**
```
GET /health
功能：检查服务状态
返回：服务运行状态和 WebSocket 连接状态
```

#### 2.1.3 数据缓存机制
- **Redis 缓存层**：缓存市场数据和价格信息
- **缓存策略**：
  - 进行中比赛：45 秒缓存
  - 未开始比赛：120 秒缓存
  - 已结束比赛：永久缓存
- **缓存失效**：WebSocket 更新时自动刷新

#### 2.1.4 请求合并优化
- 相同数据的并发请求合并为单次请求
- 防抖机制避免频繁请求
- 请求队列管理

### 2.2 安全功能

#### 2.2.1 API Key 管理
- 环境变量存储 Polymarket API Key
- 前端请求不暴露密钥
- API Key 轮换支持

#### 2.2.2 访问控制
- CORS 配置白名单
- API 请求频率限制 (Rate Limiting)
- 可选的 JWT 身份验证

#### 2.2.3 错误处理
- 统一错误响应格式
- 详细的日志记录
- 错误告警机制

---

## 3. 技术架构

### 3.1 技术栈
- **运行环境**：Node.js 18+
- **Web 框架**：Express.js
- **实时通信**：Socket.IO
- **WebSocket 客户端**：ws
- **缓存**：Redis (可选，降级为内存缓存)
- **HTTP 客户端**：axios
- **环境变量**：dotenv
- **日志**：winston
- **进程管理**：PM2 (生产环境)

### 3.2 系统架构

```
┌─────────────┐
│   前端应用   │
│  (React)    │
└──────┬──────┘
       │
       │ HTTP/WebSocket
       │
┌──────▼──────────────────────────┐
│      后端服务 (Node.js)          │
│  ┌─────────────────────────┐   │
│  │   Express REST API      │   │
│  └─────────────────────────┘   │
│  ┌─────────────────────────┐   │
│  │   Socket.IO Server      │   │
│  └─────────────────────────┘   │
│  ┌─────────────────────────┐   │
│  │   缓存层 (Redis/Memory) │   │
│  └─────────────────────────┘   │
│  ┌─────────────────────────┐   │
│  │   WebSocket Client      │   │
│  └─────────────────────────┘   │
└──────┬──────────────────────────┘
       │
       │ WebSocket
       │
┌──────▼──────┐
│  Polymarket │
│     API     │
└─────────────┘
```

### 3.3 数据流

**实时价格更新流程**
1. 后端连接 Polymarket WebSocket
2. 接收价格更新消息
3. 更新缓存数据
4. 通过 Socket.IO 广播给所有连接的前端
5. 前端更新 UI 显示

**REST API 请求流程**
1. 前端发送 HTTP 请求
2. 后端检查缓存
3. 命中：直接返回缓存数据
4. 未命中：调用 Polymarket API
5. 更新缓存
6. 返回数据给前端

---

## 4. 接口设计

### 4.1 WebSocket 事件

**客户端 → 服务端**
```javascript
// 订阅市场更新
socket.emit('subscribe', { marketIds: ['market1', 'market2'] })

// 取消订阅
socket.emit('unsubscribe', { marketIds: ['market1'] })
```

**服务端 → 客户端**
```javascript
// 价格更新
socket.on('priceUpdate', (data) => {
  // data: { tokenId, price, timestamp, volume }
})

// 市场状态变更
socket.on('marketStatusChange', (data) => {
  // data: { marketId, status, timestamp }
})

// 连接状态
socket.on('connectionStatus', (data) => {
  // data: { connected: boolean, message: string }
})
```

### 4.2 REST API 响应格式

**成功响应**
```json
{
  "success": true,
  "data": { ... },
  "timestamp": "2024-01-01T00:00:00.000Z",
  "cached": false
}
```

**错误响应**
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "错误描述",
    "details": { ... }
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

---

## 5. 部署方案

### 5.1 环境变量配置
```env
# 服务配置
PORT=3000
NODE_ENV=production

# Polymarket API
POLYMARKET_API_KEY=your_api_key_here
POLYMARKET_WS_URL=wss://ws-subscriptions-clob.polymarket.com/ws/market
POLYMARKET_API_URL=https://clob.polymarket.com

# Redis 配置 (可选)
REDIS_URL=redis://localhost:6379
REDIS_ENABLED=false

# CORS 配置
CORS_ORIGIN=http://localhost:5173

# 缓存配置
CACHE_TTL_LIVE=45
CACHE_TTL_UPCOMING=120
CACHE_TTL_ENDED=86400

# 限流配置
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100

# 日志配置
LOG_LEVEL=info
```

### 5.2 部署步骤

**开发环境**
```bash
npm install
npm run dev
```

**生产环境**
```bash
npm install --production
npm run build
npm start
```

**使用 PM2 部署**
```bash
pm2 start ecosystem.config.js
pm2 save
```

### 5.3 Docker 部署
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

---

## 6. 性能指标

### 6.1 性能目标
- API 响应时间：< 100ms (缓存命中)
- WebSocket 延迟：< 500ms
- 并发连接数：支持 1000+ 同时连接
- 请求吞吐量：1000+ req/s

### 6.2 监控指标
- API 请求成功率
- 平均响应时间
- WebSocket 连接数
- 缓存命中率
- 错误率
- 服务器资源使用率

---

## 7. 开发计划

### Phase 1：基础框架 (1-2天)
- [x] 项目初始化和依赖配置
- [ ] Express 服务器搭建
- [ ] 基础路由和中间件
- [ ] 日志系统集成
- [ ] 错误处理机制

### Phase 2：核心功能 (2-3天)
- [ ] Polymarket WebSocket 客户端
- [ ] Socket.IO 服务端实现
- [ ] 数据转发逻辑
- [ ] REST API 端点实现
- [ ] 缓存层实现

### Phase 3：优化和测试 (2天)
- [ ] 请求合并优化
- [ ] 性能测试和调优
- [ ] 单元测试
- [ ] 集成测试

### Phase 4：部署和文档 (1天)
- [ ] Docker 配置
- [ ] PM2 配置
- [ ] API 文档
- [ ] 部署文档

---

## 8. 风险和挑战

### 8.1 技术风险
- **WebSocket 连接稳定性**：需要实现可靠的重连机制
- **数据一致性**：确保缓存和实时数据的一致性
- **高并发处理**：需要优化性能以支持大量并发连接

### 8.2 解决方案
- 实现指数退避重连策略
- 缓存失效机制和版本控制
- 使用 Redis 和负载均衡优化并发能力
- 实现降级策略，Redis 不可用时使用内存缓存

---

## 9. 未来扩展

- [ ] 支持多个交易所 (不仅限于 Polymarket)
- [ ] 历史数据存储和分析
- [ ] 用户自定义告警系统
- [ ] 交易信号推送服务
- [ ] GraphQL API 支持
- [ ] 管理后台界面
- [ ] 集群部署和负载均衡
