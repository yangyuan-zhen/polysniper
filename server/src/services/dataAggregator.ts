import { logger } from '../utils/logger';
import { espnService } from './espnService';
import { hupuService } from './hupuService';
import { polymarketService } from './polymarketService';
import { arbitrageEngine } from './arbitrageEngine';
import { UnifiedMatch, MatchStatus } from '../types';
import { config } from '../config';

/**
 * 数据整合服务
 * 核心职责：整合 ESPN、虎扑、Polymarket 三个数据源
 */
class DataAggregator {
  private matches: Map<string, UnifiedMatch> = new Map();
  private updateInterval: NodeJS.Timeout | null = null;
  private espnUpdateInterval: NodeJS.Timeout | null = null;
  private hupuUpdateInterval: NodeJS.Timeout | null = null;

  /**
   * 启动数据采集
   */
  async start(): Promise<void> {
    logger.info('正在启动数据聚合器...');

    // 初始化 Polymarket WebSocket（如果启用）
    if (config.polymarket.wsEnabled) {
      await polymarketService.connectWebSocket();
    } else {
      logger.info('Polymarket WebSocket 已禁用，仅使用 REST API');
    }

    // 首次加载数据
    await this.updateAllMatches();

    // 定时更新（每5秒）
    this.updateInterval = setInterval(() => {
      this.updateAllMatches().catch(err => {
        logger.error('更新比赛数据失败:', err);
      });
    }, 5000);

    logger.info('数据聚合器已启动');
  }

  /**
   * 停止数据采集
   */
  stop(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }

