# 🌐 Polymarket 公共 API 访问模式

## 📋 概述

本项目支持**两种访问模式**来获取 Polymarket 市场数据：

### 1️⃣ 公共数据模式（推荐，当前使用）✅

**特点**：
- ✅ **无需 API Key**
- ✅ **无需钱包私钥**
- ✅ **完全免费**
- ✅ **稳定可靠**

**数据来源**：Gamma Markets API (REST)

**可获取数据**：
- 市场列表
- 市场详情
- 实时价格
- 订单簿快照
- 交易量
- 流动性

**刷新频率**：45秒轮询一次

**配置**：
```env
# .env
POLYMARKET_GAMMA_API_URL=https://gamma-api.polymarket.com
POLYMARKET_API_KEY=  # 留空
```

---

### 2️⃣ WebSocket 实时模式（可选，需认证）

**特点**：
- ⚠️ **需要 API Key**
- ⚡ **实时推送**（毫秒级延迟）
- 🔐 **需要认证**

**数据来源**：CLOB WebSocket

**优势**：
- 价格变化立即推送
- 减少 API 调用次数
- 更低的延迟

**配置**：
```env
# .env
POLYMARKET_WS_URL=wss://ws-subscriptions-clob.polymarket.com/ws
POLYMARKET_API_KEY=your_api_key_here  # 必须配置
```

---

## 🔍 如何选择？

### 选择公共数据模式（当前推荐）

✅ **适用场景**：
- 只需要查看市场数据（不交易）
- 对实时性要求不高（45秒延迟可接受）
- 不想配置 API Key
- 开发和测试阶段

✅ **优势**：
- 配置简单，开箱即用
- 无需注册账号
- 稳定可靠

❌ **限制**：
- 数据有45秒延迟
- 不支持实时推送

### 选择 WebSocket 实时模式

✅ **适用场景**：
- 需要毫秒级实时数据
- 对价格变化敏感
- 生产环境部署

⚠️ **要求**：
- 需要申请 Polymarket API Key
- 需要维护 WebSocket 连接

---

## 📖 获取 API Key（可选）

如果需要 WebSocket 实时推送，可以按以下步骤获取 API Key：

### 1. 注册 Polymarket 账号
访问 [Polymarket](https://polymarket.com)

### 2. 申请 API 访问权限
参考官方文档：https://docs.polymarket.com

### 3. 配置到项目
```env
# .env
POLYMARKET_API_KEY=your_api_key_here
```

---

## 🔧 当前项目配置

### 默认配置（公共数据模式）

```typescript
// server/src/services/polymarketService.ts

// ✅ Gamma API - 公开访问，无需认证
async getMarkets() {
  const response = await axios.get(
    'https://gamma-api.polymarket.com/markets',
    { /* 无需 headers */ }
  );
}

// ✅ 获取价格 - 公开访问
async getTokenPrice(tokenId: string) {
  const response = await axios.get(
    `https://gamma-api.polymarket.com/prices/${tokenId}`,
    { /* 无需 headers */ }
  );
}
```

### WebSocket 连接（自动跳过）

```typescript
// 如果没有 API Key，自动跳过 WebSocket 连接
async connectWebSocket() {
  if (!this.apiKey) {
    logger.info('⚠️ 未配置 API Key，跳过 WebSocket 连接');
    logger.info('💡 使用 Gamma API (REST) 获取公共市场数据（无需认证）');
    return; // 不尝试连接
  }
  
  // 有 API Key 时才连接
  this.ws = new WebSocket(this.wsUrl, {
    headers: { 'Authorization': `Bearer ${this.apiKey}` }
  });
}
```

---

## 📊 数据流程对比

### 公共数据模式（当前）

```
虎扑 API
   ↓
获取 NBA 比赛列表
   ↓
Polymarket Gamma API (REST)
   ↓ (每45秒轮询)
获取市场价格
   ↓
计算套利机会
   ↓
WebSocket Server → 前端
```

### WebSocket 实时模式（可选）

```
虎扑 API
   ↓
获取 NBA 比赛列表
   ↓
Polymarket CLOB WebSocket (需认证)
   ↓ (实时推送)
接收价格更新
   ↓
计算套利机会
   ↓
WebSocket Server → 前端
```

---

## ⚠️ 常见问题

### Q: 为什么提示 "Error: read ECONNRESET"？

**A**: CLOB WebSocket 需要 API Key 认证，没有 API Key 时会被拒绝连接。

**解决方案**：
1. ✅ **推荐**：不配置 API Key，使用公共 Gamma API（当前实现）
2. 或：申请 API Key 并配置到 `.env` 文件

### Q: 公共数据模式的数据准确吗？

**A**: 是的。Gamma API 是 Polymarket 官方提供的公共数据接口，数据准确可靠。

### Q: 45秒刷新频率够用吗？

**A**: 
- ✅ **开发阶段**：完全够用
- ✅ **数据验证**：足够验证套利逻辑
- ⚠️ **高频交易**：建议使用 WebSocket 实时模式

### Q: 如何知道当前使用哪种模式？

**A**: 查看服务器启动日志：

```bash
# 公共数据模式
⚠️ 未配置 API Key，跳过 WebSocket 连接
💡 使用 Gamma API (REST) 获取公共市场数据（无需认证）

# WebSocket 实时模式
连接 Polymarket WebSocket (使用 API Key)
已连接到 Polymarket WebSocket
```

---

## 🎯 总结

| 特性 | 公共数据模式 | WebSocket 实时模式 |
|------|-------------|------------------|
| API Key | ❌ 不需要 | ✅ 需要 |
| 认证 | ❌ 无 | ✅ 需要 |
| 实时性 | 45秒延迟 | 毫秒级 |
| 稳定性 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| 配置难度 | 简单 | 中等 |
| 适用阶段 | 开发/测试 | 生产环境 |
| **推荐度** | ✅ **当前推荐** | 可选 |

**当前项目**：使用**公共数据模式**，无需任何配置，开箱即用！✅

---

## 📚 参考资料

- [Polymarket 官方文档](https://docs.polymarket.com)
- [Gamma API 文档](https://docs.polymarket.com/developers/gamma-markets-api/overview)
- [CLOB WebSocket 文档](https://docs.polymarket.com/developers/CLOB/websocket/market-channel)
- [中文开发者快速开始](https://polymarketcn.com/api-tutorial/quickstart)
