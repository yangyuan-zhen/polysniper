# Polymarket WebSocket 实时价格推送

> **🔔 重要说明**  
> - **公共数据访问**（市场列表、价格、订单簿）：使用 **Gamma API (REST)**，**无需 API Key 或私钥** ✅  
> - **WebSocket 实时推送**：需要 **API Key 认证**（CLOB WebSocket 要求认证）  
> - **交易功能**：需要 **API Key + 钱包私钥**（当前项目不涉及）  
>  
> 💡 **当前项目**：使用 Gamma API 轮询获取价格数据，无需配置 API Key

## 📡 功能说明

WebSocket 用于**实时获取 Polymarket 市场价格更新**，相比 REST API 轮询有以下优势：

### ✅ 优势
1. **实时性**：价格变化立即推送，延迟低至毫秒级
2. **效率高**：减少 HTTP 请求开销，节省带宽
3. **服务器友好**：避免频繁轮询，减轻 API 服务器负担

### 📊 数据流程

```
Polymarket 市场
    ↓ (价格变化)
WebSocket 推送
    ↓
polymarketService.handleMessage()
    ↓
更新缓存 + 通知订阅者
    ↓
dataAggregator 获取最新价格
    ↓
计算套利信号
    ↓
WebSocket Server 推送到前端
```

## 🔧 当前实现

### 1. 连接管理
```typescript
// 连接 WebSocket
await polymarketService.connectWebSocket();

// 自动重连（最多10次，指数退避）
reconnectAttempts: 0 → 1 → 2 → 3 ... 10
reconnectDelay: 1s → 2s → 4s → 8s ... 30s (最大)
```

### 2. 消息处理
```typescript
// 接收价格更新
{
  type: 'price_update',
  data: {
    market_id: '0x123...',
    token_id: '0x456...',
    price: 0.65,
    volume: 12345,
    timestamp: 1702896000
  }
}
```

### 3. 订阅机制
```typescript
// 订阅特定市场
polymarketService.subscribe('market_id', (priceData) => {
  console.log('新价格:', priceData.price);
  // 自动更新缓存
});

// 取消订阅
polymarketService.unsubscribe('market_id', callback);
```

## ⚠️ 当前问题

### 问题：连接失败
```
[error]: AggregateError
[warn]: WebSocket 连接已关闭
[info]: 将在 2000ms 后重连 (尝试 1/10)
```

### 可能原因

1. **WebSocket URL 不正确**
   - 当前使用: `wss://ws-subscriptions-clob.polymarket.com/ws/market`
   - Polymarket 官方文档可能已更新

2. **需要认证**
   - 可能需要 API Key
   - 或特殊的握手参数

3. **网络限制**
   - 防火墙/代理阻止 WebSocket
   - 国内网络访问限制

4. **协议变更**
   - Polymarket 可能更新了 WebSocket 协议
   - 消息格式可能不同

## 🛠️ 解决方案

### 方案 1：暂时禁用（推荐）

既然 REST API 工作正常，可以先禁用 WebSocket：

```env
# .env
POLYMARKET_WS_ENABLED=false
```

**优点**：
- 避免错误日志干扰
- REST API 已足够（45秒刷新一次）
- 等 NBA 赛季开始后再优化

**缺点**：
- 失去实时性（但影响不大）

### 方案 2：验证 WebSocket URL

参考 Polymarket 官方文档，确认正确的 WebSocket 端点：

```javascript
// 可能的正确 URL
wss://ws-subscriptions-clob.polymarket.com/ws/market
wss://clob.polymarket.com/ws
wss://ws.polymarket.com/v1/markets
```

### 方案 3：添加详细日志

临时启用详细日志，查看具体错误：

```typescript
this.ws.on('error', (error) => {
  logger.error('WebSocket 错误详情:', {
    message: error.message,
    code: error.code,
    stack: error.stack
  });
});
```

### 方案 4：使用代理

如果是网络问题，可以配置 HTTP/SOCKS 代理：

```typescript
const HttpsProxyAgent = require('https-proxy-agent');

const ws = new WebSocket(url, {
  agent: new HttpsProxyAgent('http://proxy:8080')
});
```

## 📝 配置说明

### 启用/禁用 WebSocket

```env
# .env

# 禁用 WebSocket（推荐当前使用）
POLYMARKET_WS_ENABLED=false

# 启用 WebSocket（需要确保连接成功）
POLYMARKET_WS_ENABLED=true

# WebSocket URL（可以尝试不同的端点）
POLYMARKET_WS_URL=wss://ws-subscriptions-clob.polymarket.com/ws/market
```

### 日志级别

```env
# 查看详细日志
LOG_LEVEL=debug

# 减少日志输出
LOG_LEVEL=info
```

## 🔄 REST API vs WebSocket

### REST API (当前方案)
```typescript
// 每45秒刷新一次价格
setInterval(async () => {
  const markets = await polymarketService.getMarkets();
  // 处理价格更新
}, 45000);
```

**优点**：
- ✅ 稳定可靠
- ✅ 简单易调试
- ✅ 无需维护连接

**缺点**：
- ⚠️ 延迟较高（最多45秒）
- ⚠️ 更多 HTTP 请求

### WebSocket (理想方案)
```typescript
// 价格变化立即推送
ws.on('message', (data) => {
  // 实时处理价格更新
});
```

**优点**：
- ✅ 实时性好（毫秒级）
- ✅ 资源占用少
- ✅ 符合最佳实践

**缺点**：
- ⚠️ 需要维护连接
- ⚠️ 网络不稳定时需要重连
- ⚠️ 当前连接失败

## 🎯 建议

### 当前阶段（数据验证期）
1. **禁用 WebSocket**（`POLYMARKET_WS_ENABLED=false`）
2. 使用 REST API 获取数据
3. 45秒刷新频率足够测试

### NBA 赛季期间（实战期）
1. 研究 Polymarket WebSocket 文档
2. 验证正确的连接方式
3. 测试稳定性后再启用
4. 或考虑使用其他实时数据源

### 长期优化
1. 联系 Polymarket 技术支持
2. 加入 Polymarket Discord/社区
3. 参考其他开发者的实现
4. 考虑使用官方 SDK（如果有）

## 📚 相关资源

- [Polymarket 官方文档](https://docs.polymarket.com)
- [WebSocket API 参考](https://docs.polymarket.com/websocket)
- [GitHub Issues](https://github.com/Polymarket/clob-client/issues)
- [Discord 社区](https://discord.gg/polymarket)

## 🔍 调试建议

### 1. 测试连接
```bash
# 使用 wscat 测试 WebSocket
npm install -g wscat
wscat -c wss://ws-subscriptions-clob.polymarket.com/ws/market
```

### 2. 查看详细错误
```typescript
// 临时添加更详细的日志
this.ws.on('error', (error) => {
  console.log('完整错误对象:', JSON.stringify(error, null, 2));
  console.log('错误类型:', error.constructor.name);
});
```

### 3. 尝试不同 URL
```typescript
// 测试不同的 WebSocket 端点
const urls = [
  'wss://ws-subscriptions-clob.polymarket.com/ws/market',
  'wss://clob.polymarket.com/ws',
  'wss://ws.polymarket.com/markets',
];
```

## ✅ 总结

**WebSocket 的作用**：实时获取 Polymarket 市场价格更新

**当前状态**：连接失败，建议暂时禁用

**替代方案**：REST API 轮询（45秒间隔）已足够

**未来优化**：NBA 赛季开始后再解决 WebSocket 连接问题
