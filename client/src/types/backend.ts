// 后端 API 数据类型定义

export interface Team {
  id: string;
  name: string;
  score: number;
  logo?: string;
}

export interface PolymarketData {
  marketId: string;
  homeTokenId: string;
  awayTokenId: string;
  homePrice: number;
  awayPrice: number;
  homeVolume?: number;
  awayVolume?: number;
  liquidity?: number;
}

export interface ESPNData {
  homeWinProb: number;
  awayWinProb: number;
  pregameHomeWinProb: number;
  pregameAwayWinProb: number;
  injuries?: any[];
}

export interface HupuScoreData {
  homeScore: number;
  awayScore: number;
  quarter: string;
  timeRemaining: string;
  status: MatchStatus;
}

export type MatchStatus = 'PRE' | 'LIVE' | 'FINAL';

export type SignalType = 'BUY_HOME' | 'SELL_HOME' | 'BUY_AWAY' | 'SELL_AWAY' | 'NONE';

export interface ArbitrageSignal {
  type: SignalType;
  confidence: number;
  edge: number;
  reason: string;
  timestamp: number;
  details: {
    espnProb: number;
    polyPrice: number;
    priceDiff: number;
    scoreDiff: number;
    timeRemaining: string;
  };
}

export interface UnifiedMatch {
  id: string;
  homeTeam: Team;
  awayTeam: Team;
  status: MatchStatus;
  statusStr: string;
  startTime?: string;
  poly: PolymarketData;
  espn: ESPNData;
  hupu: HupuScoreData;
  signals: ArbitrageSignal[];
  lastUpdate: number;
  dataCompleteness: {
    hasPolyData: boolean;
    hasESPNData: boolean;
    hasHupuData: boolean;
  };
}

// WebSocket 事件数据类型
export interface MatchesUpdateEvent {
  type: 'initial' | 'update';
  data: UnifiedMatch[];
  timestamp: number;
}

export interface MatchUpdateEvent {
  type: 'update';
  data: UnifiedMatch;
  timestamp: number;
}

export interface SignalAlertEvent {
  matchId: string;
  signals: ArbitrageSignal[];
  timestamp: number;
}

export interface ConnectionStatusEvent {
  connected: boolean;
  message: string;
  timestamp: number;
}
