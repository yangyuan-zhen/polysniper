# Price Usage Guide

> 🌏 **[中文文档](./PRICE_GUIDE.zh-CN.md)** | **English**

## 🎯 Core Principle

**Always remember: Pay Ask when buying, receive Bid when selling!**

---

## 📊 Price Types Explained

### WebSocket Event Types

Polymarket CLOB WebSocket provides three main event types:

#### 1. `price_change` Event (Most Common) ✅

**Triggered when**: Order book changes occur

**Contains fields:**
```typescript
{
  event_type: "price_change",
  price_changes: [{
    asset_id: "0x123...",
    price: "0.855",           // A specific price level
    size: "100",              // New total size at this level
    side: "BUY" | "SELL",     // Buy or sell order
    best_bid: "0.85",         // ⭐ Current highest buy price
    best_ask: "0.86",         // ⭐ Current lowest sell price
    hash: "0xabc..."          // Order hash
  }]
}
```

**Recommendation**:
- ✅ **Prefer using** `best_bid` and `best_ask` fields
- These fields directly provide current best prices
- No need to parse the full order book

---

#### 2. `book` Event (On Subscribe/After Trades) 📖

**Triggered when**:
- First subscription (initial_dump: true)
- After large trades

**Contains fields:**
```typescript
{
  event_type: "book",
  asset_id: "0x123...",
  bids: [                     // Buy orders (descending)
    {price: "0.85", size: "100"},
    {price: "0.84", size: "50"},
    {price: "0.83", size: "30"}
  ],
  asks: [                     // Sell orders (ascending)
    {price: "0.86", size: "120"},
    {price: "0.87", size: "80"},
    {price: "0.88", size: "60"}
  ],
  last_trade_price: "0.855",  // Last traded price
  timestamp: 1234567890
}
```

**Usage**:
- ✅ Get bestBid from `bids[0].price`
- ✅ Get bestAsk from `asks[0].price`
- ⚠️ Check if arrays are empty

---

#### 3. `last_trade_price` Event (Actual Trades) 💰

**Triggered when**: Real trades occur

**Usage**:
- ℹ️ Reference only, not for trading decisions
- Trade price is between Bid and Ask
- Can verify market activity

---

### 🎯 Arbitrage Calculation Mechanism (Critical!)

#### Buy/Arbitrage Scenario

**Monitor Price**: `best_ask` ⭐

**Reason**: This is the price you **actually pay** when buying

**Profit Margin Calculation**:
```typescript
Profit Margin = ESPN Win Prob - best_ask

Example:
ESPN: 85%
best_ask: $0.86
Profit = 0.85 - 0.86 = -0.01 (-1%) ❌ No arbitrage

ESPN: 90%
best_ask: $0.75
Profit = 0.90 - 0.75 = 0.15 (15%) ✅ Arbitrage opportunity
```

#### Sell/Exit Scenario

**Monitor Price**: `best_bid` ⭐

**Reason**: This is the price you **actually receive** when selling

**Actual P&L Calculation**:
```typescript
Actual P&L = Sell Revenue - Buy Cost
          = (quantity × best_bid) - (quantity × best_ask)

Example:
Buy:  100 shares @$0.86 (Ask) = Cost $86
Sell: 100 shares @$0.95 (Bid) = Revenue $95
P&L = $95 - $86 = $9 (+10.47%)
```

#### Why Not Use Mid Price?

```typescript
❌ Wrong Calculation (Using Mid):
Profit = ESPN Win Prob - midPrice
       = 0.85 - 0.855 = -0.005 (-0.5%)
Looks unprofitable

✅ Correct Calculation (Using Ask):
Profit = ESPN Win Prob - best_ask
       = 0.85 - 0.86 = -0.01 (-1%)
Accurately reflects true cost
```

---

### Price Type Summary

#### 1. Mid Price

```typescript
midPrice = (bestBid + bestAsk) / 2
```

**Usage:**
- ✅ Frontend display (user-friendly)
- ✅ Portfolio valuation
- ✅ Signal display (for users)
- ❌ Not for actual trading calculations

**Example:**
```
Bid: $0.85
Ask: $0.86
Mid: $0.855 ← Display this on frontend
```

---

#### 2. Ask Price (Sell Price)

```typescript
bestAsk = asks[0].price  // Lowest sell price on order book
```

**Usage:**
- ✅ Price paid when buying
- ✅ Arbitrage engine profit calculation
- ✅ Paper Trading buy cost

**Why called Ask?**
- Price sellers are "asking" for
- Buyers must "pay" this price to acquire

**Example:**
```
You want to buy LA Clippers win:
- Ask = $0.86 ← You need to pay 86¢
- Mid = $0.855 ← Reference only
- Actual cost = quantity × $0.86
```

---

#### 3. Bid Price (Buy Price)

```typescript
bestBid = bids[0].price  // Highest buy price on order book
```

**Usage:**
- ✅ Price received when selling
- ✅ Paper Trading exit revenue

**Why called Bid?**
- Price buyers are "bidding"
- Sellers can only receive this price

