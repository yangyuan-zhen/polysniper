# PolySniper 架构文档

## 📊 系统概述

PolySniper 是一个 NBA 比赛套利交易系统，通过对比 ESPN 实时胜率和 Polymarket 市场价格，发现并执行套利机会。

---

## 🏗️ 核心架构

### 数据流

```
ESPN API (比分+胜率)  ──┐
                        ├──> DataAggregator ──> ArbitrageEngine ──> PaperTradingService
Polymarket WS (价格)  ──┘                              │
                                                        ├──> WebSocket Server
                                                        │
                                                        └──> Frontend
```

---

## 💰 价格体系（重要！）

### Polymarket 价格类型

| 价格类型 | 含义 | 用途 | 获取来源 |
|---------|------|------|----------|
| **Mid Price** | 中间价 `(Bid + Ask) / 2` | 前端显示、市值估值 | WebSocket `book` 事件 |
| **Bid（买价）** | 最高买入价 | **卖出时收到的价格** | `bids[0].price` / `best_bid` |
| **Ask（卖价）** | 最低卖出价 | **买入时支付的价格** | `asks[0].price` / `best_ask` |

### 价格使用原则

```typescript
// ✅ 正确的价格使用
套利信号计算: 使用 Ask 价格（模拟真实买入成本）
Paper Trading 买入: 使用 Ask 价格（实际支付）
Paper Trading 卖出: 使用 Bid 价格（实际收到）
持仓盈亏估值: 使用 Mid 价格（市值参考）
前端显示: 使用 Mid 价格（用户友好）
```

### WebSocket 事件类型

Polymarket CLOB WebSocket 提供三种价格相关事件：

#### 1. `price_change` 事件（最常用）

**触发**：订单簿变化时
**包含**：`best_bid` 和 `best_ask` 字段 ⭐

```json
{
  "event_type": "price_change",
  "price_changes": [{
    "asset_id": "0x123...",
    "price": "0.855",        // 某个价格档位
    "best_bid": "0.85",      // ⭐ 最高买价
    "best_ask": "0.86",      // ⭐ 最低卖价
    "side": "BUY"
  }]
}
```

#### 2. `book` 事件（订阅时）

**触发**：首次订阅或大额成交
**包含**：完整 `bids` 和 `asks` 数组 📖

```json
{
  "event_type": "book",
  "asset_id": "0x123...",
  "bids": [
    {"price": "0.85", "size": "100"},
    {"price": "0.84", "size": "50"}
  ],
  "asks": [
    {"price": "0.86", "size": "120"},
    {"price": "0.87", "size": "80"}
  ],
  "last_trade_price": "0.855"
}
```

#### 3. `last_trade_price` 事件（实际成交）

**触发**：真实交易发生
**包含**：实际成交价和数量 💰

```json
{
  "event_type": "last_trade_price",
  "asset_id": "0x123...",
  "price": "0.855",         // 实际成交价
  "size": "50",             // 成交数量
  "side": "BUY"
}
```

**使用建议**：
- ✅ 优先使用 `price_change` 的 `best_bid/best_ask`
- ✅ `book` 事件用于获取完整订单簿
- ℹ️ `last_trade_price` 仅作参考

---

## 🤖 套利引擎（ArbitrageEngine）

### 核心理念：赚"情绪溢价"

我们赚的是散户对早期比分波动的过度反应。

### 铁律：只做前三节（Q1-Q3）

```
✅ Q1-Q3: 时间充裕，数学模型准确（投资逻辑）
❌ Q4/OT: 运气主导，模型失效（赌博逻辑）
```

### EV+ 决策模型

```typescript
// ⭐ 关键：使用 best_ask（买入价），不是 mid_price
利润空间 = ESPN胜率 - Polymarket best_ask

if (利润空间 > 10%) {
  // 市场犯错了，买入被低估的一方
  执行买入 @best_ask 价格
}

// 平仓时使用 best_bid（卖出价）
实际盈亏 = (数量 × best_bid) - (数量 × best_ask)
```

**为什么用 Ask 而不是 Mid？**
- ✅ Ask 是买入时**实际支付**的价格
- ❌ Mid 只是参考价，不能真正以此价格买入
- 💡 用 Mid 计算会高估利润空间，导致亏损交易

### 示例

```
场景：Q1，强队落后 10 分

市场情况：
- Bid: $0.38（卖价）
- Ask: $0.40（买价）⭐ 我们关注这个
- Mid: $0.39（参考）

- 散户情绪："完了，输定了！" → 恐慌抛售 → Ask价格 40¢
- ESPN模型："只是方差，翻盘概率 65%" → 胜率坚挺

套利计算：
利润空间 = 65% - 40% (Ask) = 25% ✅ 触发买入信号
买入成本 = 100份 × $0.40 = $40

比赛结束，强队逆转获胜：
卖出收入 = 100份 × $0.98 (Bid) = $98
实际盈亏 = $98 - $40 = $58 (+145%)
```

