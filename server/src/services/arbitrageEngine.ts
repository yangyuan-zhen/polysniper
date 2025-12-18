import { logger } from '../utils/logger';
import {
  UnifiedMatch,
  ArbitrageSignal,
  SignalType,
  MatchStatus,
} from '../types';

/**
 * 套利计算引擎
 * 核心职责：基于多源数据计算套利机会
 */
class ArbitrageEngine {
  /**
   * 计算套利信号
   * @param match 统一的比赛数据
   * @returns 套利信号数组
   */
  calculateSignals(match: UnifiedMatch): ArbitrageSignal[] {
    const signals: ArbitrageSignal[] = [];

    // 只在比赛进行中或即将开始时计算套利机会
    if (match.status === MatchStatus.FINAL) {
      return signals;
    }

    // 检查数据完整性
    if (!match.dataCompleteness.hasPolyData || !match.dataCompleteness.hasESPNData) {
      logger.debug(`Insufficient data for match ${match.id}`);
      return signals;
    }

    // 策略1: 主队抄底策略（强队价格低于预期）
    const buyHomeSignal = this.calculateBuyHomeSignal(match);
    if (buyHomeSignal) {
      signals.push(buyHomeSignal);
    }

    // 策略2: 主队套现策略（价格过高）
    const sellHomeSignal = this.calculateSellHomeSignal(match);
    if (sellHomeSignal) {
      signals.push(sellHomeSignal);
    }

    // 策略3: 客队抄底策略
    const buyAwaySignal = this.calculateBuyAwaySignal(match);
    if (buyAwaySignal) {
      signals.push(buyAwaySignal);
    }

    // 策略4: 客队套现策略
    const sellAwaySignal = this.calculateSellAwaySignal(match);
    if (sellAwaySignal) {
      signals.push(sellAwaySignal);
    }

    return signals;
  }

  /**
   * 策略1: 主队抄底策略
   * 条件：ESPN胜率高但Polymarket价格低，存在套利空间
   */
  private calculateBuyHomeSignal(match: UnifiedMatch): ArbitrageSignal | null {
    const espnProb = match.status === MatchStatus.PRE 
      ? match.espn.pregameHomeWinProb 
      : match.espn.homeWinProb;
    const polyPrice = match.poly.homePrice;

    // 计算 Edge（预期收益）
    const edge = espnProb - polyPrice;

    // 阈值：Edge > 0.05 (5%) 才考虑
    if (edge < 0.05) {
      return null;
    }

    // 计算置信度
    let confidence = this.calculateConfidence(edge, match);

    // 额外条件：比赛早期机会更大
    if (match.status === MatchStatus.LIVE) {
      const timeRemaining = this.parseTimeRemaining(match.hupu.timeRemaining, match.hupu.quarter);
      if (timeRemaining < 600) { // 少于10分钟，降低置信度
        confidence *= 0.8;
      }
    }

    // 置信度阈值：> 0.5 才发出信号
    if (confidence < 0.5) {
      return null;
    }

    return {
      type: SignalType.BUY_HOME,
      confidence,
      edge: edge * 100, // 转换为百分比
      reason: `主队 ${match.homeTeam.name} ESPN胜率${(espnProb * 100).toFixed(1)}% vs 市场价格${(polyPrice * 100).toFixed(1)}% (Edge ${(edge * 100).toFixed(1)}%)`,
      timestamp: Date.now(),
      details: {
        espnProb,
        polyPrice,
        priceDiff: edge,
        scoreDiff: match.homeTeam.score - match.awayTeam.score,
        timeRemaining: match.hupu.timeRemaining,
      },
    };
  }

  /**
   * 策略2: 主队套现策略
   * 条件：Polymarket价格高于ESPN胜率，市场过度乐观
   */
  private calculateSellHomeSignal(match: UnifiedMatch): ArbitrageSignal | null {
    const espnProb = match.status === MatchStatus.PRE 
      ? match.espn.pregameHomeWinProb 
      : match.espn.homeWinProb;
    const polyPrice = match.poly.homePrice;

    // 价格高于胜率，市场过度乐观
    const edge = polyPrice - espnProb;

    // 阈值：Edge > 0.07 (7%)，卖出要求更高的阈值
    if (edge < 0.07) {
      return null;
    }

    // 额外条件：主队领先且价格高
    const scoreDiff = match.homeTeam.score - match.awayTeam.score;
    if (scoreDiff < 5 || polyPrice < 0.7) {
      return null;
    }

    const confidence = this.calculateConfidence(edge, match) * 0.9; // 卖出策略置信度略低

    if (confidence < 0.6) {
      return null;
    }

    return {
      type: SignalType.SELL_HOME,
      confidence,
      edge: edge * 100,
      reason: `主队 ${match.homeTeam.name} 市场价格${(polyPrice * 100).toFixed(1)}% vs ESPN胜率${(espnProb * 100).toFixed(1)}% 领先${scoreDiff}分 (套现机会)`,
      timestamp: Date.now(),
      details: {
        espnProb,
        polyPrice,
        priceDiff: edge,
        scoreDiff,
        timeRemaining: match.hupu.timeRemaining,
      },
    };
  }

