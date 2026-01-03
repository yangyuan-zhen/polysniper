# 📚 PolySniper 文档总览

> NBA 套利监控平台 - 完整文档索引

## 🏗️ 项目架构文档

### 核心文档
- **[README.md](./README.md)** - 项目概览和快速开始 ⭐ **推荐**
- **[docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)** - 系统架构设计
- **[docs/PRICE_GUIDE.md](./docs/PRICE_GUIDE.md)** - Bid/Ask/Mid 价格详解
- **[CHANGELOG.md](./CHANGELOG.md)** - 版本更新记录

### 专业文档
- **[docs/PRICE_USAGE_SUMMARY.md](./docs/PRICE_USAGE_SUMMARY.md)** - 价格使用规范
- **[docs/WEBSOCKET_LIMITS.md](./docs/WEBSOCKET_LIMITS.md)** - WebSocket 最佳实践

---

## 🎯 前端文档 (client/)

- **[client/README.md](./client/README.md)** - 前端应用介绍
- **[client/SIGNALS_GUIDE.md](./client/SIGNALS_GUIDE.md)** - 套利信号详解
- **[client/DOCS_INDEX.md](./client/DOCS_INDEX.md)** - 前端文档索引

---

## 🔧 后端文档 (server/)

### 核心文档
- **[server/README.md](./server/README.md)** - 后端服务介绍 ⭐
- **[server/API.md](./server/API.md)** - REST API & WebSocket 接口
- **[server/TEAM_MAPPINGS.md](./server/TEAM_MAPPINGS.md)** - NBA 球队映射

### 专业文档
- **[server/docs/PRICE_RETRIEVAL.md](./server/docs/PRICE_RETRIEVAL.md)** - 价格获取指南
- **[server/docs/WEBSOCKET.md](./server/docs/WEBSOCKET.md)** - WebSocket 连接指南
- **[server/docs/PUBLIC_API_MODE.md](./server/docs/PUBLIC_API_MODE.md)** - 公共 API 模式

---

## 🤖 Paper Trading 模拟仓

### 核心策略
- **EV+ 模型**：ESPN胜率 - Polymarket Ask价格 > 10% 才买入
- **Q1-Q3 策略**：只在前三节交易，避免第四节赌博逻辑
- **混合离场策略**：获利了结(25%) + 逻辑证伪 + 硬止损(50%)

### 技术实现
- **自动买入**：套利信号触发时使用10%仓位
- **真实价格模拟**：买入用Ask，卖出用Bid，包含滑点
- **实时监控**：每次价格更新都检查离场条件

---

## 🚀 快速导航

### 新用户
1. **[README.md](./README.md)** - 了解项目功能和安装
2. **[client/SIGNALS_GUIDE.md](./client/SIGNALS_GUIDE.md)** - 学习套利策略
3. **[docs/PRICE_GUIDE.md](./docs/PRICE_GUIDE.md)** - 理解价格体系

### 开发者
1. **[docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)** - 系统架构
2. **[server/API.md](./server/API.md)** - API 接口文档
3. **[shared/types/index.ts](./shared/types/index.ts)** - 类型定义

### 交易者
1. **Paper Trading 模拟仓** - 自动执行套利策略
2. **混合离场策略** - 智能风险控制
3. **实时 Bid/Ask 显示** - 精确交易成本

---

## 📊 项目特点

- ⚡ **毫秒级实时更新** - WebSocket 推送
- 🎯 **专注 NBA 市场** - Polymarket 独家支持
- 🤖 **自动化交易** - Paper Trading 模拟仓
- 💰 **真实价格模拟** - 包含滑点和交易成本
- 📈 **数据可视化** - ESPN 胜率曲线
- 🔄 **多源整合** - ESPN + Polymarket 数据

---

## 🔐 环境要求

- Node.js 18+
- TypeScript 5.7+
- HTTP 代理（国内访问 Polymarket）

---

**📞 联系方式**: yhrsc30@gmail.com
**📄 许可证**: ISC License