---

## 💼 Paper Trading（模拟交易）

### 账户设置

```typescript
初始资金: $1000 USDC
仓位管理: 每次使用 10% 资金
风险控制: 同一 Token 不重复买入
```

### 自动交易流程

```
1. 发现套利信号 (利润空间 > 10%)
   ↓
2. 检查余额和重复持仓
   ↓
3. 计算买入数量 = (余额 * 10%) / Ask价格
   ↓
4. 创建订单并扣除余额
   ↓
5. 记录持仓
   ↓
6. 实时更新浮盈浮亏（使用 Mid 价格）
   ↓
7. 比赛结束自动平仓（使用 Bid 价格）
```

### 买卖价格使用

```typescript
// 买入
const cost = quantity * bestAsk;  // 支付 Ask 价格（更贵）

// 持仓估值
const marketValue = quantity * midPrice;  // 使用 Mid 价格

// 卖出
const revenue = quantity * bestBid;  // 收到 Bid 价格（更便宜）
```

### 盈亏计算

```typescript
// 买入成本
entryCost = 100 * $0.86 = $86.00  // Ask 价格

// 卖出收入
exitRevenue = 100 * $0.95 = $95.00  // Bid 价格

// 实际盈亏
profit = $95.00 - $86.00 = $9.00  // +10.47%

// 注意：买卖价差（Spread）会减少利润
spread = Ask - Bid = $0.86 - $0.85 = $0.01 (1¢)
```

---

## 📡 数据更新策略

### 缓存策略

```typescript
// ❌ 实时数据 - 绝对不缓存
比分、比赛时间、ESPN 胜率、Polymarket 价格

// ✅ 静态数据 - 长效缓存（24小时）
今日比赛列表、Token ID、Market ID、Team Mapping
```

### 更新频率

```
ESPN API: 每 3 秒请求一次（节流）
Polymarket WebSocket: 被动接收，实时处理
Frontend WebSocket: 每 500ms 推送一次
```

---

## 🎯 前端显示

### MatchCard 组件

```typescript
// ESPN 胜率曲线图
- 显示赛前 → 当前的胜率变化
- 鼠标悬停显示具体胜率
- Y轴：0% - 100%
- X轴：赛前 → 当前

// Polymarket 价格
- 显示 Mid 价格（用户友好）
- 买卖价差信息（可选）
- 实时更新（WebSocket）
```

### 套利信号显示

```typescript
🎯 LA Clippers ESPN85.2% vs 市场50.0% 利润空间35.2% (Edge 35.2%)
```

**注意**：前端显示的利润空间使用 Mid 价格计算，实际交易使用 Ask 价格。

---

## 🔍 调试与日志

### 关键日志

```bash
# WebSocket 价格更新
📖 订单簿 [69300978...]: Mid=$0.8550, Bid=$0.8500, Ask=$0.8600

# 套利信号
发现 1 个套利信号 [401136-1-123456]
  - BUY_HOME: 🎯 LA Clippers ESPN85.2% vs 市场50.0% 利润空间35.2%

# Paper Trading
✅ [Paper Trading] 买入 LA Clippers x11.63 @$0.8600 (Ask价，成本: $10.00)
   订单ID: ORD000001, 置信度: 95.0%, 余额: $990.00

# 平仓
🔒 [Paper Trading] 平仓 LA Clippers @$0.9500
   盈亏: $10.47 (+121.88%), 余额: $1010.47
```

---

## ⚠️ 已知限制

### 1. 价格精度
- Mid 价格用于显示和估值
- Ask 价格用于买入成本计算
- Bid 价格用于卖出收入计算
- 买卖价差（Spread）会影响实际盈亏

### 2. 市场流动性
- Ask/Bid 价格可能因流动性不足而偏离
- 大单可能无法按订单簿顶部价格成交

### 3. 时间延迟
- ESPN 数据有 3 秒节流
- WebSocket 推送有网络延迟
- 前端刷新有 500ms 间隔

---

## 🚀 未来优化

1. **动态仓位管理**：根据置信度调整仓位大小
2. **止损机制**：浮亏达到阈值时自动平仓
3. **历史回测**：使用历史数据验证策略效果
4. **多市场支持**：扩展到其他体育赛事

---

## 📚 相关文档

- [API 文档](./API.md)
- [部署指南](./DEPLOYMENT.md)
- [常见问题](./FAQ.md)
