# Polymarket WebSocket 连接与订阅指南

## 📋 官方限制（2025年5月28日更新）

| 限制类型 | 说明 |
|---------|------|
| **Token 数量** | ❌ 无限制（已移除 100 个上限） |
| **API 速率限制** | 有，但 WebSocket 本身没有明确的订阅频率限制 |
| **Token ID 格式** | 必须是有效的 asset_id（token ID） |
| **批次大小** | 建议每批 10 个（最佳实践） |
| **批次间隔** | 建议 200ms（最佳实践） |

> ✅ **好消息**：Polymarket 在 2025年5月28日 移除了 100 token 订阅限制，现在可以订阅任意数量的 token ID！

---

## 🚨 常见问题

### 问题：价格更新一段时间后停止

**症状**：项目启动后，价格正常更新，但过一会儿就不再更新了

**可能原因**：
1. ❌ ~~订阅数量限制~~（已不再适用）
2. ⚠️ WebSocket 连接断开/超时
3. ⚠️ Token ID 格式错误
4. ⚠️ 订阅消息格式错误

### 错误表现
```bash
⚠️ 收到非 JSON 消息: INVALID OPERATION
```

这表示 WebSocket 服务器拒绝了操作，通常是因为：
- Token ID 格式无效
- 订阅消息格式错误
- WebSocket 连接状态异常

---

## ✅ 解决方案

### 1. 连接健康检查（新增）

```typescript
// polymarketService.ts
private startConnectionCheck(): void {
  this.lastMessageTime = Date.now();
  
  this.connectionCheckInterval = setInterval(() => {
    const timeSinceLastMessage = Date.now() - this.lastMessageTime;
    
    // 如果超过60秒没有收到消息，主动重连
    if (timeSinceLastMessage > 60000) {
      logger.warn(`⚠️ 连接可能断开：已 ${Math.floor(timeSinceLastMessage / 1000)}s 未收到消息`);
      this.ws.close(); // 触发重连
    }
  }, 30000); // 每30秒检查一次
}
```

### 2. Token ID 验证

```typescript
subscribe(assetId: string, callback: (data: any) => void): void {
  // 验证 Token ID 格式
  if (!assetId || typeof assetId !== 'string' || assetId.length === 0) {
    logger.warn(`⚠️ 无效的 Token ID: ${assetId}`);
    return;
  }
  // ...
}
```

### 3. 批次发送间隔

```typescript
// 每批间隔 200ms，避免速率限制
setTimeout(() => {
  this.ws.send(messageString);
}, batchIndex * 200);
```

### 4. 重连后重新订阅

```typescript
this.ws.on('open', () => {
  // 重连后重新订阅之前的 assets
  if (this.subscribedAssets.size > 0) {
    logger.info(`🔄 重连后重新订阅 ${this.subscribedAssets.size} 个市场...`);
    // ... 重新订阅逻辑
  }
});
```

### 5. 错误日志增强

```typescript
if (rawMessage === 'INVALID OPERATION') {
  logger.error(`❌ WebSocket 操作被拒绝`);
  logger.error(`   可能原因：Token ID 格式错误或订阅消息格式错误`);
  logger.error(`   最近订阅的 tokens:`);
  const recentAssets = Array.from(this.subscribedAssets).slice(-5);
  recentAssets.forEach(id => logger.error(`     - ${id}`));
}
```

### 6. 消息时间戳跟踪

```typescript
this.ws.on('message', (data) => {
  // 更新最后收到消息的时间
  this.lastMessageTime = Date.now();
  // ...
});
```

---

## 🎯 优化策略

### 策略 1：取消已结束比赛的订阅（推荐）

```typescript
// 比赛结束后取消订阅，释放资源
if (match.status === MatchStatus.FINAL) {
  polymarketService.unsubscribe(match.poly.homeTokenId);
  polymarketService.unsubscribe(match.poly.awayTokenId);
  logger.info(`🔕 已取消订阅已结束的比赛: ${match.homeTeam.name} vs ${match.awayTeam.name}`);
}
```

**优点**：
- 减少不必要的消息流量
- 保持 WebSocket 连接清爽
- 为新比赛腾出带宽

### 策略 2：优先订阅进行中的比赛

```typescript
// 按比赛状态排序，优先订阅进行中的比赛
const sortedMatches = matches.sort((a, b) => {
  const statusPriority = {
    [MatchStatus.LIVE]: 1,
    [MatchStatus.SCHEDULED]: 2,
    [MatchStatus.FINAL]: 3,
  };
  return statusPriority[a.status] - statusPriority[b.status];
});

// 先订阅进行中的比赛
sortedMatches.forEach(match => {
  if (match.status === MatchStatus.LIVE) {
    subscribeToMarketPrice(match);
  }
});
```

### 策略 3：只订阅有套利机会的市场

```typescript
// 只订阅有套利信号的市场
if (match.signals.length > 0) {
  subscribeToMarketPrice(match);
} else {
  logger.debug(`⏭️ 跳过无套利机会的市场`);
}
```

**注意**：这可能导致错过新出现的套利机会，需权衡利弊。

---

## 📝 调试信息

### 查看当前订阅状态

```bash
# 日志输出
📊 当前已订阅: 22 个市场
💚 连接健康：最后消息 5s 前
```

### 监控连接健康

```typescript
// 每30秒检查连接健康
const timeSinceLastMessage = Date.now() - this.lastMessageTime;
logger.debug(`💚 连接健康：最后消息 ${Math.floor(timeSinceLastMessage / 1000)}s 前`);
```

### 监控订阅数量

```typescript
logger.info(`当前已订阅: ${this.subscribedAssets.size} 个市场`);
logger.info(`待订阅: ${this.pendingSubscriptions.size} 个市场`);
```

---

## ⚠️ 注意事项

1. **Token ID 必须有效**
   - 必须是有效的 asset_id（来自 Polymarket API）
   - 空字符串或 undefined 会导致 `INVALID OPERATION`

2. **连接健康监控很重要**
   - 超过60秒没有消息，可能连接已断开
   - 自动重连机制会重新订阅所有 token

3. **及时取消订阅**
   - 比赛结束后立即取消订阅
   - 减少不必要的消息流量
   - 提升系统整体性能

4. **监控错误日志**
   - 如果看到 `INVALID OPERATION`，检查最近订阅的 Token ID
   - 确认 Token ID 格式正确

---

## 🔧 配置建议

### 推荐配置
```typescript
// 无订阅数量限制（2025年5月28日更新）
BATCH_SIZE = 10;        // 每批10个（最佳实践）
batchInterval = 200;    // 200ms间隔（避免速率限制）
heartbeatInterval = 15000;     // 15秒心跳
connectionCheckInterval = 30000; // 30秒健康检查
messageTimeout = 60000;         // 60秒消息超时
```

---

## 📚 相关文档

- [Polymarket CLOB WebSocket API](https://docs.polymarket.com/)
- [系统架构](./ARCHITECTURE.md)
- [价格使用指南](./PRICE_GUIDE.md)
