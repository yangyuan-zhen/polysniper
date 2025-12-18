import axios from 'axios';
import WebSocket from 'ws';
import { config } from '../config';
import { logger } from '../utils/logger';
import { cache } from '../utils/cache';
import { PolymarketData, CacheKey } from '../types';
import { findTeamByChinese, NBATeam } from '../config/nbaTeamMap';

class PolymarketService {
  private gammaApiUrl: string;    // Gamma Markets API - 获取数据
  private clobApiUrl: string;     // CLOB API - 交易（暂不使用）
  private wsUrl: string;
  private apiKey: string;
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 1000;
  private subscribers: Map<string, Set<(data: any) => void>> = new Map();

  constructor() {
    this.gammaApiUrl = config.polymarket.gammaApiUrl;
    this.clobApiUrl = config.polymarket.clobApiUrl;
    // 使用 CLOB WebSocket（订单簿和价格数据）
    this.wsUrl = config.polymarket.wsUrl;
    this.apiKey = config.polymarket.apiKey;
  }

  /**
   * 连接 Polymarket WebSocket
   */
  async connectWebSocket(): Promise<void> {
    try {
      const options: any = {};
      
      // 如果有 API Key，添加认证头
      if (this.apiKey) {
        options.headers = {
          'Authorization': `Bearer ${this.apiKey}`,
        };
        logger.info('连接 Polymarket WebSocket (使用 API Key)');
      } else {
        logger.info('连接 Polymarket WebSocket (无 API Key)');
      }

      this.ws = new WebSocket(this.wsUrl, options);

      this.ws.on('open', () => {
        logger.info('已连接到 Polymarket WebSocket');
        this.reconnectAttempts = 0;
        
        // 连接成功后，订阅市场频道
        this.subscribeToMarketChannel();
      });

      this.ws.on('message', (data: WebSocket.Data) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleMessage(message);
        } catch (error) {
          logger.error('Failed to parse WebSocket message:', error);
        }
      });

      this.ws.on('error', (error) => {
        logger.error('WebSocket 错误:', error);
      });

