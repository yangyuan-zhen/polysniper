# PolySniper Backend - API Documentation

> 🌏 **[中文文档](./API.zh-CN.md)** | **English**

## 📋 Table of Contents

- [Overview](#overview)
- [REST API](#rest-api)
  - [Health Check](#health-check)
  - [Get Matches](#get-matches)
  - [Get Single Match](#get-single-match)
  - [Get Arbitrage Signals](#get-arbitrage-signals)
  - [Get Statistics](#get-statistics)
- [WebSocket API](#websocket-api)
  - [Connection](#connection)
  - [Subscribe](#subscribe)
  - [Unsubscribe](#unsubscribe)
  - [Receive Updates](#receive-updates)
- [Data Models](#data-models)
- [Error Handling](#error-handling)
- [Examples](#examples)

---

## Overview

**Base URL**: `http://localhost:3000`

**WebSocket URL**: `ws://localhost:3000`

**Rate Limit**: 100 requests/minute (applies to `/api/*` paths)

**Data Update Frequency**: 
- REST API: Real-time (no cache)
- WebSocket: Pushed every 3 seconds
- Background Data Collection: Refreshed every 5 seconds

---

## REST API

### Health Check

**Description**: Check server health status

**Path**: `GET /health`

**Response**:

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

---

### Get Matches

**Description**: Get all match data, supports filtering

**Path**: `GET /api/matches`

**Query Parameters**:

| Parameter | Type | Required | Description | Example |
|------|------|------|------|------|
| `status` | string | No | Filter by match status | `LIVE`, `PRE`, `FINAL` |
| `hasSignals` | boolean | No | Only return matches with arbitrage signals | `true`, `false` |

**Request Examples**:

```bash
# Get all matches
GET /api/matches

# Get live matches
GET /api/matches?status=LIVE

# Get matches with signals
GET /api/matches?hasSignals=true
```

---

### Get Single Match

**Description**: Get detailed data for a specific match

**Path**: `GET /api/matches/:id`

**Path Parameters**:

| Parameter | Type | Description | Example |
|------|------|------|------|
| `id` | string | Unique match identifier | `BOS-DET-20251216` |

---

### Get Arbitrage Signals

**Description**: Get all matches with arbitrage signals, sorted by confidence (descending)

**Path**: `GET /api/signals`

**Response**:

```json
{
  "success": true,
  "data": [
    {
      "id": "BOS-DET-20251216",
      "signals": [
        {
          "type": "BUY_HOME",
          "confidence": 0.85,
          "edge": 8.5,
          "reason": "Strong arbitrage opportunity: ESPN win prob significantly higher than market price",
          "timestamp": 1734325080000
        }
      ]
    }
  ]
}
```

---

### Get Statistics

**Description**: Get system-wide statistics

**Path**: `GET /api/stats`

**Response**:

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
  }
}
```

---

## WebSocket API

### Connection

**URL**: `ws://localhost:3000`

**Protocol**: Socket.IO

**Connection Example**:

```javascript
import { io } from 'socket.io-client';

const socket = io('http://localhost:3000', {
  transports: ['websocket'],
  reconnection: true
});

socket.on('connect', () => {
  console.log('WebSocket Connected:', socket.id);
});
```

---

### Subscribe

**Event**: `subscribe`

**Parameters**:

```typescript
{
  matchIds?: string[];  // Optional, list of match IDs; if empty, subscribes to all
}
```

**Example**:

```javascript
// Subscribe to all matches
socket.emit('subscribe', {});
```

---

### Unsubscribe

**Event**: `unsubscribe`

**Parameters**:

```typescript
{
  matchIds?: string[];  // Optional, list of match IDs to unsubscribe from
}
```

---

### Receive Updates

#### 1. Match Data Update (Multiple)

**Event**: `matchesUpdate`

**Data Format**:

```typescript
{
  type: 'initial' | 'update';  // initial: Initial data on subscribe; update: Subsequent updates
  data: UnifiedMatch[];        // Array of match data
  timestamp: number;
}
```

#### 2. Arbitrage Signal Alert

**Event**: `signalAlert`

**Data Format**:

```typescript
{
  matchId: string;              // Match ID
  signals: ArbitrageSignal[];   // Array of signals
  timestamp: number;
}
```

---

## Data Models

### UnifiedMatch

```typescript
interface UnifiedMatch {
  id: string;                    // Unique ID: "BOS-DET-20251216"
  homeTeam: Team;                // Home team
  awayTeam: Team;                // Away team
  status: MatchStatus;           // Status: PRE | LIVE | FINAL
  statusStr: string;             // Status string: "Q4 02:30"
  startTime?: string;            // Start time (ISO 8601)
  poly: PolymarketData;          // Polymarket data
  espn: ESPNData;                // ESPN data
  signals: ArbitrageSignal[];    // Arbitrage signals
  lastUpdate: number;            // Last update timestamp
  dataCompleteness: {
    hasPolyData: boolean;
    hasESPNData: boolean;
  };
}
```

### ArbitrageSignal

```typescript
interface ArbitrageSignal {
  type: SignalType;              // Signal type
  confidence: number;            // Confidence (0-1)
  edge: number;                  // Expected edge (percentage)
  reason: string;                // Reason
  timestamp: number;             // Timestamp
  details: {
    espnProb: number;            // ESPN win prob
    polyPrice: number;           // Polymarket price
    priceDiff: number;           // Price difference
    scoreDiff: number;           // Score difference
    timeRemaining: string;       // Time remaining
  };
}
```

**SignalType Enum**:
- `BUY_HOME`: Buy Home Team
- `SELL_HOME`: Sell Home Team
- `BUY_AWAY`: Buy Away Team
- `SELL_AWAY`: Sell Away Team
- `NONE`: No Signal

---

## Error Handling

### Common Error Codes

| Error Code | HTTP Status | Description |
|--------|------------|------|
| `NOT_FOUND` | 404 | Resource not found |
| `RATE_LIMIT_EXCEEDED` | 429 | Rate limit exceeded |
| `INTERNAL_ERROR` | 500 | Internal server error |
| `BAD_REQUEST` | 400 | Invalid request parameters |