**Example:**
```
You want to sell your LA Clippers shares:
- Bid = $0.85 ← You only receive 85¢
- Mid = $0.855 ← Reference only
- Actual revenue = quantity × $0.85
```

---

## 💸 Bid-Ask Spread

### Definition

```typescript
spread = bestAsk - bestBid
```

### Impact

**The spread eats your profit!**

```
Buy cost:  100 × $0.86 = $86.00
Sell revenue: 100 × $0.85 = $85.00
Loss: $1.00 (1.16%)
```

Even if price doesn't move, you lose 1¢!

---

## 🎯 Arbitrage Engine Price Usage

### Old Logic (Wrong) ❌

```typescript
const polyPrice = midPrice;  // $0.855
const profitMargin = espnProb - polyPrice;  // 85% - 85.5% = -0.5%
// ❌ Shows no profit, but may actually have arbitrage opportunity
```

### New Logic (Correct) ✅

```typescript
const polyPrice = bestAsk;  // $0.86 (actual buy price)
const profitMargin = espnProb - polyPrice;  // 85% - 86% = -1%
// ✅ Accurately reflects true cost
```

---

## 💼 Paper Trading Price Usage

### Buy

```typescript
// ✅ Correct
const entryPrice = bestAsk || midPrice;  // Prefer Ask
const cost = quantity * entryPrice;
balance -= cost;

// ❌ Wrong
const entryPrice = midPrice;  // Underestimates cost
```

### Position Valuation

```typescript
// ✅ Correct
const currentValue = quantity * midPrice;  // Market value reference
const unrealizedPnl = currentValue - cost;

// Or more conservative
const currentValue = quantity * bestBid;  // Immediate sellable value
```

### Sell

```typescript
// ✅ Correct
const exitPrice = bestBid || midPrice;  // Prefer Bid
const revenue = quantity * exitPrice;
balance += revenue;

// ❌ Wrong
const exitPrice = midPrice;  // Overestimates revenue
```

---

## 📈 Real-World Examples

### Case 1: Successful Arbitrage

```
ESPN Win Prob: 90%
Polymarket:
  - Bid: $0.84
  - Ask: $0.86
  - Mid: $0.85

Analysis:
Profit margin = 90% - 86% = 4%
✅ Buy 100 shares @$0.86 = Cost $86

Game ends, Clippers win:
Sell 100 shares @$0.99 = Revenue $99
Actual P&L = $99 - $86 = $13 (+15.12%)
```

### Case 2: Spread Trap

```
ESPN Win Prob: 52%
Polymarket:
  - Bid: $0.48
  - Ask: $0.52
  - Mid: $0.50

Analysis:
Profit margin = 52% - 52% = 0%
❌ No arbitrage (spread eats profit immediately)

If forced to buy:
Buy @$0.52, immediately sell @$0.48
Loss = $0.04 (7.7%)
```

### Case 3: Mid Price Misleading

```
ESPN Win Prob: 75%
Polymarket:
  - Bid: $0.50
  - Ask: $0.90
  - Mid: $0.70

Using Mid price:
Profit = 75% - 70% = 5% ✅ Looks profitable

Using Ask price:
Profit = 75% - 90% = -15% ❌ Actually loses!

Conclusion: Huge spread indicates low liquidity, avoid trading
```

---

## ⚠️ Important Notes

### 1. Liquidity Risk

Order book may not be deep:
```
asks: [
  {price: 0.86, size: 10},   // Only 10 shares
  {price: 0.90, size: 5},    // Price jumps
  {price: 0.95, size: 20}    // Even more expensive
]
```

If you want to buy 100 shares, actual cost = 10×0.86 + 5×0.90 + 85×0.95 = $95.35 (far higher than bestAsk)

### 2. Price Delay

WebSocket prices may have latency:
- You see Ask $0.86
- By the time you submit, it may be $0.88
- This is "slippage"

### 3. Market Closure Risk

Polymarket markets may close before game ends:
- Cannot sell at expected price
- Must wait for market settlement

---

## ✅ Best Practices

1. **Arbitrage Engine: Always use Ask price**
   ```typescript
   const profitMargin = espnProb - bestAsk;
   ```

2. **Paper Trading: Buy with Ask, Sell with Bid**
   ```typescript
   const entryCost = quantity * bestAsk;
   const exitRevenue = quantity * bestBid;
   ```

3. **Frontend Display: Use Mid price, but mark as reference**
   ```typescript
   <div>Price: ${midPrice} (Reference)</div>
   <div className="text-xs">Buy Price: ${bestAsk}</div>
   ```

4. **Risk Control: Check spread**
   ```typescript
   const spread = bestAsk - bestBid;
   if (spread > 0.05) {
     logger.warn('Spread too large, insufficient liquidity');
   }
   ```

---

## 🔧 Code Checklist

- [ ] Arbitrage engine uses Ask price for profit calculation
- [ ] Paper Trading uses Ask price for buying
- [ ] Paper Trading uses Bid price for selling
- [ ] Frontend displays Mid price but marks as reference
- [ ] Logs clearly indicate which price type is used
- [ ] Consider spread impact on profits
