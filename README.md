# 🎯 PolySniper

> NBA 预测市场实时监控与交易策略工具

![PolySniper](./src/assets/1.png)
**PolySniper** 是一个专为 [Polymarket](https://polymarket.com) NBA 比赛预测市场设计的实时监控系统，通过整合多源数据提供智能交易信号。

## ✨ 核心功能

### 📊 实时数据监控
- **价格实时更新**：
  - WebSocket直连：浏览器直接连接 Polymarket WebSocket，< 1秒实时更新
  - REST API轮询：30秒自动更新作为备份（可通过环境变量切换）
  - 智能延迟：随机0-5秒初始延迟，避免并发请求导致资源耗尽
- **比赛实时比分**：30秒更新，获取虎扑 API 比赛数据
- **ESPN 胜率预测**：
  - 赛前：基于博彩赔率计算，永久缓存（localStorage持久化）
  - 赛中：实时 Win Probability 动态更新
  - 双显示：比赛进行中同时显示实时胜率和赛前预测作为参考
- **伤病信息**：实时查看球队伤病报告

### 🎯 智能交易策略
基于**价格 + 比分 + 时间 + ESPN胜率**四重因素分析：

- **🟢 强队抄底策略**：
  - 使用**赛前ESPN胜率**判断强队（>65%）
  - 当强队价格低于赛前预期时，即使暂时落后也识别为买入机会
  - 考虑时间因素：比赛早期机会更大
- **🔴 领先套现策略**：价格过高 + 大幅领先 → 卖出信号
- **置信度评分**：每个信号都有置信度评估（50-100%）
- **静音模式**：提示音已禁用，通过UI和控制台日志提示

### 📈 数据可视化
- **价格趋势图**：Chart.js 绘制实时价格走势
- **信号历史**：完整记录所有交易信号
- **比赛筛选**：按状态（进行中/未开始/已结束）快速过滤

---

## 🚀 快速开始

### 前置要求
- Node.js 18+
- VPN/Clash（访问 Polymarket API）

### 安装
```bash
# 克隆项目
git clone <repository-url>
cd polysniper

# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

### 环境变量配置

创建 `.env` 文件：

```bash
# Clash 代理配置（访问 Polymarket 需要）
HTTP_PROXY=http://127.0.0.1:7890
HTTPS_PROXY=http://127.0.0.1:7890

# WebSocket 开关
# true = 启用WebSocket实时更新 (< 1秒延迟)
# false = 仅使用REST API轮询 (30秒延迟)
VITE_ENABLE_WEBSOCKET=true
```

**注意**：确保 Clash 或其他代理工具的**系统代理**已开启。

---

## 🏗️ 技术栈

### 前端框架
- **React 18** + **TypeScript**
- **Vite** - 快速开发构建
- **Redux Toolkit** - 状态管理

### UI 组件
- **TailwindCSS** - 样式框架
- **Lucide React** - 图标库
- **Chart.js** - 图表可视化

### 数据源
- **Polymarket WebSocket** - 实时价格推送（< 1秒延迟）
  - 官方地址：`wss://ws-subscriptions-clob.polymarket.com/ws/market`
  - 浏览器直连，不通过Vite代理（WebSocket不受CORS限制）
  - 订阅消息格式：`{"type": "market", "assets_ids": [...]}`
  - 支持订单簿、价格变化、交易三种消息类型
- **Polymarket REST API** - 价格数据备份（30秒轮询）
- **虎扑 API** - NBA 比赛数据（30秒更新）
- **ESPN API** - 胜率预测、伤病信息

---

## 📖 文档

- [📚 DOCS_INDEX.md](./DOCS_INDEX.md) - **文档索引总览** ⭐
- [🔧 TROUBLESHOOTING.md](./TROUBLESHOOTING.md) - **故障排除指南** 🆕
- [📝 CHANGELOG.md](./CHANGELOG.md) - **项目更新日志** 🆕
- [📊 SIGNALS_GUIDE.md](./SIGNALS_GUIDE.md) - 交易信号详解
- [📋 PRD.md](./PRD.md) - 产品需求文档
- [📡 WEBSOCKET_STATUS.md](./WEBSOCKET_STATUS.md) - WebSocket实现状态

---

## 🎨 界面预览

### 比赛卡片颜色
- 🟢 **绿色**：主队价格 ≥ 60¢（市场看好主队）
- 🔴 **红色**：主队价格 ≤ 40¢（市场看好客队）
- ⚪ **灰色**：价格 40-60¢（势均力敌）

### 交易策略信号
- 🟢 **强买入**：价格低 + 小幅落后 + 胜率支持（≥50%或≥45%）→ 抄底时机
- 🟢 **买入**：价格合适 + 有反弹空间 + 基本胜率（≥45%或≥40%）
- 🔴 **强卖出**：价格高 + 大幅领先 → 套现时机
- 🔴 **卖出**：领先但价格未达理想点
- ⚪ **观望**：无明确信号或胜率不支持

---

## ⚙️ 项目结构

```
src/
├── components/                 # React 组件
│   ├── MatchCard.tsx          # 比赛卡片（核心组件）
│   ├── StrategySignalCard.tsx # 策略信号卡片
│   ├── SignalLog.tsx          # 信号历史记录
│   ├── ColorGuide.tsx         # 颜色指南
│   ├── Header.tsx             # 顶部导航
│   └── TeamInfoModal.tsx      # 球队详情弹窗（伤病信息）
├── services/                   # API 服务
│   ├── api.ts                 # Polymarket REST API
│   ├── polymarketWebSocket.ts # WebSocket客户端 ⭐
│   ├── espn.ts                # ESPN API (胜率/伤病)
│   └── strategy.ts            # 交易策略算法（强队抄底）
├── contexts/                   # Context API
│   └── SignalContext.tsx      # 信号全局状态管理
├── types/                      # TypeScript 类型定义
│   └── index.ts               # 统一类型导出
├── App.tsx                     # 主应用
└── main.tsx                    # 应用入口
```

**关键文件说明**：
- `polymarketWebSocket.ts` - WebSocket客户端，处理实时价格推送
- `strategy.ts` - 核心策略逻辑，包含强队抄底算法
- `MatchCard.tsx` - 单个比赛卡片，整合所有数据和信号
- `SignalContext.tsx` - 全局信号管理，信号聚合和筛选

---

## 🔧 开发命令

```bash
# 开发模式
npm run dev

# 构建生产版本
npm run build

# 预览生产构建
npm run preview

# 代码检查
npm run lint
```

---

## ⚠️ 免责声明

本工具仅供学习和研究使用，不构成任何投资建议。

- 预测市场具有风险，交易需谨慎
- 信号算法基于历史数据，无法保证未来收益
- 建议小额测试，验证策略有效性
- 请遵守当地法律法规

---

## 📝 License

MIT

---

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！
