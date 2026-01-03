import { logger } from '../utils/logger';
import {
  UnifiedMatch,
  ArbitrageSignal,
  SignalType,
  MatchStatus,
} from '../../../shared/types/index';

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
    // 注意：移除虎扑数据源后，无法通过 quarter 判断比赛阶段
    // 暂时禁用此逻辑，直到找到替代数据源
    if (match.status === MatchStatus.LIVE) {
      // TODO: 需要替代方案来判断比赛阶段
      return signals;
    }

    // 检查数据完整性
    if (!match.dataCompleteness.hasPolyData) {
      logger.debug(`No Polymarket data for match ${match.id}`);
      return signals;
    }

    // 临时：即使没有 ESPN 数据也尝试生成信号（用于测试 Paper Trading）
    if (!match.dataCompleteness.hasESPNData) {
      logger.warn(`⚠️ 缺少 ESPN 数据，使用默认胜率进行 Paper Trading 测试: ${match.homeTeam.name} vs ${match.awayTeam.name}`);
      // 继续执行，使用默认胜率
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
    let espnProb = 0;
    if (match.dataCompleteness.hasESPNData && match.espn) {
      espnProb = match.status === MatchStatus.PRE 
        ? (isHome ? match.espn.pregameHomeWinProb : match.espn.pregameAwayWinProb)
        : (isHome ? match.espn.homeWinProb : match.espn.awayWinProb);
    } else {
      // 临时：使用默认胜率进行测试（基于比分差异）
      const scoreDiff = isHome 
        ? match.homeTeam.score - match.awayTeam.score
        : match.awayTeam.score - match.homeTeam.score;
      
      // 简单的胜率估算：基于比分差异
      if (scoreDiff >= 10) {
        espnProb = 0.75; // 领先10分以上，75%胜率
      } else if (scoreDiff >= 5) {
        espnProb = 0.65; // 领先5-9分，65%胜率
      } else if (scoreDiff >= 0) {
        espnProb = 0.55; // 领先或平局，55%胜率
      } else {
        espnProb = 0.45; // 落后，45%胜率
      }
      
      logger.debug(`📊 使用默认胜率: ${teamName} ${(espnProb * 100).toFixed(1)}% (比分差: ${scoreDiff})`);
    }
    
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
      logger.debug(`❌ 利润空间不足: ${teamName} ESPN${(espnProb * 100).toFixed(1)}% vs Ask${(buyPrice * 100).toFixed(1)}% = ${(profitMargin * 100).toFixed(1)}% < 10%`);
      return null;
    }

    // 计算置信度（基于利润空间大小）
    // 利润空间越大，市场犯的错越离谱，我们越有信心
    let confidence = Math.min(0.5 + profitMargin * 3, 0.95); // 10%起步=0.8，20%=0.95

    // 时间因素：前三节，时间越多越好（时间是我们的盟友）
    // 注意：移除虎扑数据源后，无法获取 quarter 和 timeRemaining
    // TODO: 需要替代数据源来计算时间因素

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
        timeRemaining: 'N/A', // TODO: 需要从 ESPN 获取比赛时间信息
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
