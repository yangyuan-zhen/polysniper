# Polymarket 价格使用总结

## 📋 价格类型

| 价格类型 | 含义 | 用途 |
|---------|------|------|
| **bestAsk** | 最低卖价 | 买入成本（你支付的价格） |
| **bestBid** | 最高买价 | 卖出收入（你收到的价格） |
| **midPrice** | 中间价 `(bid + ask) / 2` | 显示参考，不用于交易决策 |

---

## ✅ 正确用法

### 1. 套利信号判断（买入决策）

**使用 `bestAsk`**（买入成本）

```typescript
// arbitrageEngine.ts
const buyPrice = polyBestAsk || polyMidPrice; // 优先 bestAsk
const profitMargin = espnProb - buyPrice;

if (profitMargin > 0.10) {
  // 生成买入信号
}
```

**原因**：
- 我们要买入时，需要支付 `bestAsk` 价格
- 套利利润 = `ESPN胜率 - bestAsk`（不是 midPrice）
- 使用 midPrice 会**高估利润**，导致错误决策

---

### 2. 模拟交易买入（Paper Trading）

**使用 `bestAsk`**（买入成本）

```typescript
// paperTradingService.ts
const price = homeBestAsk || homePrice; // 优先 bestAsk
const cost = quantity * price;
this.balance -= cost;
```

**日志输出**：
```
✅ [Paper Trading] 买入 Lakers x10.00 @$0.6500 (Ask价，成本: $6.50)
```

---

### 3. 持仓价格更新（浮盈浮亏计算）

**使用 `bestBid`**（卖出价）

```typescript
// dataAggregator.ts
paperTradingService.updatePositionPrice(
  matchId,
  homeTokenId,
  awayTokenId,
  homeBestBid || homePrice, // 使用 bestBid（卖出价）
  awayBestBid || awayPrice  // 使用 bestBid（卖出价）
);
```

**原因**：
- 持仓浮盈 = 如果现在卖出能收到多少钱
- 卖出时我们收到的是 `bestBid` 价格
- 浮盈 = `(bestBid - bestAsk) * quantity`

---

### 4. 平仓（比赛结束）

**使用 `bestBid`**（卖出价）

```typescript
// dataAggregator.ts
paperTradingService.closePosition(
  matchId,
  homeTokenId,
  homeBestBid || homePrice // 使用 bestBid（卖出价）
);
```

**实际利润计算**：
```typescript
const entryCost = quantity * bestAsk;  // 买入成本
const exitRevenue = quantity * bestBid; // 卖出收入
const profit = exitRevenue - entryCost; // 实际利润
```

---

## 📊 完整流程示例

### 场景：Lakers vs Celtics

#### 1. WebSocket 价格更新
```json
{
  "event_type": "price_change",
  "price_changes": [{
    "asset_id": "0x123...",
    "best_bid": "0.64",  // ⭐ 卖出价
    "best_ask": "0.66",  // ⭐ 买入价
    "price": "0.65"      // Mid 价（参考）
  }]
}
```

#### 2. 套利信号判断
```typescript
ESPN Lakers 胜率: 75%
Polymarket bestAsk: 66%

利润空间 = 75% - 66% = 9%
❌ 不满足 10% 阈值，不生成信号
```

如果 bestAsk 降到 64%：
```typescript
利润空间 = 75% - 64% = 11%
✅ 满足 10% 阈值，生成买入信号
```

#### 3. 模拟买入（Paper Trading）
```typescript
买入价格: $0.64 (bestAsk)
买入数量: 10 股
买入成本: $6.40
余额: $1000 - $6.40 = $993.60
```

#### 4. 持仓浮盈更新
价格变化：`bestBid = 0.68, bestAsk = 0.70`

```typescript
当前卖出价: $0.68 (bestBid)
浮盈 = (0.68 - 0.64) * 10 = $0.40
浮盈率 = (0.40 / 6.40) * 100 = 6.25%
```

#### 5. 比赛结束平仓
最终 `bestBid = 0.72`

```typescript
卖出价格: $0.72 (bestBid)
卖出收入: 10 * 0.72 = $7.20
实际利润: $7.20 - $6.40 = $0.80
利润率: (0.80 / 6.40) * 100 = 12.5%
```

---

## ⚠️ 常见错误

### ❌ 错误 1：套利判断使用 midPrice
```typescript
// 错误
const profitMargin = espnProb - midPrice;
```

**问题**：
- midPrice = `(bid + ask) / 2`
- 实际买入价是 `bestAsk`，不是 `midPrice`
- 会**高估利润**约 `spread / 2`

**正确**：
```typescript
const profitMargin = espnProb - bestAsk;
```

---

### ❌ 错误 2：浮盈计算使用 midPrice
```typescript
// 错误
const unrealizedPnl = (midPrice - entryPrice) * quantity;
```

**问题**：
- 卖出时收到的是 `bestBid`，不是 `midPrice`
- 会**高估浮盈**约 `spread / 2`

**正确**：
```typescript
const unrealizedPnl = (bestBid - entryPrice) * quantity;
```

---

### ❌ 错误 3：平仓使用 midPrice
```typescript
// 错误
const exitRevenue = quantity * midPrice;
```

**问题**：
- 实际收入是 `bestBid`，不是 `midPrice`
- 会**高估收益**

**正确**：
```typescript
const exitRevenue = quantity * bestBid;
```

---

## 📐 价差（Spread）影响

### 价差定义
```typescript
spread = bestAsk - bestBid
```

### 典型价差
- **流动性好的市场**：0.5% - 1%
- **流动性差的市场**：2% - 5%

### 影响
假设 `bestBid = 0.64, bestAsk = 0.66`：
- Spread = 2%
- 使用 midPrice (0.65) 会导致：
  - **套利判断**：高估利润 1%
  - **浮盈计算**：高估浮盈 1%
  - **实际交易**：少赚 2%（买入多付 1%，卖出少收 1%）

---

## 🎯 总结

| 操作 | 使用价格 | 原因 |
|-----|---------|------|
| **套利判断** | `bestAsk` | 买入成本 |
| **买入** | `bestAsk` | 实际支付价格 |
| **浮盈计算** | `bestBid` | 卖出能收到的价格 |
| **平仓** | `bestBid` | 实际收入 |
| **显示参考** | `midPrice` | 只用于显示，不用于决策 |

**核心原则**：
- ✅ 买入用 `bestAsk`（你支付的）
- ✅ 卖出用 `bestBid`（你收到的）
- ❌ 决策不用 `midPrice`（会导致错误）

---

## 📚 相关文档

- [价格使用指南](./PRICE_GUIDE.md)
- [系统架构](./ARCHITECTURE.md)
- [WebSocket 订阅指南](./WEBSOCKET_LIMITS.md)
