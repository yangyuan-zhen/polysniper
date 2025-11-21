# WebSocket 实时价格更新

## 工作原理

### 数据更新方式

现在系统使用**混合更新策略**：

1. **WebSocket 实时更新**（主要方式）
   - 连接到：`wss://ws-subscriptions-clob.polymarket.com/ws/market`
   - 订阅每个市场的 CLOB Token IDs
   - 价格变化时立即推送更新（毫秒级延迟）
   - 自动重连机制

2. **HTTP 轮询**（备用方式）
   - 每 60 秒轮询一次
   - 用于 WebSocket 连接失败时的降级方案

3. **比分数据**
   - 每 30 秒从虎扑 API 更新
   - 更新比分、节数、剩余时间

## 更新频率对比

| 数据类型 | 旧方式（轮询） | 新方式（WebSocket） |
|---------|--------------|-------------------|
| Polymarket 价格 | 30秒 | 实时（<100ms） |
| 比分数据 | 30秒 | 30秒 |
| 比赛状态 | 30秒 | 30秒 |

## 优势

✅ **实时性**：价格变化立即显示，延迟 <100ms  
✅ **效率高**：减少不必要的 API 调用  
✅ **带宽低**：只传输变化的数据  
✅ **自动重连**：连接断开后 5 秒自动重连  
✅ **智能降级**：WebSocket 失败时回退到轮询  

## 工作流程

```
页面加载
  │
  ├─→ 获取市场数据（HTTP）
  │    └─→ 解析 Token IDs
  │
  ├─→ 连接 WebSocket
  │    └─→ 订阅 Token IDs
  │
  └─→ 启动 60秒轮询（备用）

价格变化
  │
  └─→ WebSocket 推送
       └─→ 更新 UI（实时）

WebSocket 断开
  │
  └─→ 5秒后自动重连
       └─→ 重新订阅所有 Token IDs
```

## 控制台日志

开启 WebSocket 后，你会看到：

```
[WebSocket] 连接到 Polymarket...
[WebSocket] 已连接
[WS订阅] 黄蜂 vs 步行者: ["123456", "789012"]
[WebSocket] 订阅: 123456
[WebSocket] 订阅: 789012
[WS价格] 123456 = 0.465
[WS价格] 789012 = 0.535
```

## 资源管理

- 组件卸载时自动取消订阅
- 比赛结束后停止订阅
- 智能清理 WebSocket 连接

## 注意事项

⚠️ **Polymarket WebSocket 需要通过 VPN/Clash 访问**（与 HTTP API 相同）  
⚠️ **浏览器 WebSocket 不能使用 Vite 代理**，必须直连  
⚠️ **确保 Clash 的系统代理已开启**

## 技术细节

### 订阅消息格式
```json
{
  "auth": {},
  "type": "market",
  "market": "0x123456...",
  "assets_ids": ["123456", "789012"]
}
```

### 价格推送格式
```json
{
  "event_type": "price_change",
  "asset_id": "123456",
  "price": "0.465"
}
```

### 重连策略
- 连接断开后等待 5 秒
- 自动重新连接
- 重新订阅所有 Token IDs
- 最多重试 10 次

## 性能优化

### 批量订阅
系统会将多个市场的订阅请求合并，避免频繁发送小消息。

### 智能去重
相同 Token ID 只订阅一次，即使多场比赛使用同一市场。

### 内存管理
- 自动清理已结束比赛的订阅
- 组件卸载时取消订阅
- 页面隐藏时暂停连接（可选）

## 数据流图

```
Polymarket WebSocket Server
           ↓
    wss://ws-subscriptions-clob.polymarket.com
           ↓
      [订阅 Token IDs]
           ↓
    [实时价格推送] ← 价格变化
           ↓
   websocketManager.ts
           ↓
   updatePriceData() → Redux Store
           ↓
      React 组件重新渲染
           ↓
        UI 更新
```

## 与 HTTP 轮询对比

| 特性 | WebSocket | HTTP 轮询 |
|------|-----------|-----------|
| **延迟** | <100ms | 30-60s |
| **带宽** | 极低（仅变化） | 较高（每次全量） |
| **服务器负载** | 低 | 高 |
| **实时性** | ✅ 优秀 | ⚠️ 一般 |
| **实现复杂度** | 中等 | 简单 |
| **稳定性** | 需要重连机制 | 简单可靠 |

## 故障排查

### WebSocket 连接失败
1. 检查 Clash 系统代理是否开启
2. 查看浏览器控制台是否有跨域错误
3. 尝试直接访问 `wss://ws-subscriptions-clob.polymarket.com`

### 价格不更新
1. 检查控制台是否有 `[WS价格]` 日志
2. 确认市场 Token ID 是否正确
3. 检查 Redux Store 是否正确更新

### 频繁断线
1. 检查网络稳定性
2. 调整重连延迟时间
3. 考虑使用 HTTP 轮询作为备用  
