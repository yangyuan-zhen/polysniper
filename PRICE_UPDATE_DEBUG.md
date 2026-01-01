# 🔍 价格更新问题诊断

## 🐛 问题：价格没有实时更新

### 📋 诊断清单

请按顺序检查以下项目，并记录每一步的结果：

---

## 1️⃣ 检查 WebSocket 连接

### 查看后端日志

启动服务器后，应该看到：

```bash
# ✅ 正常日志
连接 Polymarket WebSocket (无 API Key)
已连接到 Polymarket WebSocket
✅ Polymarket WebSocket 已就绪，等待订阅具体 token
```

### ❌ 如果没有看到

**可能原因**:
- WebSocket URL 不正确
- 网络连接问题
- 防火墙阻止

**解决方法**:
```bash
# 检查配置
cat server/src/config/index.ts | grep wsUrl

# 应该显示
wsUrl: 'wss://ws-subscriptions-clob.polymarket.com/ws'
```

---

## 2️⃣ 检查是否订阅了市场

### 查看后端日志

当找到 Polymarket 市场后，应该看到：

```bash
# ✅ 正常订阅日志
🔔 订阅市场价格 [Lakers vs Warriors]
   Market ID: 0x1a2b3c...
   主队 Token: 0x4d5e6f...
   客队 Token: 0x7g8h9i...
📡 订阅 token 价格: 0x4d5e6f...
📡 订阅 token 价格: 0x7g8h9i...
```

### ❌ 如果没有看到订阅日志

**可能原因 1**: 没有找到 Polymarket 市场

查看是否有这些日志：
```bash
未找到队名映射: XXX vs YYY
Polymarket 数据获取失败
```

**解决方法**: 检查队名映射
```bash
# 查看支持的队名
cat server/src/config/teamMappings.ts
```

**可能原因 2**: WebSocket 未启用

**解决方法**:
```typescript
// server/src/config/index.ts
wsEnabled: true, // 确保为 true
```

---

## 3️⃣ 检查是否收到 WebSocket 消息

### 查看后端日志（调试模式）

设置日志级别为 debug：
```bash
# .env
LOG_LEVEL=debug
```

重启后应该看到：
```bash
# ✅ 正常消息日志
收到 WS 消息: {"event_type":"book","asset_id":"0x...","bids":[...],"asks":[...]}
💰 订单簿价格 [0x4d5e6f...]: $0.5234 (买:0.5200, 卖:0.5268)
通知 1 个订阅者
```

### ❌ 如果没有收到消息

**可能原因 1**: Polymarket 市场没有交易活动
- 等待更长时间（5-10分钟）
- NBA 赛季结束时可能没有活跃市场

**可能原因 2**: 订阅消息格式不正确

**测试**: 运行测试脚本
```bash
cd server
npm run test:polymarket-ws

# 查看是否收到价格更新
```

**可能原因 3**: Token ID 不正确

查看日志中的 Token ID，然后手动检查：
```bash
# 访问 Polymarket API
curl "https://gamma-api.polymarket.com/markets?limit=5"
```

---

## 4️⃣ 检查价格是否更新到内存

### 查看后端日志

当收到价格更新后，应该看到：
```bash
# ✅ 价格变化日志
收到主队价格回调: 0.5234 (旧价格: 0.5200)
🔴 实时价格更新 [Lakers]: $0.5200 → $0.5234
```

### ❌ 如果收到消息但没有更新

**可能原因 1**: 价格变化太小（<0.01）

**调试**: 暂时降低阈值
```typescript
// dataAggregator.ts
if (newPrice && Math.abs(newPrice - oldPrice) > 0.001) { // 改为 0.001
  logger.info(`价格更新...`);
}
```

**可能原因 2**: 回调函数没有被调用

查看是否有这个日志：
```bash
⚠️ 没有订阅者: 0x4d5e6f...
```

如果有，说明订阅逻辑有问题。

---

## 5️⃣ 检查前端是否收到更新

### 打开浏览器控制台

应该看到：
```bash
# ✅ 前端接收日志
[App] 📊 收到比赛更新: 5 场比赛 下午2:30:45
[App] 📊 收到比赛更新: 5 场比赛 下午2:30:47
```

### ❌ 如果前端没有收到

**检查后端 WebSocket 推送**:
```bash
# 后端日志
📡 数据变化，推送更新 (5 场比赛) → 1 个客户端
```

- 如果 `→ 0 个客户端`：前端没有连接
- 如果 `→ 1 个客户端` 但前端没收到：WebSocket 推送失败

