# 价格使用指南

## 🎯 核心原则

**永远记住：买入付 Ask，卖出收 Bid！**

---

## 📊 价格类型详解

### WebSocket 事件类型说明

Polymarket CLOB WebSocket 提供三种主要事件类型：

#### 1. `price_change` 事件（最常用）✅

**触发时机**：订单簿发生变化时

**包含字段：**
```typescript
{
  event_type: "price_change",
  price_changes: [{
    asset_id: "0x123...",
    price: "0.855",           // 某个价格档位
    size: "100",              // 该档位的新总量
    side: "BUY" | "SELL",     // 买单或卖单
    best_bid: "0.85",         // ⭐ 当前最高买价
    best_ask: "0.86",         // ⭐ 当前最低卖价
    hash: "0xabc..."          // 订单哈希
  }]
}
```

**使用建议**：
- ✅ **优先使用** `best_bid` 和 `best_ask` 字段
- 这两个字段直接给出当前最优价格
- 无需解析完整订单簿

---

#### 2. `book` 事件（订阅时/成交时）📖

**触发时机**：
- 首次订阅时（initial_dump: true）
- 大额成交后

**包含字段：**
```typescript
{
  event_type: "book",
  asset_id: "0x123...",
  bids: [                     // 买单列表（降序）
    {price: "0.85", size: "100"},
    {price: "0.84", size: "50"},
    {price: "0.83", size: "30"}
  ],
  asks: [                     // 卖单列表（升序）
    {price: "0.86", size: "120"},
    {price: "0.87", size: "80"},
    {price: "0.88", size: "60"}
  ],
  last_trade_price: "0.855",  // 最后成交价
  timestamp: 1234567890
}
```

**使用建议**：
- ✅ 从 `bids[0].price` 获取 bestBid
- ✅ 从 `asks[0].price` 获取 bestAsk
- ⚠️ 检查数组是否为空

---

#### 3. `last_trade_price` 事件（实际成交）💰

**触发时机**：真实交易发生时

**包含字段：**
```typescript
{
  event_type: "last_trade_price",
  market: "0xmarket...",
  asset_id: "0x123...",
  price: "0.855",             // 实际成交价
  size: "50",                 // 成交数量
  side: "BUY" | "SELL",       // 买方或卖方成交
  timestamp: 1234567890
}
```

**使用建议**：
- ℹ️ 仅作为参考，不用于交易决策
- 成交价介于 Bid 和 Ask 之间
- 可用于验证市场活跃度

---

### 🎯 套利计算机制（关键！）

#### 买入/套利场景

**监控价格**：`best_ask` ⭐

**原因**：这是你买入时需要**实际支付**的价格

**套利利润空间计算**：
```typescript
利润空间 = ESPN胜率 - best_ask

示例：
ESPN胜率: 85%
best_ask: $0.86
利润空间 = 0.85 - 0.86 = -0.01 (-1%) ❌ 无套利空间

ESPN胜率: 90%
best_ask: $0.75
利润空间 = 0.90 - 0.75 = 0.15 (15%) ✅ 有套利空间
```

#### 卖出/平仓场景

**监控价格**：`best_bid` ⭐

**原因**：这是你卖出时能**实际收到**的价格

**实际收益计算**：
```typescript
实际收益 = 卖出收入 - 买入成本
         = (数量 × best_bid) - (数量 × best_ask)

示例：
买入: 100份 @$0.86 (Ask) = 成本 $86
卖出: 100份 @$0.95 (Bid) = 收入 $95
实际盈亏 = $95 - $86 = $9 (+10.47%)
```

#### 为什么不用 Mid 价格？

```typescript
❌ 错误计算（使用 Mid）：
利润空间 = ESPN胜率 - midPrice
         = 0.85 - 0.855 = -0.005 (-0.5%)
看起来无利润

✅ 正确计算（使用 Ask）：
利润空间 = ESPN胜率 - best_ask
         = 0.85 - 0.86 = -0.01 (-1%)
准确反映真实成本

注意：即使用 Ask 计算也无利润，但如果用 Mid 会被误导！
```

---

### 价格类型总结

#### 1. Mid Price（中间价）

```typescript
midPrice = (bestBid + bestAsk) / 2
```

**获取来源：**
- `price_change` 事件：`(best_bid + best_ask) / 2`
- `book` 事件：`(bids[0].price + asks[0].price) / 2`

**用途：**
- ✅ 前端显示（用户友好）
- ✅ 持仓市值估值
- ✅ 套利信号展示（给用户看）
- ❌ 不用于实际交易计算

**示例：**
```
Bid: $0.85
Ask: $0.86
Mid: $0.855 ← 前端显示这个
```

---

#### 2. Ask Price（卖价/要价）

```typescript
bestAsk = asks[0].price  // 订单簿最低卖价
```

**用途：**
- ✅ 买入时支付的价格
- ✅ 套利引擎计算利润空间
- ✅ Paper Trading 买入成本

**为什么叫 Ask？**
- 卖方"要求"的价格（Asking price）
- 买方必须"支付"这个价格才能买到

**示例：**
```
你想买 LA Clippers 胜利：
- Ask = $0.86 ← 你需要支付 86¢
- Mid = $0.855 ← 仅供参考
- 实际成本 = 数量 × $0.86
```

---

#### 3. Bid Price（买价/出价）

```typescript
bestBid = bids[0].price  // 订单簿最高买价
```

