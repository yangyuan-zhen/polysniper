import axios from 'axios';
import WebSocket from 'ws';
import { HttpsProxyAgent } from 'https-proxy-agent';
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
  private subscribedAssets: Set<string> = new Set(); // 已订阅的 asset_id
  private pendingSubscriptions: Set<string> = new Set(); // 待订阅的 asset_id
  private subscriptionTimer: NodeJS.Timeout | null = null; // 批量订阅定时器
  private pingInterval: NodeJS.Timeout | null = null; // 心跳定时器

  constructor() {
    this.gammaApiUrl = config.polymarket.gammaApiUrl;
    this.clobApiUrl = config.polymarket.clobApiUrl;
    // 使用 CLOB WebSocket（订单簿和价格数据）
    this.wsUrl = config.polymarket.wsUrl;
    this.apiKey = config.polymarket.apiKey;
  }

  /**
   * 连接 Polymarket WebSocket
   * market channel 是公开频道，无需认证
   * 只要不订阅 user 频道，就不需要 API Key
   */
  async connectWebSocket(): Promise<void> {
    try {
      logger.info('🔗 正在连接 Polymarket WebSocket...');
      logger.info(`   URL: ${this.wsUrl}`);
      logger.info(`   模式: 公开 market channel，匿名订阅（无需认证）`);
      
      // 配置代理（如果需要）
      const options: any = {};
      
      const proxy = config.polymarket.wsProxy;
      
      if (proxy && proxy !== 'none') {
        logger.info(`   使用代理: ${proxy}`);
        try {
          options.agent = new HttpsProxyAgent(proxy);
        } catch (error) {
          logger.warn(`   代理配置失败: ${error}`);
        }
      } else {
        logger.info(`   直接连接（无代理）`);
      }
      
      // 连接 WebSocket
      this.ws = new WebSocket(this.wsUrl, options);

      this.ws.on('open', () => {
        logger.info('✅ 已成功连接到 Polymarket WebSocket');
        this.reconnectAttempts = 0;
        
        // 启动心跳定时器（每25秒发送一次ping，符合官方要求的20-30秒）
        this.startHeartbeat();
        
        // 连接成功后，订阅市场频道
        this.subscribeToMarketChannel();
      });

      this.ws.on('message', (data: WebSocket.Data) => {
        try {
          const rawMessage = data.toString();
          logger.debug(`📥 原始消息: ${rawMessage.slice(0, 200)}`);
          
          // 处理非 JSON 消息（如 "INVALID OPERATION"）
          if (!rawMessage.startsWith('{') && !rawMessage.startsWith('[')) {
            logger.warn(`⚠️ 收到非 JSON 消息: ${rawMessage}`);
            return;
          }
          
          const message = JSON.parse(rawMessage);
          this.handleMessage(message);
        } catch (error) {
          logger.error('Failed to parse WebSocket message:', error);
        }
      });

      this.ws.on('error', (error) => {
        logger.error('❌ WebSocket 错误:', error);
        logger.error('   错误详情:', {
          message: error.message,
          code: (error as any).code,
          type: error.constructor.name,
        });
      });

      this.ws.on('close', (code, reason) => {
        logger.warn(`⚠️ WebSocket 连接已关闭 - Code: ${code}, Reason: ${reason || '无'}`);
        this.stopHeartbeat();
        this.reconnect();
      });
    } catch (error) {
      logger.error('❌ 连接 Polymarket WebSocket 失败:', error);
      this.reconnect();
    }
  }

  /**
   * 启动心跳定时器
   */
  private startHeartbeat(): void {
    // 清理旧的心跳定时器
    this.stopHeartbeat();
    
    this.pingInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        try {
          this.ws.send(JSON.stringify({ type: 'ping' }));
          logger.debug('💓 发送心跳 Ping');
        } catch (error) {
          logger.error('心跳发送失败:', error);
        }
      }
    }, 25000); // 25秒，符合官方要求的20-30秒
    
    logger.info('💓 心跳定时器已启动（每25秒）');
  }

  /**
   * 停止心跳定时器
   */
  private stopHeartbeat(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
      logger.debug('心跳定时器已停止');
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
   * 订阅市场频道（初始化时不订阅，等待具体 token）
   */
  private subscribeToMarketChannel(): void {
    // Polymarket CLOB WebSocket 不支持全局订阅
    // 需要订阅具体的 asset_id (token ID)
    logger.info('✅ Polymarket WebSocket 已就绪，等待订阅具体 token');
  }

  /**
   * 处理 WebSocket 消息
   */
  private handleMessage(message: any): void {
    try {
      // 处理数组消息（初始订单簿快照）
      if (Array.isArray(message)) {
        logger.info(`📦 收到初始数据快照: ${message.length} 个市场`);
        message.forEach(item => this.handleSingleMessage(item));
        return;
      }
      
      // 处理单个消息
      this.handleSingleMessage(message);
    } catch (error) {
      logger.error('处理 WebSocket 消息失败:', error);
    }
  }

  /**
   * 处理单个消息
   */
  private handleSingleMessage(message: any): void {
    const event_type = message.event_type || message.type;
    
    // 订单簿快照（book）
    if (event_type === 'book' && message.asset_id) {
      const asset_id = message.asset_id;
      const price = message.last_trade_price;
      
      if (price) {
        const priceValue = parseFloat(price);
        logger.info(`📖 订单簿 [${asset_id.slice(0, 8)}...]: $${priceValue.toFixed(4)}`);
        this.updatePriceCache(asset_id, priceValue);
      }
    }
    
    // 价格变化事件（price_change）
    else if (event_type === 'price_change' && message.price_changes) {
      message.price_changes.forEach((change: any) => {
        const asset_id = change.asset_id;
        const price = change.price;
        
        if (asset_id && price) {
          const priceValue = parseFloat(price);
          logger.info(`📈 价格更新 [${asset_id.slice(0, 8)}...]: $${priceValue.toFixed(4)} (${change.side})`);
          this.updatePriceCache(asset_id, priceValue);
        }
      });
    }
    
    // 其他消息类型
    else if (event_type) {
      logger.debug(`其他消息: ${event_type}`);
    }
  }

  /**
   * 订阅特定 token 更新（Polymarket CLOB API）
   * @param assetId - Token ID (0x...)
   * @param callback - 价格更新回调
   */
  subscribe(assetId: string, callback: (data: any) => void): void {
    if (!this.subscribers.has(assetId)) {
      this.subscribers.set(assetId, new Set());
    }
    this.subscribers.get(assetId)!.add(callback);

    // 检查是否已经订阅过这个 asset
    if (this.subscribedAssets.has(assetId)) {
      logger.debug(`⏭️ 已订阅过 ${assetId.slice(0, 8)}...，跳过`);
      return;
    }

    // 添加到待订阅列表
    this.pendingSubscriptions.add(assetId);
    
    // 清除之前的定时器
    if (this.subscriptionTimer) {
      clearTimeout(this.subscriptionTimer);
    }
    
    // 设置批量订阅定时器（500ms 后发送）
    this.subscriptionTimer = setTimeout(() => {
      this.flushSubscriptions();
    }, 500);
  }

  /**
   * 批量发送订阅请求
   */
  private flushSubscriptions(): void {
    if (this.pendingSubscriptions.size === 0) {
      return;
    }

    // 发送订阅消息到 WebSocket（批量订阅）
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const assetsToSubscribe = Array.from(this.pendingSubscriptions);
      
      // 🔧 分批订阅，每批最多 10 个 tokens（避免服务器拒绝）
      const BATCH_SIZE = 10;
      const batches: string[][] = [];
      
      for (let i = 0; i < assetsToSubscribe.length; i += BATCH_SIZE) {
        batches.push(assetsToSubscribe.slice(i, i + BATCH_SIZE));
      }
      
      logger.info(`📡 批量订阅 ${assetsToSubscribe.length} 个市场 (分 ${batches.length} 批)`);
      
      // 依次发送每一批
      batches.forEach((batch, batchIndex) => {
        const subscribeMessage = {
          type: 'market',
          assets_ids: batch,
          initial_dump: true
        };
        
        const messageString = JSON.stringify(subscribeMessage);
        
        logger.info(`   📦 批次 ${batchIndex + 1}/${batches.length}: ${batch.length} 个 tokens`);
        batch.slice(0, 3).forEach((assetId, index) => {
          logger.debug(`      Token ${index + 1}: ${assetId.slice(0, 16)}...`);
        });
        
        // 延迟发送每一批（避免过快）
        setTimeout(() => {
          if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(messageString);
            logger.debug(`   ✅ 批次 ${batchIndex + 1} 已发送`);
          }
        }, batchIndex * 100); // 每批间隔 100ms
        
        // 标记为已订阅
        batch.forEach(assetId => {
          this.subscribedAssets.add(assetId);
        });
      });
      
      // 清空待订阅列表
      this.pendingSubscriptions.clear();
    } else {
      logger.warn(`⚠️ WebSocket 未连接，无法订阅 ${this.pendingSubscriptions.size} 个市场`);
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
   * @deprecated 已弃用 - 现在使用 WebSocket 实时推送价格，不再使用 REST API 轮询
   * 保留此方法作为备用方案（WebSocket 连接失败时的降级方案）
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
        
        // 调试：如果是勇士或雷霆相关的比赛，打印详细信息
        const isTargetMatch = (title.includes('warriors') || title.includes('thunder')) && 
                             (homeKeywords.some(k => k.includes('warriors') || k.includes('thunder')) || 
                              awayKeywords.some(k => k.includes('warriors') || k.includes('thunder')));
        
        if (isTargetMatch) {
          logger.debug(`[DEBUG] 勇士/雷霆比赛检查:`);
          logger.debug(`  Title: "${e.title}"`);
          logger.debug(`  HomeKW: ${JSON.stringify(homeKeywords)} -> Matched: ${matchedHome}`);
          logger.debug(`  AwayKW: ${JSON.stringify(awayKeywords)} -> Matched: ${matchedAway}`);
          logger.debug(`  Markets: ${e.markets?.length || 0} 个`);
        }
        
        // 【核心】只有同时匹配两个队才返回 true（不区分主客场）
        if (matchedHome && matchedAway) {
          logger.info(`[Layer 2] ✅ 名称匹配成功: "${e.title}"`);
          return true;
        }
        
        return false;
      });

      if (!event) {
        if (nbaEvents.length > 0) {
          logger.warn(`❌ 未找到 ${homeTeam} vs ${awayTeam} 的匹配 event，但找到 ${nbaEvents.length} 个其他 NBA events`);
          logger.debug(`搜索关键词: [${homeTeamMapping.polymarketName}/${homeTeamMapping.abbr}] vs [${awayTeamMapping.polymarketName}/${awayTeamMapping.abbr}]`);
          logger.debug(`可用的 NBA events (前 10 个):`);
          nbaEvents.slice(0, 10).forEach((e: any) => {
            logger.debug(`  - ${e.title} (${e.markets?.length || 0} markets, active: ${e.active}, closed: ${e.closed})`);
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
      
      // 先打印所有 markets
      markets.forEach((m: any, index: number) => {
        logger.debug(`  Market ${index + 1}: "${m.question || m.groupItemTitle}"`);
      });
      
      // 筛选逻辑：排除让分盘、大小分、单节、上半场等
      const winnerMarket = markets.find((m: any) => {
        const question = (m.question || m.groupItemTitle || '').toLowerCase();
        logger.debug(`  检查市场: "${question}"`);
        
        // 排除条件：包含这些关键词的不是整场胜负盘
        const excludeKeywords = [
          'spread', 'handicap', 'points', // 让分盘
          'total', 'over', 'o/u', // 大小分
          'quarter', '1q', '2q', '3q', '4q', 'q1', 'q2', 'q3', 'q4', // 单节
          'half', '1h', '2h', 'first half', 'second half', // 半场
          'more than', 'less than', 'by more', 'beat by', // 让分描述
        ];
        
        // 特殊处理：'under' 需要避免误匹配 'thunder'
        const hasUnder = question.includes('under') && !question.includes('thunder');
        const matchedExclude = excludeKeywords.find(kw => question.includes(kw)) || (hasUnder ? 'under' : null);
        
        if (matchedExclude) {
          logger.debug(`  ❌ 排除: "${question}" (匹配关键词: "${matchedExclude}")`);
          return false;
        }
        
        // 包含条件：通常 Winner 市场的问题格式简单，或包含 winner/win
        const includeKeywords = ['winner', 'win', 'vs', 'vs.'];
        const hasInclude = includeKeywords.some(kw => question.includes(kw));
        
        // 或者：问题就是球队名组合（如 "Celtics vs. Pistons"）
        const isSimpleVs = question.includes('vs') && !matchedExclude;
        
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
    this.stopHeartbeat(); // 停止心跳定时器
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

export const polymarketService = new PolymarketService();
