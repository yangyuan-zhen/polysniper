# PolySniper 项目总结

## 📌 项目概述

**PolySniper** 是一个 NBA 赛事套利监控平台，实时监控 ESPN 赔率和 Polymarket 预测市场之间的价格差异，帮助用户发现套利机会。

### 核心功能
- ✅ **实时数据整合**：ESPN 比赛数据 + Polymarket 预测市场价格
- ✅ **WebSocket 实时推送**：毫秒级价格更新
- ✅ **套利机会检测**：自动计算价格差异和潜在收益
- ✅ **伤病信息追踪**：实时显示球员伤病状态

---

## 🏗️ 技术架构

### 前端
- **框架**: React + TypeScript
- **样式**: TailwindCSS
- **构建**: Vite
- **通信**: Socket.IO Client

### 后端
- **运行时**: Node.js + TypeScript
- **框架**: Express
- **实时通信**: Socket.IO
- **WebSocket**: ws (Polymarket 实时数据)
- **代理**: https-proxy-agent (访问 Polymarket)

### 数据源
1. **ESPN API** (比赛、赔率、伤病)
   - REST API 轮询（5-30秒动态调整）
   - 提供比赛基础信息、MoneyLine 赔率、球员伤病

2. **Polymarket API**
   - **Gamma API** (REST): 市场列表、市场详情（仅初始化使用）
   - **CLOB WebSocket**: 实时价格推送（无需认证）⚡
   - 提供预测市场价格、订单簿数据
   - **注意**: 价格 100% 通过 WebSocket 获取，不使用 REST API 轮询

---

## 📊 数据流程

```
┌─────────────┐         ┌──────────────────┐
│  ESPN API   │         │  Polymarket      │
│  (REST)     │         │  Gamma API (REST)│ ← 获取市场列表（初始化）
└──────┬──────┘         └────────┬─────────┘
       │                         │
       │ 2-30s 轮询              │ 一次性查询
       │ (比赛、赔率、伤病)       │
       │                         ↓
       │                  ┌──────────────────┐
       │                  │ CLOB WebSocket   │ ← 实时价格推送 ⚡
       │                  │  (ws-subscriptions)│
       │                  └────────┬─────────┘
       │                           │
       │                           │ < 1秒延迟
       │                           │ (服务器推送)
       ↓                           ↓
┌──────────────────────────────────────────┐
│     dataAggregator.ts (数据聚合)         │
│  - 匹配比赛和市场                          │
│  - 订阅 WebSocket 价格更新                │
│  - 整合多源数据                           │
│  - 计算套利机会                           │
└─────────────┬────────────────────────────┘
              │
              │  Socket.IO (推送给前端)
              ↓
┌──────────────────────────────┐
│     前端 (React)              │
│  - 实时数据展示                │
│  - 套利机会高亮                │
└──────────────────────────────┘
```

**关键**：
- ✅ **Polymarket 价格**: 100% WebSocket 实时推送（无轮询）
- ✅ **市场列表**: REST API 仅在启动时查询一次
- ✅ **ESPN 数据**: REST API 轮询（2-30秒动态调整）

---

## 🔑 关键实现

### 1. WebSocket 实时价格推送

**问题**：Polymarket WebSocket 需要代理访问

**解决方案**：
```typescript
// 使用 https-proxy-agent
const agent = new HttpsProxyAgent('http://127.0.0.1:7890');
this.ws = new WebSocket(wsUrl, {
  agent,
  headers: { /* ... */ }
});
```

**订阅格式**：
```javascript
{
  "type": "market",
  "assets_ids": ["token1", "token2", ...],  // 批量订阅
  "initial_dump": true  // 请求初始快照
}
```

**接收消息类型**：
- `book`: 订单簿快照（初始数据）
- `price_change`: 实时价格变化

### 2. 球队名称匹配（三层漏斗）

**Layer 1 - 范围锁定**：
- 只获取 NBA 相关、active、未关闭的市场
- 通过 `series_id=10345` 和状态过滤

**Layer 2 - 名称锚定**：
- 使用球队映射表 (`nbaTeamMap.ts`)
- 同时匹配主队和客队关键词
- 不区分主客场顺序

**Layer 3 - 时间校验**：
- 确保市场截止时间在比赛开始之后
- 避免匹配到历史市场

### 3. 市场类型筛选

**目标**：只获取整场胜负盘（Moneyline）

**排除规则**：
```typescript
// 排除让分盘、大小分、单节、半场等
const excludeKeywords = [
  'spread', 'handicap', 'points',  // 让分盘
  'total', 'over', 'o/u',          // 大小分
  'quarter', 'half',                // 单节/半场
  'more than', 'less than'          // 让分描述
];

// 特殊处理：避免 'under' 误匹配 'Thunder'
const hasUnder = question.includes('under') && !question.includes('thunder');
```

