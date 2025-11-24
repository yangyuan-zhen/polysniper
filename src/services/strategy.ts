// NBA Polymarket 套利策略引擎
// 基于均值回归和波动率套利原理

export interface Match {
  matchId: string;
  homeTeamName: string;
  awayTeamName: string;
  homeScore: number;
  awayScore: number;
  matchStatus: string;
  currentQuarter?: number | string;
  costTime?: string;
}

export interface PriceData {
  homePrice: string;
  awayPrice: string;
  homeRawPrice: number;
  awayRawPrice: number;
  espnHomeWinProb?: number; // ESPN预测主队胜率 (0-1)
  // Market depth metrics for signal confidence adjustment
  marketDepth?: {
    spread: number;           // 价差 (0-1)
    liquidity: 'high' | 'medium' | 'low';
    depthImbalance: number;   // 买卖失衡 (-1 to 1)
    confidence: number;       // 市场置信度 (0-1)
  };
  tradingMomentum?: {
    buyPressure: number;      // 买方压力 (0-1)
    momentum: 'bullish' | 'bearish' | 'neutral';
  };
}

export type SignalType = 'STRONG_BUY' | 'BUY' | 'NEUTRAL' | 'SELL' | 'STRONG_SELL';

export interface TradingSignal {
  matchId: string;
  team: string; // 哪支球队
  type: SignalType;
  price: number; // 当前价格
  scoreDiff: number; // 分差（正数=领先，负数=落后）
  quarter: string; // 第几节
  timeRemaining: string; // 剩余时间
  reason: string; // 信号原因
  confidence: number; // 置信度 0-100
  targetPrice?: number; // 目标卖出价
  stopLoss?: number; // 止损价
  timestamp: number;
}

/**
 * 核心策略：判断是否进入"黄金进场点"
 * 三个信号同时满足：
 * 1. 价格区间：0.35 ~ 0.45
 * 2. 分差区间：落后 1-6 分
 * 3. 时间区间：第1-3节（或第4节前5分钟）
 * 4. 球队实力：优先强队（隐形过滤器）
 */
export function analyzeMatch(
  match: Match,
  priceData: PriceData
): TradingSignal[] {
  const signals: TradingSignal[] = [];

  // 跳过未开始或已结束的比赛
  if (match.matchStatus === 'NOTSTARTED' || match.matchStatus === 'COMPLETED') {
    return signals;
  }

  // 解析当前节数
  const quarter = typeof match.currentQuarter === 'number' 
    ? match.currentQuarter 
    : parseInt(String(match.currentQuarter || '0')) || 0;
  const timeRemaining = match.costTime || '';

  // 分析主队信号（使用主队价格和ESPN胜率）
  const homeSignal = analyzeTeam(
    match.matchId,
    match.homeTeamName,
    match.homeScore - match.awayScore, // 主队分差（正数=领先）
    priceData.homeRawPrice, // 主队价格
    quarter,
    timeRemaining,
    priceData.espnHomeWinProb, // ESPN主队胜率
    priceData // 传入完整的价格数据（包含市场深度）
  );
  if (homeSignal) signals.push(homeSignal);

  // 分析客队信号（使用客队价格和ESPN胜率）
  const awaySignal = analyzeTeam(
    match.matchId,
    match.awayTeamName,
    match.awayScore - match.homeScore, // 客队分差（正数=领先）
    priceData.awayRawPrice, // 客队价格
    quarter,
    timeRemaining,
    priceData.espnHomeWinProb ? (1 - priceData.espnHomeWinProb) : undefined, // ESPN客队胜率
    priceData // 传入完整的价格数据（包含市场深度）
  );
  if (awaySignal) signals.push(awaySignal);

  return signals;
}

/**
 * 分析单支球队的交易信号
 */
