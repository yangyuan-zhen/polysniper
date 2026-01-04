# PolySniper Backend - API 接口文档

> 🌏 **中文** | **[English](./API.md)**

## 📋 目录

- [概述](#概述)
- [REST API](#rest-api)
  - [健康检查](#健康检查)
  - [获取比赛列表](#获取比赛列表)
  - [获取单场比赛](#获取单场比赛)
  - [获取套利信号](#获取套利信号)
  - [获取统计信息](#获取统计信息)
- [WebSocket API](#websocket-api)
  - [连接](#连接)
  - [订阅比赛](#订阅比赛)
  - [取消订阅](#取消订阅)
  - [接收更新](#接收更新)
- [数据模型](#数据模型)
- [错误处理](#错误处理)
- [示例代码](#示例代码)

---

## 概述

**基础 URL**: `http://localhost:3000`

**WebSocket URL**: `ws://localhost:3000`

**限流**: 100 请求/分钟（仅适用于 `/api/*` 路径）

**数据更新频率**: 
- REST API: 实时（无缓存）
- WebSocket: 每 3 秒推送
- 后台数据采集: 每 5 秒刷新

---

## REST API

### 健康检查

**描述**: 检查服务器健康状态

**路径**: `GET /health`

**参数**: 无

**响应**:

```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "timestamp": "2025-12-16T09:18:00.000Z",
    "uptime": 3600.5
  }
}
```

**字段说明**:
- `status`: 服务状态 (`healthy`)
- `timestamp`: 当前时间（ISO 8601）
- `uptime`: 服务运行时长（秒）

---

### 获取比赛列表

**描述**: 获取所有比赛数据，支持筛选

**路径**: `GET /api/matches`

**Query 参数**:

| 参数 | 类型 | 必填 | 说明 | 示例 |
|------|------|------|------|------|
| `status` | string | 否 | 按比赛状态筛选 | `LIVE`, `PRE`, `FINAL` |
| `hasSignals` | boolean | 否 | 只返回有套利信号的比赛 | `true`, `false` |

**请求示例**:

```bash
# 获取所有比赛
GET /api/matches

# 获取进行中的比赛
GET /api/matches?status=LIVE

# 获取有套利信号的比赛
GET /api/matches?hasSignals=true

# 组合筛选
GET /api/matches?status=LIVE&hasSignals=true
```

**响应**:

```json
{
  "success": true,
  "data": [
    {
      "id": "BOS-DET-20251216",
      "homeTeam": {
        "id": "BOS",
        "name": "Boston Celtics",
        "score": 57,
        "logo": "https://..."
      },
      "awayTeam": {
        "id": "DET",
        "name": "Detroit Pistons",
        "score": 53,
        "logo": "https://..."
      },
      "status": "LIVE",
      "statusStr": "Q2 00:00",
      "startTime": "2025-12-16T01:00:00.000Z",
      "poly": {
        "marketId": "0x...",
        "homeTokenId": "123",
        "awayTokenId": "456",
        "homePrice": 0.68,
        "awayPrice": 0.32,
        "homeVolume": 50000,
        "awayVolume": 25000,
        "liquidity": 100000
      },
      "espn": {
        "homeWinProb": 0.674,
        "awayWinProb": 0.326,
        "pregameHomeWinProb": 0.674,
        "pregameAwayWinProb": 0.326,
        "injuries": []
      },
      "signals": [
        {
          "type": "BUY_HOME",
          "confidence": 0.75,
          "edge": 5.2,
          "reason": "ESPN胜率(67.4%)明显高于Polymarket价格(68.0%)",
          "timestamp": 1734325080000,
          "details": {
            "espnProb": 0.674,
            "polyPrice": 0.68,
            "priceDiff": 0.006,
            "scoreDiff": 4,
            "timeRemaining": "Q2 00:00"
          }
        }
      ],
      "lastUpdate": 1734325080000,
      "dataCompleteness": {
        "hasPolyData": true,
        "hasESPNData": true
      }
    }
  ],
  "timestamp": "2025-12-16T09:18:00.000Z",
  "cached": false
}
```

---

### 获取单场比赛

**描述**: 根据比赛 ID 获取详细数据

**路径**: `GET /api/matches/:id`

**路径参数**:

| 参数 | 类型 | 说明 | 示例 |
|------|------|------|------|
| `id` | string | 比赛唯一标识 | `BOS-DET-20251216` |

**请求示例**:

```bash
GET /api/matches/BOS-DET-20251216
```

**响应**: 与 [获取比赛列表](#获取比赛列表) 中的单个比赛对象结构相同

**错误响应**:

```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Match BOS-DET-20251216 not found"
  },
  "timestamp": "2025-12-16T09:18:00.000Z"
}
```

---

### 获取套利信号

**描述**: 获取所有包含套利信号的比赛，按置信度降序排列

**路径**: `GET /api/signals`

**参数**: 无

**请求示例**:

```bash
GET /api/signals
```

**响应**:

```json
{
  "success": true,
  "data": [
    {
      "id": "BOS-DET-20251216",
      "homeTeam": { ... },
      "awayTeam": { ... },
      "signals": [
        {
          "type": "BUY_HOME",
          "confidence": 0.85,
          "edge": 8.5,
          "reason": "强套利机会：ESPN胜率远高于市场价格",
          "timestamp": 1734325080000,
          "details": {
            "espnProb": 0.85,
            "polyPrice": 0.76,
            "priceDiff": 0.09,
            "scoreDiff": 10,
            "timeRemaining": "Q4 05:30"
          }
        }
      ],
      ...
    }
  ],
  "timestamp": "2025-12-16T09:18:00.000Z"
}
```

**说明**:
- 返回的比赛按最高置信度降序排列
- 只包含 `signals` 数组非空的比赛

---

### 获取统计信息

**描述**: 获取系统整体统计数据

**路径**: `GET /api/stats`

**参数**: 无

**请求示例**:

```bash
GET /api/stats
```

**响应**:

```json
{
  "success": true,
  "data": {
    "totalMatches": 5,
    "liveMatches": 2,
    "matchesWithSignals": 1,
    "totalSignals": 3,
    "avgConfidence": "0.750",
    "dataCompleteness": {
      "withPolyData": 2,
      "withESPNData": 5
    }
  },
  "timestamp": "2025-12-16T09:18:00.000Z"
}
```

**字段说明**:
- `totalMatches`: 总比赛数
- `liveMatches`: 进行中的比赛数
- `matchesWithSignals`: 有套利信号的比赛数
- `totalSignals`: 总套利信号数
- `avgConfidence`: 平均置信度
- `dataCompleteness`: 各数据源的完整性统计

---

## WebSocket API

### 连接

**URL**: `ws://localhost:3000`

**协议**: Socket.IO

**连接示例**:

```javascript
import { io } from 'socket.io-client';

const socket = io('http://localhost:3000', {
  transports: ['websocket'],
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionAttempts: 5
});

socket.on('connect', () => {
  console.log('WebSocket 已连接:', socket.id);
});

socket.on('disconnect', () => {
  console.log('WebSocket 已断开');
});
```

---

### 订阅比赛

**事件**: `subscribe`

**参数**:

```typescript
{
  matchIds?: string[];  // 可选，指定比赛 ID 列表；为空则订阅所有比赛
}
```

**订阅示例**:

```javascript
// 订阅所有比赛
socket.emit('subscribe', {});

// 订阅特定比赛
socket.emit('subscribe', {
  matchIds: ['BOS-DET-20251216', 'LAL-GSW-20251216']
});
```

**说明**:
- 订阅后会立即收到一次 `matchesUpdate` 事件（初始数据）
- 之后每 3 秒收到一次更新

---

### 取消订阅

**事件**: `unsubscribe`

**参数**:

```typescript
{
  matchIds?: string[];  // 可选，指定要取消订阅的比赛 ID；为空则取消订阅所有
}
```

**取消订阅示例**:

```javascript
// 取消订阅所有比赛
socket.emit('unsubscribe', {});

// 取消订阅特定比赛
socket.emit('unsubscribe', {
  matchIds: ['BOS-DET-20251216']
});
```

---

### 接收更新

#### 1. 比赛数据更新（多场）

**事件**: `matchesUpdate`

**数据格式**:

```typescript
{
  type: 'initial' | 'update';  // initial: 订阅时的初始数据; update: 后续更新
  data: UnifiedMatch[];        // 比赛数据数组
  timestamp: number;           // 时间戳（毫秒）
}
```

**监听示例**:

```javascript
socket.on('matchesUpdate', (data) => {
  console.log(`收到 ${data.data.length} 场比赛更新 (类型: ${data.type})`);
  data.data.forEach(match => {
    console.log(`${match.homeTeam.name} vs ${match.awayTeam.name}`);
    console.log(`比分: ${match.homeTeam.score} - ${match.awayTeam.score}`);
    console.log(`信号数: ${match.signals.length}`);
  });
});
```

---

#### 2. 单场比赛更新

**事件**: `matchUpdate`

**数据格式**:

```typescript
{
  type: 'update';
  data: UnifiedMatch;  // 单场比赛数据
  timestamp: number;
}
```

**监听示例**:

```javascript
socket.on('matchUpdate', (data) => {
  console.log('比赛更新:', data.data.id);
});
```

**说明**: 只有订阅了特定比赛 ID 才会收到此事件

---

#### 3. 套利信号告警

**事件**: `signalAlert`

**数据格式**:

```typescript
{
  matchId: string;              // 比赛 ID
  signals: ArbitrageSignal[];   // 套利信号数组
  timestamp: number;
}
```

**监听示例**:

```javascript
socket.on('signalAlert', (data) => {
  console.log(`🚨 套利信号告警 - 比赛: ${data.matchId}`);
  data.signals.forEach(signal => {
    console.log(`  类型: ${signal.type}`);
    console.log(`  置信度: ${(signal.confidence * 100).toFixed(1)}%`);
    console.log(`  预期收益: ${signal.edge.toFixed(2)}%`);
    console.log(`  原因: ${signal.reason}`);
  });
});
```

**说明**: 当比赛有套利信号时触发（订阅所有或特定比赛均可收到）

---

#### 4. 连接状态

**事件**: `connectionStatus`

**数据格式**:

```typescript
{
  connected: boolean;
  message: string;
  timestamp: number;
}
```

**监听示例**:

```javascript
socket.on('connectionStatus', (data) => {
  console.log('连接状态:', data.connected ? '已连接' : '已断开');
  console.log('消息:', data.message);
});
```

---

## 数据模型

### UnifiedMatch（统一比赛数据）

```typescript
interface UnifiedMatch {
  id: string;                    // 唯一ID: "BOS-DET-20251216"
  homeTeam: Team;                // 主队
  awayTeam: Team;                // 客队
  status: MatchStatus;           // 比赛状态: PRE | LIVE | FINAL
  statusStr: string;             // 状态描述: "Q4 02:30"
  startTime?: string;            // 开始时间（ISO 8601）
  poly: PolymarketData;          // Polymarket 数据
  espn: ESPNData;                // ESPN 数据
  signals: ArbitrageSignal[];    // 套利信号
  lastUpdate: number;            // 最后更新时间戳
  dataCompleteness: {
    hasPolyData: boolean;
    hasESPNData: boolean;
  };
}
```

### Team（球队信息）

```typescript
interface Team {
  id: string;        // 球队ID: "BOS"
  name: string;      // 球队名称: "Boston Celtics"
  score: number;     // 当前比分
  logo?: string;     // 球队 logo URL
}
```

### ArbitrageSignal（套利信号）

```typescript
interface ArbitrageSignal {
  type: SignalType;              // 信号类型
  confidence: number;            // 置信度 (0-1)
  edge: number;                  // 预期收益率（百分比）
  reason: string;                // 信号原因说明
  timestamp: number;             // 信号生成时间
  details: {
    espnProb: number;            // ESPN 胜率
    polyPrice: number;           // Polymarket 价格
    priceDiff: number;           // 价格差异
    scoreDiff: number;           // 比分差异
    timeRemaining: string;       // 剩余时间
  };
}
```

**SignalType 枚举**:
- `BUY_HOME`: 买入主队
- `SELL_HOME`: 卖出主队
- `BUY_AWAY`: 买入客队
- `SELL_AWAY`: 卖出客队
- `NONE`: 无信号

### PolymarketData（Polymarket 数据）

```typescript
interface PolymarketData {
  marketId: string;        // 市场 ID
  homeTokenId: string;     // 主队 token ID
  awayTokenId: string;     // 客队 token ID
  homePrice: number;       // 主队价格 (0-1)
  awayPrice: number;       // 客队价格 (0-1)
  homeVolume?: number;     // 主队交易量
  awayVolume?: number;     // 客队交易量
  liquidity?: number;      // 流动性
}
```

### ESPNData（ESPN 数据）

```typescript
interface ESPNData {
  homeWinProb: number;           // 主队实时胜率 (0-1)
  awayWinProb: number;           // 客队实时胜率 (0-1)
  pregameHomeWinProb: number;    // 主队赛前胜率 (0-1)
  pregameAwayWinProb: number;    // 客队赛前胜率 (0-1)
  injuries?: InjuryReport[];     // 伤病报告
}
```

---

## 错误处理

### 通用错误格式

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "错误描述",
    "details": { ... }  // 可选，开发环境下包含详细错误信息
  },
  "timestamp": "2025-12-16T09:18:00.000Z"
}
```

### 常见错误码

| 错误码 | HTTP 状态码 | 说明 |
|--------|------------|------|
| `NOT_FOUND` | 404 | 资源不存在 |
| `RATE_LIMIT_EXCEEDED` | 429 | 超过请求限制 |
| `INTERNAL_ERROR` | 500 | 服务器内部错误 |
| `BAD_REQUEST` | 400 | 请求参数错误 |

---

## 示例代码

### REST API 示例（JavaScript/TypeScript）

```typescript
// 使用 fetch 获取比赛列表
async function getMatches() {
  try {
    const response = await fetch('http://localhost:3000/api/matches?status=LIVE');
    const result = await response.json();
    
    if (result.success) {
      console.log('比赛数量:', result.data.length);
      result.data.forEach(match => {
        console.log(`${match.homeTeam.name} vs ${match.awayTeam.name}`);
      });
    }
  } catch (error) {
    console.error('获取比赛失败:', error);
  }
}

// 获取套利信号
async function getSignals() {
  try {
    const response = await fetch('http://localhost:3000/api/signals');
    const result = await response.json();
    
    if (result.success) {
      result.data.forEach(match => {
        match.signals.forEach(signal => {
          console.log(`📊 ${match.id}: ${signal.type} (置信度: ${signal.confidence})`);
        });
      });
    }
  } catch (error) {
    console.error('获取信号失败:', error);
  }
}
```

### WebSocket 完整示例（React）

```typescript
import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

function App() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [matches, setMatches] = useState([]);
  const [signals, setSignals] = useState([]);

  useEffect(() => {
    // 创建连接
    const ws = io('http://localhost:3000', {
      transports: ['websocket'],
      reconnection: true,
    });

    ws.on('connect', () => {
      console.log('WebSocket 已连接');
      
      // 订阅所有比赛
      ws.emit('subscribe', {});
    });

    // 接收比赛更新
    ws.on('matchesUpdate', (data) => {
      console.log('收到更新:', data.type);
      setMatches(data.data);
    });

    // 接收套利信号
    ws.on('signalAlert', (data) => {
      console.log('🚨 新的套利信号:', data);
      setSignals(prev => [...prev, data]);
      
      // 显示通知
      showNotification(data);
    });

    ws.on('disconnect', () => {
      console.log('WebSocket 已断开');
    });

    setSocket(ws);

    // 清理
    return () => {
      ws.disconnect();
    };
  }, []);

  function showNotification(data: any) {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('套利信号告警', {
        body: `${data.matchId}: ${data.signals.length} 个信号`,
      });
    }
  }

  return (
    <div>
      <h1>PolySniper 实时监控</h1>
      <h2>比赛列表 ({matches.length})</h2>
      {/* 渲染比赛... */}
      
      <h2>套利信号 ({signals.length})</h2>
      {/* 渲染信号... */}
    </div>
  );
}
```

### Python 示例

```python
import requests
import socketio

# REST API
def get_live_matches():
    response = requests.get('http://localhost:3000/api/matches?status=LIVE')
    data = response.json()
    
    if data['success']:
        for match in data['data']:
            print(f"{match['homeTeam']['name']} vs {match['awayTeam']['name']}")
            print(f"比分: {match['homeTeam']['score']} - {match['awayTeam']['score']}")

# WebSocket
sio = socketio.Client()

@sio.on('connect')
def on_connect():
    print('WebSocket 已连接')
    sio.emit('subscribe', {})

@sio.on('matchesUpdate')
def on_matches_update(data):
    print(f"收到 {len(data['data'])} 场比赛更新")

@sio.on('signalAlert')
def on_signal_alert(data):
    print(f"🚨 套利信号: {data['matchId']}")
    for signal in data['signals']:
        print(f"  {signal['type']}: {signal['confidence']:.2%}")

sio.connect('http://localhost:3000')
sio.wait()
```

---

## ⚠️ 重要说明

### Polymarket 市场可用性

**注意**：并非所有 NBA 比赛都会在 Polymarket 上有对应的市场。

### 球队名称匹配策略

系统使用**核心队名**（不含城市名）进行匹配，因为 Polymarket 经常省略城市名：

- ✅ **优先匹配**：`Lakers`, `Celtics`, `Heat` 等核心队名
- ✅ **备用匹配**：`LAL`, `BOS`, `MIA` 等缩写
- ⚠️ **较少使用**：`Los Angeles Lakers` 等完整名称

**示例**：
- Polymarket 问题：`"Will the Lakers beat the Warriors?"` ✅ 可匹配
- Polymarket 问题：`"Lakers vs Warriors - Jan 15"` ✅ 可匹配  
- Polymarket 问题：`"Los Angeles Lakers vs Golden State Warriors"` ✅ 可匹配

- ✅ **季后赛、总决赛**：通常有市场
- ⚠️ **常规赛热门比赛**：部分有市场
- ❌ **常规赛普通比赛**：大多数没有市场

**原因**：
- Polymarket 是用户创建市场的平台
- 市场创建需要提供流动性
- 只有关注度高的比赛才会有足够的流动性

**影响**：
- 没有 Polymarket 数据时，系统仍然会显示 ESPN 和虎扑的数据
- 只是无法计算套利信号
- `dataCompleteness.hasPolyData` 会标记为 `false`

---

## 🔧 配置说明

### 环境变量

```bash
# .env
PORT=3000
NODE_ENV=development

# CORS 配置
CORS_ORIGIN=*

# 限流配置
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100

# Redis 配置（可选）
REDIS_ENABLED=false
REDIS_HOST=localhost
REDIS_PORT=6379
```

### 数据更新周期

- **数据采集**: 每 5 秒
- **WebSocket 推送**: 每 3 秒
- **缓存有效期**:
  - ESPN 比分: 10 秒
  - 虎扑赛程: 3 秒
  - Polymarket 市场: 5 秒

---

## 📞 技术支持

如有问题，请参考：
- [开发文档](./DEVELOPMENT.md)
- [WebSocket 说明](./WEBSOCKET.md)
- [实时数据文档](./REALTIME_DATA.md)
- [ESPN API](https://site.api.espn.com/apis/site/v2/sports/basketball/nba) - ESPN 数据源
