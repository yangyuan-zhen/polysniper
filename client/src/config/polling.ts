/**
 * 轮询频率配置
 * 
 * 根据数据源优化情况动态调整更新频率
 * 
 * 频率建议：
 * - 60 秒: 保守安全
 * - 45 秒: 推荐（平衡速度和安全性）
 * - 30 秒: 比赛高峰期可选
 * - 15-20 秒: 高风险（可能被限速）
 */

export const PollingConfig = {

  /**
   * Polymarket 比赛卡片轮询频率（毫秒）
   * 
   * - 进行中的比赛: 45秒
   * - 未开始的比赛: 120秒
   */
  POLYMARKET_LIVE_INTERVAL: 45000,
  POLYMARKET_UPCOMING_INTERVAL: 120000,

  /**
   * 价格趋势记录频率（毫秒）
   * 
   * - 强制记录: 2分钟
   * - 变化检测: 30秒
   */
  PRICE_TREND_RECORD_INTERVAL: 2 * 60 * 1000,
  PRICE_TREND_CHECK_INTERVAL: 30 * 1000,

  /**
   * 是否启用性能日志
   */
  ENABLE_PERFORMANCE_LOGS: true,
} as const;

/**
 * 获取当前配置的可读描述
 */
export function getPollingConfigDescription(): string {
  const polyLive = PollingConfig.POLYMARKET_LIVE_INTERVAL / 1000;
  const polyUpcoming = PollingConfig.POLYMARKET_UPCOMING_INTERVAL / 1000;

  return `
Polymarket (进行中): 每 ${polyLive} 秒更新
Polymarket (未开始): 每 ${polyUpcoming} 秒更新
  `.trim();
}

/**
 * 根据风险等级调整配置（用于 A/B 测试或紧急回退）
 */
export function getConfigByRiskLevel(level: 'safe' | 'balanced' | 'aggressive') {
  const configs = {
    safe: {
      ...PollingConfig,
      POLYMARKET_LIVE_INTERVAL: 60000 as number, // 60秒
    },
    balanced: {
      ...PollingConfig,
      POLYMARKET_LIVE_INTERVAL: 45000 as number, // 45秒（默认）
    },
    aggressive: {
      ...PollingConfig,
      POLYMARKET_LIVE_INTERVAL: 30000 as number, // 30秒
    },
  };

  return configs[level];
}
