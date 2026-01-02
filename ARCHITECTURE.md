# 🏗️ PolySniper 架构说明

## 系统架构

```
┌─────────────────────────────────────────────────────────────┐
│                         前端 (React)                          │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │ MatchCard   │  │ DetailModal  │  │  SignalCard      │   │
│  └─────────────┘  └──────────────┘  └──────────────────┘   │
│         │                │                    │              │
│         └────────────────┴────────────────────┘              │
│                          │                                   │
│                  WebSocket Client                            │
└────────────────────────┬─────────────────────────────────────┘
                         │
                    WebSocket
                         │
┌────────────────────────┴─────────────────────────────────────┐
│                    后端 (Node.js + Express)                   │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              Data Aggregator (核心)                   │   │
│  │  - 获取 ESPN 比赛数据 (每 5 秒)                       │   │
│  │  - 匹配 Polymarket 价格                               │   │
│  │  - 计算套利信号                                       │   │
│  └───┬─────────────────────────┬────────────────────────┘   │
│      │                         │                             │
│  ┌───▼──────────┐        ┌─────▼─────────┐                  │
│  │ ESPN Service │        │ Polymarket    │                  │
│  │              │        │ Service       │                  │
│  │ - Scoreboard │        │ - Market Data │                  │
│  │ - Summary    │        │ - Token Price │                  │
│  │ - Injuries   │        │               │                  │
│  └───┬──────────┘        └─────┬─────────┘                  │
│      │                         │                             │
└──────┼─────────────────────────┼─────────────────────────────┘
       │                         │
       ▼                         ▼
┌──────────────┐        ┌──────────────┐
│   ESPN API   │        │ Polymarket   │
│              │        │   Gamma API  │
│ - 比赛赛程    │        │ - Events     │
│ - 实时比分    │        │ - Markets    │
│ - 胜率预测    │        │ - Prices     │
│ - 伤病信息    │        │              │
└──────────────┘        └──────────────┘
```

## 数据流

### 1. ESPN 作为主数据源

```typescript
// 1. 获取比赛数据
ESPN Scoreboard API → 比赛列表 (今天+明天+后天)
  ↓
过滤已结束比赛 (status !== 'post')
  ↓
遍历每场比赛
```

### 2. 获取详细数据

```typescript
// 2. 并行请求详细数据
Promise.allSettled([
  espnService.getGameWinProbability(gameId),  // 胜率 + 伤病
  polymarketService.searchNBAMarkets(team1, team2)  // 价格
])
  ↓
合并数据 → UnifiedMatch
  ↓
计算套利信号 (arbitrageEngine)
  ↓
WebSocket 推送给前端
```

### 3. 数据结构

```typescript
interface UnifiedMatch {
  id: string;
  homeTeam: { id, name, score };
  awayTeam: { id, name, score };
  status: 'PRE' | 'LIVE' | 'FINAL';
  startTime: string;
  
  // ESPN 数据
  espn: {
    homeWinProb: number;
    awayWinProb: number;
    pregameHomeWinProb: number;
    pregameAwayWinProb: number;
    injuries: InjuryReport[];
  };
  
  // Polymarket 数据
  poly: {
    marketId: string;
    homePrice: number;
    awayPrice: number;
  };
  
  // 套利信号
  signals: ArbitrageSignal[];
  
  dataCompleteness: {
    hasESPNData: boolean;
    hasPolyData: boolean;
  };
}
```

## 核心服务

### ESPN Service

```typescript
class ESPNService {
  // 获取指定日期的比赛
  async getScoreboard(date?: string): Promise<any>
  
  // 获取比赛详细数据（胜率 + 伤病）
  async getGameWinProbability(gameId: string): Promise<ESPNData>
  
  // 根据队名查找比赛
  async getWinProbabilityByTeams(home, away, date): Promise<ESPNData>
}
```

**关键特性：**
- ✅ 支持日期参数查询未来比赛
- ✅ 使用 Summary API 获取完整数据
- ✅ 从 MoneyLine 计算隐含概率
- ✅ 解析伤病详情

### Polymarket Service

```typescript
class PolymarketService {
  // 搜索 NBA 市场
  async searchNBAMarkets(homeTeam, awayTeam): Promise<PolymarketData>
}
```

