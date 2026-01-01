# 💰 Polymarket 价格更新说明

## 🔍 问题说明

用户反馈：**价格没有实时更新**

### 原因分析

Polymarket 价格更新受以下因素影响：

1. **后端轮询频率**
   - 进行中比赛：2秒
   - 未开始比赛：5秒
   - 价格从 Polymarket API 获取

2. **Polymarket 自身延迟**
   - 基于区块链的预测市场
   - 交易需要区块确认（~2-5秒）
   - API 可能有缓存（~1-2秒）

3. **WebSocket 推送机制**
   - 检测到价格变化才推送
   - 变化阈值：0.01（1美分）

## 📊 当前更新流程

```
用户下单交易
    ↓
区块链确认 (~2-5秒)
    ↓
Polymarket API 更新 (~1-2秒)
    ↓
我们的后端轮询 (2-5秒)
    ↓
WebSocket 检测变化 (1秒)
    ↓
推送给前端
───────────────────────────
总延迟: 6-13秒
```

## 🎯 优化方案

### 方案 1: 提高价格更新频率（推荐）

**修改后端轮询，价格始终使用更高频率**

```typescript
// server/src/services/dataAggregator.ts
private startDynamicUpdate(): void {
  const update = async () => {
    await this.updateAllMatches();
    
    // 🔥 价格始终快速更新：2秒
    const interval = 2000; // 固定2秒（之前根据状态5秒或2秒）
    
    this.updateInterval = setTimeout(update, interval);
  };
  update();
}
```

**效果**：
- ✅ 价格更新延迟：6-9秒（减少4秒）
- ❌ API 调用增加：60次/分钟（之前12次/分钟）

### 方案 2: 启用 Polymarket WebSocket（复杂）

**使用 Polymarket CLOB WebSocket 实时订阅**

```typescript
// server/src/services/polymarketService.ts
async connectWebSocket(): Promise<void> {
  const ws = new WebSocket(this.wsUrl);
  
  ws.on('message', (data) => {
    // 实时价格更新
    const priceUpdate = JSON.parse(data);
    this.updatePriceCache(priceUpdate);
  });
}
```

**限制**：
- ⚠️ 需要认证和 API Key
- ⚠️ 复杂的订单簿数据结构
- ⚠️ 需要维护连接和订阅

### 方案 3: 混合策略（平衡）

**根据用户活跃度调整**

```typescript
// 检测用户关注的比赛
if (比赛有用户关注) {
  价格更新频率 = 1秒 ⚡
} else if (比赛进行中) {
  价格更新频率 = 2秒
} else {
  价格更新频率 = 5秒
}
```

## 🔧 立即优化

### 步骤 1: 修改后端轮询

```typescript
// server/src/services/dataAggregator.ts
private startDynamicUpdate(): void {
  const update = async () => {
    await this.updateAllMatches();
    
    // 🎯 方案选择：
    
    // 选项A: 固定2秒（最实时，但API调用多）
    const interval = 2000;
    
    // 选项B: 动态调整（平衡）
    // const interval = this.hasLiveMatches ? 2000 : 3000;
    
    // 选项C: 保持原样（省API调用）
    // const interval = this.hasLiveMatches ? 2000 : 5000;
    
    this.updateInterval = setTimeout(update, interval);
  };
  update();
}
```

### 步骤 2: 添加价格变化日志

```typescript
// server/src/services/dataAggregator.ts
if (polyResult.status === 'fulfilled' && polyResult.value) {
  const newPrice = polyResult.value;
  const oldPrice = match.poly;
  
  // 检测价格变化
  if (oldPrice && (
    Math.abs(newPrice.homePrice - oldPrice.homePrice) > 0.01 ||
    Math.abs(newPrice.awayPrice - oldPrice.awayPrice) > 0.01
  )) {
    logger.info(`💰 价格变化 [${match.homeTeam.name} vs ${match.awayTeam.name}]`);
    logger.info(`   主队: $${oldPrice.homePrice} → $${newPrice.homePrice}`);
    logger.info(`   客队: $${oldPrice.awayPrice} → $${newPrice.awayPrice}`);
  }
  
  match.poly = newPrice;
}
```

### 步骤 3: WebSocket 优化（已完成✅）

