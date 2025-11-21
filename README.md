# 🎯 PolySniper

> NBA 预测市场实时监控与交易策略工具

![PolySniper](./src/assets/1.png)
**PolySniper** 是一个专为 [Polymarket](https://polymarket.com) NBA 比赛预测市场设计的实时监控系统，通过整合多源数据提供智能交易信号。

## ✨ 核心功能

### 📊 实时数据监控
- **WebSocket 价格推送**：毫秒级延迟，实时追踪 Polymarket 市场价格变化
- **比赛实时比分**：30秒更新，获取虎扑 API 比赛数据
- **ESPN 胜率预测**：
  - 赛前：基于博彩赔率计算胜率预测
  - 赛中：实时 Win Probability 动态更新
- **伤病信息**：实时查看球队伤病报告

### 🎯 智能交易策略
基于**价格 + 比分 + 时间 + ESPN胜率**四重因素分析：

- **🟢 强买入信号**：价格低估 + 小幅落后 + 时间充裕 → 双音提醒 🔔🔔
- **🔴 强卖出信号**：价格过高 + 大幅领先 → 单音提醒 🔔
- **置信度评分**：每个信号都有置信度评估（50-100%）

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

### 配置代理
确保 Clash 或其他代理工具的**系统代理**已开启（Polymarket API 需要）。

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
- **Polymarket API** - 预测市场价格
- **Polymarket WebSocket** - 实时价格推送
- **虎扑 API** - NBA 比赛数据
- **ESPN API** - 胜率预测、伤病信息

---

## 📖 文档

- [📊 SIGNALS_GUIDE.md](./SIGNALS_GUIDE.md) - 交易信号详解
- [🔌 WEBSOCKET.md](./WEBSOCKET.md) - WebSocket 实现原理
- [📋 PRD.md](./PRD.md) - 产品需求文档

---

## 🎨 界面预览

### 比赛卡片颜色
- 🟢 **绿色**：主队价格 ≥ 60¢（市场看好主队）
- 🔴 **红色**：主队价格 ≤ 40¢（市场看好客队）
- ⚪ **灰色**：价格 40-60¢（势均力敌）

### 交易信号
- 🟢 **强买入**：价格低 + 小幅落后 + 时间充裕 → 🔔🔔
- 🔴 **强卖出**：价格高 + 大幅领先 → 🔔

---

## ⚙️ 项目结构

```
src/
├── components/          # React 组件
│   ├── MatchCard.tsx   # 比赛卡片
│   ├── SignalCard.tsx  # 信号卡片
│   ├── TeamInfoModal.tsx # 球队详情弹窗
│   └── PriceChart.tsx  # 价格趋势图
├── services/           # API 服务
│   ├── api.ts         # Polymarket API
│   ├── espn.ts        # ESPN API (胜率/伤病)
│   ├── strategy.ts    # 交易策略算法
│   └── websocket.ts   # WebSocket 连接
├── store/             # Redux 状态管理
│   └── signalsSlice.ts
└── App.tsx            # 主应用
```

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