**用途：**
- ✅ 卖出时收到的价格
- ✅ Paper Trading 平仓收入

**为什么叫 Bid？**
- 买方"出价"愿意购买（Bidding price）
- 卖方如果接受，只能收到这个价格

**示例：**
```
你想卖出持有的 LA Clippers 胜利：
- Bid = $0.85 ← 你只能收到 85¢
- Mid = $0.855 ← 仅供参考
- 实际收入 = 数量 × $0.85
```

---

## 💸 买卖价差（Spread）

### 定义

```typescript
spread = bestAsk - bestBid
```

### 影响

**买卖价差会吃掉你的利润！**

```
买入成本: 100 × $0.86 = $86.00
卖出收入: 100 × $0.85 = $85.00
损失: $1.00 (1.16%)
```

即使价格不动，你也亏损了 1¢！

---

## 🎯 套利引擎价格使用

### 旧逻辑（错误）❌

```typescript
const polyPrice = midPrice;  // $0.855
const profitMargin = espnProb - polyPrice;  // 85% - 85.5% = -0.5%
// ❌ 显示无利润，但实际可能有套利空间
```

### 新逻辑（正确）✅

```typescript
const polyPrice = bestAsk;  // $0.86 (实际买入价)
const profitMargin = espnProb - polyPrice;  // 85% - 86% = -1%
// ✅ 准确反映真实成本
```

---

## 💼 Paper Trading 价格使用

### 买入

```typescript
// ✅ 正确
const entryPrice = bestAsk || midPrice;  // 优先用 Ask
const cost = quantity * entryPrice;
balance -= cost;

// ❌ 错误
const entryPrice = midPrice;  // 低估成本
```

### 持仓估值

```typescript
// ✅ 正确
const currentValue = quantity * midPrice;  // 市值参考
const unrealizedPnl = currentValue - cost;

// 或者更保守
const currentValue = quantity * bestBid;  // 立即能卖出的价值
```

### 卖出

```typescript
// ✅ 正确
const exitPrice = bestBid || midPrice;  // 优先用 Bid
const revenue = quantity * exitPrice;
balance += revenue;

// ❌ 错误
const exitPrice = midPrice;  // 高估收入
```

---

## 📈 实战案例

### 案例 1：成功套利

```
ESPN 胜率: 90%
Polymarket:
  - Bid: $0.84
  - Ask: $0.86
  - Mid: $0.85

分析：
利润空间 = 90% - 86% = 4%
✅ 买入 100 份 @$0.86 = 成本 $86

比赛结束，快船获胜：
卖出 100 份 @$0.99 = 收入 $99
实际盈亏 = $99 - $86 = $13 (+15.12%)
```

### 案例 2：买卖价差陷阱

```
ESPN 胜率: 52%
Polymarket:
  - Bid: $0.48
  - Ask: $0.52
  - Mid: $0.50

分析：
利润空间 = 52% - 52% = 0%
❌ 无套利空间（买入即被价差吃掉利润）

如果强行买入：
买入 @$0.52，立即按市场价卖出 @$0.48
损失 = $0.04 (7.7%)
```

### 案例 3：Mid 价格误导

```
ESPN 胜率: 75%
Polymarket:
  - Bid: $0.50
  - Ask: $0.90
  - Mid: $0.70

用 Mid 价格计算：
利润空间 = 75% - 70% = 5% ✅ 看似有利润

用 Ask 价格计算：
利润空间 = 75% - 90% = -15% ❌ 实际亏损！

结论：巨大的买卖价差说明流动性不足，避免交易
```

---

## ⚠️ 注意事项

### 1. 流动性风险

订单簿可能不深：
```
asks: [
  {price: 0.86, size: 10},   // 只有 10 份
  {price: 0.90, size: 5},    // 价格跳升
  {price: 0.95, size: 20}    // 更贵
]
```

如果你要买 100 份，实际成本 = 10×0.86 + 5×0.90 + 85×0.95 = $95.35（远高于 bestAsk）

### 2. 价格延迟

WebSocket 价格可能有延迟：
- 你看到 Ask $0.86
- 实际提交时可能已经是 $0.88
- 这就是"滑点"

### 3. 市场关闭风险

Polymarket 市场可能在比赛结束前关闭：
- 无法按预期价格卖出
- 需要等待市场结算

---

## ✅ 最佳实践

1. **套利引擎：永远用 Ask 价格**
   ```typescript
   const profitMargin = espnProb - bestAsk;
   ```

2. **Paper Trading：买入用 Ask，卖出用 Bid**
   ```typescript
   const entryCost = quantity * bestAsk;
   const exitRevenue = quantity * bestBid;
   ```

3. **前端显示：用 Mid 价格，但注明是参考价**
   ```typescript
   <div>价格: ${midPrice} (参考)</div>
   <div className="text-xs">买入价: ${bestAsk}</div>
   ```

4. **风险控制：检查买卖价差**
   ```typescript
   const spread = bestAsk - bestBid;
   if (spread > 0.05) {
     logger.warn('价差过大，流动性不足');
   }
   ```

---

## 🔧 代码检查清单

- [ ] 套利引擎使用 Ask 价格计算利润空间
- [ ] Paper Trading 买入使用 Ask 价格
- [ ] Paper Trading 卖出使用 Bid 价格
- [ ] 前端显示 Mid 价格，但标注为参考价
- [ ] 日志明确标注使用的价格类型
- [ ] 考虑买卖价差对利润的影响