**匹配逻辑：**
1. 通过 series_id='10345' 过滤 NBA 市场
2. 使用队名关键词匹配
3. 时间校验（endDate >= startTime）

### Data Aggregator

```typescript
class DataAggregator {
  // 主更新循环 (每 5 秒)
  private async updateAllMatches(): Promise<void>
  
  // 单场比赛更新
  private async updateMatch(espnGame): Promise<void>
  
  // ESPN 队名 → Polymarket 搜索
  private async searchPolymarketByESPNTeams(home, away): Promise<any>
}
```

## 队名映射

```typescript
// config/teamMappings.ts
interface TeamMapping {
  espnName: string;      // "Boston Celtics"
  espnId: string;        // "2"
  chineseName: string;      // "凯尔特人" (用于 Polymarket 搜索)
  polyKeywords: string[]; // ["Celtics", "BOS"]
}
```

**映射流程：**
```
ESPN "Boston Celtics" 
  → 查找映射表
  → chineseName "凯尔特人"
  → Polymarket API 搜索
```

## 性能优化

### 1. 并行请求
```typescript
// ❌ 串行 (慢)
const espn = await espnService.get();
const poly = await polyService.get();

// ✅ 并行 (快)
const [espn, poly] = await Promise.allSettled([
  espnService.get(),
  polyService.get()
]);
```

### 2. 数据缓存
- ESPN Scoreboard: 10 秒缓存
- ESPN Summary: 按需获取，不缓存（实时数据）
- Polymarket: 按需获取

### 3. 智能过滤
- 只处理未结束的比赛 (`status !== 'post'`)
- 查询未来 3 天的比赛数据

## API 响应时间

| 服务 | 端点 | 响应时间 |
|------|------|---------|
| ESPN | Scoreboard | ~200ms |
| ESPN | Summary | ~300-500ms |
| Polymarket | Events | ~400-600ms |
| **总计** | **单场比赛** | **~1s** |

## WebSocket 通信

### 客户端 → 服务器

```typescript
// 订阅比赛更新
socket.emit('subscribe', { matchIds: ['all'] });

// 取消订阅
socket.emit('unsubscribe', { matchIds: ['123'] });
```

### 服务器 → 客户端

```typescript
// 初始数据
socket.emit('matchesUpdate', { 
  type: 'initial', 
  matches: [...] 
});

// 增量更新
socket.emit('matchesUpdate', { 
  type: 'update', 
  matches: [...] 
});

// 套利信号
socket.emit('signalAlert', { 
  match, 
  signal 
});
```

## 错误处理

### Promise.allSettled

```typescript
// 确保单个服务失败不影响整体
const [espnResult, polyResult] = await Promise.allSettled([...]);

if (espnResult.status === 'fulfilled') {
  match.espn = espnResult.value;
} else {
  logger.error('ESPN failed', espnResult.reason);
}
```

### 数据完整性标记

```typescript
dataCompleteness: {
  hasESPNData: boolean,  // 有胜率和伤病
  hasPolyData: boolean,  // 有市场价格
}

// 前端根据标记决定显示内容
```

## 部署架构

```
┌─────────────────────────────────────────────┐
│           Nginx (反向代理)                   │
│  - 静态文件 (React 构建)                     │
│  - API 转发 → Node.js                        │
│  - WebSocket 升级                            │
└─────────────────┬───────────────────────────┘
                  │
         ┌────────┴────────┐
         │                 │
    ┌────▼─────┐     ┌────▼─────┐
    │ Node.js  │     │ Node.js  │
    │ Instance │     │ Instance │
    │ (PM2)    │     │ (PM2)    │
    └──────────┘     └──────────┘
```

## 监控指标

- 📊 总比赛数
- 📊 实时比赛数
- 📊 套利信号数
- 📊 数据完整性百分比
- 📊 API 响应时间
- 📊 WebSocket 连接数

## 下一步优化

- [ ] 添加 Redis 分布式缓存
- [ ] 实现多实例负载均衡
- [ ] 添加 Prometheus 监控
- [ ] 优化 WebSocket 断线重连
- [ ] 添加数据持久化存储
