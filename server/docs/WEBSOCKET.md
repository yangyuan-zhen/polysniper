# Polymarket WebSocket 实时价格推送

> **✅ 已成功实现（2026-01-01）**  
> - **WebSocket 连接**：使用 CLOB WebSocket 实时获取价格数据  
> - **心跳机制**：使用 WebSocket 协议层 Ping/Pong 帧（每15秒）  
> - **无需认证**：订阅公开市场数据无需 API Key  
> - **代理支持**：国内网络需要配置 HTTP 代理访问  
>  
> 💡 **当前方案**：WebSocket 实时推送（< 1秒延迟）+ REST API 轮询（45秒）双重保障

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

## 💓 心跳机制（重要）

### WebSocket 协议层 Ping/Pong

Polymarket CLOB WebSocket 使用 **WebSocket 协议层的 Ping/Pong 帧**保持连接：

```typescript
// ❌ 错误方式：发送 JSON 消息（会返回 INVALID OPERATION）
ws.send(JSON.stringify({ type: 'ping' }));

// ✅ 正确方式：使用 WebSocket 协议层方法
ws.ping();  // 发送 Ping 帧
ws.on('pong', () => {  // 监听 Pong 响应
  console.log('收到心跳响应');
});
```

### 心跳配置

- **频率**: 每 15 秒（CLOB 建议 10-20 秒，比官方要求的 20-30 秒更保守）
- **超时**: 10 秒
- **实现**:
  - Python: `run_forever(ping_interval=15, ping_timeout=10)`
  - TypeScript: `setInterval(() => ws.ping(), 15000)`

## 🛠️ 实现细节

### 1. WebSocket 连接配置

```typescript
import WebSocket from 'ws';
import { HttpsProxyAgent } from 'https-proxy-agent';

// 配置代理（国内访问必需）
const options: any = {};
if (config.polymarket.wsProxy) {
  options.agent = new HttpsProxyAgent(config.polymarket.wsProxy);
}

// 连接 WebSocket
this.ws = new WebSocket(
  'wss://ws-subscriptions-clob.polymarket.com/ws/market',
  options
);
```

### 2. 订阅市场数据

```typescript
// 订阅格式（必须使用 assets_ids，不是 asset_id）
const subscribeMessage = {
  type: 'market',
  assets_ids: [
    '0x1234...', // token ID 1
    '0x5678...', // token ID 2
  ],
  initial_dump: true  // 请求初始数据快照
};

ws.send(JSON.stringify(subscribeMessage));
```

### 3. 心跳实现

**TypeScript (polymarketService.ts)**:
```typescript
private pingInterval: NodeJS.Timeout | null = null;

private startHeartbeat(): void {
  this.pingInterval = setInterval(() => {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.ping();  // 发送协议层 Ping 帧
      logger.debug('💓 发送 WebSocket Ping 帧');
    }
  }, 15000);  // 15秒
}

// 监听 Pong 响应
this.ws.on('pong', () => {
  logger.debug('💚 收到 WebSocket Pong 响应');
});
```

**Python (test.py)**:
```python
import websocket

ws = websocket.WebSocketApp(
    "wss://ws-subscriptions-clob.polymarket.com/ws/market",
    on_open=on_open,
    on_message=on_message,
    on_pong=lambda ws, msg: print("💚 收到 Pong 响应")
)

ws.run_forever(
    http_proxy_host="127.0.0.1",
    http_proxy_port=7890,
    ping_interval=15,   # 每15秒发送 Ping
    ping_timeout=10     # Ping 超时时间
)
```

### 4. 消息处理

```typescript
ws.on('message', (data) => {
  const message = JSON.parse(data.toString());
  
  // 处理订单簿快照
  if (message.event_type === 'book') {
    const { asset_id, last_trade_price } = message;
    updatePriceCache(asset_id, parseFloat(last_trade_price));
  }
  
  // 处理价格变化
  if (message.event_type === 'price_change') {
    message.price_changes.forEach((change: any) => {
      updatePriceCache(change.asset_id, parseFloat(change.price));
    });
  }
});
```

## 📝 配置说明

### 环境变量配置

```env
# .env

# 启用 WebSocket（已成功实现）
POLYMARKET_WS_ENABLED=true

# WebSocket 端点（已验证可用）
POLYMARKET_WS_URL=wss://ws-subscriptions-clob.polymarket.com/ws/market

# 代理配置（国内访问必需）
POLYMARKET_WS_PROXY=http://127.0.0.1:7890

# 日志级别
LOG_LEVEL=info  # debug 可查看心跳详情
```

