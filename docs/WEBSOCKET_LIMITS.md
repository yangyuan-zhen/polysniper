# Polymarket WebSocket Connection & Subscription Guide

> 🌏 **[中文文档](./WEBSOCKET_LIMITS.zh-CN.md)** | **English**

## 📋 Official Limits (Updated May 28, 2025)

| Limit Type | Description |
|---------|------|
| **Token Count** | ❌ No limit (100-token limit removed) |
| **API Rate Limit** | Yes, but no explicit subscription frequency limit for WebSocket |
| **Token ID Format** | Must be valid asset_id (token ID) |
| **Batch Size** | Recommended 10 per batch (best practice) |
| **Batch Interval** | Recommended 200ms (best practice) |

> ✅ **Good News**: Polymarket removed the 100-token subscription limit on May 28, 2025. You can now subscribe to unlimited tokens!

---

## 🚨 Common Issues

### Issue: Price Updates Stop After Some Time

**Symptoms**: Prices update normally after startup, but stop after a while

**Possible Causes**:
1. ❌ ~~Subscription limit~~  (no longer applicable)
2. ⚠️ WebSocket connection dropped/timeout
3. ⚠️ Invalid token ID format
4. ⚠️ Incorrect subscription message format

### Error Indication
```bash
⚠️ Received non-JSON message: INVALID OPERATION
```

This indicates the WebSocket server rejected the operation, usually because:
- Invalid token ID format
- Incorrect subscription message format
- Abnormal WebSocket connection state

---

## ✅ Solutions

### 1. Connection Health Check (New)

```typescript
// polymarketService.ts
private startConnectionCheck(): void {
  this.lastMessageTime = Date.now();
  
  this.connectionCheckInterval = setInterval(() => {
    const timeSinceLastMessage = Date.now() - this.lastMessageTime;
    
    // Reconnect if no message received for 60 seconds
    if (timeSinceLastMessage > 60000) {
      logger.warn(`⚠️ Connection may be down: ${Math.floor(timeSinceLastMessage / 1000)}s since last message`);
      this.ws.close(); // Trigger reconnection
    }
  }, 30000); // Check every 30 seconds
}
```

### 2. Token ID Validation

```typescript
subscribe(assetId: string, callback: (data: any) => void): void {
  // Validate Token ID format
  if (!assetId || typeof assetId !== 'string' || assetId.length === 0) {
    logger.warn(`⚠️ Invalid Token ID: ${assetId}`);
    return;
  }
  // ...
}
```

### 3. Batch Send Interval

```typescript
// 200ms interval between batches to avoid rate limits
setTimeout(() => {
  this.ws.send(messageString);
}, batchIndex * 200);
```

### 4. Re-subscribe After Reconnection

```typescript
this.ws.on('open', () => {
  // Re-subscribe to previous assets after reconnection
  if (this.subscribedAssets.size > 0) {
    logger.info(`🔄 Re-subscribing to ${this.subscribedAssets.size} markets after reconnection...`);
    // ... re-subscribe logic
  }
});
```

---

## 🎯 Optimization Strategies

### Strategy 1: Unsubscribe from Finished Matches (Recommended)

```typescript
// Unsubscribe after match ends to free resources
if (match.status === MatchStatus.FINAL) {
  polymarketService.unsubscribe(match.poly.homeTokenId);
  polymarketService.unsubscribe(match.poly.awayTokenId);
  logger.info(`🔕 Unsubscribed from finished match: ${match.homeTeam.name} vs ${match.awayTeam.name}`);
}
```

**Benefits**:
- Reduces unnecessary message traffic
- Keeps WebSocket connection clean
- Frees bandwidth for new matches

### Strategy 2: Prioritize Live Matches

```typescript
// Sort by match status, prioritize live matches
const sortedMatches = matches.sort((a, b) => {
  const statusPriority = {
    [MatchStatus.LIVE]: 1,
    [MatchStatus.SCHEDULED]: 2,
    [MatchStatus.FINAL]: 3,
  };
  return statusPriority[a.status] - statusPriority[b.status]  ;
});

// Subscribe to live matches first
sortedMatches.forEach(match => {
  if (match.status === MatchStatus.LIVE) {
    subscribeToMarketPrice(match);
  }
});
```

---

## 📝 Debug Information

### View Current Subscription Status

```bash
# Log output
📊 Currently subscribed: 22 markets
💚 Connection healthy: last message 5s ago
```

### Monitor Connection Health

```typescript  
// Check connection health every 30 seconds
const timeSinceLastMessage = Date.now() - this.lastMessageTime;
logger.debug(`💚 Connection healthy: last message ${Math.floor(timeSinceLastMessage / 1000)}s ago`);
```

---

## ⚠️ Important Notes

1. **Token ID Must Be Valid**
   - Must be valid asset_id (from Polymarket API)
   - Empty string or undefined causes `INVALID OPERATION`

2. **Connection Health Monitoring is Important**
   - If no message for 60s, connection may be down
   - Auto-reconnect will re-subscribe all tokens

3. **Unsubscribe Promptly**
   - Unsubscribe immediately after match ends
   - Reduces unnecessary message traffic
   - Improves overall system performance

4. **Monitor Error Logs**
   - If you see `INVALID OPERATION`, check recently subscribed Token IDs
   - Verify Token ID format is correct

---

## 🔧 Configuration Recommendations

### Recommended Settings
```typescript
// No subscription limit (Updated May 28, 2025)
BATCH_SIZE = 10;        // 10 per batch (best practice)
batchInterval = 200;    // 200ms interval (avoid rate limits)
heartbeatInterval = 15000;      // 15s heartbeat
connectionCheckInterval = 30000; // 30s health check
messageTimeout = 60000;         // 60s message timeout
```

---

## 📚 Related Documentation

- [Polymarket CLOB WebSocket API](https://docs.polymarket.com/)
- [System Architecture](./ARCHITECTURE.md)
- [Price Guide](./PRICE_GUIDE.md)