---

## 🧪 运行测试脚本

### 测试 1: Polymarket WebSocket

```bash
cd server
npx ts-node src/test/testPolymarketWS.ts
```

**期望输出**:
```bash
✅ 找到 5 个市场
📊 使用市场: Will the Lakers beat the Warriors?
📡 订阅 token 价格: 0x4d5e6f...
🔴 主队价格更新 [1]: $0.5234
```

### 测试 2: 完整数据流

```bash
# 启动服务器
npm run dev

# 查看日志，确认以下步骤：
1. ✅ Polymarket WebSocket 已就绪
2. ✅ 找到比赛数据
3. ✅ 订阅市场价格
4. ✅ 收到 WS 消息
5. ✅ 价格更新到内存
6. ✅ 推送给前端
```

---

## 🔧 常见问题和解决方案

### 问题 1: WebSocket 连接失败

```bash
WebSocket 错误: connect ECONNREFUSED
```

**解决**: 
- 检查网络连接
- 检查 WSS URL
- 尝试使用代理

### 问题 2: 订阅消息被拒绝

```bash
收到 WS 消息: {"type":"error","message":"Invalid subscription"}
```

**解决**:
- 检查消息格式
- 确认 Token ID 正确
- 查看 Polymarket CLOB API 文档

### 问题 3: 收到消息但没有订阅者

```bash
⚠️ 没有订阅者: 0x4d5e6f...
```

**解决**:
- 确认订阅时机正确
- 检查 Token ID 匹配

### 问题 4: 价格变化但前端不显示

**检查**:
1. 后端是否推送？
   ```bash
   📡 数据变化，推送更新 → 1 个客户端
   ```

2. 前端是否接收？
   ```bash
   [App] 📊 收到比赛更新
   ```

3. 价格是否真的变化？
   - 检查快照比较逻辑
   - 价格四舍五入到2位小数

---

## 📊 完整诊断流程

```
1. 检查后端日志
   ├─ ✅ WebSocket 已连接
   ├─ ✅ 找到比赛
   ├─ ✅ 找到 Polymarket 市场
   └─ ✅ 订阅 token

2. 等待价格更新
   ├─ ✅ 收到 WS 消息
   ├─ ✅ 通知订阅者
   └─ ✅ 价格更新到内存

3. 检查推送
   ├─ ✅ 数据变化检测
   └─ ✅ 推送给客户端

4. 检查前端
   ├─ ✅ 接收更新
   └─ ✅ UI 更新
```

---

## 🎯 快速排查命令

```bash
# 1. 查看最近的价格相关日志
grep "价格" server/logs/combined.log | tail -20

# 2. 查看 WebSocket 连接日志
grep "WebSocket" server/logs/combined.log | tail -10

# 3. 查看订阅日志
grep "订阅" server/logs/combined.log | tail -10

# 4. 查看推送日志
grep "推送更新" server/logs/combined.log | tail -10

# 5. 实时监控
tail -f server/logs/combined.log | grep -E "(价格|WebSocket|订阅)"
```

---

## 📝 报告问题模板

如果以上步骤都检查了还是不行，请提供以下信息：

```
### 环境信息
- Node 版本: 
- 操作系统: 
- 网络环境: 

### 日志片段

#### 1. WebSocket 连接日志
```
[粘贴日志]
```

#### 2. 订阅日志
```
[粘贴日志]
```

#### 3. 消息接收日志
```
[粘贴日志]
```

#### 4. 价格更新日志
```
[粘贴日志]
```

### 测试结果
- [ ] Polymarket WebSocket 测试
- [ ] 前端 WebSocket 连接测试
- [ ] 完整数据流测试

### 问题描述
[详细描述问题]
```

---

## ✅ 成功标志

当一切正常时，应该看到：

**后端日志**:
```bash
✅ Polymarket WebSocket 已就绪
🔔 订阅市场价格 [Lakers vs Warriors]
📡 订阅 token 价格: 0x4d5e6f...
💰 订单簿价格 [0x4d5e6f...]: $0.5234
🔴 实时价格更新 [Lakers]: $0.5200 → $0.5234
📡 数据变化，推送更新 → 1 个客户端
```

**前端控制台**:
```bash
[App] ✅ WebSocket 已连接
[App] 📊 收到比赛更新: 5 场比赛 下午2:30:45
[App] 📊 收到比赛更新: 5 场比赛 下午2:30:47
```

---

**更新时间**: 2025-12-26  
**版本**: v1.0  
**状态**: 等待用户反馈
