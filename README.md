# 🎯 PolySniper

**NBA 赛事套利监控平台** - 实时监控 ESPN 赔率与 Polymarket 预测市场，自动发现套利机会

[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-61dafb)](https://reactjs.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20+-green)](https://nodejs.org/)

> 📖 **详细文档**: [PROJECT_SUMMARY.md](./PROJECT_SUMMARY.md) | [ARCHITECTURE.md](./ARCHITECTURE.md)

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
- 💰 **自动套利检测** - 实时计算价格差异和潜在收益
- 🏥 **伤病信息追踪** - 实时显示球员伤病状态
- 📊 **数据可视化** - 实时图表展示价格走势
- 🎯 **智能匹配** - 三层漏斗精准匹配球队和市场

## 📊 数据更新机制

### Polymarket 价格
- **WebSocket 实时推送** ⚡ 
- 延迟 < 1秒
- 无需轮询，服务器主动推送

### ESPN 比赛信息
- **动态轮询频率**:
  - 🔴 进行中: 2秒/次（实时监控）
  - 🟡 未开始: 5秒/次（等待开赛）
  - 🟢 已结束: 30秒/次（等待结算）

## 🔐 环境配置

### 后端 (.env)

```bash
# 服务配置
PORT=3000
NODE_ENV=development

# Polymarket WebSocket 代理（⚠️ 必需！）
POLYMARKET_WS_PROXY=http://127.0.0.1:7890
POLYMARKET_WS_ENABLED=true
POLYMARKET_WS_URL=wss://ws-subscriptions-clob.polymarket.com/ws/market

# CORS
CORS_ORIGIN=*

# Redis (可选)
REDIS_ENABLED=false
```

> ⚠️ **重要**: Polymarket API 需要代理访问（国内网络环境）

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

- 📋 [项目总结](./PROJECT_SUMMARY.md) - 完整的技术文档
- 🏗️ [架构设计](./ARCHITECTURE.md) - 系统架构和设计决策
- 📊 [数据流程](./DATA_UPDATE_FLOW.md) - 数据更新流程详解
- 📝 [变更日志](./CHANGELOG.md) - 版本更新记录