      this.ws.on('close', () => {
        logger.warn('WebSocket 连接已关闭');
        this.reconnect();
      });
    } catch (error) {
      logger.error('连接 Polymarket WebSocket 失败:', error);
      this.reconnect();
    }
  }

  /**
   * 重连机制（指数退避）
   */
  private reconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      logger.error('已达到最大重连次数');
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(
      this.reconnectDelay * Math.pow(2, this.reconnectAttempts),
      30000 // 最大30秒
    );

    logger.info(`将在 ${delay}ms 后重连 (尝试 ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

    setTimeout(() => {
      this.connectWebSocket();
    }, delay);
  }

  /**
   * 订阅市场频道
   */
  private subscribeToMarketChannel(): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      // 订阅所有市场的价格变化
      const subscribeMessage = {
        type: 'subscribe',
        channel: 'market',
        markets: [], // 空数组表示订阅所有市场
      };
      
      this.ws.send(JSON.stringify(subscribeMessage));
      logger.info('已订阅 Polymarket 市场频道');
    }
  }

  /**
   * 处理 WebSocket 消息
   */
  private handleMessage(message: any): void {
    try {
      // CLOB WebSocket 消息格式
      const { event_type, asset_id, market, price, bids, asks } = message;
      
      // 处理订单簿更新 (book)
      if (event_type === 'book' && asset_id) {
        // 计算中间价格
        const bestBid = bids?.[0]?.price ? parseFloat(bids[0].price) : 0;
        const bestAsk = asks?.[0]?.price ? parseFloat(asks[0].price) : 0;
        const midPrice = (bestBid + bestAsk) / 2;
        
        logger.debug(`价格更新 [${asset_id.slice(0, 8)}...]: ${midPrice.toFixed(4)}`);
        
        // 通知订阅者
        const callbacks = this.subscribers.get(market || asset_id);
        if (callbacks) {
          callbacks.forEach(callback => callback({
            asset_id,
            market,
            price: midPrice,
            bestBid,
            bestAsk,
            bids,
            asks,
          }));
        }
        
        // 更新缓存
        if (asset_id && midPrice > 0) {
          this.updatePriceCache(asset_id, midPrice);
        }
      }
      
      // 处理价格变化消息 (price_change)
      if (event_type === 'price_change' && asset_id && price) {
        const priceValue = typeof price === 'string' ? parseFloat(price) : price;
        
        logger.debug(`价格变化 [${asset_id.slice(0, 8)}...]: ${priceValue.toFixed(4)}`);
        
        // 通知订阅者
        const callbacks = this.subscribers.get(market || asset_id);
        if (callbacks) {
          callbacks.forEach(callback => callback(message));
        }
        
        // 更新缓存
        this.updatePriceCache(asset_id, priceValue);
      }
    } catch (error) {
      logger.error('处理 WebSocket 消息失败:', error);
    }
  }

  /**
   * 订阅特定市场更新
   */
  subscribe(marketId: string, callback: (data: any) => void): void {
    if (!this.subscribers.has(marketId)) {
      this.subscribers.set(marketId, new Set());
    }
    this.subscribers.get(marketId)!.add(callback);

    // 发送订阅消息到 WebSocket
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const subscribeMessage = {
        type: 'subscribe',
        channel: 'market',
        markets: [marketId],
      };
      this.ws.send(JSON.stringify(subscribeMessage));
      logger.debug(`已订阅市场: ${marketId}`);
    }
  }

  /**
   * 取消订阅
   */
  unsubscribe(marketId: string, callback: (data: any) => void): void {
    const callbacks = this.subscribers.get(marketId);
    if (callbacks) {
      callbacks.delete(callback);
      if (callbacks.size === 0) {
        this.subscribers.delete(marketId);

        // 发送取消订阅消息到 WebSocket
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          const unsubscribeMessage = {
            type: 'unsubscribe',
            channel: 'market',
            markets: [marketId],
          };
          this.ws.send(JSON.stringify(unsubscribeMessage));
          logger.debug(`已取消订阅市场: ${marketId}`);
        }
      }
    }
  }

  /**
   * 获取市场列表
   */
  async getMarkets(params?: { 
    status?: string; 
    sport?: string;
    limit?: number;
    offset?: number;
    closed?: boolean;
  }): Promise<any> {
    try {
      const cacheKey = `${CacheKey.MARKETS}:${JSON.stringify(params)}`;
      const cached = await cache.get(cacheKey);
      if (cached) {
        return cached;
      }

      // Gamma API 是公开的，不需要认证
      const response = await axios.get(`${this.gammaApiUrl}/markets`, {
        params,
        timeout: 10000,
      });

      const data = response.data;
      
      // 缓存45秒
      await cache.set(cacheKey, data, 45);
      
      logger.debug('已获取 Polymarket 市场数据');
      return data;
    } catch (error) {
      logger.error('获取 Polymarket 市场失败:', error);
      throw error;
    }
  }

  /**
   * 获取特定市场信息
   */
  async getMarket(marketId: string): Promise<any> {
    try {
      const cacheKey = `${CacheKey.MATCH}:${marketId}`;
      const cached = await cache.get(cacheKey);
      if (cached) {
        return cached;
      }

      // Gamma API 是公开的，不需要认证
      const response = await axios.get(`${this.gammaApiUrl}/markets/${marketId}`, {
        timeout: 10000,
      });

      const data = response.data;
      
      // 缓存45秒
      await cache.set(cacheKey, data, 45);
      
      return data;
    } catch (error) {
      logger.error(`Failed to fetch market ${marketId}:`, error);
      throw error;
    }
  }

  /**
   * 获取 token 价格
   */
  async getTokenPrice(tokenId: string): Promise<number> {
    try {
      const cacheKey = `${CacheKey.POLY_PRICES}:${tokenId}`;
      const cached = await cache.get<number>(cacheKey);
      if (cached !== null) {
        return cached;
      }

      // Gamma API 是公开的，不需要认证
      const response = await axios.get(`${this.gammaApiUrl}/prices/${tokenId}`, {
        timeout: 10000,
      });

      const price = response.data.price;
      
      // 缓存10秒
      await cache.set(cacheKey, price, 10);
      
      return price;
    } catch (error) {
      logger.error(`Failed to fetch price for token ${tokenId}:`, error);
      return 0;
    }
  }

  /**
   * 更新价格缓存
   */
  private async updatePriceCache(tokenId: string, price: number): Promise<void> {
    const cacheKey = `${CacheKey.POLY_PRICES}:${tokenId}`;
    await cache.set(cacheKey, price, 10);
  }

  /**
   * 搜索NBA比赛市场（使用 Events API）
   * 采用漏斗模型 (The Funnel) 进行精准匹配
   * 注意：虎扑和 Polymarket 的主客场定义可能不同，所以不区分主客场顺序
   */
  async searchNBAMarkets(homeTeam: string, awayTeam: string): Promise<PolymarketData | null> {
    try {
      // ========== 第一层：范围锁定 (Scope) ==========
      // 条件：只请求 NBA 相关且 active/未结算的市场
      // 目的：排除历史比赛，只留下当前的 10-20 场 NBA 比赛
      const response = await axios.get(`${this.gammaApiUrl}/events`, {
        params: { 
          series_id: '10345',  // NBA 2026 series
          limit: 100, 
          offset: 0,
          closed: false,       // 排除已关闭的市场
          active: true,        // 只要进行中/未结算的市场
        },
        timeout: 10000,
      });
      
      const allEvents = response.data || [];
      
      logger.debug(`[Layer 1] 从 Polymarket 获取到 ${allEvents.length} 个 active 且未关闭的 NBA events`);
      
      if (!allEvents || !Array.isArray(allEvents)) {
        logger.warn('API 未返回 events 数据');
        return null;
      }

      // 第一层范围锁定的二次过滤（双保险）
      const nbaEvents = allEvents.filter((e: any) => {
        // 必须未关闭
        if (e.closed === true) return false;
        
        // 必须激活
        if (e.active === false) return false;
        
        // 必须是 NBA 相关
        const text = `${e.title} ${e.slug} ${e.category}`.toLowerCase();
        if (!text.includes('nba') && !text.includes('basketball')) return false;
        
        // 注意：不检查 endDate 是否在未来，因为比赛结束后市场可能还需要时间结算
        // active=true 和 closed=false 已经足够过滤了
        
        return true;
      });
      
      // 查找球队映射（从静态映射表）
      // 虎扑传入的是中文名（如：活塞、老鹰），需要使用 findTeamByChinese
      const homeTeamMapping = findTeamByChinese(homeTeam);
      const awayTeamMapping = findTeamByChinese(awayTeam);
      
      if (!homeTeamMapping || !awayTeamMapping) {
        logger.warn(`[Layer 2] ⚠️ 无法找到球队映射: ${homeTeam} 或 ${awayTeam}`);
        return null;
      }
      
      logger.debug(`[Layer 1] 筛选后剩余 ${nbaEvents.length} 个开放的 NBA events`);
      logger.debug(`[Layer 2] 开始名称锚定: ${homeTeam} vs ${awayTeam}`);
      logger.debug(`[Layer 2] 使用 Polymarket 关键词: [${homeTeamMapping.polymarketName}] 和 [${awayTeamMapping.polymarketName}]`);
      
      // ========== 第二层：名称锚定 (Name Matching) ==========
      // 条件：Event Title 必须同时包含两个队的关键词（不区分主客场顺序）
      // 目的：这是最精准的指纹，NBA 不会在同一天有两场相同对决
      // 注意：虎扑和 Polymarket 的主客场定义可能不同，所以只匹配队名
      const event = nbaEvents.find((e: any) => {
        const title = e.title.toLowerCase();
        const slug = e.slug.toLowerCase();
        
        // 使用 polymarketName 和 abbr 进行匹配
        const homeKeywords = [homeTeamMapping.polymarketName, homeTeamMapping.abbr].map(k => k.toLowerCase());
        const awayKeywords = [awayTeamMapping.polymarketName, awayTeamMapping.abbr].map(k => k.toLowerCase());
        
        const matchedHome = homeKeywords.some(kw => title.includes(kw) || slug.includes(kw));
        const matchedAway = awayKeywords.some(kw => title.includes(kw) || slug.includes(kw));
        
        // 【核心】只有同时匹配两个队才返回 true（不区分主客场）
        if (matchedHome && matchedAway) {
          logger.info(`[Layer 2] ✅ 名称匹配成功: "${e.title}"`);
          return true;
        }
        
        // 调试：如果包含任意一个关键词，打印出来看看为什么没全匹配
        if (title.includes('celtics') && title.includes('pistons')) {
          logger.warn(`DEBUG: 发现目标比赛但未匹配成功! Title: "${title}"`);
          logger.warn(`  HomeKW: ${JSON.stringify(homeKeywords)} -> Matched: ${matchedHome}`);
          logger.warn(`  AwayKW: ${JSON.stringify(awayKeywords)} -> Matched: ${matchedAway}`);
        }
        
        return false;
      });

      if (!event) {
        if (nbaEvents.length > 0) {
          logger.debug(`未找到 ${homeTeam} vs ${awayTeam} 的匹配 event，但找到 ${nbaEvents.length} 个其他 NBA events`);
          nbaEvents.slice(0, 3).forEach((e: any) => {
            logger.debug(`  - ${e.title}`);
          });
        } else {
          logger.debug(`未找到 ${homeTeam} vs ${awayTeam} 的匹配 event，当前无开放的 NBA events`);
        }
        return null;
      }

      logger.info(`找到 event: ${event.title}`);

      // Event 包含 markets 数组，需要筛选出 Winner (胜负盘/Moneyline) 市场
      const markets = event.markets || [];
      if (markets.length === 0) {
        logger.warn('Event 没有 markets 数据');
        return null;
      }
      
      logger.debug(`Event 包含 ${markets.length} 个 markets，开始筛选 Winner 市场`);
      
      // 筛选逻辑：排除让分盘、大小分、单节、上半场等
      const winnerMarket = markets.find((m: any) => {
        const question = (m.question || m.groupItemTitle || '').toLowerCase();
        
        // 排除条件：包含这些关键词的不是整场胜负盘
        const excludeKeywords = [
          'spread', 'handicap', 'points', // 让分盘
          'total', 'over', 'under', 'o/u', // 大小分
          'quarter', '1q', '2q', '3q', '4q', 'q1', 'q2', 'q3', 'q4', // 单节
          'half', '1h', '2h', 'first half', 'second half', // 半场
          'more than', 'less than', 'by more', 'beat by', // 让分描述
        ];
        
        const hasExclude = excludeKeywords.some(kw => question.includes(kw));
        
        if (hasExclude) {
          logger.debug(`  排除: ${question}`);
          return false;
        }
        
        // 包含条件：通常 Winner 市场的问题格式简单，或包含 winner/win
        const includeKeywords = ['winner', 'win', 'vs', 'vs.'];
        const hasInclude = includeKeywords.some(kw => question.includes(kw));
        
        // 或者：问题就是球队名组合（如 "Celtics vs. Pistons"）
        const isSimpleVs = question.includes('vs') && !hasExclude;
        
        if (hasInclude || isSimpleVs) {
          logger.debug(`  ✅ Winner 市场: ${question}`);
          return true;
        }
        
        return false;
      });
      
      if (!winnerMarket) {
        logger.warn('未找到 Winner (胜负盘) 市场');
        logger.debug('可用的 markets:');
        markets.forEach((m: any) => {
          logger.debug(`  - ${m.question || m.groupItemTitle}`);
        });
        return null;
      }
      
      const market = winnerMarket;
      
      // 解析 outcomes 和 outcomePrices（它们是 JSON 字符串）
      let outcomes: string[] = [];
      let outcomePrices: string[] = [];
      let tokenIds: string[] = [];
      
      try {
        outcomes = typeof market.outcomes === 'string' ? JSON.parse(market.outcomes) : market.outcomes;
        outcomePrices = typeof market.outcomePrices === 'string' ? JSON.parse(market.outcomePrices) : market.outcomePrices;
        tokenIds = typeof market.clobTokenIds === 'string' ? JSON.parse(market.clobTokenIds) : (market.clobTokenIds || []);
      } catch (error) {
        logger.error('解析 market 数据失败:', error);
        return null;
      }
      
      if (outcomes.length < 2 || outcomePrices.length < 2) {
        logger.warn('市场结果或价格数据不足');
        return null;
      }

      // 根据 outcomes 判断哪个是主队、哪个是客队
      // outcomes 可能是 ["Celtics", "Pistons"] 或 ["Pistons", "Celtics"]
      let homePrice = 0;
      let awayPrice = 0;
      let homeTokenId = '';
      let awayTokenId = '';
      
      // 查找主队和客队在 outcomes 中的索引
      let homeIndex = -1;
      let awayIndex = -1;
      
      outcomes.forEach((outcome: string, idx: number) => {
        const outcomeLower = outcome.toLowerCase();
        
        // 检查是否匹配主队（使用 polymarketName 和 abbr）
        const homeKeywords = [homeTeamMapping.polymarketName, homeTeamMapping.abbr].map(k => k.toLowerCase());
        const matchesHome = homeKeywords.some((kw: string) => outcomeLower.includes(kw));
        
        // 检查是否匹配客队
        const awayKeywords = [awayTeamMapping.polymarketName, awayTeamMapping.abbr].map(k => k.toLowerCase());
        const matchesAway = awayKeywords.some((kw: string) => outcomeLower.includes(kw));
        
        if (matchesHome) {
          homeIndex = idx;
          logger.debug(`  找到主队 "${outcome}" at index ${idx}`);
        }
        
        if (matchesAway) {
          awayIndex = idx;
          logger.debug(`  找到客队 "${outcome}" at index ${idx}`);
        }
      });
      
      if (homeIndex === -1 || awayIndex === -1) {
        logger.warn(`无法在 outcomes [${outcomes.join(', ')}] 中找到主客队`);
        logger.warn(`期望: 主队=${homeTeamMapping.polymarketName}/${homeTeamMapping.abbr}, 客队=${awayTeamMapping.polymarketName}/${awayTeamMapping.abbr}`);
        return null;
      }
      
      // 根据索引获取对应的价格和 token ID
      homePrice = parseFloat(outcomePrices[homeIndex] || '0');
      awayPrice = parseFloat(outcomePrices[awayIndex] || '0');
      homeTokenId = tokenIds[homeIndex] || '';
      awayTokenId = tokenIds[awayIndex] || '';
      
      logger.debug(`解析成功: ${outcomes[homeIndex]}=$${homePrice}, ${outcomes[awayIndex]}=$${awayPrice}`);

      return {
        marketId: market.conditionId || market.condition_id || market.id || '',
        homeTokenId,
        awayTokenId,
        homePrice,
        awayPrice,
        homeVolume: parseFloat(market.volumeNum || market.volume || '0'),
        awayVolume: 0,
        liquidity: parseFloat(market.liquidityNum || market.liquidity || event.liquidity || '0'),
        endDate: event.endDate || event.startDate, // 用于 Layer 3 时间校验
      };
    } catch (error) {
      logger.error('搜索 NBA 市场失败:', error);
      return null;
    }
  }

  /**
   * 断开 WebSocket 连接
   */
  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

export const polymarketService = new PolymarketService();
