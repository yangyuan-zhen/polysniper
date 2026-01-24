import { logger } from '../utils/logger';
import {
  UnifiedMatch,
  ArbitrageSignal,
  SignalType,
  MatchStatus,
} from '../../../shared/types/index';

/**
 * 套利计算引擎 - ESPN 胜率 vs Polymarket 价格
 * 
 * 核心理念：当 ESPN 实时胜率 > Polymarket 价格时，市场可能低估了该队
 * 
 * 参数：
 * - MIN_EDGE: 最小套利边际 (5%)
 * - ONLY_LIVE: 只在比赛进行中触发
 * 
 * 举例：
 * ESPN 预测主队胜率 60%，Polymarket 价格 $0.52
 * 边际 = 60% - 52% = 8% > 5%，触发买入信号
 */

// 可配置参数
const MIN_EDGE = 0.05; // 最小边际 5%
const ONLY_LIVE = true; // 只在比赛进行中触发

class ArbitrageEngine {
  /**
   * 计算套利信号
   * @param match 统一的比赛数据
   * @returns 套利信号数组
   */
  calculateSignals(match: UnifiedMatch): ArbitrageSignal[] {
    const signals: ArbitrageSignal[] = [];

    // 必须有 Polymarket 数据
    if (!match.dataCompleteness.hasPolyData || !match.poly) {
      return signals;
    }

    // 必须有 ESPN 胜率数据
    if (!match.espn) {
      logger.debug(`❌ 无 ESPN 数据: ${match.homeTeam.name} vs ${match.awayTeam.name}`);
      return signals;
    }

    // 可选：只在比赛进行中触发
    if (ONLY_LIVE && match.status !== MatchStatus.LIVE) {
      logger.debug(`⏸️ 比赛未开始: ${match.homeTeam.name} vs ${match.awayTeam.name} (${match.status})`);
      return signals;
    }

    // 获取价格（优先使用 bestAsk 买入价）
    const homePrice = match.poly.homeBestAsk || match.poly.homePrice;
    const awayPrice = match.poly.awayBestAsk || match.poly.awayPrice;

    if (!homePrice || !awayPrice) {
      return signals; // 价格数据不完整
    }

    // 获取 ESPN 胜率（进行中用实时胜率，赛前用预测胜率）
    const espnHomeProb = match.status === MatchStatus.LIVE 
      ? match.espn.homeWinProb 
      : match.espn.pregameHomeWinProb;
    const espnAwayProb = match.status === MatchStatus.LIVE 
      ? match.espn.awayWinProb 
      : match.espn.pregameAwayWinProb;

    if (!espnHomeProb || !espnAwayProb) {
      logger.debug(`❌ ESPN 胜率数据不完整: ${match.homeTeam.name} vs ${match.awayTeam.name}`);
      return signals;
    }

    // 计算边际
    const homeEdge = espnHomeProb - homePrice; // ESPN 胜率 - Poly 价格
    const awayEdge = espnAwayProb - awayPrice;

    logger.debug(`📊 比较 [${match.homeTeam.name} vs ${match.awayTeam.name}]:`);
    logger.debug(`   主队: ESPN ${(espnHomeProb * 100).toFixed(1)}% vs Poly $${homePrice.toFixed(3)} → 边际 ${(homeEdge * 100).toFixed(1)}%`);
    logger.debug(`   客队: ESPN ${(espnAwayProb * 100).toFixed(1)}% vs Poly $${awayPrice.toFixed(3)} → 边际 ${(awayEdge * 100).toFixed(1)}%`);

    // 检查主队是否有套利机会
    if (homeEdge >= MIN_EDGE) {
      const confidence = Math.min(0.5 + homeEdge, 0.95);
      
      logger.info(`🎯 发现套利机会！买入 ${match.homeTeam.name}`);
      logger.info(`   MatchID: ${match.id}`);
      logger.info(`   ESPN 胜率: ${(espnHomeProb * 100).toFixed(1)}% vs Poly 价格: $${homePrice.toFixed(3)}`);
      logger.info(`   边际: ${(homeEdge * 100).toFixed(1)}% (阈值: ${(MIN_EDGE * 100).toFixed(0)}%)`);
      logger.info(`   比分: ${match.homeTeam.name} ${match.homeTeam.score} - ${match.awayTeam.score} ${match.awayTeam.name}`);
      if (match.quarter && match.timeRemaining) {
        logger.info(`   进度: ${match.quarter} ${match.timeRemaining}`);
      }

      signals.push({
        type: SignalType.BUY_HOME,
        confidence,
        edge: homeEdge * 100,
        reason: `📈 ESPN ${(espnHomeProb * 100).toFixed(1)}% > Poly $${homePrice.toFixed(2)} (边际 ${(homeEdge * 100).toFixed(1)}%)`,
        timestamp: Date.now(),
        details: {
          espnProb: espnHomeProb,
          polyPrice: homePrice,
          priceDiff: homeEdge,
          scoreDiff: match.homeTeam.score - match.awayTeam.score,
          timeRemaining: match.quarter && match.timeRemaining ? `${match.quarter} ${match.timeRemaining}` : 'LIVE',
        },
      });
    }

    // 检查客队是否有套利机会
    if (awayEdge >= MIN_EDGE) {
      const confidence = Math.min(0.5 + awayEdge, 0.95);
      
      logger.info(`🎯 发现套利机会！买入 ${match.awayTeam.name}`);
      logger.info(`   MatchID: ${match.id}`);
      logger.info(`   ESPN 胜率: ${(espnAwayProb * 100).toFixed(1)}% vs Poly 价格: $${awayPrice.toFixed(3)}`);
      logger.info(`   边际: ${(awayEdge * 100).toFixed(1)}% (阈值: ${(MIN_EDGE * 100).toFixed(0)}%)`);
      logger.info(`   比分: ${match.homeTeam.name} ${match.homeTeam.score} - ${match.awayTeam.score} ${match.awayTeam.name}`);
      if (match.quarter && match.timeRemaining) {
        logger.info(`   进度: ${match.quarter} ${match.timeRemaining}`);
      }

      signals.push({
        type: SignalType.BUY_AWAY,
        confidence,
        edge: awayEdge * 100,
        reason: `📈 ESPN ${(espnAwayProb * 100).toFixed(1)}% > Poly $${awayPrice.toFixed(2)} (边际 ${(awayEdge * 100).toFixed(1)}%)`,
        timestamp: Date.now(),
        details: {
          espnProb: espnAwayProb,
          polyPrice: awayPrice,
          priceDiff: awayEdge,
          scoreDiff: match.awayTeam.score - match.homeTeam.score,
          timeRemaining: match.quarter && match.timeRemaining ? `${match.quarter} ${match.timeRemaining}` : 'LIVE',
        },
      });
    }

    // 如果没有机会，记录原因
    if (signals.length === 0 && (homeEdge > 0 || awayEdge > 0)) {
      logger.debug(`❌ 边际不足: 主队 ${(homeEdge * 100).toFixed(1)}%, 客队 ${(awayEdge * 100).toFixed(1)}% (需要 >= ${(MIN_EDGE * 100).toFixed(0)}%)`);
    }

    return signals;
  }
}

export const arbitrageEngine = new ArbitrageEngine();