    if (config.polymarket.wsEnabled) {
      polymarketService.disconnect();
    }
    logger.info('数据聚合器已停止');
  }

  /**
   * 更新所有比赛数据
   */
  private async updateAllMatches(): Promise<void> {
    try {
      // 1. 获取虎扑所有比赛（12月11日-23日）
      const games = await hupuService.getAllGames();

      logger.debug(`从虎扑获取到 ${games.length} 场比赛`);

      // 2. 过滤掉已结束的比赛（COMPLETED）
      // 原因：Polymarket 对已结束的比赛不会有 active=true 的市场
      // 避免无意义的 API 调用
      const activeGames = games.filter((game: any) => {
        const matchStatus = game.matchStatus || '';
        return matchStatus !== 'COMPLETED';
      });

      logger.debug(`过滤后剩余 ${activeGames.length} 场进行中或未开始的比赛`);

      // 3. 对每场比赛整合数据
      for (const game of activeGames) {
        try {
          await this.updateMatch(game);
        } catch (error) {
          logger.error(`更新比赛 ${game.id} 失败:`, error);
        }
      }
    } catch (error) {
      logger.error('更新所有比赛失败:', error);
    }
  }

  /**
   * 更新单场比赛数据（已优化：并行请求）
   */
  private async updateMatch(hupuGame: any): Promise<void> {
    const homeTeamName = hupuGame.homeTeamName || '';
    const awayTeamName = hupuGame.awayTeamName || '';

    // 生成匹配ID
    const matchId = this.generateMatchId(hupuGame);

    // 获取现有数据或创建新的
    let match = this.matches.get(matchId) || this.createEmptyMatch(matchId, hupuGame);

    // ========== 性能优化：并行请求三个数据源 ==========
    // 使用 Promise.allSettled 确保即使某个失败也不影响其他
    // 预期性能提升：从 (265ms + 480ms + 500ms) 降低到 max(265ms, 480ms, 500ms) ≈ 500ms
    const [hupuResult, espnResult, polyResult] = await Promise.allSettled([
      hupuService.getGameByTeams(homeTeamName, awayTeamName),
      espnService.getWinProbabilityByTeams(homeTeamName, awayTeamName),
      polymarketService.searchNBAMarkets(homeTeamName, awayTeamName),
    ]);

    // 处理虎扑数据（比分）
    if (hupuResult.status === 'fulfilled' && hupuResult.value) {
      const hupuScore = hupuResult.value;
      match.hupu = hupuScore;
      match.status = hupuScore.status;
      match.statusStr = `${hupuScore.quarter} ${hupuScore.timeRemaining}`;
      match.homeTeam.score = hupuScore.homeScore;
      match.awayTeam.score = hupuScore.awayScore;
      match.dataCompleteness.hasHupuData = true;
    } else if (hupuResult.status === 'rejected') {
      logger.debug(`虎扑数据获取失败 [${matchId}]: ${hupuResult.reason}`);
    }

    // 处理 ESPN 数据（胜率、伤病）
    if (espnResult.status === 'fulfilled' && espnResult.value) {
      match.espn = espnResult.value;
      match.dataCompleteness.hasESPNData = true;
    } else if (espnResult.status === 'rejected') {
      logger.debug(`ESPN 数据获取失败 [${matchId}]`);
    }

    // 处理 Polymarket 数据（市场价格）
    if (polyResult.status === 'fulfilled' && polyResult.value) {
      const polyData = polyResult.value;
      
      // ========== 第三层：时间校验 (Time Validation) ==========
      // 条件：Polymarket 的 endDate 不能早于虎扑的 startTime
      // 说明：endDate 等于 startTime 是正常的（市场在比赛开始时关闭）
      // 目的：防止匹配到未来同名对决或异常未结算的历史盘口
      let timeValid = true;
      if (polyData.endDate && match.startTime) {
        const polyEndTime = new Date(polyData.endDate).getTime();
        const hupuStartTime = new Date(match.startTime).getTime();
        
        // 只有当 endDate 明显早于 startTime 时才拒绝（允许相等）
        if (polyEndTime < hupuStartTime) {
          logger.warn(`[Layer 3] ⚠️ 时间校验失败: Polymarket endDate (${polyData.endDate}) < Hupu startTime (${match.startTime})`);
          timeValid = false;
        } else {
          logger.debug(`[Layer 3] ✅ 时间校验通过: endDate >= startTime`);
        }
      }
      
      if (timeValid) {
        match.poly = polyData;
        match.dataCompleteness.hasPolyData = true;
      }
    } else if (polyResult.status === 'rejected') {
      logger.debug(`Polymarket 数据获取失败 [${matchId}]`);
    }

    // 计算套利信号
    if (match.dataCompleteness.hasPolyData && match.dataCompleteness.hasESPNData) {
      match.signals = arbitrageEngine.calculateSignals(match);
      
      // 记录发现的套利机会
      if (match.signals.length > 0) {
        logger.info(`发现 ${match.signals.length} 个套利信号 [${matchId}]`);
        match.signals.forEach(signal => {
          logger.info(`  - ${signal.type}: ${signal.reason} (置信度: ${(signal.confidence * 100).toFixed(1)}%)`);
        });
      }
    }

    // 更新时间戳
    match.lastUpdate = Date.now();

    // 保存到内存
    this.matches.set(matchId, match);
  }

  /**
   * 创建空的比赛对象
   */
  private createEmptyMatch(matchId: string, hupuGame: any): UnifiedMatch {
    return {
      id: matchId,
      homeTeam: {
        id: hupuGame.homeTeamId || '',
        name: hupuGame.homeTeamName || '',
        score: 0,
      },
      awayTeam: {
        id: hupuGame.awayTeamId || '',
        name: hupuGame.awayTeamName || '',
        score: 0,
      },
      status: MatchStatus.PRE,
      statusStr: '未开始',
      startTime: hupuGame.chinaStartTime || hupuGame.beginTime,
      poly: {
        marketId: '',
        homeTokenId: '',
        awayTokenId: '',
        homePrice: 0,
        awayPrice: 0,
      },
      espn: {
        homeWinProb: 0,
        awayWinProb: 0,
        pregameHomeWinProb: 0,
        pregameAwayWinProb: 0,
      },
      hupu: {
        homeScore: 0,
        awayScore: 0,
        quarter: '',
        timeRemaining: '',
        status: MatchStatus.PRE,
      },
      signals: [],
      lastUpdate: Date.now(),
      dataCompleteness: {
        hasPolyData: false,
        hasESPNData: false,
        hasHupuData: false,
      },
    };
  }

  /**
   * 生成匹配ID
   */
  private generateMatchId(hupuGame: any): string {
    const homeTeam = hupuGame.homeTeamId || hupuGame.homeTeamName || '';
    const awayTeam = hupuGame.awayTeamId || hupuGame.awayTeamName || '';
    const startTime = hupuGame.chinaStartTime || hupuGame.beginTime || Date.now();
    const date = new Date(startTime).toISOString().split('T')[0].replace(/-/g, '');
    return `${homeTeam}-${awayTeam}-${date}`;
  }

  /**
   * 获取所有比赛
   */
  getAllMatches(): UnifiedMatch[] {
    return Array.from(this.matches.values());
  }

  /**
   * 获取指定状态的比赛
   */
  getMatchesByStatus(status: MatchStatus): UnifiedMatch[] {
    return this.getAllMatches().filter(m => m.status === status);
  }

  /**
   * 获取单场比赛
   */
  getMatch(matchId: string): UnifiedMatch | null {
    return this.matches.get(matchId) || null;
  }

  /**
   * 获取有套利信号的比赛
   */
  getMatchesWithSignals(): UnifiedMatch[] {
    return this.getAllMatches().filter(m => m.signals.length > 0);
  }
}

export const dataAggregator = new DataAggregator();
