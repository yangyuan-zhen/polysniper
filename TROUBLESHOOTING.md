# 🔧 故障排除指南

## 常见问题

### 1. TLS 连接错误 ❌

**错误信息**：
```
Client network socket disconnected before secure TLS connection was established
```

**原因分析**：
- Clash代理未启动或配置不正确
- 网络连接不稳定
- Polymarket服务器访问受限

**解决步骤**：

#### ✅ 步骤1：检查Clash代理
```bash
# 确认Clash正在运行
# 查看系统托盘 - Clash图标应该是绿色的

# 确认代理端口正确
# 默认: http://127.0.0.1:7890
```

#### ✅ 步骤2：检查环境变量
`.env` 文件中确认：
```bash
HTTP_PROXY=http://127.0.0.1:7890
HTTPS_PROXY=http://127.0.0.1:7890
```

#### ✅ 步骤3：测试代理连接
在浏览器中访问：
```
https://clob.polymarket.com
https://gamma-api.polymarket.com
```

如果能访问，说明代理正常。

#### ✅ 步骤4：重启开发服务器
```bash
# Ctrl+C 停止
npm run dev
```

#### ✅ 步骤5：检查代理模式
Clash设置中确认：
- ✅ 系统代理：**已启用**
- ✅ 模式：**规则模式** 或 **全局模式**
- ❌ 直连模式：不要使用

---

### 2. API 请求超时 ⏱️

**错误信息**：
```
[Market Depth] Order book request timeout (attempt 1/3)
```

**原因分析**：
- 网络速度慢
- Polymarket服务器响应慢
- 代理不稳定

**解决方案**：

#### 方案A：已自动重试 ✅
系统会自动重试最多2次，你不需要手动操作。

#### 方案B：增加超时时间
如果经常超时，可以修改超时配置：

**文件**: `src/services/marketDepth.ts`
```typescript
// 找到并修改
const timeout = 5000; // 改为 10000（10秒）
```

**文件**: `src/services/api.ts`
```typescript
// 找到并修改
const timeout = 8000; // 改为 15000（15秒）
```

---

### 3. WebSocket 连接失败 🔌

**错误信息**：
```
[WebSocket] Connection failed: ...
```

**解决方案**：

#### 方案A：禁用WebSocket，使用REST API
`.env` 文件中设置：
```bash
VITE_ENABLE_WEBSOCKET=false
```

这样会完全使用REST API轮询（30秒更新）。

#### 方案B：检查WebSocket代理支持
确认Clash支持WebSocket协议（wss://）。

---

### 4. 虎扑 API 连接重置 🏀

**错误信息**：
```
[vite] http proxy error: /1/7.5.60/basketballapi/scheduleList
Error: read ECONNRESET
```

**原因分析**：
虎扑API服务器不稳定或拒绝连接。

**解决方案**：

#### 已自动重试 ✅
系统会自动重试最多2次，等待1秒后重试。

#### 如果持续失败
虎扑API可能暂时不可用，等待几分钟后会自动恢复。

---

### 5. 大量并发请求导致资源耗尽 ⚠️

**错误信息**：
```
ERR_INSUFFICIENT_RESOURCES
```

**解决方案**：

已在v2.0.0中修复：
- ✅ 添加随机延迟（0-5秒）
- ✅ 降低轮询频率（30秒）
- ✅ 启用WebSocket减少请求

确保使用最新版本。

---

## 调试技巧

### 查看详细日志

打开浏览器控制台（F12），查看：

**正常日志**：
```
[WebSocket] ✓ Connected
[WebSocket] Subscribing to 2 tokens
[Market Depth] Fetching order book...
```

**错误日志**：
```
[Market Depth] Error fetching spread (attempt 1/3): ...
[Polymarket] CLOB price request timeout (attempt 2/3)
```

### 监控网络请求

1. 打开 DevTools → Network
2. 筛选 XHR 和 WS
3. 查看失败的请求
4. 检查状态码和错误消息

---

## 性能优化建议

### 如果网络较慢

**方案1：仅使用WebSocket**
```bash
# .env
VITE_ENABLE_WEBSOCKET=true
```
这样可以大幅减少REST API请求。

**方案2：增加轮询间隔**
```typescript
// src/components/MatchCard.tsx
// 找到并修改
const pollingInterval = 30000; // 改为 60000（60秒）
```

### 如果Clash不稳定

**使用其他代理工具**：
- V2Ray
- ClashX Pro
- Shadowrocket（macOS）

更新 `.env` 中的代理地址：
```bash
HTTP_PROXY=http://127.0.0.1:YOUR_PROXY_PORT
HTTPS_PROXY=http://127.0.0.1:YOUR_PROXY_PORT
```

---

## 快速诊断清单

### ✅ 启动前检查

- [ ] Clash代理已启动
- [ ] 系统代理模式已启用
- [ ] `.env` 文件配置正确
- [ ] 端口号正确（默认7890）

### ✅ 运行时检查

- [ ] 浏览器能访问 Polymarket网站
- [ ] 控制台没有红色错误
- [ ] WebSocket连接显示 "✓ Connected"
- [ ] 价格数据正常更新

### ✅ 故障排查

1. 重启Clash代理
2. 重启开发服务器（`npm run dev`）
3. 清除浏览器缓存（Ctrl+Shift+Delete）
4. 检查防火墙设置
5. 尝试切换代理模式（规则/全局）

---

## 联系支持

如果上述方法都无法解决问题，请提供以下信息：

1. **错误日志** - 浏览器控制台的完整错误信息
2. **网络日志** - DevTools Network面板截图
3. **环境信息** - 操作系统、Node版本、代理工具
4. **复现步骤** - 如何触发错误

---

## 已知限制

### Polymarket API 限制
- 请求频率限制（未公开具体数值）
- 某些地区可能需要代理访问

### WebSocket 限制
- 依赖浏览器WebSocket API（IE不支持）
- 需要稳定的网络连接
- 代理工具必须支持WSS协议

### 虎扑 API 限制
- 响应速度较慢（通常2-3秒）
- 偶尔会返回错误或超时
- 没有官方文档和技术支持

---

## 版本信息

- **当前版本**: v2.0.1
- **最后更新**: 2025-11-25
- **重试机制**: ✅ 已添加
- **超时控制**: ✅ 已添加
- **错误处理**: ✅ 已优化

---

📞 如有疑问，请查阅其他文档：
- [README.md](./README.md) - 项目概览
- [WEBSOCKET_STATUS.md](./WEBSOCKET_STATUS.md) - WebSocket实现
- [CHANGELOG.md](./CHANGELOG.md) - 更新日志