function analyzeTeam(
  matchId: string,
  team: string,
  scoreDiff: number, // 正数=领先，负数=落后
  price: number,
  quarter: number,
  timeRemaining: string,
  espnWinProb: number | undefined, // ESPN预测该队胜率 (0-1)
  fullPriceData?: PriceData // 完整价格数据（包含市场深度和动量）
): TradingSignal | null {
  const timestamp = Date.now();

  const absDiff = Math.abs(scoreDiff);
  const isLast5Min = quarter === 4 && isLastFiveMinutes(timeRemaining);

  // 🚫 过滤规则：垃圾时间和大分差
  // 1. 最后5分钟 + 分差超过15分 → 比赛已定，不生成信号
  if (isLast5Min && absDiff > 15) {
    return null;
  }
  
  // 2. 任何时候分差超过20分 → 比赛失控，不生成信号
  if (absDiff > 20) {
    return null;
  }
  
  // 3. 第4节落后超过6分 → 逆转概率极低，不生成买入信号
  if (quarter === 4 && scoreDiff < -6) {
    return null;
  }

  // === ESPN胜率偏差分析 ===
  let priceDeviation = 0;
  let hasPriceEdge = false;
  if (espnWinProb !== undefined) {
    // 计算价格偏差：ESPN胜率 - Polymarket价格
    priceDeviation = espnWinProb - price;
    // 如果ESPN预测明显高于市场价格，存在价格优势
    hasPriceEdge = priceDeviation >= 0.12; // 偏差≥12%
  }

  // === 信号1：价格击球区 (0.35 ~ 0.45) ===
  const inPriceZone = price >= 0.35 && price <= 0.45;

  // === 信号2：分差射程内 (落后1-6分) ===
  const scoreDiffInRange = scoreDiff >= -6 && scoreDiff < 0;

  // === 信号3：时间区间 (第1-3节或第4节前5分钟) ===
  const inTimeZone = quarter >= 1 && quarter <= 3;

  // === 价格错配套利信号 (ESPN胜率远高于市场价格) ===
  // 要求：1. 价格偏差≥12%  2. ESPN胜率≥40% (避免推荐弱队)
  if (hasPriceEdge && espnWinProb !== undefined && espnWinProb >= 0.40) {
    let baseConfidence = 70 + (priceDeviation * 100); // 偏差越大，置信度越高
    
    // 根据市场深度调整置信度
    if (fullPriceData?.marketDepth) {
      baseConfidence *= fullPriceData.marketDepth.confidence;
      // 流动性惩罚
      if (fullPriceData.marketDepth.liquidity === 'low') {
        baseConfidence *= 0.8;
      }
    }
    
    const finalConfidence = Math.min(98, Math.max(60, baseConfidence));
    
    let reason = `⚡ 价格错配！ESPN ${(espnWinProb * 100).toFixed(0)}% vs 市场 ${(price * 100).toFixed(0)}¢ (偏差+${(priceDeviation * 100).toFixed(0)}%)`;
    
    return {
      matchId,
      team,
      type: 'STRONG_BUY',
      price,
      scoreDiff,
      quarter: `第${quarter}节`,
      timeRemaining,
      reason,
      confidence: finalConfidence,
      targetPrice: Math.min(0.85, espnWinProb + 0.10),
      stopLoss: Math.max(0.15, price - 0.10),
      timestamp,
    };
  }

  // === 强买入信号 (三个条件全部满足) ===
  if (inPriceZone && scoreDiffInRange && inTimeZone) {
    // 根据ESPN胜率调整置信度
    let baseConfidence = calculateConfidence(price, scoreDiff, quarter, espnWinProb);
    const espnBonus = hasPriceEdge ? 15 : (priceDeviation > 0.05 ? 8 : 0); // ESPN支持加分
    
    // 市场深度调整
    if (fullPriceData?.marketDepth) {
      baseConfidence *= fullPriceData.marketDepth.confidence;
      
      // 添加市场状态加成/惩罚
      if (fullPriceData.marketDepth.liquidity === 'low') {
        baseConfidence *= 0.85; // 低流动性惩罚
      }
      if (fullPriceData.marketDepth.spread > 0.05) {
        baseConfidence *= 0.9; // 大价差惩罚
      }
    }
    
    // 交易动量加成
    if (fullPriceData?.tradingMomentum) {
      if (fullPriceData.tradingMomentum.momentum === 'bullish') {
        baseConfidence *= 1.05; // 看涨动量加成
      } else if (fullPriceData.tradingMomentum.momentum === 'bearish') {
        baseConfidence *= 0.95; // 看跌动量惩罚
      }
    }
    
    const finalConfidence = Math.min(100, Math.max(30, baseConfidence + espnBonus));
    
    // 生成信号原因（包含ESPN和市场深度信息）
    let reason = `💎 黄金进场点！价格 ${(price * 100).toFixed(1)}¢，落后 ${Math.abs(scoreDiff)} 分`;
    if (espnWinProb && priceDeviation > 0.05) {
      reason += ` (ESPN ${(espnWinProb * 100).toFixed(0)}%)`;
    }
    if (fullPriceData?.marketDepth) {
      const { spread, liquidity } = fullPriceData.marketDepth;
      if (liquidity === 'high' && spread < 0.02) {
        reason += ' ✓高流动性';
      } else if (liquidity === 'low' || spread > 0.05) {
        reason += ' ⚠️流动性差';
      }
    }
    
    return {
      matchId,
      team,
      type: 'STRONG_BUY',
      price,
      scoreDiff,
      quarter: `第${quarter}节`,
      timeRemaining,
      reason,
      confidence: finalConfidence,
      targetPrice: 0.75,
      stopLoss: 0.15,
      timestamp,
    };
  }

  // === 普通买入信号 (满足2个条件) ===
  if ((inPriceZone && scoreDiffInRange) || (inPriceZone && inTimeZone)) {
    const baseConfidence = calculateConfidence(price, scoreDiff, quarter) - 20;
    const finalConfidence = Math.min(85, Math.max(20, baseConfidence));
    
    let reason = `📈 买入机会：价格 ${(price * 100).toFixed(1)}¢`;
    
    return {
      matchId,
      team,
      type: 'BUY',
      price,
      scoreDiff,
      quarter: `第${quarter}节`,
      timeRemaining,
      reason,
      confidence: finalConfidence,
      targetPrice: 0.70,
      stopLoss: 0.20,
      timestamp,
    };
  }

  // === 卖出信号 (价格过高) ===
  if (price >= 0.75 && scoreDiff > 0) {
    return {
      matchId,
      team,
      type: 'SELL',
      price,
      scoreDiff,
      quarter: `第${quarter}节`,
      timeRemaining,
      reason: `💰 止盈机会：价格 ${(price * 100).toFixed(1)}¢，建议卖出锁定利润`,
      confidence: 80,
      timestamp,
    };
  }

  // === 强卖出信号 (价格极高或大幅领先) ===
  if (price >= 0.85 || (price >= 0.70 && scoreDiff > 10)) {
    return {
      matchId,
      team,
      type: 'STRONG_SELL',
      price,
      scoreDiff,
      quarter: `第${quarter}节`,
      timeRemaining,
      reason: `🔥 强力止盈：价格 ${(price * 100).toFixed(1)}¢，立即卖出！`,
      confidence: 95,
      timestamp,
    };
  }

  return null;
}

