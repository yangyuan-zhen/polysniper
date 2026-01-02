import { logger } from '../utils/logger';
import {
  UnifiedMatch,
  ArbitrageSignal,
  SignalType,
  MatchStatus,
} from '../types';

/**
 * 套利计算引擎 - 新机制
 * 核心理念：赚"情绪溢价" (Eating the Emotional Premium)
 * 
 * 盈利来源：我们赚的是散户对早期比分波动的过度反应
 * 铁律：只做前三节（Q1-Q3），第四节赌博逻辑不参与
 * 决策模型：EV+ 利润空间 = ESPN胜率 - Polymarket价格 > 10%
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

    // 铁律：只做前三节（Q1-Q3）
    if (match.status === MatchStatus.LIVE) {
      const quarter = match.hupu.quarter;
      if (quarter === 'Q4' || quarter === 'OT') {
        logger.info(`⛔ [套利引擎] 跳过第四节/加时 ${match.homeTeam.name} vs ${match.awayTeam.name} (${quarter})`);
        return signals; // 第四节是赌博逻辑，不参与
      }
    }

    // 检查数据完整性
    if (!match.dataCompleteness.hasPolyData || !match.dataCompleteness.hasESPNData) {
      logger.debug(`Insufficient data for match ${match.id}`);
      return signals;
    }

    // 新策略：EV+ 决策模型
    // 利润空间 = 上帝视角的胜率(ESPN) - 市场盲人的出价(Poly)
    
    // 主队机会
    const homeSignal = this.calculateEVPlusSignal(match, 'home');
    if (homeSignal) {
      signals.push(homeSignal);
    }

    // 客队机会
    const awaySignal = this.calculateEVPlusSignal(match, 'away');
    if (awaySignal) {
      signals.push(awaySignal);
    }

    return signals;
  }

  /**
   * EV+ 决策模型：只做一道简单的减法题
   * 利润空间 = ESPN胜率 - Polymarket bestAsk
   * 如果利润空间 > 10%，说明市场犯错了
   */
  private calculateEVPlusSignal(match: UnifiedMatch, side: 'home' | 'away'): ArbitrageSignal | null {
    const isHome = side === 'home';
    const teamName = isHome ? match.homeTeam.name : match.awayTeam.name;
    // 获取ESPN胜率（上帝视角）
    const espnProb = match.status === MatchStatus.PRE 
      ? (isHome ? match.espn.pregameHomeWinProb : match.espn.pregameAwayWinProb)
      : (isHome ? match.espn.homeWinProb : match.espn.awayWinProb);
    
    // 获取Polymarket bestAsk（买入成本）
    const polyBestAsk = isHome ? match.poly.homeBestAsk : match.poly.awayBestAsk;
    const polyMidPrice = isHome ? match.poly.homePrice : match.poly.awayPrice;
    
    // 优先使用 bestAsk，如果没有则使用 midPrice
    const buyPrice = polyBestAsk || polyMidPrice;
    
    if (!buyPrice) {
      return null; // 没有有效价格
    }

    // 计算利润空间（做一道减法题）
    const profitMargin = espnProb - buyPrice;

    // 铁律：利润空间 > 10% 才出手（市场犯错了）
    if (profitMargin < 0.10) {
      return null;
    }

    // 计算置信度（基于利润空间大小）
    // 利润空间越大，市场犯的错越离谱，我们越有信心
    let confidence = Math.min(0.5 + profitMargin * 3, 0.95); // 10%起步=0.8，20%=0.95

    // 时间因素：前三节，时间越多越好（时间是我们的盟友）
    if (match.status === MatchStatus.LIVE) {
      const quarter = match.hupu.quarter;
      if (quarter === 'Q1') {
        confidence = Math.min(confidence * 1.1, 0.95); // Q1奖励10%
      } else if (quarter === 'Q2') {
        confidence = Math.min(confidence * 1.05, 0.95); // Q2奖励5%
      }
      // Q3保持原样
    }

    // 生成信号
    const scoreDiff = isHome 
      ? match.homeTeam.score - match.awayTeam.score
      : match.awayTeam.score - match.homeTeam.score;

    return {
      type: isHome ? SignalType.BUY_HOME : SignalType.BUY_AWAY,
      confidence,
      edge: profitMargin * 100, // 转换为百分比
      reason: `🎯 ${teamName} ESPN${(espnProb * 100).toFixed(1)}% vs Ask${(buyPrice * 100).toFixed(1)}% 利润空间${(profitMargin * 100).toFixed(1)}% (Edge ${(profitMargin * 100).toFixed(1)}%)`,
      timestamp: Date.now(),
      details: {
        espnProb,
        polyPrice: buyPrice, // 使用 bestAsk 作为价格
        priceDiff: profitMargin,
        scoreDiff,
        timeRemaining: match.hupu.timeRemaining,
      },
    };
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
