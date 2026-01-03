/** 比赛状态 */
export declare enum MatchStatus {
    PRE = "PRE",// 未开始
    LIVE = "LIVE",// 进行中
    FINAL = "FINAL"
}
/** 交易信号类型 */
export declare enum SignalType {
    BUY_HOME = "BUY_HOME",
    SELL_HOME = "SELL_HOME",
    BUY_AWAY = "BUY_AWAY",
    SELL_AWAY = "SELL_AWAY",
    NONE = "NONE"
}
/** 订单类型 */
export declare enum OrderType {
    BUY = "BUY",
    SELL = "SELL"
}
/** 订单状态 */
export declare enum OrderStatus {
    PENDING = "PENDING",// 等待成交
    FILLED = "FILLED",// 已成交
    CLOSED = "CLOSED"
}
/** 缓存键类型 */
export declare enum CacheKey {
    ESPN_SCORES = "espn_scores",
    MARKETS = "polymarket_markets",
    MATCH = "polymarket_match"
}
/** 球队信息 */
export interface Team {
    id: string;
    name: string;
    score: number;
    logo?: string;
}
/** ESPN 数据 */
export interface ESPNData {
    homeWinProb: number;
    awayWinProb: number;
    pregameHomeWinProb: number;
    pregameAwayWinProb: number;
    injuries?: any[];
}
/** Polymarket 市场数据 */
export interface PolymarketData {
    marketId: string;
    homeTokenId: string;
    awayTokenId: string;
    homePrice: number;
    awayPrice: number;
    homeBestBid?: number;
    homeBestAsk?: number;
    awayBestBid?: number;
    awayBestAsk?: number;
    homeVolume?: number;
    awayVolume?: number;
    liquidity?: number;
    endDate?: string;
}
/** 套利信号 */
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
/** 统一的比赛数据（核心数据模型） */
export interface UnifiedMatch {
    id: string;
    homeTeam: Team;
    awayTeam: Team;
    status: MatchStatus;
    statusStr: string;
    startTime?: string;
    poly: PolymarketData;
    espn: ESPNData;
    signals: ArbitrageSignal[];
    lastUpdate: number;
    dataCompleteness: {
        hasPolyData: boolean;
        hasESPNData: boolean;
    };
}
/** 通用 API 响应格式 */
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
/** WebSocket 消息类型 */
export interface WSMessage {
    type: 'priceUpdate' | 'marketStatusChange' | 'connectionStatus' | 'signalAlert';
    data: any;
    timestamp: number;
}
/** 订单记录 */
export interface Order {
    id: string;
    matchId: string;
    type: OrderType;
    status: OrderStatus;
    team: string;
    tokenId: string;
    quantity: number;
    entryPrice: number;
    exitPrice?: number;
    currentPrice: number;
    pnl: number;
    pnlPercent: number;
    reason: string;
    confidence: number;
    timestamp: number;
    closeTimestamp?: number;
}
/** 持仓记录 */
export interface Position {
    matchId: string;
    team: string;
    tokenId: string;
    quantity: number;
    avgCost: number;
    currentPrice: number;
    unrealizedPnl: number;
    unrealizedPnlPercent: number;
}
/** 账户状态 */
export interface AccountStatus {
    balance: number;
    equity: number;
    positions: Position[];
    openOrders: Order[];
    closedOrders: Order[];
    totalTrades: number;
    winRate: number;
    totalPnl: number;
    totalPnlPercent: number;
}
/** WebSocket 比赛数据更新事件 */
export interface MatchesUpdateEvent {
    type: 'initial' | 'update';
    data: UnifiedMatch[];
    timestamp: number;
}
/** 单个比赛更新事件 */
export interface MatchUpdateEvent {
    type: 'update';
    data: UnifiedMatch;
    timestamp: number;
}
/** 信号警报事件 */
export interface SignalAlertEvent {
    matchId: string;
    signals: ArbitrageSignal[];
    timestamp: number;
}
/** 连接状态事件 */
export interface ConnectionStatusEvent {
    connected: boolean;
    message: string;
    timestamp: number;
}
/** 检查是否为有效的比赛状态 */
export declare function isValidMatchStatus(status: string): status is MatchStatus;
/** 检查是否为有效的信号类型 */
export declare function isValidSignalType(type: string): type is SignalType;
/** 检查 UnifiedMatch 是否有完整数据 */
export declare function isCompleteMatch(match: UnifiedMatch): boolean;
/** 获取比赛的主队胜率 */
export declare function getHomeWinProbability(match: UnifiedMatch): number;
/** 获取比赛的客队胜率 */
export declare function getAwayWinProbability(match: UnifiedMatch): number;
/** 检查是否有套利信号 */
export declare function hasArbitrageSignals(match: UnifiedMatch): boolean;
/** 获取最强的套利信号 */
export declare function getStrongestSignal(match: UnifiedMatch): ArbitrageSignal | null;
//# sourceMappingURL=index.d.ts.map