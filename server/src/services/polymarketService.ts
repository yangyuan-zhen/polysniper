import axios from 'axios';
import WebSocket from 'ws';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { config } from '../config';
import { logger } from '../utils/logger';
import { cache } from '../utils/cache';
import { PolymarketData, CacheKey } from '../../../shared/types/index';
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
  private priceCache: Map<string, { price: number; bestBid: number | null; bestAsk: number | null }> = new Map(); // 价格缓存
  // 注意：2025年5月28日更新 - 100 token 订阅限制已被移除
  private lastSubscribeTime = 0; // 上次订阅时间
  private lastMessageTime = 0; // 上次收到消息的时间
  private lastWsTime: Map<string, number> = new Map(); // 每个 asset 最后一次收到 WS 更新的时间
  private connectionCheckInterval: NodeJS.Timeout | null = null; // 连接检查定时器
  private pollingInterval: NodeJS.Timeout | null = null; // REST API 轮询定时器

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
      
      // 配置 WebSocket 选项
      const options: any = {
        // 增加超时设置
        handshakeTimeout: 15000, // 15秒连接超时，增加以允许代理连接
        // 禁用压缩，提高稳定性
        perMessageDeflate: false,
        // 关闭验证，避免证书问题
        rejectUnauthorized: false
      };
      
      // 获取代理配置
      const proxy = config.polymarket.wsProxy;
      
      if (proxy && proxy !== 'none') {
        logger.info(`   使用 Clash 代理: ${proxy}`);
        try {
          // 创建代理代理
          const agent = new HttpsProxyAgent(proxy);
          options.agent = agent;
          logger.info('   代理配置成功');
        } catch (error) {
          logger.warn(`   代理配置失败: ${error}`);
          logger.warn('   将尝试直接连接');
        }
      } else {
        logger.info(`   直接连接（无代理）`);
      }
      
      // 连接 WebSocket
      this.ws = new WebSocket(this.wsUrl, options);

      this.ws.on('open', () => {
        logger.info('✅ 已成功连接到 Polymarket WebSocket');
        this.reconnectAttempts = 0;
        
        // 启动心跳定时器（每15秒发送 WebSocket 协议层 Ping 帧）
        this.startHeartbeat();
        
        // 启动连接健康检查（每30秒检查一次）
        this.startConnectionCheck();
        
        // 启动 REST API 轮询（每1秒一次，作为 WebSocket 的兜底）
        this.startPolling();
        
        // ⚠️ 不发送初始连接消息
        // Polymarket WebSocket 不期望 "hello" 消息，会返回 INVALID OPERATION
        // 直接进行订阅即可
        
        // 🔄 重连后重新订阅之前的 assets
        if (this.subscribedAssets.size > 0) {
          logger.info(`🔄 重连后重新订阅 ${this.subscribedAssets.size} 个市场...`);
          const assetsToResubscribe = Array.from(this.subscribedAssets);
          this.subscribedAssets.clear(); // 清空，准备重新订阅
          
          // 将所有资产加入待订阅列表
          assetsToResubscribe.forEach(assetId => {
            this.pendingSubscriptions.add(assetId);
          });
          
          // 延迟2秒后批量订阅（确保连接稳定）
          setTimeout(() => {
            this.flushSubscriptions();
          }, 2000);
        }
      });

      this.ws.on('message', (data: WebSocket.Data) => {
        try {
          const rawMessage = data.toString();
          
          // 处理非 JSON 消息（如 "INVALID OPERATION"）
          if (!rawMessage.startsWith('{') && !rawMessage.startsWith('[')) {
            if (rawMessage === 'INVALID OPERATION') {
              // 🔧 降低日志级别，避免刷屏
              // INVALID OPERATION 通常是因为尝试订阅已订阅的 token，或格式问题
              // 这不影响已有订阅，只记录 debug 级别
              logger.debug(`⚠️ WebSocket 返回 INVALID OPERATION（已忽略，不影响现有订阅）`);
              logger.debug(`   当前订阅数: ${this.subscribedAssets.size}, 待订阅数: ${this.pendingSubscriptions.size}`);
              // 不做任何处理，保留已有订阅
            } else {
              logger.warn(`收到非 JSON WebSocket 消息: ${rawMessage}`);
            }
            return;
          }
          
          const message = JSON.parse(rawMessage);
          
          // 更新最后收到消息的时间
          this.lastMessageTime = Date.now();
          
          // 提高价格更新日志级别，确保能看到
          const event_type = message.event_type || message.type;
          if (event_type === 'price_change' || event_type === 'book') {
            logger.info(`📥 收到 Polymarket 消息: ${event_type}`);
          } else {
            logger.debug(`📥 收到消息: ${rawMessage.slice(0, 200)}`);
          }
          
          this.handleMessage(message);
        } catch (error) {
          logger.error('Failed to parse WebSocket message:', error);
        }
      });

      this.ws.on('pong', () => {
        logger.debug('💚 收到 WebSocket Pong 响应');
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
        this.stopHeartbeat();
        this.stopConnectionCheck();
        this.stopPolling();
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
          // 使用 WebSocket 协议层的 ping() 方法，而不是发送 JSON 消息
          this.ws.ping();
          logger.debug('💓 发送 WebSocket Ping 帧');
        } catch (error) {
          logger.error('心跳发送失败:', error);
        }
      }
    }, 15000); // 15秒，CLOB建议10-20秒
    
    logger.info('💓 WebSocket Ping 心跳已启动（每15秒）');
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
   * 启动连接健康检查
   */
  private startConnectionCheck(): void {
    this.stopConnectionCheck();
    this.lastMessageTime = Date.now();
    
    this.connectionCheckInterval = setInterval(() => {
      const now = Date.now();
      const timeSinceLastMessage = now - this.lastMessageTime;
      
      // 如果超过60秒没有收到消息，可能连接有问题
      if (timeSinceLastMessage > 60000) {
        logger.warn(`⚠️ 连接可能断开：已 ${Math.floor(timeSinceLastMessage / 1000)}s 未收到消息`);
        logger.info(`🔄 尝试重连...`);
        
        // 主动关闭并重连
        if (this.ws) {
          this.ws.close();
        }
      } else {
        logger.debug(`💚 连接健康：最后消息 ${Math.floor(timeSinceLastMessage / 1000)}s 前`);
      }
    }, 30000); // 每30秒检查一次
    
    logger.info('🩺 连接健康检查已启动（每30秒）');
  }

  /**
   * 停止连接健康检查
   */
  private stopConnectionCheck(): void {
    if (this.connectionCheckInterval) {
      clearInterval(this.connectionCheckInterval);
      this.connectionCheckInterval = null;
      logger.debug('连接健康检查已停止');
    }
  }

  /**
   * 启动 REST API 轮询（兜底机制）
   */
  private startPolling(): void {
    this.stopPolling();
    
    logger.info('🔄 启动 REST API 轮询（每1秒一次）');
    
    this.pollingInterval = setInterval(async () => {
      if (this.subscribedAssets.size === 0) return;
      
      const now = Date.now();
      
      // 遍历所有已订阅的资产，获取最新订单簿
      for (const assetId of this.subscribedAssets) {
        // 优化：如果 WebSocket 最近有更新（2秒内）且缓存中有完整的买卖价，则跳过 REST API 轮询
        const lastUpdate = this.lastWsTime.get(assetId) || 0;
        const cached = this.priceCache.get(assetId);
        const hasFullData = cached && cached.bestBid !== null && cached.bestAsk !== null;
        
        if (now - lastUpdate < 2000 && hasFullData) {
          // WebSocket 活跃且数据完整，跳过轮询
          continue;
        }
        
      try {
        // 使用 getMidpoint 替代 getOrderBook，避免 Ghost Market 数据
        const midPrice = await this.getMidpoint(assetId);
        
        if (midPrice !== null) {
          // 只更新中间价，不更新 Bid/Ask (因为 REST API 的 OrderBook 不可靠)
          // Bid/Ask 将完全依赖 WebSocket 推送
          this.updatePrice(assetId, {
            price: midPrice,
            bestBid: null, // 保持现有值 (在 updatePrice 中处理)
            bestAsk: null  // 保持现有值
          });
        }
      } catch (error) {
        // 忽略单个查询错误
      }
    }
  }, 1000);
  }

  /**
   * 停止 REST API 轮询
   */
  private stopPolling(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
      logger.debug('REST API 轮询已停止');
    }
  }

  /**
   * 获取单个 Token 的订单簿（REST API）
   */
  private async getOrderBook(tokenId: string): Promise<{ bestBid: number | null; bestAsk: number | null } | null> {
    try {
      // 配置代理（如果需要）
      const axiosConfig: any = {
        params: { token_id: tokenId },
        timeout: 2000, // 短超时
      };
      
      // 获取代理配置
      const proxy = config.polymarket.wsProxy;
      if (proxy && proxy !== 'none') {
        const { HttpsProxyAgent } = await import('https-proxy-agent');
        axiosConfig.httpsAgent = new HttpsProxyAgent(proxy);
        axiosConfig.httpAgent = new HttpsProxyAgent(proxy);
      }
      
      const response = await axios.get(`${this.clobApiUrl}/book`, axiosConfig);
      
      if (response.data) {
        const bids = response.data.bids || [];
        const asks = response.data.asks || [];
        
        return {
          bestBid: bids.length > 0 ? parseFloat(bids[0].price) : null,
          bestAsk: asks.length > 0 ? parseFloat(asks[0].price) : null
        };
      }
      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * 获取 Token 的中间价 (Midpoint)
   * 解决 getOrderBook 返回 Ghost Market 数据的问题
   */
  private async getMidpoint(tokenId: string): Promise<number | null> {
    try {
      const axiosConfig: any = {
        params: { token_id: tokenId },
        timeout: 2000,
      };
      
      const proxy = config.polymarket.wsProxy;
      if (proxy && proxy !== 'none') {
        const { HttpsProxyAgent } = await import('https-proxy-agent');
        axiosConfig.httpsAgent = new HttpsProxyAgent(proxy);
        axiosConfig.httpAgent = new HttpsProxyAgent(proxy);
      }
      
      const response = await axios.get(`${this.clobApiUrl}/midpoint`, axiosConfig);
      
      if (response.data && response.data.mid) {
        return parseFloat(response.data.mid);
      }
      return null;
    } catch (error) {
      // 忽略 404 或其他错误
      return null;
    }
  }

  /**
   * 获取 Token 的市场价格 (REST API)
   * side = 'BUY' -> 获取 Ask (买入价)
   * side = 'SELL' -> 获取 Bid (卖出价)
   */
  private async getMarketPrice(tokenId: string, side: 'BUY' | 'SELL'): Promise<number | null> {
    try {
      const axiosConfig: any = {
        params: { token_id: tokenId, side: side },
        timeout: 2000,
      };
      
      const proxy = config.polymarket.wsProxy;
      if (proxy && proxy !== 'none') {
        const { HttpsProxyAgent } = await import('https-proxy-agent');
        axiosConfig.httpsAgent = new HttpsProxyAgent(proxy);
        axiosConfig.httpAgent = new HttpsProxyAgent(proxy);
      }
      
      const response = await axios.get(`${this.clobApiUrl}/price`, axiosConfig);
      
      if (response.data && response.data.price) {
        return parseFloat(response.data.price);
      }
      return null;
    } catch (error) {
      return null;
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
   * 初始化时不订阅全局频道，等待具体 token
   * Polymarket CLOB WebSocket 不支持全局订阅
   * 需要订阅具体的 asset_id (token ID)
   */
  private initializeConnection(): void {
    logger.info('✅ Polymarket WebSocket 已就绪，等待订阅具体 token');
  }
  
  /**
   * 重置订阅状态
   * 在出现订阅错误时调用，清空已订阅和待订阅列表
   */
  private resetSubscriptions(): void {
    logger.info('重置订阅状态');
    
    // 清空已订阅列表
    this.subscribedAssets.clear();
    
    // 清空待订阅列表
    this.pendingSubscriptions.clear();
    
    // 延迟 2 秒后再尝试订阅，给服务器时间处理
    setTimeout(() => {
      logger.info('准备重新订阅');
      // 在下一次数据更新时自动重新订阅
    }, 2000);
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
    // 检查消息类型
    const event_type = message.event_type || message.type;
    
    // 处理订阅响应
    if (event_type === 'subscribed' || event_type === 'subscription_succeeded') {
      logger.info(`✅ 订阅成功: ${message.request_id || 'unknown'}`);
      return;
    }
    
    // 处理错误消息
    if (event_type === 'error' || message.error) {
      logger.error(`❌ WebSocket 错误: ${message.error || JSON.stringify(message)}`);
      return;
    }
    
    // 处理订单簿数据
    if (event_type === 'book' && message.asset_id) {
      const asset_id = message.asset_id;
      const bids = message.bids || [];
      const asks = message.asks || [];
      const bestBid = bids.length > 0 ? parseFloat(bids[0].price) : null;
      const bestAsk = asks.length > 0 ? parseFloat(asks[0].price) : null;
      const lastTradePrice = message.last_trade_price ? parseFloat(message.last_trade_price) : null;
      const midPrice = bestBid && bestAsk ? (bestBid + bestAsk) / 2 : lastTradePrice;
      
      if (midPrice) {
        logger.info(`📖 订单簿 [${asset_id.slice(0, 8)}...]: Mid=$${midPrice.toFixed(4)}, Bid=$${bestBid?.toFixed(4) || 'N/A'}, Ask=$${bestAsk?.toFixed(4) || 'N/A'}`);
        this.lastWsTime.set(asset_id, Date.now()); // 记录 WS 更新时间
        this.updatePrice(asset_id, { price: midPrice, bestBid, bestAsk });
      }
    } 
    // 处理价格变化
    else if (event_type === 'price_change' && message.price_changes) {
      message.price_changes.forEach((change: any) => {
        const asset_id = change.asset_id;
        const price = change.price ? parseFloat(change.price) : null;
        const bestBid = change.best_bid ? parseFloat(change.best_bid) : null;
        const bestAsk = change.best_ask ? parseFloat(change.best_ask) : null;
        const midPrice = bestBid && bestAsk ? (bestBid + bestAsk) / 2 : price;
        
        if (asset_id && midPrice) {
          logger.info(`📈 价格更新 [${asset_id.slice(0, 8)}...]: Mid=$${midPrice.toFixed(4)}, Bid=$${bestBid?.toFixed(4) || 'N/A'}, Ask=$${bestAsk?.toFixed(4) || 'N/A'} (${change.side})`);
          this.lastWsTime.set(asset_id, Date.now()); // 记录 WS 更新时间
          this.updatePrice(asset_id, { price: midPrice, bestBid, bestAsk });
        }
      });
    }
    // 处理其他消息类型
    else if (event_type) {
      logger.debug(`其他消息类型: ${event_type}`);
      // 记录完整消息以便调试
      if (process.env.NODE_ENV === 'development') {
        logger.debug(`消息内容: ${JSON.stringify(message).slice(0, 200)}...`);
      }
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

    // Token 验证将在 flushSubscriptions 中进行

    // 验证 Token ID 格式（应该是以 0x 开头的十六进制字符串，或纯数字字符串）
    if (!assetId || (typeof assetId !== 'string') || assetId.length === 0) {
      logger.warn(`⚠️ 无效的 Token ID: ${assetId}`);
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
   * 验证 Token ID 是否有效（通过获取订单簿）
   */
  private async validateToken(tokenId: string): Promise<boolean> {
    try {
      // 配置代理（如果需要）
      const axiosConfig: any = {
        params: { token_id: tokenId },
        timeout: 5000,
      };
      
      // 获取代理配置
      const proxy = config.polymarket.wsProxy;
      if (proxy && proxy !== 'none') {
        const { HttpsProxyAgent } = await import('https-proxy-agent');
        axiosConfig.httpsAgent = new HttpsProxyAgent(proxy);
        axiosConfig.httpAgent = new HttpsProxyAgent(proxy);
      }
      
      // 使用 CLOB API 获取订单簿来验证 token 是否有效
      const response = await axios.get(`${this.clobApiUrl}/book`, axiosConfig);
      
      // 如果能成功获取订单簿，说明 token 有效
      return response.status === 200 && response.data;
    } catch (error) {
      logger.debug(`Token ${tokenId.slice(0, 8)}... 验证失败:`, (error as any).message);
      return false;
    }
  }

  /**
   * 批量发送订阅请求
   */
  private async flushSubscriptions(): Promise<void> {
    if (this.pendingSubscriptions.size === 0) {
      return;
    }

    // 检查 WebSocket 连接状态
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      logger.warn(`⚠️ WebSocket 未连接 (状态: ${this.ws?.readyState}), 无法订阅 ${this.pendingSubscriptions.size} 个市场`);
      // 延迟重试
      setTimeout(() => this.flushSubscriptions(), 1000);
      return;
    }

    // 发送订阅消息到 WebSocket（批量订阅）
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const assetsToSubscribe = Array.from(this.pendingSubscriptions);
      
      // 🔧 分批订阅，每批只订阅 1 个 token（避免服务器拒绝）
      const BATCH_SIZE = 1;
      const batches: string[][] = [];
      
      for (let i = 0; i < assetsToSubscribe.length; i += BATCH_SIZE) {
        batches.push(assetsToSubscribe.slice(i, i + BATCH_SIZE));
      }
      
      // 验证所有 Token ID 格式
      const formatValidAssets = assetsToSubscribe.filter(id => {
        if (!id || typeof id !== 'string' || id.length === 0) {
          logger.warn(`⚠️ 跳过无效 Token ID: ${id}`);
          return false;
        }
        
        // 检查 Token ID 格式，必须是数字或十六进制字符串
        const isHexString = /^0x[0-9a-fA-F]+$/.test(id);
        const isNumericString = /^\d+$/.test(id);
        
        if (!isHexString && !isNumericString) {
          logger.warn(`⚠️ 跳过格式不正确的 Token ID: ${id}`);
          return false;
        }
        
        return true;
      });

      // 暂时跳过 Token 验证，直接使用格式验证通过的 Token
      // TODO: 后续可以启用 Token 验证来过滤无效的 Token
      const validAssets = formatValidAssets;
      logger.info(`📋 跳过 Token 验证，使用 ${validAssets.length} 个格式有效的 Token`);
      
      if (validAssets.length === 0) {
        logger.warn(`⚠️ 没有有效的 Token ID 需要订阅`);
        this.pendingSubscriptions.clear();
        return;
      }
      
      // 重新分批
      const validBatches: string[][] = [];
      for (let i = 0; i < validAssets.length; i += BATCH_SIZE) {
        validBatches.push(validAssets.slice(i, i + BATCH_SIZE));
      }
      
      logger.info(`📡 批量订阅 ${validAssets.length} 个市场 (分 ${validBatches.length} 批)`);
      logger.info(`   当前已订阅: ${this.subscribedAssets.size}`);
      
      // 依次发送每一批
      validBatches.forEach((batch, batchIndex) => {
        // 根据 Polymarket API 文档要求，assets_ids 应该是原始的数字字符串
        // 不需要转换为十六进制格式
        
        // 根据订阅格式选择不同的消息格式
        let subscribeMessage;
        
        // 使用标准的 Polymarket WebSocket 订阅格式
        // 注意：每批只订阅一个 token，所以 batch 数组只有一个元素
        subscribeMessage = {
          type: "market",
          assets_ids: batch,  // ✅ 使用原始的数字字符串，不转换为十六进制
          initial_dump: true  // 请求初始数据快照
        };
        
        logger.debug('   使用标准 Polymarket WebSocket 订阅格式');
        
        const messageString = JSON.stringify(subscribeMessage);
        
        logger.info(`   📦 批次 ${batchIndex + 1}/${validBatches.length}: ${batch.length} 个 tokens`);
        
        // 输出 Token ID
        batch.forEach((assetId, index) => {
          if (index < 3) { // 只显示前 3 个以避免输出过多
            logger.debug(`      Token ${index + 1}: ${assetId.slice(0, 16)}...`);
          }
        });
        
        // 输出完整的订阅消息以便调试
        logger.info(`   📨 订阅消息: ${messageString}`);
        
        // 延迟发送每一批（避免过快）
        // 首批延迟1000ms确保连接稳定，后续批次间隔1000ms
        const delayMs = (batchIndex + 1) * 1000;
        setTimeout(() => {
          if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            try {
              this.ws.send(messageString);
              logger.debug(`   ✅ 批次 ${batchIndex + 1} 已发送`);
              logger.debug(`   消息内容: ${messageString}`);
              this.lastSubscribeTime = Date.now();
              
              // 只有成功发送后才标记为已订阅
              batch.forEach(assetId => {
                this.subscribedAssets.add(assetId);
              });
              
              logger.info(`   📊 当前已订阅: ${this.subscribedAssets.size} 个市场`);
            } catch (error) {
              logger.error(`   ❌ 批次 ${batchIndex + 1} 发送异常:`, error);
            }
          } else {
            logger.warn(`   ⚠️ 批次 ${batchIndex + 1} 发送失败：WebSocket 未连接 (状态: ${this.ws?.readyState})`);
          }
        }, delayMs);
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
          // 使用 operation 字段进行动态操作（取消订阅）
          // 格式：{ "assets_ids": ["..."], "operation": "unsubscribe" }
          const unsubscribeMessage = {
            assets_ids: [marketId], // 使用原始的数字字符串 ID
            operation: "unsubscribe"
          };
          this.ws.send(JSON.stringify(unsubscribeMessage));
          logger.debug(`已取消订阅市场: ${marketId}`);
          
          // 从已订阅列表中移除
          this.subscribedAssets.delete(marketId);
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
      
      // 缓存10秒（减少缓存时间，配合 WebSocket 实时更新）
      await cache.set(cacheKey, data, 10);
      
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
      
      // 缓存10秒（减少缓存时间，配合 WebSocket 实时更新）
      await cache.set(cacheKey, data, 10);
      
      return data;
    } catch (error) {
      logger.error(`Failed to fetch market ${marketId}:`, error);
      throw error;
    }
  }

  /**
   * 更新价格并触发订阅者回调（WebSocket 实时推送）
   */
  private updatePrice(assetId: string, priceData: { price: number; bestBid: number | null; bestAsk: number | null }): void {
    // 获取现有缓存
    const cached = this.priceCache.get(assetId);
    
    // ========== Ghost Market 过滤 ==========
    // 检测并拒绝明显异常的价格（如 0.99/0.01）
    const isGhostPrice = (bid: number | null, ask: number | null, mid: number): boolean => {
      // 如果 Bid/Ask 接近极端值 (0.99 或 0.01)，可能是 Ghost Market
      if (bid !== null && (bid >= 0.98 || bid <= 0.02)) return true;
      if (ask !== null && (ask >= 0.98 || ask <= 0.02)) return true;
      
      // 如果 Bid/Ask 与 Midpoint 差距超过 30%，可能是异常数据
      if (mid > 0) {
        if (bid !== null && Math.abs(bid - mid) / mid > 0.3) return true;
        if (ask !== null && Math.abs(ask - mid) / mid > 0.3) return true;
      }
      
      return false;
    };
    
    // 如果检测到 Ghost Price，保留旧数据
    if (isGhostPrice(priceData.bestBid, priceData.bestAsk, priceData.price)) {
      logger.debug(`🚫 Ghost Market 检测: 拒绝异常价格 Bid=${priceData.bestBid}, Ask=${priceData.bestAsk}, Mid=${priceData.price}`);
      // 如果有缓存数据，保留缓存；否则只更新 midpoint
      if (cached) {
        priceData.bestBid = cached.bestBid;
        priceData.bestAsk = cached.bestAsk;
      } else {
        priceData.bestBid = null;
        priceData.bestAsk = null;
      }
    }
    
    // 合并数据：如果新数据的 bid/ask 为空，则保留旧数据
    const mergedData = {
      price: priceData.price,
      bestBid: priceData.bestBid !== null ? priceData.bestBid : (cached?.bestBid || null),
      bestAsk: priceData.bestAsk !== null ? priceData.bestAsk : (cached?.bestAsk || null)
    };

    // 更新价格缓存
    this.priceCache.set(assetId, mergedData);

    // 触发所有订阅者的回调
    const callbacks = this.subscribers.get(assetId);
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback({ 
            price: mergedData.price, 
            midPrice: mergedData.price, 
            bestBid: mergedData.bestBid, 
            bestAsk: mergedData.bestAsk, 
            timestamp: Date.now() 
          });
        } catch (error) {
          logger.error(`触发回调失败 [${assetId}]:`, error);
        }
      });
    }
  }

  /**
   * 搜索NBA比赛市场（使用 Events API）
   * 采用漏斗模型 (The Funnel) 进行精准匹配
   * 注意：虎扑和 Polymarket 的主客场定义可能不同，所以不区分主客场顺序
   */
  async searchNBAMarkets(homeTeam: string, awayTeam: string): Promise<PolymarketData | null> {
    try {
      // 查找球队映射（从静态映射表）
      const homeTeamMapping = findTeamByChinese(homeTeam);
      const awayTeamMapping = findTeamByChinese(awayTeam);
      
      if (!homeTeamMapping || !awayTeamMapping) {
        logger.warn(`[Layer 2] ⚠️ 无法找到球队映射: ${homeTeam} 或 ${awayTeam}`);
        return null;
      }

      // ========== 策略1：Slug 直接搜索 (最可靠) ==========
      // Polymarket slug 格式: nba-{away_abbr}-{home_abbr}-{date} 或 nba-{home_abbr}-{away_abbr}-{date}
      // 例如: nba-atl-tor-2026-01-05
      // 注意：由于时区差异（服务器 UTC vs 美东时间），需要尝试多个日期
      const today = new Date();
      const dateStr = today.toISOString().split('T')[0]; // YYYY-MM-DD (UTC)
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];
      
      const homeAbbr = homeTeamMapping.abbr.toLowerCase();
      const awayAbbr = awayTeamMapping.abbr.toLowerCase();
      
      // 尝试今天和昨天的日期（因为时区差异，今天 UTC 的比赛可能对应美东时间昨天/今天）
      // 优先匹配今天的日期
      const possibleSlugs = [
        `nba-${homeAbbr}-${awayAbbr}-${dateStr}`,
        `nba-${awayAbbr}-${homeAbbr}-${dateStr}`,
        `nba-${homeAbbr}-${awayAbbr}-${yesterdayStr}`,
        `nba-${awayAbbr}-${homeAbbr}-${yesterdayStr}`,
      ];
      
      logger.debug(`[Slug Search] 尝试 slug 搜索: ${possibleSlugs.join(' | ')}`);
      
      let slugFoundEvent: any = null;
      for (const slug of possibleSlugs) {
        try {
          const slugResponse = await axios.get(`${this.gammaApiUrl}/events`, {
            params: { slug: slug },
            timeout: 5000,
          });
          
          if (slugResponse.data && slugResponse.data.length > 0) {
            const event = slugResponse.data[0];
            // 只检查 active 状态，不再过滤 closed（进行中的比赛可能被错误标记）
            if (event.active) {
              logger.info(`[Slug Search] ✅ 找到比赛 (slug=${slug}): ${event.title}`);
              slugFoundEvent = event;
              break;
            }
          }
        } catch (err) {
          // Slug 不存在，继续尝试下一个
        }
      }
      
      // 如果 slug 搜索找到了，直接使用它，不需要 series_id 搜索
      if (slugFoundEvent) {
        // 直接使用 slug 找到的 event，跳转到后续处理逻辑
        const event = slugFoundEvent;
        logger.info(`找到 event: ${event.title}`);
        
        // 以下是原有的 event 处理逻辑 (直接复制过来处理 slug 找到的 event)
        const markets = event.markets || [];
        if (markets.length === 0) {
          logger.warn('Event 没有 markets 数据');
          return null;
        }
        
        // 筛选 Winner 市场 (简化逻辑)
        const winnerMarket = markets.find((m: any) => {
          const question = (m.question || m.groupItemTitle || '').toLowerCase();
          const excludeKeywords = ['spread', 'handicap', 'points', 'total', 'over', 'o/u', 'quarter', '1q', '2q', '3q', '4q', 'q1', 'q2', 'q3', 'q4', 'half', '1h', '2h', 'first half', 'second half', 'more than', 'less than', 'by more', 'beat by'];
          const hasUnder = question.includes('under') && !question.includes('thunder');
          if (excludeKeywords.some(kw => question.includes(kw)) || hasUnder) return false;
          return question.includes('vs') || question.includes('winner') || question.includes('win');
        });
        
        if (!winnerMarket) {
          logger.warn('未找到 Winner (胜负盘) 市场');
          return null;
        }
        
        const market = winnerMarket;
        let outcomes: string[] = typeof market.outcomes === 'string' ? JSON.parse(market.outcomes) : market.outcomes;
        let outcomePrices: string[] = typeof market.outcomePrices === 'string' ? JSON.parse(market.outcomePrices) : market.outcomePrices;
        let tokenIds: string[] = typeof market.clobTokenIds === 'string' ? JSON.parse(market.clobTokenIds) : (market.clobTokenIds || []);
        
        if (outcomes.length < 2 || outcomePrices.length < 2) {
          logger.warn('市场结果或价格数据不足');
          return null;
        }
        
        let homeIndex = -1, awayIndex = -1;
        outcomes.forEach((outcome: string, idx: number) => {
          const outcomeLower = outcome.toLowerCase();
          if ([homeTeamMapping.polymarketName, homeTeamMapping.abbr].some(k => outcomeLower.includes(k.toLowerCase()))) homeIndex = idx;
          if ([awayTeamMapping.polymarketName, awayTeamMapping.abbr].some(k => outcomeLower.includes(k.toLowerCase()))) awayIndex = idx;
        });
        
        if (homeIndex === -1 || awayIndex === -1) {
          logger.warn(`无法在 outcomes [${outcomes.join(', ')}] 中找到主客队`);
          return null;
        }
        
        let homePrice = parseFloat(outcomePrices[homeIndex] || '0');
        let awayPrice = parseFloat(outcomePrices[awayIndex] || '0');
        const homeTokenId = tokenIds[homeIndex] || '';
        const awayTokenId = tokenIds[awayIndex] || '';
        
        // 获取初始价格
        try {
          const [homeMid, awayMid, homeAsk, homeBid, awayAsk, awayBid] = await Promise.all([
            this.getMidpoint(homeTokenId), this.getMidpoint(awayTokenId),
            this.getMarketPrice(homeTokenId, 'BUY'), this.getMarketPrice(homeTokenId, 'SELL'),
            this.getMarketPrice(awayTokenId, 'BUY'), this.getMarketPrice(awayTokenId, 'SELL')
          ]);
          if (homeMid || homeAsk || homeBid) {
            homePrice = homeMid || (homeBid && homeAsk ? (homeBid + homeAsk) / 2 : homePrice);
            this.updatePrice(homeTokenId, { price: homePrice, bestBid: homeBid, bestAsk: homeAsk });
          }
          if (awayMid || awayAsk || awayBid) {
            awayPrice = awayMid || (awayBid && awayAsk ? (awayBid + awayAsk) / 2 : awayPrice);
            this.updatePrice(awayTokenId, { price: awayPrice, bestBid: awayBid, bestAsk: awayAsk });
          }
        } catch (error) {
          logger.warn('获取初始价格失败，将依赖 WebSocket 更新:', error);
        }
        
        logger.info(`📊 Polymarket 价格 [${homeTeam} vs ${awayTeam}]: ${homeTeamMapping.polymarketName}=$${homePrice.toFixed(4)}, ${awayTeamMapping.polymarketName}=$${awayPrice.toFixed(4)}`);
        
        return {
          marketId: market.conditionId || market.condition_id || market.id || '',
          homeTokenId,
          awayTokenId,
          homePrice,
          awayPrice,
          homeBestBid: undefined,
          homeBestAsk: undefined,
          awayBestBid: undefined,
          awayBestAsk: undefined,
          liquidity: parseFloat(market.liquidity || '0'),
        };
      }
      
      logger.debug(`[Slug Search] slug 搜索未找到，回退到 series_id 搜索`);
      
      // ========== 策略2：Series ID 搜索 (回退) ==========
      const response = await axios.get(`${this.gammaApiUrl}/events`, {
        params: { 
          series_id: '10345',  // NBA 2026 series
          limit: 100, 
          offset: 0,
          closed: false,
          active: true,
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
        if (e.closed === true) return false;
        if (e.active === false) return false;
        const text = `${e.title} ${e.slug} ${e.category}`.toLowerCase();
        if (!text.includes('nba') && !text.includes('basketball')) return false;
        return true;
      });
      
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
      
      // 使用 REST API 价格作为初始值，后续通过 WebSocket 实时更新
      logger.info(`📊 REST API 价格 [${homeTeam} vs ${awayTeam}]:`);
      logger.info(`   原始 outcomePrices: ${JSON.stringify(outcomePrices)}`);
      logger.info(`   解析后: ${outcomes[homeIndex]}=$${homePrice.toFixed(4)}, ${outcomes[awayIndex]}=$${awayPrice.toFixed(4)}`);

      // 获取初始价格数据（使用 Midpoint 和 MarketPrice，避免 OrderBook 的 Ghost Market 问题）
      try {
        logger.info(`[Layer 3] 正在获取初始价格数据: ${homeTeam} vs ${awayTeam}`);
        
        const [homeMid, awayMid, homeAsk, homeBid, awayAsk, awayBid] = await Promise.all([
          this.getMidpoint(homeTokenId),
          this.getMidpoint(awayTokenId),
          this.getMarketPrice(homeTokenId, 'BUY'),  // Ask
          this.getMarketPrice(homeTokenId, 'SELL'), // Bid
          this.getMarketPrice(awayTokenId, 'BUY'),  // Ask
          this.getMarketPrice(awayTokenId, 'SELL')  // Bid
        ]);
        
        // 更新主队价格
        if (homeMid || homeAsk || homeBid) {
          // 优先使用 Midpoint，如果没有则尝试 (Bid+Ask)/2，最后使用 homePrice
          let price = homePrice;
          if (homeMid) {
            price = homeMid;
          } else if (homeBid && homeAsk) {
            price = (homeBid + homeAsk) / 2;
          }
          
          logger.debug(`  主队初始价格: Mid=${homeMid}, Bid=${homeBid}, Ask=${homeAsk} -> 使用: ${price}`);
          
          this.updatePrice(homeTokenId, {
            price: price,
            bestBid: homeBid,
            bestAsk: homeAsk
          });
          homePrice = price;
        }
        
        // 更新客队价格
        if (awayMid || awayAsk || awayBid) {
          let price = awayPrice;
          if (awayMid) {
            price = awayMid;
          } else if (awayBid && awayAsk) {
            price = (awayBid + awayAsk) / 2;
          }
          
          logger.debug(`  客队初始价格: Mid=${awayMid}, Bid=${awayBid}, Ask=${awayAsk} -> 使用: ${price}`);
          
          this.updatePrice(awayTokenId, {
            price: price,
            bestBid: awayBid,
            bestAsk: awayAsk
          });
          awayPrice = price;
        }
      } catch (error) {
        logger.warn('获取初始价格失败，将依赖 WebSocket 更新:', error);
      }

      return {
        marketId: market.conditionId || market.condition_id || market.id || '',
        homeTokenId,
        awayTokenId,
        homePrice,
        awayPrice,
        // 从缓存中读取最新的 bid/ask (刚刚通过 updatePrice 更新过)
        homeBestBid: this.priceCache.get(homeTokenId)?.bestBid || undefined,
        homeBestAsk: this.priceCache.get(homeTokenId)?.bestAsk || undefined,
        awayBestBid: this.priceCache.get(awayTokenId)?.bestBid || undefined,
        awayBestAsk: this.priceCache.get(awayTokenId)?.bestAsk || undefined,
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
    try {
      // 停止心跳定时器
      this.stopHeartbeat();
      this.stopConnectionCheck();
      this.stopPolling();
      
      // 安全关闭 WebSocket
      if (this.ws) {
        if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
          try {
            this.ws.close(1000, '正常关闭');
          } catch (closeError) {
            logger.warn('关闭 WebSocket 时出错，已忽略:', closeError);
          }
        }
        this.ws = null;
      }
      
      logger.info('WebSocket 连接已断开');
    } catch (error) {
      logger.error('断开 WebSocket 连接时出错:', error);
      // 即使出错也不抛出异常
    }
  }
}

export const polymarketService = new PolymarketService();
