# Polymarket Price Usage Summary

> 🌏 **[中文文档](./PRICE_USAGE_SUMMARY.zh-CN.md)** | **English**

## 📋 Price Types

| Price Type | Meaning | Usage |
|---------|------|------|
| **bestAsk** | Lowest sell price | Buy cost (price you pay) |
| **bestBid** | Highest buy price | Sell revenue (price you receive) |
| **midPrice** | Mid price `(bid + ask) / 2` | Display reference, not for trading decisions |

---

## ✅ Correct Usage

### 1. Arbitrage Signal Judgment (Buy Decision)

**Use `bestAsk`** (buy cost)

```typescript
// arbitrageEngine.ts
const buyPrice = polyBestAsk || polyMidPrice; // Prefer bestAsk
const profitMargin = espnProb - buyPrice;

if (profitMargin > 0.10) {
  // Generate buy signal
}
```

**Reason**:
- When buying, we pay `bestAsk` price
- Arbitrage profit = `ESPN Win Prob - bestAsk` (not midPrice)
- Using midPrice **overestimates profit**, leading to wrong decisions

---

### 2. Paper Trading Buy

**Use `bestAsk`** (buy cost)

```typescript
// paperTradingService.ts
const price = homeBestAsk || homePrice; // Prefer bestAsk
const cost = quantity * price;
this.balance -= cost;
```

**Log output**:
```
✅ [Paper Trading] Buy Lakers x10.00 @$0.6500 (Ask price, cost: $6.50)
```

---

### 3. Position Price Update (Unrealized P&L)

**Use `bestBid`** (sell price)

```typescript
// dataAggregator.ts
paperTradingService.updatePositionPrice(
  matchId,
  homeTokenId,
  awayTokenId,
  homeBestBid || homePrice, // Use bestBid (sell price)
  awayBestBid || awayPrice  // Use bestBid (sell price)
);
```

**Reason**:
- Unrealized P&L = how much $ if sold now
- When selling, we receive `bestBid` price
- Unrealized P&L = `(bestBid - bestAsk) * quantity`

---

### 4. Close Position (Match Ended)

**Use `bestBid`** (sell price)

```typescript
// dataAggregator.ts
paperTradingService.closePosition(
  matchId,
  homeTokenId,
  homeBestBid || homePrice // Use bestBid (sell price)
);
```

**Actual profit calculation**:
```typescript
const entryCost = quantity * bestAsk;   // Buy cost
const exitRevenue = quantity * bestBid; // Sell revenue
const profit = exitRevenue - entryCost; // Actual profit
```

---

## 📊 Complete Flow Example

### Scenario: Lakers vs Celtics

#### 1. WebSocket Price Update
```json
{
  "event_type": "price_change",
  "price_changes": [{
    "asset_id": "0x123...",
    "best_bid": "0.64",  // ⭐ Sell price
    "best_ask": "0.66",  // ⭐ Buy price
    "price": "0.65"      // Mid price (reference)
  }]
}
```

#### 2. Arbitrage Signal Judgment
```typescript
ESPN Lakers Win Prob: 75%
Polymarket bestAsk: 66%

Profit margin = 75% - 66% = 9%
❌ Does not meet 10% threshold, no signal generated
```

If bestAsk drops to 64%:
```typescript
Profit margin = 75% - 64% = 11%
✅ Meets 10% threshold, generate buy signal
```

#### 3. Paper Trading Buy
```typescript
Buy price: $0.64 (bestAsk)
Buy quantity: 10 shares
Buy cost: $6.40
Balance: $1000 - $6.40 = $993.60
```

#### 4. Position Unrealized P&L Update
Price changes: `bestBid = 0.68, bestAsk = 0.70`

```typescript
Current sell price: $0.68 (bestBid)
Unrealized P&L = (0.68 - 0.64) * 10 = $0.40
Unrealized P&L% = (0.40 / 6.40) * 100 = 6.25%
```

#### 5. Match Ends, Close Position
Final `bestBid = 0.72`

```typescript
Sell price: $0.72 (bestBid)
Sell revenue: 10 * 0.72 = $7.20
Actual profit: $7.20 - $6.40 = $0.80
Profit%: (0.80 / 6.40) * 100 = 12.5%
```

---

## ⚠️ Common Mistakes

### ❌ Mistake 1: Using midPrice for Arbitrage Judgment
```typescript
// Wrong
const profitMargin = espnProb - midPrice;
```

**Problem**:
- midPrice = `(bid + ask) / 2`
- Actual buy price is `bestAsk`, not `midPrice`
- **Overestimates profit** by ~`spread / 2`

**Correct**:
```typescript
const profitMargin = espnProb - bestAsk;
```

---

### ❌ Mistake 2: Using midPrice for Unrealized P&L
```typescript
// Wrong
const unrealizedPnl = (midPrice - entryPrice) * quantity;
```

**Problem**:
- When selling, you receive `bestBid`, not `midPrice`
- **Overestimates unrealized P&L** by ~`spread / 2`

**Correct**:
```typescript
const unrealizedPnl = (bestBid - entryPrice) * quantity;
```

---

## 📐 Spread Impact

### Spread Definition
```typescript
spread = bestAsk - bestBid
```

### Typical Spreads
- **Good liquidity markets**: 0.5% - 1%
- **Poor liquidity markets**: 2% - 5%

### Impact
Assuming `bestBid = 0.64, bestAsk = 0.66`:
- Spread = 2%
- Using midPrice (0.65) causes:
  - **Arbitrage judgment**: Overestimate profit by 1%
  - **Unrealized P&L**: Overestimate by 1%
  - **Actual trading**: Earn 2% less (pay 1% more when buying, receive 1% less when selling)

---

## 🎯 Summary

| Operation | Use Price | Reason |
|-----|---------|------|
| **Arbitrage Judgment** | `bestAsk` | Buy cost |
| **Buy** | `bestAsk` | Actual price paid |
| **Unrealized P&L** | `bestBid` | Price received when selling |
| **Close Position** | `bestBid` | Actual revenue |
| **Display Reference** | `midPrice` | Display only, not for decisions |

**Core Principles**:
- ✅ Buy with `bestAsk` (what you pay)
- ✅ Sell with `bestBid` (what you receive)
- ❌ Don't use `midPrice` for decisions (causes errors)

---

## 📚 Related Documentation

- [Price Guide](./PRICE_GUIDE.md)
- [System Architecture](./ARCHITECTURE.md)
- [WebSocket Subscription Guide](./WEBSOCKET_LIMITS.md)