### 4. 动态更新频率

根据比赛状态自动调整查询频率：

| 比赛状态 | 更新频率 | 说明 |
|---------|---------|------|
| 进行中 (in) | 2秒 | 最高优先级，实时监控 |
| 未开始 (pre) | 5秒 | 等待开赛 |
| 已结束 (post) | 30秒 | 低优先级，等待结算 |

---

## 🛠️ 已解决的关键问题

### 1. WebSocket 连接问题
- ❌ **问题**：`ECONNRESET` 错误
- ✅ **原因**：需要代理访问
- ✅ **解决**：使用 `https-proxy-agent`

### 2. 订阅失败问题
- ❌ **问题**：收到 `INVALID OPERATION` 错误
- ✅ **原因**：单次订阅 token 数量过多
- ✅ **解决**：批量订阅，每批最多 10 个 tokens，间隔 100ms

### 3. Thunder 队名被误排除
- ❌ **问题**：`"Thunder vs. Warriors"` 市场被排除
- ✅ **原因**：`"thunder"` 包含 `"under"`（大小分关键词）
- ✅ **解决**：特殊处理 `under`，排除 `thunder` 队名

### 4. 价格数据不实时
- ❌ **问题**：REST API 轮询延迟高
- ✅ **解决**：使用 WebSocket 实时推送，延迟降至 < 1秒

---

## 📁 项目结构

```
polysniper/
├── client/                    # 前端代码
│   ├── src/
│   │   ├── components/        # React 组件
│   │   ├── hooks/             # 自定义 Hooks
│   │   ├── services/          # API 服务
│   │   └── types/             # TypeScript 类型
│   └── vite.config.ts
│
├── server/                    # 后端代码
│   ├── src/
│   │   ├── config/            # 配置文件
│   │   │   └── nbaTeamMap.ts # 球队映射表
│   │   ├── services/          # 核心服务
│   │   │   ├── espnService.ts        # ESPN 数据服务
│   │   │   ├── polymarketService.ts  # Polymarket 数据服务
│   │   │   ├── dataAggregator.ts     # 数据聚合服务
│   │   │   └── arbitrageEngine.ts    # 套利计算引擎
│   │   ├── types/             # TypeScript 类型
│   │   └── utils/             # 工具函数
│   └── .env.example           # 环境变量示例
│
├── ARCHITECTURE.md            # 架构文档
├── DATA_UPDATE_FLOW.md        # 数据流程文档
├── CHANGELOG.md               # 变更日志
└── README.md                  # 项目说明
```

---

## 🚀 快速开始

### 1. 安装依赖
```bash
npm install
```

### 2. 配置环境变量
```bash
cd server
cp .env.example .env
# 编辑 .env，配置代理地址
```

### 3. 启动开发服务器
```bash
npm run dev
```

### 4. 访问应用
- 前端: http://localhost:5173
- 后端: http://localhost:3000

---

## 🔧 配置说明

### 代理配置
```env
# Polymarket WebSocket 代理（必需）
POLYMARKET_WS_PROXY=http://127.0.0.1:7890

# 是否启用 WebSocket（建议开启）
POLYMARKET_WS_ENABLED=true
```

### WebSocket URL
```env
# CLOB WebSocket 端点
POLYMARKET_WS_URL=wss://ws-subscriptions-clob.polymarket.com/ws/market
```

---

## 📈 性能优化

1. **批量订阅**: 每批最多 10 个 tokens，避免服务器拒绝
2. **动态频率**: 根据比赛状态调整更新频率
3. **数据缓存**: 缓存 Polymarket 市场数据（45秒）和价格数据（10秒）
4. **增量更新**: 只在数据变化时推送给前端

---

## 🎯 未来优化方向

1. **性能优化**
   - [ ] 添加 Redis 缓存层
   - [ ] 实现数据持久化（数据库）
   - [ ] 优化内存使用

2. **功能增强**
   - [ ] 添加用户通知系统（套利机会提醒）
   - [ ] 支持多种套利策略
   - [ ] 历史数据分析和回测

3. **稳定性提升**
   - [ ] WebSocket 断线重连优化
   - [ ] 错误恢复机制
   - [ ] 监控和告警系统

---

## 📝 开发注意事项

1. **代理必需**: Polymarket API 需要代理访问（国内网络）
2. **批量订阅**: 一次性订阅过多 tokens 会被拒绝
3. **队名匹配**: 注意 Thunder/under 等特殊情况
4. **市场筛选**: 仔细过滤让分盘、大小分等非胜负盘市场
5. **时间校验**: 确保市场截止时间在比赛开始之后

---

## 📞 联系方式

如有问题，请查看项目文档或提交 Issue。
