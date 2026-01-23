import { logger } from '../utils/logger';
import {
  UnifiedMatch,
  ArbitrageSignal,
  SignalType,
  MatchStatus,
} from '../../../shared/types/index';

/**
 * 套利计算引擎 - 方案B：无风险对冲套利
 * 
 * 核心理念：当 homePrice + awayPrice < 1.0 时，同时买入主队和客队，锁定无风险利润
 * 
 * 举例：
 * 主队 $0.45 + 客队 $0.48 = $0.93
 * 投入 $100 主队 + $100 客队 = $200
 * 如果主队赢：收入 $100/0.45 = $222 → 赚 $22 (11%)
 * 如果客队赢：收入 $100/0.48 = $208 → 赚 $8 (4%)
 * 
 * 无论谁赢，都能盈利！
 */

class ArbitrageEngine {
  /**
   * 计算套利信号
   * @param match 统一的比赛数据
   * @returns 套利信号数组
   */
  calculateSignals(match: UnifiedMatch): ArbitrageSignal[] {
    const signals: ArbitrageSignal[] = [];

    // 必须有完整的 Polymarket 数据
    if (!match.dataCompleteness.hasPolyData || !match.poly) {
      return signals;
    }

    // 🎯 方案B：无风险对冲套利
    // 核心逻辑：如果 homePrice + awayPrice < 0.95，同时买入主队和客队
    const homePrice = match.poly.homeBestAsk || match.poly.homePrice;
    const awayPrice = match.poly.awayBestAsk || match.poly.awayPrice;

    if (!homePrice || !awayPrice) {
      return signals; // 价格数据不完整
    }

    const totalProb = homePrice + awayPrice;

    // 套利阈值：总概率 < 0.95（留 5% 作为利润空间 + 手续费缓冲）
    if (totalProb >= 0.95) {
      logger.debug(`❌ 无套利机会: ${match.homeTeam.name} vs ${match.awayTeam.name} (${homePrice.toFixed(3)} + ${awayPrice.toFixed(3)} = ${totalProb.toFixed(3)} >= 0.95)`);
      return signals;
    }

    // 计算套利空间
    const arbitrageMargin = 1.0 - totalProb; // 例如：1.0 - 0.92 = 0.08 (8%)
    const profitPercent = arbitrageMargin * 100;

    // 计算置信度（套利空间越大，置信度越高）
    const confidence = Math.min(0.7 + arbitrageMargin * 2, 0.99);

    logger.info(`🎯 发现套利机会！${match.homeTeam.name} vs ${match.awayTeam.name}`);
    logger.info(`   主队: $${homePrice.toFixed(3)} + 客队: $${awayPrice.toFixed(3)} = $${totalProb.toFixed(3)}`);
    logger.info(`   套利空间: ${profitPercent.toFixed(2)}% (置信度: ${(confidence * 100).toFixed(1)}%)`);

    // 生成套利信号（需要同时买入主队和客队）
    // 为了简化，我们生成一个信号，在 reason 中标注这是双边套利
    signals.push({
      type: SignalType.BUY_HOME, // 这里用 BUY_HOME，但实际会同时买入主客队
      confidence,
      edge: profitPercent,
      reason: `🔒 无风险套利: $${homePrice.toFixed(3)} + $${awayPrice.toFixed(3)} = $${totalProb.toFixed(3)} < 1.0 (利润${profitPercent.toFixed(2)}%)`,
      timestamp: Date.now(),
      details: {
        espnProb: 0, // 套利不需要 ESPN 数据
        polyPrice: homePrice,
        priceDiff: arbitrageMargin,
        scoreDiff: 0,
        timeRemaining: match.quarter && match.timeRemaining ? `${match.quarter} ${match.timeRemaining}` : 'PRE',
        awayPrice, // 额外记录客队价格
        totalProb, // 记录总概率
        arbitrageMargin, // 记录套利空间
      },
    });

    return signals;
  }
}

export const arbitrageEngine = new ArbitrageEngine();
