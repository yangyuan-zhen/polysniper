"use strict";
// =============================================================================
// PolySniper 共享类型定义
// =============================================================================
// 这个文件包含前后端共享的所有 TypeScript 接口和枚举
// 修改这里的类型会同时影响前端和后端的类型检查
Object.defineProperty(exports, "__esModule", { value: true });
exports.CacheKey = exports.OrderStatus = exports.OrderType = exports.SignalType = exports.MatchStatus = void 0;
exports.isValidMatchStatus = isValidMatchStatus;
exports.isValidSignalType = isValidSignalType;
exports.isCompleteMatch = isCompleteMatch;
exports.getHomeWinProbability = getHomeWinProbability;
exports.getAwayWinProbability = getAwayWinProbability;
exports.hasArbitrageSignals = hasArbitrageSignals;
exports.getStrongestSignal = getStrongestSignal;
// =============================================================================
// 基础枚举类型
// =============================================================================
/** 比赛状态 */
var MatchStatus;
(function (MatchStatus) {
    MatchStatus["PRE"] = "PRE";
    MatchStatus["LIVE"] = "LIVE";
    MatchStatus["FINAL"] = "FINAL";
})(MatchStatus || (exports.MatchStatus = MatchStatus = {}));
/** 交易信号类型 */
var SignalType;
(function (SignalType) {
    SignalType["BUY_HOME"] = "BUY_HOME";
    SignalType["SELL_HOME"] = "SELL_HOME";
    SignalType["BUY_AWAY"] = "BUY_AWAY";
    SignalType["SELL_AWAY"] = "SELL_AWAY";
    SignalType["NONE"] = "NONE";
})(SignalType || (exports.SignalType = SignalType = {}));
/** 订单类型 */
var OrderType;
(function (OrderType) {
    OrderType["BUY"] = "BUY";
    OrderType["SELL"] = "SELL";
})(OrderType || (exports.OrderType = OrderType = {}));
/** 订单状态 */
var OrderStatus;
(function (OrderStatus) {
    OrderStatus["PENDING"] = "PENDING";
    OrderStatus["FILLED"] = "FILLED";
    OrderStatus["CLOSED"] = "CLOSED";
})(OrderStatus || (exports.OrderStatus = OrderStatus = {}));
/** 缓存键类型 */
var CacheKey;
(function (CacheKey) {
    CacheKey["ESPN_SCORES"] = "espn_scores";
    CacheKey["MARKETS"] = "polymarket_markets";
    CacheKey["MATCH"] = "polymarket_match";
})(CacheKey || (exports.CacheKey = CacheKey = {}));
// =============================================================================
// 类型守卫和工具函数
// =============================================================================
/** 检查是否为有效的比赛状态 */
function isValidMatchStatus(status) {
    return Object.values(MatchStatus).includes(status);
}
/** 检查是否为有效的信号类型 */
function isValidSignalType(type) {
    return Object.values(SignalType).includes(type);
}
/** 检查 UnifiedMatch 是否有完整数据 */
function isCompleteMatch(match) {
    return match.dataCompleteness.hasPolyData && match.dataCompleteness.hasESPNData;
}
/** 获取比赛的主队胜率 */
function getHomeWinProbability(match) {
    return match.espn.homeWinProb;
}
/** 获取比赛的客队胜率 */
function getAwayWinProbability(match) {
    return match.espn.awayWinProb;
}
/** 检查是否有套利信号 */
function hasArbitrageSignals(match) {
    return match.signals.length > 0 && match.signals.some(signal => signal.type !== SignalType.NONE);
}
/** 获取最强的套利信号 */
function getStrongestSignal(match) {
    const validSignals = match.signals.filter(signal => signal.type !== SignalType.NONE);
    if (validSignals.length === 0)
        return null;
    return validSignals.reduce((strongest, current) => current.confidence > strongest.confidence ? current : strongest);
}
//# sourceMappingURL=index.js.map