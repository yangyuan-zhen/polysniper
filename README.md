# 🎯 PolySniper

NBA 预测市场实时监控系统 - 整合 Polymarket、ESPN 和虎扑数据，提供套利信号分析

## 📁 项目结构

```
polysniper/
├── client/          # 前端应用 (React + Vite + TailwindCSS)
├── server/          # 后端服务 (Node.js + Express + WebSocket)
├── package.json     # 根配置文件
└── README.md        # 项目说明
```

## 🚀 快速开始

### 安装依赖

```bash
# 安装所有依赖（根目录 + 前端 + 后端）
npm run install:all
```

### 开发模式

```bash
# 同时启动前后端开发服务器
npm run dev

# 或分别启动
npm run dev:server  # 后端: http://localhost:3000
npm run dev:client  # 前端: http://localhost:5173
```

### 生产构建

```bash
# 构建前后端
npm run build

# 启动生产服务器
npm start
```

## 🔧 技术栈

### 前端
- **框架**: React 19 + TypeScript
- **构建工具**: Vite 7
- **样式**: TailwindCSS 4
- **图表**: Recharts
- **图标**: Lucide React
- **WebSocket**: Socket.IO Client

### 后端
- **运行时**: Node.js + TypeScript
- **框架**: Express
- **WebSocket**: Socket.IO
- **缓存**: Redis (可选)
- **日志**: Winston
- **数据源**: 
  - Polymarket API (价格数据)
  - ESPN API (胜率预测)
  - 虎扑 API (实时比分)

## 📡 API 端点

### REST API
- `GET /health` - 健康检查
- `GET /api/matches` - 获取所有比赛
- `GET /api/matches/:id` - 获取单场比赛
- `GET /api/signals` - 获取套利信号
- `GET /api/stats` - 获取统计信息

### WebSocket
- **连接**: `ws://localhost:3000`
- **事件**:
  - `subscribe` - 订阅比赛更新
  - `unsubscribe` - 取消订阅
  - `matchesUpdate` - 接收比赛更新
  - `signalAlert` - 接收套利信号

详细 API 文档：[server/API.md](./server/API.md)

## 🎨 功能特性

- ✅ **实时数据更新** - WebSocket 每 3 秒推送最新数据
- ✅ **多数据源整合** - Polymarket + ESPN + 虎扑
- ✅ **套利信号分析** - 自动计算价格差异和套利机会
- ✅ **响应式设计** - 适配桌面和移动设备
- ✅ **数据可视化** - 实时图表展示价格走势
- ✅ **智能匹配** - 自动匹配不同平台的球队名称

## 📊 数据更新频率

- **后台采集**: 每 5 秒刷新
- **WebSocket 推送**: 每 3 秒
- **前端轮询**: 按需（主要使用 WebSocket）

## 🔐 环境配置

### 后端 (.env)

```bash
# 服务配置
PORT=3000
NODE_ENV=development

# CORS
CORS_ORIGIN=*

# 限流
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100

# Redis (可选)
REDIS_ENABLED=false
REDIS_HOST=localhost
REDIS_PORT=6379
```

## 📝 开发指南

### 前端开发
```bash
cd client
npm run dev      # 启动开发服务器
npm run build    # 生产构建
npm run lint     # 代码检查
```

### 后端开发
```bash
cd server
npm run dev      # 启动开发服务器
npm run build    # TypeScript 编译
npm run test     # 运行测试
```

## 📦 部署

### 使用 PM2 (推荐)
```bash
cd server
npm run start:pm2
```

### Docker (待实现)
```bash
docker-compose up -d
```

## ⚠️ 注意事项


1. **数据延迟**
   - ESPN 数据: ~5-10 秒延迟
   - 虎扑数据: ~3-5 秒延迟
   - Polymarket: 实时（区块链确认时间）

2. **限流保护**
   - API 请求限制: 100 次/分钟
   - WebSocket 连接无限制

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

ISC License

## 📞 联系方式
yhrsc30@gmail.com

如有问题，请查看：
- [后端 API 文档](./server/API.md)
- [开发文档](./server/docs/DEVELOPMENT.md)
- [WebSocket 说明](./server/docs/WEBSOCKET.md)