  /**
   * 策略3: 客队抄底策略
   */
  private calculateBuyAwaySignal(match: UnifiedMatch): ArbitrageSignal | null {
    const espnProb = match.status === MatchStatus.PRE 
      ? match.espn.pregameAwayWinProb 
      : match.espn.awayWinProb;
    const polyPrice = match.poly.awayPrice;

    const edge = espnProb - polyPrice;

    if (edge < 0.05) {
      return null;
    }

    let confidence = this.calculateConfidence(edge, match);

    if (match.status === MatchStatus.LIVE) {
      const timeRemaining = this.parseTimeRemaining(match.hupu.timeRemaining, match.hupu.quarter);
      if (timeRemaining < 600) {
        confidence *= 0.8;
      }
    }

    if (confidence < 0.5) {
      return null;
    }

    return {
      type: SignalType.BUY_AWAY,
      confidence,
      edge: edge * 100,
      reason: `客队 ${match.awayTeam.name} ESPN胜率${(espnProb * 100).toFixed(1)}% vs 市场价格${(polyPrice * 100).toFixed(1)}% (Edge ${(edge * 100).toFixed(1)}%)`,
      timestamp: Date.now(),
      details: {
        espnProb,
        polyPrice,
        priceDiff: edge,
        scoreDiff: match.awayTeam.score - match.homeTeam.score,
        timeRemaining: match.hupu.timeRemaining,
      },
    };
  }

  /**
   * 策略4: 客队套现策略
   */
  private calculateSellAwaySignal(match: UnifiedMatch): ArbitrageSignal | null {
    const espnProb = match.status === MatchStatus.PRE 
      ? match.espn.pregameAwayWinProb 
      : match.espn.awayWinProb;
    const polyPrice = match.poly.awayPrice;

    const edge = polyPrice - espnProb;

    if (edge < 0.07) {
      return null;
    }

    const scoreDiff = match.awayTeam.score - match.homeTeam.score;
    if (scoreDiff < 5 || polyPrice < 0.7) {
      return null;
    }

    const confidence = this.calculateConfidence(edge, match) * 0.9;

    if (confidence < 0.6) {
      return null;
    }

    return {
      type: SignalType.SELL_AWAY,
      confidence,
      edge: edge * 100,
      reason: `客队 ${match.awayTeam.name} 市场价格${(polyPrice * 100).toFixed(1)}% vs ESPN胜率${(espnProb * 100).toFixed(1)}% 领先${scoreDiff}分 (套现机会)`,
      timestamp: Date.now(),
      details: {
        espnProb,
        polyPrice,
        priceDiff: edge,
        scoreDiff,
        timeRemaining: match.hupu.timeRemaining,
      },
    };
  }

  /**
   * 计算置信度
   * 基于多个因素：Edge大小、流动性、时间等
   */
  private calculateConfidence(edge: number, match: UnifiedMatch): number {
    let confidence = 0;

    // 基础置信度：Edge越大，置信度越高
    confidence += Math.min(edge * 10, 0.5); // 最多贡献0.5

    // 流动性因素：流动性越高，置信度越高
    const liquidity = match.poly.liquidity || 0;
    if (liquidity > 10000) {
      confidence += 0.2;
    } else if (liquidity > 5000) {
      confidence += 0.1;
    }

    // 比分差距因素：比分接近时，反转可能性更大
    const scoreDiff = Math.abs(match.homeTeam.score - match.awayTeam.score);
    if (scoreDiff < 5) {
      confidence += 0.1;
    } else if (scoreDiff > 15) {
      confidence -= 0.1; // 分差过大，反转难度高
    }

    // 时间因素：比赛早期，变数更大
    if (match.status === MatchStatus.LIVE) {
      const timeRemaining = this.parseTimeRemaining(match.hupu.timeRemaining, match.hupu.quarter);
      if (timeRemaining > 1800) { // 超过30分钟
        confidence += 0.2;
      }
    }

    // 限制在 0-1 范围内
    return Math.max(0, Math.min(1, confidence));
  }

  /**
   * 解析剩余时间（秒）
   */
  private parseTimeRemaining(timeStr: string, quarter: string): number {
    if (quarter === 'FINAL') return 0;

    // 解析 "05:30" 格式
    const parts = timeStr.split(':');
    if (parts.length !== 2) return 0;

    const minutes = parseInt(parts[0], 10);
    const seconds = parseInt(parts[1], 10);
    const timeInQuarter = minutes * 60 + seconds;

    // 计算总剩余时间
    let totalTime = timeInQuarter;
    
    switch (quarter) {
      case 'Q1':
        totalTime += 36 * 60; // 3个节 + 当前节剩余
        break;
      case 'Q2':
        totalTime += 24 * 60; // 2个节 + 当前节剩余
        break;
      case 'Q3':
        totalTime += 12 * 60; // 1个节 + 当前节剩余
        break;
      case 'Q4':
        totalTime = timeInQuarter; // 只有当前节剩余
        break;
      case 'OT':
        totalTime = Math.min(timeInQuarter, 5 * 60); // 加时最多5分钟
        break;
    }

    return totalTime;
  }
}

export const arbitrageEngine = new ArbitrageEngine();