```typescript
// 价格四舍五入到2位小数（0.01精度）
homePrice: m.poly?.homePrice ? Math.round(m.poly.homePrice * 100) / 100 : null,
awayPrice: m.poly?.awayPrice ? Math.round(m.poly.awayPrice * 100) / 100 : null,
```

## 📈 性能对比

### 当前配置
```
更新频率:
- 进行中: 2秒
- 未开始: 5秒

价格延迟:
- 最快: 6秒 (区块链2秒 + API1秒 + 轮询2秒 + 推送1秒)
- 最慢: 13秒 (区块链5秒 + API2秒 + 轮询5秒 + 推送1秒)

API调用:
- 进行中: 30次/分钟
- 未开始: 12次/分钟
```

### 优化后（固定2秒）
```
更新频率:
- 所有比赛: 2秒 ⚡

价格延迟:
- 最快: 6秒
- 最慢: 10秒 ⚡ (减少3秒)

API调用:
- 所有比赛: 30次/分钟
```

## 🎯 推荐配置

### 开发/测试环境
```bash
# .env
PRICE_UPDATE_INTERVAL=2000  # 2秒，快速看到变化
```

### 生产环境
```bash
# .env
PRICE_UPDATE_INTERVAL=3000  # 3秒，平衡速度和成本
```

### 实现

```typescript
// server/src/config/index.ts
export const config = {
  priceUpdateInterval: parseInt(process.env.PRICE_UPDATE_INTERVAL || '3000', 10),
};

// server/src/services/dataAggregator.ts
const interval = config.priceUpdateInterval;
```

## 💡 最佳实践

### 1. 前端优化提示

```typescript
// 显示价格更新时间
<div className="text-xs text-gray-500">
  价格更新: {formatTimeAgo(match.poly?.lastUpdate)}
</div>

// 显示加载状态
{isPriceUpdating && <Spinner />}
```

### 2. 用户反馈

```typescript
// 价格变化动画
<div className={`transition-all ${priceChanged ? 'animate-pulse' : ''}`}>
  ${price}
</div>
```

### 3. 缓存策略

```typescript
// 价格缓存（避免重复请求）
const priceCache = new Map();
const CACHE_TTL = 2000; // 2秒

async function getPrice(marketId: string) {
  const cached = priceCache.get(marketId);
  if (cached && Date.now() - cached.time < CACHE_TTL) {
    return cached.price;
  }
  
  const price = await fetchPrice(marketId);
  priceCache.set(marketId, { price, time: Date.now() });
  return price;
}
```

## 🐛 故障排查

### 问题 1: 价格长时间不更新

**检查**:
```bash
# 查看后端日志
💰 价格变化 [Lakers vs Warriors]
   主队: $0.52 → $0.54
```

**原因**:
- Polymarket API 故障
- 网络延迟
- 市场流动性低（无交易）

### 问题 2: 价格跳变

**现象**: $0.50 → $0.70 突然跳变

**原因**:
- 轮询间隔内发生多次交易
- 大额交易导致价格突变
- Polymarket 市场深度不足

**解决**: 添加价格变化平滑

```typescript
// 平滑价格变化
const smoothPrice = (oldPrice: number, newPrice: number): number => {
  const maxChange = 0.05; // 最大5美分变化
  const diff = newPrice - oldPrice;
  
  if (Math.abs(diff) > maxChange) {
    return oldPrice + Math.sign(diff) * maxChange;
  }
  return newPrice;
};
```

## 📝 总结

### 核心问题
- Polymarket 价格更新延迟：6-13秒
- 主要延迟来自区块链确认（无法优化）

### 优化建议
1. ✅ **立即可行**: 固定2秒轮询（已优化WebSocket）
2. ⚠️ **中期**: 启用 Polymarket WebSocket（需开发）
3. 🎯 **长期**: 前端优化（加载提示、动画）

### 现实预期
- 价格不可能"完全实时"（区块链特性）
- 优化后可达到 6-10秒 延迟
- 这在区块链预测市场中已经很快

### 用户沟通
> "Polymarket 是基于区块链的市场，价格更新需要等待区块确认（约2-5秒）。我们已将轮询优化到2秒，总延迟约6-10秒，这是目前技术下的最佳表现。"

---

**更新时间**: 2025-12-26
**当前延迟**: 6-13秒
**优化目标**: 6-10秒
