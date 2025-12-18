/**
 * 轮询频率配置
 * 
 * 根据虎扑 API 优化情况动态调整更新频率
 * 
 * 性能参考（启用 Keep-Alive 后）：
 * - 首次请求: ~896ms
 * - 后续请求: ~300ms
 * 
 * 频率建议：
 * - 10 秒: 保守安全
 * - 5 秒: 推荐（平衡速度和安全性）
 * - 3 秒: 比赛高峰期可选
 * - 1-2 秒: 高风险（可能被限速）
 */

export const PollingConfig = {
  /**
   * 虎扑 API 轮询频率（毫秒）
   * 用于获取比赛列表和实时比分
   * 
   * @default 5000 (5秒) - 启用 Keep-Alive 后的推荐值
   */
  HUPU_API_INTERVAL: 5000,

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
  const hupu = PollingConfig.HUPU_API_INTERVAL / 1000;
  const polyLive = PollingConfig.POLYMARKET_LIVE_INTERVAL / 1000;
  const polyUpcoming = PollingConfig.POLYMARKET_UPCOMING_INTERVAL / 1000;

  return `
虎扑 API: 每 ${hupu} 秒更新
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
      HUPU_API_INTERVAL: 10000 as number, // 10秒
    },
    balanced: {
      ...PollingConfig,
      HUPU_API_INTERVAL: 5000 as number, // 5秒（默认）
    },
    aggressive: {
      ...PollingConfig,
      HUPU_API_INTERVAL: 3000 as number, // 3秒
    },
  };

  return configs[level];
}
