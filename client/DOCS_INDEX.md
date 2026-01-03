# 📚 PolySniper 前端文档索引

## 核心文档
- **[README.md](./README.md)** - 前端应用概览和功能介绍 ⭐
- **[SIGNALS_GUIDE.md](./SIGNALS_GUIDE.md)** - 套利信号和 Paper Trading 详解 ⭐

## 开发相关
- **[package.json](./package.json)** - 项目依赖和脚本
- **[vite.config.ts](./vite.config.ts)** - Vite 构建配置
- **[tsconfig.json](./tsconfig.json)** - TypeScript 配置

---

## 🎯 快速导航

### 新用户入门
1. 阅读 [README.md](./README.md) 了解前端功能
2. 查看 [SIGNALS_GUIDE.md](./SIGNALS_GUIDE.md) 学习套利策略和模拟交易
3. 查看根目录 [README.md](../README.md) 了解完整系统架构

### 开发者
1. 了解 React 19 + TypeScript + TailwindCSS 技术栈
2. 查看 `src/components/` 目录了解组件结构
3. 参考 WebSocket 连接和实时数据处理逻辑

### 关键组件
- **MatchCard.tsx** - 比赛卡片，显示 Bid/Ask 价格
- **WinProbChart.tsx** - ESPN 胜率曲线图
- **SignalAlert.tsx** - 套利信号提醒

---

## 📊 技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| React | 19 | 前端框架 |
| TypeScript | 5.7 | 类型安全 |
| Vite | 7 | 构建工具 |
| TailwindCSS | 4 | 样式框架 |
| Recharts | - | 图表库 |
| Socket.IO | - | WebSocket 客户端 |
