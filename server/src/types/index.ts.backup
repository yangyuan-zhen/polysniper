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
  injuries?: any[];         // 伤病报告数据
}

// Polymarket 市场数据
export interface PolymarketData {
  marketId: string;
  homeTokenId: string;
  awayTokenId: string;
  homePrice: number;        // 主队中间价 (0-1) - 用于显示
  awayPrice: number;        // 客队中间价 (0-1) - 用于显示
  homeBestBid?: number;     // 主队最高买价 - 卖出时收到的价格
  homeBestAsk?: number;     // 主队最低卖价 - 买入时支付的价格
  awayBestBid?: number;     // 客队最高买价
  awayBestAsk?: number;     // 客队最低卖价
  homeVolume?: number;      // 主队交易量
  awayVolume?: number;      // 客队交易量
  liquidity?: number;       // 流动性
  endDate?: string;         // 市场结束时间（用于 Layer 3 时间校验）
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
  
  // 套利信号（后端计算）
  signals: ArbitrageSignal[];
  
  // 元数据
  lastUpdate: number;      // 最后更新时间戳
  dataCompleteness: {      // 数据完整性标记
    hasPolyData: boolean;
    hasESPNData: boolean;
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
  ESPN_SCORES = 'espn_scores',
  MARKETS = 'polymarket_markets',
  MATCH = 'polymarket_match',
}

// ============ Paper Trading 模拟交易 ============

// 订单类型
export enum OrderType {
  BUY = 'BUY',
  SELL = 'SELL',
}

// 订单状态
export enum OrderStatus {
  PENDING = 'PENDING',   // 等待成交
  FILLED = 'FILLED',     // 已成交
  CLOSED = 'CLOSED',     // 已平仓
}

// 订单记录
export interface Order {
  id: string;                    // 订单ID
  matchId: string;               // 比赛ID
  type: OrderType;               // 买入/卖出
  status: OrderStatus;           // 订单状态
  team: string;                  // 队名
  tokenId: string;               // Token ID
  quantity: number;              // 数量（份额）
  entryPrice: number;            // 开仓价格
  exitPrice?: number;            // 平仓价格
  currentPrice: number;          // 当前价格
  pnl: number;                   // 盈亏（美元）
  pnlPercent: number;            // 盈亏百分比
  reason: string;                // 交易原因（信号描述）
  confidence: number;            // 信号置信度
  timestamp: number;             // 开仓时间
  closeTimestamp?: number;       // 平仓时间
}

// 持仓记录
export interface Position {
  matchId: string;
  team: string;
  tokenId: string;
  quantity: number;              // 持有数量
  avgCost: number;               // 平均成本
  currentPrice: number;          // 当前价格
  unrealizedPnl: number;         // 未实现盈亏
  unrealizedPnlPercent: number;  // 未实现盈亏百分比
}

// 账户状态
export interface AccountStatus {
  balance: number;               // 可用余额
  equity: number;                // 总权益（余额+持仓市值）
  positions: Position[];         // 当前持仓
  openOrders: Order[];           // 未平仓订单
  closedOrders: Order[];         // 已平仓订单
  totalTrades: number;           // 总交易次数
  winRate: number;               // 胜率
  totalPnl: number;              // 总盈亏
  totalPnlPercent: number;       // 总盈亏百分比
}
