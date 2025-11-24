# WebSocket Integration for Real-Time Polymarket Prices

## 概述

已成功集成Polymarket WebSocket API，实现实时价格更新功能。系统现在会优先使用WebSocket推送的价格数据，在WebSocket不可用时回退到REST API轮询。

## 核心组件

### 1. `polymarketWebSocket.ts` - WebSocket客户端

**功能：**
- 连接到Polymarket CLOB WebSocket (`wss://clob.polymarket.com/v2/ws`)
- 订阅特定token ID的价格更新
- 自动重连机制（最多5次尝试）
- 价格更新回调系统

**主要API：**
```typescript
// 获取单例WebSocket客户端
getWebSocketClient(): PolymarketWebSocketClient

// 初始化连接并订阅tokens
initializeWebSocket(tokenIds: string[]): Promise<PolymarketWebSocketClient>

// 订阅价格更新
client.onPriceUpdate((tokenId, price, side) => {
  // 处理价格更新
})
```

### 2. `polymarket.ts` - 增强的价格获取

**新增功能：**

#### `subscribeToRealtimePrices()`
订阅实时价格更新，返回取消订阅函数。
```typescript
const unsubscribe = subscribeToRealtimePrices(
  tokenIds: string[],
  onUpdate?: (tokenId: string, price: string) => void
): () => void
```

#### `getRealtimePrice()`
从WebSocket缓存获取最新价格（10秒有效期）。
```typescript
getRealtimePrice(tokenId: string, maxAge?: number): string | null
```

#### `enrichWithRealtimePrices()`
增强版价格获取，优先使用WebSocket价格，回退到REST API。
```typescript
enrichWithRealtimePrices(
  market: PolymarketMarket, 
  marketName?: string
): Promise<PolymarketMarket>
```

### 3. `MatchCard.tsx` - UI集成

**更新逻辑：**
1. 从Polymarket API获取市场数据时，提取token IDs
2. 自动订阅这些tokens的WebSocket更新
3. WebSocket价格存入缓存，下次轮询时自动使用
4. 比赛结束时自动取消订阅

## 数据流

```
┌─────────────────┐
│  MatchCard组件  │
└────────┬────────┘
         │
         ├─ 1. 首次加载：从REST API获取市场数据
         │  └─> searchPolymarketMatch()
         │      └─> enrichWithRealtimePrices()
         │          ├─ 检查WebSocket缓存
         │          └─ 回退到fetchClobPrice()
         │
         ├─ 2. 提取token IDs并订阅WebSocket
         │  └─> subscribeToRealtimePrices(tokenIds)
         │      └─> WebSocket连接并订阅
         │
         ├─ 3. 接收WebSocket价格推送
         │  └─> onPriceUpdate回调
         │      └─> 更新realtimePriceCache
         │
         └─ 4. 定期轮询（20-30秒）
            └─> searchPolymarketMatch()
                └─> enrichWithRealtimePrices()
                    └─ 优先使用WebSocket缓存的价格✓
```

## 优势

### 1. **实时性更强**
- WebSocket推送延迟：< 1秒
- REST API轮询延迟：20-30秒

### 2. **降低API请求**
- 减少CLOB REST API调用
- 避免频繁轮询导致的速率限制

### 3. **自动降级**
- WebSocket连接失败自动回退到REST API
- 连接断开自动重连（最多5次）

### 4. **资源优化**
- 单个WebSocket连接服务所有比赛卡片
- 比赛结束自动取消订阅

## 配置

### WebSocket参数
```typescript
// 在 polymarketWebSocket.ts 中配置
private readonly WS_URL = 'wss://clob.polymarket.com/v2/ws';
private maxReconnectAttempts = 5;
private reconnectDelay = 3000; // 3秒
```

### 价格缓存有效期
```typescript
// 在 polymarket.ts 中配置
getRealtimePrice(tokenId: string, maxAge = 10000) // 10秒
```

## 日志示例

```
[WebSocket] Client initialized
[WebSocket] Connecting to wss://clob.polymarket.com/v2/ws
[WebSocket] ✓ Connected
[WebSocket] Subscribing to 2 tokens
[RT Prices] ✓ Subscribed to 2 tokens via WebSocket
[WebSocket] Price update for token 12345: 0.5234
[RT Prices] ✓ Lakers vs Celtics - Using WebSocket prices
```

## 故障排查

### WebSocket连接失败
- 检查网络连接
- 验证WebSocket URL是否正确
- 查看浏览器控制台的WebSocket错误信息

### 价格不更新
- 确认token IDs正确提取
- 检查WebSocket连接状态
- 验证CLOB API返回的价格格式

### 内存泄漏
- 确保组件卸载时调用unsubscribe()
- 检查WebSocket客户端单例是否正确管理

## 未来优化

1. **批量订阅管理**
   - 多个组件共享同一个token订阅
   - 引用计数自动管理订阅

2. **价格验证**
   - 对比WebSocket和REST API价格
   - 异常价格告警

3. **连接状态UI**
   - 显示WebSocket连接状态
   - 实时/延迟数据标识

4. **性能监控**
   - WebSocket消息延迟统计
   - 价格更新频率分析
