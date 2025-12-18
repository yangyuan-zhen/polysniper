// 比赛状态
export enum MatchStatus {
  PRE = 'PRE',       // 未开始
  LIVE = 'LIVE',     // 进行中
  FINAL = 'FINAL',   // 已结束
}

// 交易信号类型
export enum SignalType {
  BUY_HOME = 'BUY_HOME',
  SELL_HOME = 'SELL_HOME',
  BUY_AWAY = 'BUY_AWAY',
  SELL_AWAY = 'SELL_AWAY',
  NONE = 'NONE',
}

// 球队信息
export interface Team {
  id: string;           // 球队ID（如 "LAL"）
  name: string;         // 球队名称（如 "Lakers"）
  score: number;        // 当前比分
  logo?: string;        // 球队logo URL
}

// ESPN 数据
export interface ESPNData {
  homeWinProb: number;      // 主队实时胜率（进行中）
  awayWinProb: number;      // 客队实时胜率（进行中）
  pregameHomeWinProb: number; // 主队赛前胜率
  pregameAwayWinProb: number; // 客队赛前胜率
  injuries?: InjuryReport[];  // 伤病报告
}

// 伤病报告
export interface InjuryReport {
  teamId: string;
  playerId: string;
  playerName: string;
  status: 'OUT' | 'DOUBTFUL' | 'QUESTIONABLE' | 'PROBABLE' | 'DAY_TO_DAY';
  description: string;
}

// Polymarket 市场数据
export interface PolymarketData {
  marketId: string;
  homeTokenId: string;
  awayTokenId: string;
  homePrice: number;        // 主队价格 (0-1)
  awayPrice: number;        // 客队价格 (0-1)
  homeVolume?: number;      // 主队交易量
  awayVolume?: number;      // 客队交易量
  liquidity?: number;       // 流动性
  endDate?: string;         // 市场结束时间（用于 Layer 3 时间校验）
}

// 虎扑比分数据
export interface HupuScoreData {
  homeScore: number;
  awayScore: number;
  quarter: string;          // "Q4", "OT", "FINAL"
  timeRemaining: string;    // "05:30"
  status: MatchStatus;
}

// 套利信号
export interface ArbitrageSignal {
  type: SignalType;
  confidence: number;       // 0-1，置信度
  edge: number;            // 预期收益率（百分比）
  reason: string;          // 信号原因说明
  timestamp: number;
  // 详细计算数据
  details: {
    espnProb: number;      // ESPN胜率
    polyPrice: number;     // Polymarket价格
    priceDiff: number;     // 价格差异
    scoreDiff: number;     // 比分差异
    timeRemaining: string; // 剩余时间
  };
}

// 统一的比赛数据（核心数据模型）
export interface UnifiedMatch {
  id: string;              // 唯一ID: "LAL-GSW-20231215"
  
  // 基础信息
  homeTeam: Team;
  awayTeam: Team;
  
  // 比赛状态（来源：虎扑）
  status: MatchStatus;
  statusStr: string;       // "Q4 02:30" 或 "未开始" 或 "已结束"
  startTime?: string;      // 比赛开始时间
  
  // Polymarket 数据
  poly: PolymarketData;
  
  // ESPN 数据
  espn: ESPNData;
  
  // 虎扑比分数据
  hupu: HupuScoreData;
  
  // 套利信号（后端计算）
  signals: ArbitrageSignal[];
  
  // 元数据
  lastUpdate: number;      // 最后更新时间戳
  dataCompleteness: {      // 数据完整性标记
    hasPolyData: boolean;
    hasESPNData: boolean;
    hasHupuData: boolean;
  };
}

// API 响应格式
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  timestamp: string;
  cached?: boolean;
}

// WebSocket 消息类型
export interface WSMessage {
  type: 'priceUpdate' | 'marketStatusChange' | 'connectionStatus' | 'signalAlert';
  data: any;
  timestamp: number;
}

// 缓存键类型
export enum CacheKey {
  MARKETS = 'markets',
  MATCH = 'match',
  ESPN_SCORES = 'espn:scores',
  ESPN_INJURIES = 'espn:injuries',
  HUPU_SCHEDULE = 'hupu:schedule',
  POLY_PRICES = 'poly:prices',
}
