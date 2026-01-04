# 🏗️ PolySniper Architecture

> 🌏 **[中文文档](./ARCHITECTURE.zh-CN.md)** | **English**

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend (React)                          │
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
│                 Backend (Node.js + Express)                   │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │            Data Aggregator (Core)                     │   │
│  │  - Fetch ESPN match data (every 5s)                  │   │
│  │  - Match Polymarket prices                           │   │
│  │  - Calculate arbitrage signals                       │   │
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
│ - Schedule   │        │ - Events     │
│ - Live Score │        │ - Markets    │
│ - Win Prob   │        │ - Prices     │
│ - Injuries   │        │              │
└──────────────┘        └──────────────┘
```

## Data Flow

### 1. ESPN as Primary Data Source

```typescript
// 1. Fetch match data
ESPN Scoreboard API → Match list (today + tomorrow + day after)
  ↓
Filter finished matches (status !== 'post')
  ↓
Iterate through each match
```

### 2. Fetch Detailed Data

```typescript
// 2. Parallel requests for detailed data
Promise.allSettled([
  espnService.getGameWinProbability(gameId),  // Win prob + injuries
  polymarketService.searchNBAMarkets(team1, team2)  // Prices
])
  ↓
Merge data → UnifiedMatch
  ↓
Calculate arbitrage signals (arbitrageEngine)
  ↓
WebSocket push to frontend
```

### 3. Data Structure

```typescript
interface UnifiedMatch {
  id: string;
  homeTeam: { id, name, score };
  awayTeam: { id, name, score };
  status: 'PRE' | 'LIVE' | 'FINAL';
  startTime: string;
  
  // ESPN data
  espn: {
    homeWinProb: number;
    awayWinProb: number;
    pregameHomeWinProb: number;
    pregameAwayWinProb: number;
    injuries: InjuryReport[];
  };
  
  // Polymarket data
  poly: {
    marketId: string;
    homePrice: number;
    awayPrice: number;
  };
  
  // Arbitrage signals
  signals: ArbitrageSignal[];
  
  dataCompleteness: {
    hasESPNData: boolean;
    hasPolyData: boolean;
  };
}
```

## Core Services

### ESPN Service

```typescript
class ESPNService {
  // Get matches for specified date
  async getScoreboard(date?: string): Promise<any>
  
  // Get match details (win prob + injuries)
  async getGameWinProbability(gameId: string): Promise<ESPNData>
  
  // Find match by team names
  async getWinProbabilityByTeams(home, away, date): Promise<ESPNData>
}
```

**Key Features:**
- ✅ Supports date parameter for future matches
- ✅ Uses Summary API for complete data
- ✅ Calculates implied probability from MoneyLine


### Polymarket Service

```typescript
class PolymarketService {
  // Search NBA markets
  async searchNBAMarkets(homeTeam, awayTeam): Promise<PolymarketData>
}
```

**Matching Logic:**
1. Filter NBA markets via series_id='10345'
2. Match using team name keywords
3. Time validation (endDate >= startTime)

### Data Aggregator

```typescript
class DataAggregator {
  // Main update loop (every 5 seconds)
  private async updateAllMatches(): Promise<void>
  
  // Single match update
  private async updateMatch(espnGame): Promise<void>
  
  // ESPN team names → Polymarket search
  private async searchPolymarketByESPNTeams(home, away): Promise<any>
}
```

## Team Name Mapping

```typescript
// config/teamMappings.ts
interface TeamMapping {
  espnName: string;      // "Boston Celtics"
  espnId: string;        // "2"
  chineseName: string;   // "凯尔特人" (for Polymarket search)
  polyKeywords: string[]; // ["Celtics", "BOS"]
}
```

**Mapping Flow:**
```
ESPN "Boston Celtics" 
  → Lookup mapping table
  → chineseName "凯尔特人"
  → Polymarket API search
```

## Performance Optimization

### 1. Parallel Requests
```typescript
// ❌ Sequential (slow)
const espn = await espnService.get();
const poly = await polyService.get();

// ✅ Parallel (fast)
const [espn, poly] = await Promise.allSettled([
  espnService.get(),
  polyService.get()
]);
```

### 2. Data Caching
- ESPN Scoreboard: 10 second cache
- ESPN Summary: On-demand, no cache (real-time data)
- Polymarket: On-demand

### 3. Smart Filtering
- Only process unfinished matches (`status !== 'post'`)
- Query 3 days of match data

## API Response Time

| Service | Endpoint | Response Time |
|------|------|---------|
| ESPN | Scoreboard | ~200ms |
| ESPN | Summary | ~300-500ms |
| Polymarket | Events | ~400-600ms |
| **Total** | **Per Match** | **~1s** |

## WebSocket Communication

### Client → Server

```typescript
// Subscribe to match updates
socket.emit('subscribe', { matchIds: ['all'] });

// Unsubscribe
socket.emit('unsubscribe', { matchIds: ['123'] });
```

### Server → Client

```typescript
// Initial data
socket.emit('matchesUpdate', { 
  type: 'initial', 
  matches: [...] 
});

// Incremental updates
socket.emit('matchesUpdate', { 
  type: 'update', 
  matches: [...] 
});

// Arbitrage signals
socket.emit('signalAlert', { 
  match, 
  signal 
});
```

## Error Handling

### Promise.allSettled

```typescript
// Ensure single service failure doesn't affect overall
const [espnResult, polyResult] = await Promise.allSettled([...]);

if (espnResult.status === 'fulfilled') {
  match.espn = espnResult.value;
} else {
  logger.error('ESPN failed', espnResult.reason);
}
```

### Data Completeness Flags

```typescript
dataCompleteness: {
  hasESPNData: boolean,  // Has win prob and injuries
  hasPolyData: boolean,  // Has market prices
}

// Frontend decides what to display based on flags
```

## Deployment Architecture

```
┌─────────────────────────────────────────────┐
│           Nginx (Reverse Proxy)              │
│  - Static files (React build)               │
│  - API forwarding → Node.js                 │
│  - WebSocket upgrade                        │
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

## Monitoring Metrics

- 📊 Total matches
- 📊 Live matches
- 📊 Arbitrage signals
- 📊 Data completeness percentage
- 📊 API response time
- 📊 WebSocket connections

## Future Optimizations

- [ ] Add Redis distributed cache
- [ ] Implement multi-instance load balancing
- [ ] Add Prometheus monitoring
- [ ] Optimize WebSocket reconnection
- [ ] Add data persistence storage
