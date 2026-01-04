# 🎯 PolySniper

**NBA 赛事套利监控平台** - 实时监控 ESPN 赔率与 Polymarket 预测市场，自动发现套利机会

[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-61dafb)](https://reactjs.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20+-green)](https://nodejs.org/)

> 🌏 **中文** | **[English](./README.md)**

> 📖 **详细文档**: [系统架构](./docs/ARCHITECTURE.md) | [价格指南](./docs/PRICE_GUIDE.md)

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
  - ESPN API (比赛赛程、实时比分、胜率预测、伤病信息)
  - Polymarket API (市场价格数据)

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

## ✨ 核心功能

- ⚡ **毫秒级实时更新** - WebSocket 推送，价格延迟 < 1秒
- 🔄 **多源数据整合** - ESPN 赔率 + Polymarket 预测市场
- 💰 **自动套利检测** - EV+ 模型，利润空间 > 10% 触发
- 🤖 **Paper Trading** - Q1-Q3 价值回归策略，混合离场机制
- 💸 **真实价格模拟** - 买入用 Ask，卖出用 Bid，包含滑点
- 🎯 **智能离场** - 获利了结(25%) + 逻辑证伪 + 硬止损(50%)
- 📊 **数据可视化** - ESPN 风格胜率曲线，交互式悬停
- 🎯 **智能匹配** - 三层漏斗精准匹配球队和市场
- ⏰ **时间控制** - 只做 Q1-Q3，避免第四节赌博逻辑

## 📊 数据更新策略

### 实时数据（不缓存）
- ✅ **比分、时间、ESPN 胜率、Polymarket 价格**
- ESPN: 每 **3秒** 请求一次（节流）
- Polymarket: **WebSocket 实时推送**（被动接收）
- 前端: 每 **500ms** 推送一次

### 静态数据（长效缓存 24小时）
- ✅ **今日比赛列表、Token ID、Market ID、Team Mapping**
- 这些数据在比赛期间不会改变
- 减少 API 请求，提升性能

### 价格体系
| 价格类型 | 用途 | 来源 |
|---------|------|------|
| **Ask（卖价）** | 买入时支付 | `asks[0].price` |
| **Bid（买价）** | 卖出时收到 | `bids[0].price` |
| **Mid（中间价）** | 显示、估值 | `(Bid + Ask) / 2` |

> 💡 详见 [价格使用指南](./docs/PRICE_GUIDE.md)

## 🔐 环境配置

### 后端 (.env)

```bash
# 服务配置
PORT=3000
NODE_ENV=development

# Polymarket WebSocket（⚠️ 国内需要代理！）
POLYMARKET_WS_ENABLED=true
POLYMARKET_WS_URL=wss://ws-subscriptions-clob.polymarket.com/ws/market
POLYMARKET_WS_PROXY=http://127.0.0.1:7890

# CORS
CORS_ORIGIN=*

# Redis (可选)
REDIS_ENABLED=false

# 日志级别（debug 可查看心跳详情）
LOG_LEVEL=info
```

> ⚠️ **重要**: 
> - Polymarket WebSocket 需要 HTTP 代理访问（国内网络）
> - 心跳机制使用 WebSocket 协议层 Ping/Pong（15秒间隔）
> - 详细配置请参考 [server/docs/WEBSOCKET.md](./server/docs/WEBSOCKET.md)

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

## ⚠️ 重要注意事项

1. **代理必需** 🌐
   - Polymarket API 需要代理访问
   - 配置 `POLYMARKET_WS_PROXY` 环境变量

2. **WebSocket 订阅限制** 📡
   - 单次订阅最多 10 个 tokens
   - 批次间隔 100ms
   - 避免 `INVALID OPERATION` 错误

3. **队名特殊处理** 🏀
   - Thunder 队名包含 "under"
   - 需要特殊逻辑避免误排除

4. **数据延迟** ⏱️
   - Polymarket WebSocket: < 1秒
   - ESPN 轮询: 2-30秒（动态调整）

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

ISC License

## 📞 联系方式
yhrsc30@gmail.com

## 📚 文档索引

- 📖 **[README](./README.md)** - 英文主文档
- 📖 **[中文文档](./README.zh-CN.md)** - 中文主文档
- 📡 **[API 接口文档](./server/API.zh-CN.md)** - REST API & WebSocket 接口说明

## 💼 Paper Trading 快速入门

```typescript
// 自动运行，无需配置
初始资金: $1000 USDC
仓位管理: 每次 10% 资金
交易逻辑: 
  - 发现信号 → 自动买入（Ask 价格）
  - 实时盈亏 → 市值估值（Mid 价格）
  - 比赛结束 → 自动平仓（Bid 价格）

// 查看交易记录
监听 WebSocket 事件: paperTradingUpdate
```

**示例日志：**
```
✅ [Paper Trading] 买入 LA Clippers x11.63 @$0.8600 (Ask价，成本: $10.00)
   订单ID: ORD000001, 置信度: 95.0%, 余额: $990.00

🔒 [Paper Trading] 平仓 LA Clippers @$0.9500
   盈亏: $10.47 (+121.88%), 余额: $1010.47
```