### 心跳参数说明

| 参数 | Python | TypeScript | 说明 |
|------|--------|------------|------|
| **Ping 频率** | `ping_interval=15` | `setInterval(..., 15000)` | 每15秒发送一次 |
| **Ping 超时** | `ping_timeout=10` | - | 10秒无响应视为超时 |
| **重连延迟** | 自动 | `reconnectDelay * 2^n` | 指数退避，最大30秒 |
| **最大重连** | 自动 | `maxReconnectAttempts=10` | 失败10次后停止 |

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

## 🎯 使用建议

### 生产环境配置

```env
# 推荐配置（WebSocket + REST 双重保障）
POLYMARKET_WS_ENABLED=true
POLYMARKET_WS_PROXY=http://127.0.0.1:7890
LOG_LEVEL=info
```

**优势**：
- ✅ WebSocket 提供实时更新（< 1秒）
- ✅ REST API 作为备用（45秒轮询）
- ✅ 双重机制确保数据可靠性

### 调试模式

```env
# 查看详细心跳日志
LOG_LEVEL=debug
```

**日志输出示例**：
```
💓 发送 WebSocket Ping 帧
💚 收到 WebSocket Pong 响应
📥 原始消息: {"event_type":"book","asset_id":"0x123...
📖 订单簿 [0x123...]: $0.6500
```

### 故障排查

**问题 1**: `INVALID OPERATION` 错误
- **原因**: 发送了 JSON 心跳消息而非协议层 Ping
- **解决**: 使用 `ws.ping()` 或 `ping_interval` 参数

**问题 2**: 连接立即断开
- **原因**: 没有心跳，服务器超时断开
- **解决**: 确保心跳机制正常工作（15秒一次）

**问题 3**: 无法连接
- **原因**: 国内网络限制
- **解决**: 配置 HTTP 代理（`POLYMARKET_WS_PROXY`）

## 📚 相关资源

- [Polymarket 官方文档](https://docs.polymarket.com)
- [WebSocket API 参考](https://docs.polymarket.com/websocket)
- [GitHub Issues](https://github.com/Polymarket/clob-client/issues)
- [Discord 社区](https://discord.gg/polymarket)

## 🔍 测试与验证

### 1. 快速测试脚本

```bash
# 运行 Python 测试脚本
python test.py
```

**预期输出**：
```
✅ 已连接到 WebSocket！
💓 WebSocket 原生 Ping 心跳已启用（每15秒）
📡 已订阅 5 个活跃资产
💚 收到服务器 Pong 响应
📨 收到消息: {...}
```

### 2. 验证心跳工作

```typescript
// 在 TypeScript 代码中添加计数器
let pongCount = 0;
this.ws.on('pong', () => {
  pongCount++;
  logger.info(`✅ 心跳正常 (${pongCount} 次响应)`);
});
```

### 3. 监控连接稳定性

```typescript
let connectionUptime = 0;
setInterval(() => {
  if (this.ws && this.ws.readyState === WebSocket.OPEN) {
    connectionUptime++;
    logger.info(`⏱️  连接稳定运行: ${connectionUptime * 15}秒`);
  }
}, 15000);
```

## ✅ 总结

### 当前状态

- ✅ **WebSocket 连接**: 成功实现（2026-01-01）
- ✅ **心跳机制**: WebSocket 协议层 Ping/Pong（15秒）
- ✅ **代理支持**: HTTP 代理配置完成
- ✅ **消息处理**: 订单簿 + 价格变化事件
- ✅ **容错机制**: 自动重连 + REST API 备用

### 关键要点

1. **心跳必须使用协议层方法**，不能发送 JSON 消息
2. **国内访问需要配置代理**（`POLYMARKET_WS_PROXY`）
3. **订阅使用 `assets_ids` 数组**，不是 `asset_id` 单个值
4. **心跳频率 15 秒**，比官方建议更保守，确保稳定
5. **WebSocket + REST 双重保障**，确保数据可靠性

### 性能指标

| 指标 | 数值 | 说明 |
|------|------|------|
| **延迟** | < 1秒 | WebSocket 实时推送 |
| **心跳频率** | 15秒 | 保持连接活跃 |
| **重连间隔** | 1-30秒 | 指数退避策略 |
| **备用轮询** | 45秒 | REST API 容错 |
