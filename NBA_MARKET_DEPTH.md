# NBA市场深度分析功能

## 📊 概述

基于Polymarket CLOB API，为NBA赛事预测添加了市场深度、流动性和交易动量分析，提升交易信号的可靠性。

## 🎯 新增功能

### 1. Order Book深度分析
分析买卖盘深度，评估市场支撑和压力。

**数据来源：** `GET /api/clob/book?token_id={tokenId}`

**指标：**
- **`bidDepth`** - 买单总量（看涨支撑）
- **`askDepth`** - 卖单总量（看跌压力）
- **`depthImbalance`** - 买卖失衡度 (-1 to 1)
  - 正值 = 买单多 → 看涨情绪强
  - 负值 = 卖单多 → 看跌情绪强

### 2. Spread（价差）监控
评估市场效率和流动性质量。

**数据来源：** `GET /api/clob/spread?token_id={tokenId}`

**评估标准：**
```typescript
if (spread < 0.02)  // < 2% → 流动性很好
if (spread < 0.03)  // 2-3% → 流动性良好
if (spread > 0.05)  // > 5% → 流动性差，价格不稳定
```

### 3. 流动性分类
根据总深度自动分类市场流动性。

```typescript
if (totalDepth > 10000)  liquidity = 'high'    // 高流动性
if (totalDepth > 5000)   liquidity = 'medium'  // 中等流动性
else                     liquidity = 'low'     // 低流动性
```

### 4. 交易动量分析
分析最近1小时的交易活动，判断市场情绪。

**数据来源：** `GET /api/polymarket/trades?market={conditionId}&limit=200`

**指标：**
- **`buyPressure`** - 买方压力 (0-1)
- **`sellPressure`** - 卖方压力 (0-1)
- **`momentum`** - 动量方向：
  - `bullish` - 买盘压力 > 60%
  - `bearish` - 卖盘压力 > 60%
  - `neutral` - 平衡状态
- **`bigTrades`** - 大额交易数量（>$100）

## 🔧 技术实现

### 新建文件

#### `src/services/marketDepth.ts`
市场深度分析服务，提供以下API：

```typescript
// 获取Order Book
fetchOrderBook(tokenId: string): Promise<OrderBookData | null>

// 获取Spread
fetchSpread(tokenId: string): Promise<number | null>

// 获取最近交易
fetchRecentTrades(conditionId: string, limit: number): Promise<TradeData[]>

// 分析市场深度
analyzeMarketDepth(tokenId: string): Promise<MarketDepthMetrics | null>

// 分析交易动量
analyzeTradingMomentum(conditionId: string, lookbackMinutes: number): Promise<TradingMomentum | null>

// 综合分析（推荐使用）
getNBAMarketAnalysis(tokenId: string, conditionId: string): Promise<{
  depth: MarketDepthMetrics | null;
  momentum: TradingMomentum | null;
  recommendation: string;
  confidence: number;
}>
```

#### API路由
- `api/clob/book.ts` - Order Book代理
- `api/clob/spread.ts` - Spread代理

### 更新文件

#### `src/services/strategy.ts`
策略引擎现在集成市场深度数据：

**PriceData接口扩展：**
```typescript
interface PriceData {
  // ... 原有字段
  marketDepth?: {
    spread: number;
    liquidity: 'high' | 'medium' | 'low';
    depthImbalance: number;
    confidence: number;  // 市场置信度
  };
  tradingMomentum?: {
    buyPressure: number;
    momentum: 'bullish' | 'bearish' | 'neutral';
  };
}
```

**信号置信度调整：**
```typescript
// 基础置信度
let baseConfidence = calculateConfidence(...);

// 市场深度调整
if (marketDepth) {
  baseConfidence *= marketDepth.confidence;  // 应用市场置信度
  
  if (liquidity === 'low') {
    baseConfidence *= 0.85;  // 低流动性惩罚 -15%
  }
  
  if (spread > 0.05) {
    baseConfidence *= 0.9;   // 大价差惩罚 -10%
  }
}

// 交易动量调整
if (tradingMomentum) {
  if (momentum === 'bullish') {
    baseConfidence *= 1.05;  // 看涨动量加成 +5%
  } else if (momentum === 'bearish') {
    baseConfidence *= 0.95;  // 看跌动量惩罚 -5%
  }
}
```

