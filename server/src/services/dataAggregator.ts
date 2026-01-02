import { logger } from '../utils/logger';
import { espnService } from './espnService';
import { polymarketService } from './polymarketService';
import { arbitrageEngine } from './arbitrageEngine';
import { paperTradingService } from './paperTradingService';
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
  private hasLiveMatches: boolean = false;
  private subscribedMarkets: Set<string> = new Set(); // 跟踪已订阅的市场
  private lastWSUpdate: Map<string, number> = new Map(); // 跟踪每个市场最后的 WS 更新时间

  /**
   * 启动数据采集
   */
  async start(): Promise<void> {
    logger.info('正在启动数据聚合器...');

    // 初始化 Polymarket WebSocket（如果启用）
    logger.info(`🔍 WebSocket 配置: wsEnabled=${config.polymarket.wsEnabled}, wsUrl=${config.polymarket.wsUrl}`);
    
    if (config.polymarket.wsEnabled) {
      logger.info('🚀 启动 Polymarket WebSocket 连接...');
      await polymarketService.connectWebSocket();
    } else {
      logger.info('⚠️ Polymarket WebSocket 已禁用，仅使用 REST API');
    }

    // 首次加载数据
    await this.updateAllMatches();

    // 启动动态更新循环
    this.startDynamicUpdate();

    logger.info('数据聚合器已启动（动态更新频率）');
  }

  /**
   * 启动动态更新循环
   */
  private startDynamicUpdate(): void {
    const update = async () => {
      try {
        await this.updateAllMatches();
        
        // 检查长时间未更新的市场
        this.checkStaleSubscriptions();
        
        // 🎯 数据更新策略：
        // 1. 实时数据（比分、时间、胜率、价格）：不缓存
        // 2. 静态数据（比赛列表、Token ID、Market ID）：长效缓存
        // 3. ESPN：每3秒请求一次（节流）
        // 4. Polymarket WS：被动接收，实时处理
        const interval = 3000; // 3秒节流
        
        this.updateInterval = setTimeout(update, interval);
        
        // 显示当前状态
        if (this.hasLiveMatches) {
          logger.debug(`🔴 进行中比赛，ESPN节流: 3秒`);
        } else {
          logger.debug(`⚪ 等待比赛开始，ESPN节流: 3秒`);
        }
      } catch (err) {
        logger.error('更新比赛数据失败:', err);
        // 出错后3秒重试（保持一致）
        this.updateInterval = setTimeout(update, 3000);
      }
    };
    
    update();
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
   * 检查并诊断长时间未收到 WebSocket 更新的市场
   */
  private checkStaleSubscriptions(): void {
    const now = Date.now();
    const STALE_THRESHOLD = 60000; // 60秒未更新视为过期
    
    let staleCount = 0;
    this.matches.forEach((match, matchId) => {
      if (match.poly && match.status === 'LIVE') {
        const lastUpdate = this.lastWSUpdate.get(matchId);
        if (lastUpdate && (now - lastUpdate) > STALE_THRESHOLD) {
          staleCount++;
          logger.warn(`⚠️ 市场价格长时间未更新 [${match.homeTeam.name} vs ${match.awayTeam.name}]`);
          logger.warn(`   上次更新: ${Math.floor((now - lastUpdate) / 1000)}秒前`);
          logger.warn(`   Market ID: ${match.poly.marketId.slice(0, 8)}...`);
        }
      }
    });
    
    if (staleCount > 0) {
      logger.warn(`📊 共有 ${staleCount} 个进行中的市场价格长时间未更新`);
    }
  }

  /**
   * 更新所有比赛数据（使用 ESPN 作为主数据源）
   */
  private async updateAllMatches(): Promise<void> {
    try {
      // 获取未来3天的比赛数据
      // 注意：ESPN API 使用美国时区，比中国时间晚约12-16小时
      // 美国25号晚上的比赛 = 中国26号早上
      // 因此需要查询前一天到后一天的数据，确保覆盖所有中国时间的比赛
      const getESPNDate = (daysOffset: number = 0): string => {
        const now = new Date();
        // 转换为中国时间（UTC+8）
        const chinaTime = new Date(now.getTime() + (8 * 60 * 60 * 1000));
        // 提前一天查询，因为 ESPN 使用美国时区
        chinaTime.setUTCDate(chinaTime.getUTCDate() + daysOffset - 1);
        const year = chinaTime.getUTCFullYear();
        const month = String(chinaTime.getUTCMonth() + 1).padStart(2, '0');
        const day = String(chinaTime.getUTCDate()).padStart(2, '0');
        return `${year}${month}${day}`;
      };

      const dates: string[] = [];
      // 查询4天的数据（昨天到后天），确保覆盖中国时间今天到后天的所有比赛
      for (let i = 0; i < 4; i++) {
        dates.push(getESPNDate(i));
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

      logger.info(`📅 查询日期: ${dates.join(', ')}`);
      logger.info(`📊 从 ESPN 获取到 ${allGames.length} 场比赛`);

      // 记录每场比赛的状态和日期
      allGames.forEach((game: any) => {
        const competition = game.competitions?.[0];
        const homeTeam = competition?.competitors?.find((c: any) => c.homeAway === 'home')?.team?.displayName;
        const awayTeam = competition?.competitors?.find((c: any) => c.homeAway === 'away')?.team?.displayName;
        const status = game.status?.type?.state;
        const gameDate = new Date(game.date).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
        logger.debug(`  ${homeTeam} vs ${awayTeam} - 状态: ${status} - 时间: ${gameDate}`);
      });

      // 过滤掉已结束的比赛
      const activeGames = allGames.filter((game: any) => {
        const status = game.status?.type?.state;
        return status !== 'post'; // ESPN 使用 'post' 表示已结束
      });

      // 检测是否有进行中的比赛
      const liveGames = activeGames.filter((game: any) => game.status?.type?.state === 'in');
      this.hasLiveMatches = liveGames.length > 0;

      if (this.hasLiveMatches) {
        logger.info(`🔴 ${liveGames.length} 场比赛进行中，更新频率: 2秒`);
      } else {
        logger.info(`⚪ ${activeGames.length} 场比赛未开始，更新频率: 5秒`);
      }

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

    // 处理 ESPN 数据（胜率）
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
        const startTime = new Date(match.startTime).getTime();
        
        // 只有当 endDate 明显早于 startTime 时才拒绝（允许相等）
        if (polyEndTime < startTime) {
          logger.warn(`[Layer 3] ⚠️ 时间校验失败: Polymarket endDate (${polyData.endDate}) < startTime (${match.startTime})`);
          timeValid = false;
        } else {
          logger.debug(`[Layer 3] ✅ 时间校验通过: endDate >= startTime`);
        }
      }
      
      if (timeValid) {
        // 检测价格变化并记录日志（降低阈值到0.001以捕捉更小的变化）
        const oldPoly = match.poly;
        if (oldPoly && oldPoly.homePrice && oldPoly.awayPrice) {
          const homePriceChange = Math.abs(polyData.homePrice - oldPoly.homePrice);
          const awayPriceChange = Math.abs(polyData.awayPrice - oldPoly.awayPrice);
          
          // 价格变化超过0.001（0.1美分）时记录
          if (homePriceChange > 0.001 || awayPriceChange > 0.001) {
            logger.info(`💰 价格变化 [${homeTeamName} vs ${awayTeamName}]`);
            if (homePriceChange > 0.001) {
              logger.info(`   ${homeTeamName}: $${oldPoly.homePrice.toFixed(4)} → $${polyData.homePrice.toFixed(4)} (${(homePriceChange >= 0 ? '+' : '')}${(homePriceChange * 100).toFixed(2)}¢)`);
            }
            if (awayPriceChange > 0.001) {
              logger.info(`   ${awayTeamName}: $${oldPoly.awayPrice.toFixed(4)} → $${polyData.awayPrice.toFixed(4)} (${(awayPriceChange >= 0 ? '+' : '')}${(awayPriceChange * 100).toFixed(2)}¢)`);
            }
          }
        }
        
        match.poly = polyData;
        match.dataCompleteness.hasPolyData = true;
        
        // 🎯 订阅 WebSocket 实时价格更新
        if (config.polymarket.wsEnabled && polyData.marketId) {
          this.subscribeToMarketPrice(matchId, polyData.marketId, polyData.homeTokenId, polyData.awayTokenId);
        }
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
          
          // 🤖 Paper Trading: 自动执行模拟交易
          // 注意：买入时使用 bestAsk（最低卖价），卖出时使用 bestBid（最高买价）
          paperTradingService.executeSignal(
            signal,
            matchId,
            match.homeTeam.name,
            match.awayTeam.name,
            match.poly.homeTokenId,
            match.poly.awayTokenId,
            match.poly.homeBestAsk,  // 买入价
            match.poly.awayBestAsk,  // 买入价
            match.poly.homePrice,    // 中间价（备用）
            match.poly.awayPrice     // 中间价（备用）
          );
        });
      }
      
      // 📊 Paper Trading: 更新持仓价格（实时计算浮盈浮亏）
      // 注意：使用 bestBid（卖出价）计算浮盈，如果没有则使用 midPrice
      if (match.poly) {
        paperTradingService.updatePositionPrice(
          matchId,
          match.poly.homeTokenId,
          match.poly.awayTokenId,
          match.poly.homeBestBid || match.poly.homePrice, // 使用 bestBid（卖出价）
          match.poly.awayBestBid || match.poly.awayPrice  // 使用 bestBid（卖出价）
        );
      }
    }
    
    // 🔒 Paper Trading: 比赛结束时自动平仓
    // 注意：使用 bestBid（卖出价）平仓
    if (match.status === MatchStatus.FINAL && match.poly) {
      paperTradingService.closePosition(
        matchId, 
        match.poly.homeTokenId, 
        match.poly.homeBestBid || match.poly.homePrice // 使用 bestBid（卖出价）
      );
      paperTradingService.closePosition(
        matchId, 
        match.poly.awayTokenId, 
        match.poly.awayBestBid || match.poly.awayPrice // 使用 bestBid（卖出价）
      );
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
      signals: [],
      lastUpdate: Date.now(),
      dataCompleteness: {
        hasPolyData: false,
        hasESPNData: false,
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
      const period = espnGame.status?.period || 0;
      const clock = espnGame.status?.displayClock || '';
      
      // 设置状态字符串
      let quarterStr = '';
      if (period === 5) {
        quarterStr = 'OT';
      } else if (period >= 1 && period <= 4) {
        quarterStr = `Q${period}`;
      }
      
      match.statusStr = `${quarterStr} ${clock}`;
    } else if (statusType === 'post') {
      match.status = MatchStatus.FINAL;
      match.statusStr = '已结束';
    }
  }

  /**
   * 使用 ESPN 队名搜索 Polymarket
   */
  private async searchPolymarketByESPNTeams(homeTeamName: string, awayTeamName: string): Promise<any> {
    // 将 ESPN 队名转换为中文名（用于 Polymarket 搜索）
    const homeTeam = NBA_TEAMS.find(t => t.espnName === homeTeamName);
    const awayTeam = NBA_TEAMS.find(t => t.espnName === awayTeamName);

    if (!homeTeam || !awayTeam) {
      logger.debug(`未找到队名映射: ${homeTeamName} vs ${awayTeamName}`);
      return null;
    }

    return polymarketService.searchNBAMarkets(homeTeam.chineseName, awayTeam.chineseName);
  }


  /**
   * 获取所有比赛数据
   */
  getAllMatches(): UnifiedMatch[] {
    return Array.from(this.matches.values());
  }

  /**
   * 获取 Paper Trading 账户状态
   */
  getPaperTradingStatus() {
    return paperTradingService.getAccountStatus();
  }

  /**
   * 订阅 Polymarket WebSocket 实时价格
   */
  private subscribeToMarketPrice(
    matchId: string,
    marketId: string,
    homeTokenId: string,
    awayTokenId: string
  ): void {
    // 避免重复订阅
    if (this.subscribedMarkets.has(marketId)) {
      logger.debug(`跳过重复订阅: ${marketId.slice(0, 8)}...`);
      return;
    }

    this.subscribedMarkets.add(marketId);
    
    const match = this.matches.get(matchId);
    const homeTeam = match?.homeTeam?.name || 'Unknown';
    const awayTeam = match?.awayTeam?.name || 'Unknown';
    
    logger.info(`🔔 订阅市场价格 [${homeTeam} vs ${awayTeam}]`);
    logger.info(`   Market ID: ${marketId.slice(0, 8)}...`);
    logger.info(`   主队 Token: ${homeTokenId.slice(0, 8)}...`);
    logger.info(`   客队 Token: ${awayTokenId.slice(0, 8)}...`);
    logger.info(`   当前已订阅市场数: ${this.subscribedMarkets.size}`);

    // 订阅主队 token
    polymarketService.subscribe(homeTokenId, (data: any) => {
      const match = this.matches.get(matchId);
      if (match && match.poly) {
        const oldPrice = match.poly.homePrice;
        const newPrice = data.price || data.midPrice;
        
        if (!newPrice) {
          logger.warn(`⚠️ 收到无效价格数据: ${JSON.stringify(data)}`);
          return;
        }
        
        // 记录最后一次 WebSocket 更新时间
        this.lastWSUpdate.set(matchId, Date.now());
        
        // 无条件更新价格（WebSocket 推送什么就用什么）
        match.poly.homePrice = newPrice;
        match.poly.homeBestBid = data.bestBid || null;
        match.poly.homeBestAsk = data.bestAsk || null;
        match.lastUpdate = Date.now();
        
        // 只在价格变化超过阈值时打印日志（避免日志刷屏）
        const priceChange = newPrice - oldPrice;
        const currentHomeTeam = match.homeTeam?.name || 'Unknown';
        if (Math.abs(priceChange) > 0.001) {
          logger.info(`🔴 实时价格更新 [${currentHomeTeam}]: Mid=$${newPrice.toFixed(4)}, Bid=$${match.poly.homeBestBid?.toFixed(4) || 'N/A'}, Ask=$${match.poly.homeBestAsk?.toFixed(4) || 'N/A'}`);
          logger.info(`   📊 完整数据 - tokenId: ${homeTokenId.slice(0, 8)}..., 原始回调数据:`, JSON.stringify(data));
        } else {
          logger.debug(`🔴 微小价格变化 [${currentHomeTeam}]: Mid=$${newPrice.toFixed(4)}`);
        }
        
        // 重新计算套利信号
        if (match.dataCompleteness.hasPolyData && match.dataCompleteness.hasESPNData) {
          match.signals = arbitrageEngine.calculateSignals(match);
        }
      } else {
        logger.warn(`⚠️ 收到价格但找不到比赛: ${matchId}`);
      }
    });

    // 订阅客队 token
    polymarketService.subscribe(awayTokenId, (data: any) => {
      const match = this.matches.get(matchId);
      if (match && match.poly) {
        const oldPrice = match.poly.awayPrice;
        const newPrice = data.price || data.midPrice;
        const newBestBid = data.bestBid || null;
        const newBestAsk = data.bestAsk || null;
        
        if (!newPrice) {
          logger.warn(`⚠️ 收到无效价格数据: ${JSON.stringify(data)}`);
          return;
        }
        
        // 记录最后一次 WebSocket 更新时间
        this.lastWSUpdate.set(matchId, Date.now());
        
        // 更新所有价格（midPrice + bid/ask）
        match.poly.awayPrice = newPrice;
        match.poly.awayBestBid = newBestBid;
        match.poly.awayBestAsk = newBestAsk;
        match.lastUpdate = Date.now();
        
        // 只在价格变化超过阈值时打印日志（避免日志刷屏）
        const priceChange = newPrice - oldPrice;
        const currentAwayTeam = match.awayTeam?.name || 'Unknown';
        if (Math.abs(priceChange) > 0.001) {
          logger.info(`🔵 实时价格更新 [${currentAwayTeam}]: Mid=$${newPrice.toFixed(4)}, Bid=$${newBestBid?.toFixed(4) || 'N/A'}, Ask=$${newBestAsk?.toFixed(4) || 'N/A'}`);
          logger.debug(`   📊 完整数据:`, JSON.stringify(data));
        } else {
          logger.debug(`🔵 微小价格变化 [${currentAwayTeam}]: Mid=$${newPrice.toFixed(4)}`);
        }
        
        // 重新计算套利信号
        if (match.dataCompleteness.hasPolyData && match.dataCompleteness.hasESPNData) {
          match.signals = arbitrageEngine.calculateSignals(match);
        }
      } else {
        logger.warn(`⚠️ 收到价格但找不到比赛: ${matchId}`);
      }
    });
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
