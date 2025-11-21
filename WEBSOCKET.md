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

⚠️ Polymarket WebSocket 需要通过 VPN/Clash 访问（与 HTTP API 相同）  
⚠️ 浏览器 WebSocket 不能使用 Vite 代理，必须直连  
⚠️ 确保 Clash 的系统代理已开启  