**信号原因增强：**
```typescript
// 原信号
"💎 黄金进场点！价格 42.5¢，落后 4 分 (ESPN 58%)"

// 现在带流动性提示
"💎 黄金进场点！价格 42.5¢，落后 4 分 (ESPN 58%) ✓高流动性"
"💎 黄金进场点！价格 42.5¢，落后 4 分 (ESPN 58%) ⚠️流动性差"
```

## 📈 实际应用场景

### 场景1：高质量信号
```
价格：0.42 (42¢)
Spread：0.015 (1.5%)
流动性：high (深度 15000)
买卖失衡：+0.15 (买方略占优)
动量：bullish

→ 信号置信度：85% → 91% ✓
→ 原因：高流动性+看涨动量，信号可靠
```

### 场景2：低质量信号（自动降级）
```
价格：0.38 (38¢)
Spread：0.08 (8%)
流动性：low (深度 3000)
买卖失衡：-0.3 (卖方占优)
动量：bearish

→ 信号置信度：75% → 51% ⚠️
→ 原因：流动性差+看跌动量，降低权重
```

### 场景3：市场失衡信号
```
Order Book:
- Bids (买单): 12000
- Asks (卖单): 4000
- 失衡度：+0.5 (买方强势)

→ 市场情绪：强烈看涨
→ 策略：顺势买入，卖方压力小
```

## 🎯 置信度调整规则总结

| 因素 | 条件 | 调整 |
|------|------|------|
| **Spread** | > 5% | -10% |
| | 3-5% | -5% |
| | < 2% | 无影响 |
| **流动性** | Low | -15% |
| | Medium | -7.5% |
| | High | 无影响 |
| **动量** | Bullish | +5% |
| | Bearish | -5% |
| | Neutral | 无影响 |
| **市场置信度** | 基于spread和流动性计算 | ×0.6-1.0 |

## 🚀 使用方式

### 方式1：独立使用（调试/分析）
```typescript
import { getNBAMarketAnalysis } from './services/marketDepth';

const analysis = await getNBAMarketAnalysis(tokenId, conditionId);

console.log(analysis.depth);        // 深度指标
console.log(analysis.momentum);     // 动量指标
console.log(analysis.recommendation); // 建议
console.log(analysis.confidence);   // 综合置信度
```

### 方式2：集成到策略（自动）
```typescript
// 在MatchCard中获取市场数据后
const priceData: PriceData = {
  homePrice,
  awayPrice,
  homeRawPrice,
  awayRawPrice,
  espnHomeWinProb,
  // 添加市场深度数据
  marketDepth: {
    spread: 0.025,
    liquidity: 'high',
    depthImbalance: 0.12,
    confidence: 0.95
  },
  tradingMomentum: {
    buyPressure: 0.65,
    momentum: 'bullish'
  }
};

// 策略自动应用调整
const signals = analyzeMatch(match, priceData);
```

## 📊 数据流示意图

```
NBA比赛数据 → MatchCard组件
     ↓
获取Polymarket价格 (WebSocket)
     ↓
获取市场深度数据 (REST API)
     ├─ Order Book (买卖深度)
     ├─ Spread (价差)
     └─ Recent Trades (交易历史)
     ↓
计算指标
     ├─ 流动性分类
     ├─ 深度失衡
     ├─ 买卖压力
     └─ 交易动量
     ↓
传入策略引擎
     ├─ 基础信号计算
     ├─ 应用市场深度调整
     └─ 生成最终信号（带置信度）
     ↓
显示给用户
```

## ⚠️ 注意事项

1. **API调用成本**
   - Order Book和Spread是额外的API调用
   - 建议与价格更新同步，避免过度请求
   - 考虑缓存机制（如5-10秒缓存）

2. **数据可用性**
   - 某些小盘市场可能没有足够的深度数据
   - 新开的市场流动性可能很低
   - 需要处理API调用失败的情况

3. **性能考虑**
   - 市场深度分析应该异步进行
   - 不应阻塞主要的价格更新流程
   - 失败时优雅降级（不影响基础功能）

## 🔮 未来优化方向

1. **实时Order Book更新**
   - 使用WebSocket监听Order Book变化
   - 实时计算深度失衡

2. **历史动量趋势**
   - 记录过去24小时的动量变化
   - 识别动量反转点

3. **大单追踪**
   - 监控大额交易（Smart Money）
   - 提供跟单信号

4. **市场操纵检测**
   - 识别异常的Order Book模式
   - 警告可能的价格操纵

5. **流动性预警系统**
   - 自动监控所有NBA市场
   - 标记流动性突然下降的市场
