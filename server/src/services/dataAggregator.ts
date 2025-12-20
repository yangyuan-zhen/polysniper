import { logger } from '../utils/logger';
import { espnService } from './espnService';
import { polymarketService } from './polymarketService';
import { arbitrageEngine } from './arbitrageEngine';
import { UnifiedMatch, MatchStatus } from '../types';
import { config } from '../config';
import { NBA_TEAMS } from '../config/teamMappings';

/**
 * 数据整合服务
 * 核心职责：整合 ESPN 和 Polymarket 两个数据源
 */
class DataAggregator {
  private matches: Map<string, UnifiedMatch> = new Map();
  private updateInterval: NodeJS.Timeout | null = null;

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
   * 更新所有比赛数据（使用 ESPN 作为主数据源）
   */
  private async updateAllMatches(): Promise<void> {
    try {
      // 获取未来3天的比赛数据
      const today = new Date();
      const dates: string[] = [];
      
      for (let i = 0; i < 3; i++) {
        const date = new Date(today);
        date.setDate(date.getDate() + i);
        const dateStr = date.toISOString().split('T')[0].replace(/-/g, '');
        dates.push(dateStr);
      }

      // 并行获取多天的比赛数据
      const scoreboardPromises = dates.map(date => espnService.getScoreboard(date));
      const scoreboards = await Promise.all(scoreboardPromises);

      // 合并所有比赛
      const allGames: any[] = [];
      scoreboards.forEach(scoreboard => {
        if (scoreboard?.events) {
          allGames.push(...scoreboard.events);
        }
      });

      logger.debug(`从 ESPN 获取到 ${allGames.length} 场比赛`);

      // 过滤掉已结束的比赛
      const activeGames = allGames.filter((game: any) => {
        const status = game.status?.type?.state;
        return status !== 'post'; // ESPN 使用 'post' 表示已结束
      });

      logger.debug(`过滤后剩余 ${activeGames.length} 场进行中或未开始的比赛`);

      // 对每场比赛整合数据
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
   * 更新单场比赛数据（使用 ESPN 作为主数据源）
   */
  private async updateMatch(espnGame: any): Promise<void> {
    // 从 ESPN 数据中提取球队信息
    const competition = espnGame.competitions?.[0];
    const competitors = competition?.competitors || [];
    const homeCompetitor = competitors.find((c: any) => c.homeAway === 'home');
    const awayCompetitor = competitors.find((c: any) => c.homeAway === 'away');
    
    if (!homeCompetitor || !awayCompetitor) {
      logger.warn(`比赛 ${espnGame.id} 缺少球队信息`);
      return;
    }

    const homeTeamName = homeCompetitor.team?.displayName || '';
    const awayTeamName = awayCompetitor.team?.displayName || '';
    const homeTeamId = homeCompetitor.team?.id || '';
    const awayTeamId = awayCompetitor.team?.id || '';

    // 生成匹配ID（使用 ESPN ID）
    const matchId = `${awayTeamId}-${homeTeamId}-${espnGame.id}`;

    // 获取现有数据或创建新的
    let match = this.matches.get(matchId) || this.createEmptyMatchFromESPN(matchId, espnGame);

    // 解析比赛状态和比分
    this.parseESPNGameStatus(match, espnGame);

    // ========== 并行请求详细数据 ==========
    const [espnResult, polyResult] = await Promise.allSettled([
      espnService.getGameWinProbability(espnGame.id),
      this.searchPolymarketByESPNTeams(homeTeamName, awayTeamName),
    ]);

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
        match.signals.forEach((signal: any) => {
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
   * 从 ESPN 数据创建比赛对象
   */
  private createEmptyMatchFromESPN(matchId: string, espnGame: any): UnifiedMatch {
    const competition = espnGame.competitions?.[0];
    const competitors = competition?.competitors || [];
    const homeCompetitor = competitors.find((c: any) => c.homeAway === 'home');
    const awayCompetitor = competitors.find((c: any) => c.homeAway === 'away');

    return {
      id: matchId,
      homeTeam: {
        id: homeCompetitor?.team?.id || '',
        name: homeCompetitor?.team?.displayName || '',
        score: parseInt(homeCompetitor?.score || '0'),
      },
      awayTeam: {
        id: awayCompetitor?.team?.id || '',
        name: awayCompetitor?.team?.displayName || '',
        score: parseInt(awayCompetitor?.score || '0'),
      },
      status: MatchStatus.PRE,
      statusStr: espnGame.status?.type?.description || '未开始',
      startTime: espnGame.date,
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
   * 解析 ESPN 比赛状态和比分
   */
  private parseESPNGameStatus(match: UnifiedMatch, espnGame: any): void {
    const competition = espnGame.competitions?.[0];
    const competitors = competition?.competitors || [];
    const homeCompetitor = competitors.find((c: any) => c.homeAway === 'home');
    const awayCompetitor = competitors.find((c: any) => c.homeAway === 'away');

    // 更新比分
    match.homeTeam.score = parseInt(homeCompetitor?.score || '0');
    match.awayTeam.score = parseInt(awayCompetitor?.score || '0');

    // 更新状态
    const statusType = espnGame.status?.type?.state;
    if (statusType === 'pre') {
      match.status = MatchStatus.PRE;
      match.statusStr = '未开始';
    } else if (statusType === 'in') {
      match.status = MatchStatus.LIVE;
      const period = espnGame.status?.period || '';
      const clock = espnGame.status?.displayClock || '';
      match.statusStr = `Q${period} ${clock}`;
    } else if (statusType === 'post') {
      match.status = MatchStatus.FINAL;
      match.statusStr = '已结束';
    }

    match.dataCompleteness.hasHupuData = true;
  }

  /**
   * 使用 ESPN 队名搜索 Polymarket
   */
  private async searchPolymarketByESPNTeams(homeTeamName: string, awayTeamName: string): Promise<any> {
    // 将 ESPN 队名转换为虎扑中文名（用于 Polymarket 搜索）
    const homeTeam = NBA_TEAMS.find(t => t.espnName === homeTeamName);
    const awayTeam = NBA_TEAMS.find(t => t.espnName === awayTeamName);

    if (!homeTeam || !awayTeam) {
      logger.debug(`未找到队名映射: ${homeTeamName} vs ${awayTeamName}`);
      return null;
    }

    return polymarketService.searchNBAMarkets(homeTeam.hupuName, awayTeam.hupuName);
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