/**
 * 计算置信度
 * 基于价格、分差和时间综合判断
 */
function calculateConfidence(price: number, scoreDiff: number, quarter: number, espnWinProb?: number): number {
  let confidence = 50;

  // 价格越低，置信度越高
  if (price <= 0.38) confidence += 20;
  else if (price <= 0.42) confidence += 10;

  // 分差越小，置信度越高
  const absDiff = Math.abs(scoreDiff);
  if (absDiff <= 3) confidence += 15;
  else if (absDiff <= 5) confidence += 10;

  // 节数越早，置信度越高（时间越充裕）
  if (quarter <= 2) confidence += 15;
  else if (quarter === 3) confidence += 5;

  // ESPN胜率支持加分
  if (espnWinProb !== undefined) {
    const deviation = espnWinProb - price;
    if (deviation >= 0.15) confidence += 20; // 强偏差
    else if (deviation >= 0.10) confidence += 12; // 中等偏差
    else if (deviation >= 0.05) confidence += 6;  // 轻微偏差
  }

  return Math.min(100, confidence);
}

/**
 * 判断是否是第4节最后5分钟
 */
function isLastFiveMinutes(timeRemaining: string): boolean {
  if (!timeRemaining) return false;

  // 解析时间格式 "03:25" -> 3分25秒
  const parts = timeRemaining.split(':');
  if (parts.length !== 2) return false;

  const minutes = parseInt(parts[0]) || 0;
  const seconds = parseInt(parts[1]) || 0;

  const totalSeconds = minutes * 60 + seconds;

  // 小于5分钟 (300秒)
  return totalSeconds < 300;
}

/**
 * 格式化信号为可读文本
 */
export function formatSignal(signal: TradingSignal): string {
  const emoji = {
    STRONG_BUY: '🔥',
    BUY: '📈',
    NEUTRAL: '⚖️',
    SELL: '💰',
    STRONG_SELL: '🚨',
  };

  return `${emoji[signal.type]} ${signal.team} | ${signal.reason}`;
}
