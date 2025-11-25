/**
 * Polymarket WebSocket Service for Real-Time Price Updates
 * 
 * 官方文档: https://docs.polymarket.com/developers/CLOB/websocket/wss-overview
 * 
 * WebSocket Endpoints:
 * - wss://ws-subscriptions-clob.polymarket.com/ws/
 * - wss://ws-live-data.polymarket.com (备选)
 * 
 * 订阅消息格式:
 * {
 *   "type": "market",
 *   "assets_ids": ["token_id_1", "token_id_2"]
 * }
 * 
 * 推送消息类型:
 * - book: 订单簿更新 (包含 bids/asks)
 * - price_change: 价格变化 (订单添加/取消)
 * - trade: 交易执行 (最准确的成交价)
 */

type PriceUpdateCallback = (tokenId: string, price: string, side: 'BUY' | 'SELL') => void;

export class PolymarketWebSocketClient {
  private ws: WebSocket | null = null;
  private reconnectTimeout: number | null = null;
  private subscribedTokens: Set<string> = new Set();
  private callbacks: Set<PriceUpdateCallback> = new Set();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 3000; // 3 seconds
  private isConnecting = false;
  
  // Polymarket WebSocket endpoint (直连，不通过Vite代理)
  // WebSocket协议不受CORS限制，可以直接从浏览器连接
  // 两个可选地址：
  // 1. wss://ws-subscriptions-clob.polymarket.com/ws/market
  // 2. wss://ws-live-data.polymarket.com (实时数据，可能更快)
  private readonly WS_URL = 'wss://ws-subscriptions-clob.polymarket.com/ws/market';
  
  private pingInterval: number | null = null;

  constructor() {
    console.log('[WebSocket] Client initialized');
    console.log('[WebSocket] 直连URL:', this.WS_URL);
    console.log('[WebSocket] 不需要API密钥认证，公开市场数据');
    console.log('[WebSocket] 不使用Vite代理，浏览器直接连接');
  }

  /**
   * Connect to Polymarket WebSocket
   */
  connect(): Promise<void> {
    if (this.ws?.readyState === WebSocket.OPEN) {
      console.log('[WebSocket] Already connected');
      return Promise.resolve();
    }

    if (this.isConnecting) {
      console.log('[WebSocket] Connection already in progress');
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      try {
        this.isConnecting = true;
        console.log('[WebSocket] Connecting to', this.WS_URL);
        this.ws = new WebSocket(this.WS_URL);

        this.ws.onopen = () => {
          console.log('[WebSocket] ✓ Connected');
          this.isConnecting = false;
          this.reconnectAttempts = 0;
          
          // 启动PING心跳（每10秒）
          this.startPing();
          
          // Resubscribe to all tokens if this is a reconnection
          if (this.subscribedTokens.size > 0) {
            console.log('[WebSocket] Resubscribing to', this.subscribedTokens.size, 'tokens');
            this.subscribeToTokens(Array.from(this.subscribedTokens));
          }
          
          resolve();
        };

        this.ws.onmessage = (event) => {
          // 处理PONG响应
          if (event.data === 'PONG') {
            return;
          }
          
          try {
            const message = JSON.parse(event.data);
            console.log('[WebSocket] Message received:', message);
            this.handleMessage(message);
          } catch (error) {
            console.error('[WebSocket] Failed to parse message:', error, event.data);
          }
        };

        this.ws.onerror = (error) => {
          console.error('[WebSocket] Connection error:', error);
          this.isConnecting = false;
          // 不再reject，等待onclose处理
        };

        this.ws.onclose = () => {
          console.log('[WebSocket] Connection closed');
          this.isConnecting = false;
          this.stopPing(); // 停止心跳
          this.attemptReconnect();
        };
      } catch (error) {
        this.isConnecting = false;
        console.error('[WebSocket] Connection failed:', error);
        reject(error);
      }
    });
  }

  /**
   * Handle incoming WebSocket messages
   * Polymarket推送订单簿(Orderbook)和交易(Trade)数据
   */
  private handleMessage(message: any): void {
    // 处理不同类型的消息
    const eventType = message.event_type || message.type;
    
    console.log('[WebSocket] Event type:', eventType);
    
    // 1. 订单簿更新 (Orderbook updates)
    if (eventType === 'book') {
      // 订单簿快照或更新，包含 bids 和 asks
      // 可以从 best_bid 和 best_ask 计算中间价
      console.log('[WebSocket] 📚 Orderbook update');
      return;
    }
    
    // 2. 价格变化 (Price changes) - 当订单被添加/取消时
    if (eventType === 'price_change' || message.price_changes) {
      const priceChanges = message.price_changes || message.pc || [];
      
      for (const change of priceChanges) {
        const tokenId = change.asset_id || change.a;
        const price = change.price || change.p;
        const side = change.side || change.s;
        
        if (tokenId && price) {
          console.log(`[WebSocket] 💰 Price: ${tokenId.substring(0, 10)}... = ${price} (${side})`);
          
          // Notify callbacks
          this.callbacks.forEach(callback => {
            try {
              callback(tokenId, price, side);
            } catch (error) {
              console.error('[WebSocket] Callback error:', error);
            }
          });
        }
      }
      return;
    }
    
    // 3. 交易事件 (Trade) - 最准确的成交价
    if (eventType === 'trade' || message.trades) {
      const trades = message.trades || [message];
      
      for (const trade of trades) {
        const tokenId = trade.asset_id || trade.token_id;
        const price = trade.price;
        const side = trade.side;
        
        if (tokenId && price) {
          console.log(`[WebSocket] 🔥 Trade executed: ${tokenId.substring(0, 10)}... @ ${price}`);
          
          // Trade价格是最准确的市场价格
          this.callbacks.forEach(callback => {
            try {
              callback(tokenId, price, side);
            } catch (error) {
              console.error('[WebSocket] Callback error:', error);
            }
          });
        }
      }
      return;
    }
    
    // 其他消息类型（如订阅确认等）
    console.log('[WebSocket] Other message:', eventType);
  }

  /**
   * Subscribe to price updates for specific token IDs
   */
  subscribeToTokens(tokenIds: string[]): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('[WebSocket] Cannot subscribe: not connected');
      return;
    }

    // Add to tracked tokens
    tokenIds.forEach(id => this.subscribedTokens.add(id));

    // Send subscription message (官方格式: assets_ids + type)
    const subscribeMsg = {
      type: 'market',
      assets_ids: tokenIds,
    };

    console.log('[WebSocket] Subscribing to', tokenIds.length, 'tokens:', subscribeMsg);
    this.ws.send(JSON.stringify(subscribeMsg));
  }

  /**
   * Unsubscribe from specific token IDs
   */
  unsubscribeFromTokens(tokenIds: string[]): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    tokenIds.forEach(id => this.subscribedTokens.delete(id));

    // 注意：官方文档未明确说明unsubscribe格式，使用相同格式
    const unsubscribeMsg = {
      type: 'unsubscribe',
      assets_ids: tokenIds,
    };

    console.log('[WebSocket] Unsubscribing from', tokenIds.length, 'tokens');
    this.ws.send(JSON.stringify(unsubscribeMsg));
  }

  /**
   * Register a callback for price updates
   */
  onPriceUpdate(callback: PriceUpdateCallback): () => void {
    this.callbacks.add(callback);
    
    // Return unsubscribe function
    return () => {
      this.callbacks.delete(callback);
    };
  }

  /**
   * Attempt to reconnect after connection loss
   */
  private attemptReconnect(): void {
    if (this.reconnectTimeout) {
      return; // Already attempting to reconnect
    }

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[WebSocket] Max reconnect attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * this.reconnectAttempts;
    
    console.log(`[WebSocket] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
    
    this.reconnectTimeout = setTimeout(() => {
      this.reconnectTimeout = null;
      this.connect().catch(error => {
        console.error('[WebSocket] Reconnection failed:', error);
      });
    }, delay);
  }

  /**
   * 启动PING心跳（官方要求每10秒发送一次）
   */
  private startPing(): void {
    this.stopPing(); // 清除旧的
    
    this.pingInterval = window.setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send('PING');
        console.log('[WebSocket] 💓 PING sent');
      }
    }, 10000); // 10秒
  }
  
  /**
   * 停止PING心跳
   */
  private stopPing(): void {
    if (this.pingInterval !== null) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  /**
   * Disconnect and cleanup
   */
  disconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    this.stopPing(); // 停止心跳
    
    if (this.ws) {
      console.log('[WebSocket] Disconnecting');
      this.ws.close();
      this.ws = null;
    }

    this.subscribedTokens.clear();
    this.callbacks.clear();
    this.reconnectAttempts = 0;
    console.log('[WebSocket] Disconnected');
  }

  /**
   * Get connection status
   */
  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  /**
   * Get list of subscribed token IDs
   */
  getSubscribedTokens(): string[] {
    return Array.from(this.subscribedTokens);
  }
}

// Singleton instance
let wsClient: PolymarketWebSocketClient | null = null;

/**
 * Get or create WebSocket client instance
 */
export function getWebSocketClient(): PolymarketWebSocketClient {
  if (!wsClient) {
    wsClient = new PolymarketWebSocketClient();
  }
  return wsClient;
}

/**
 * Initialize WebSocket connection and subscribe to token updates
 */
export async function initializeWebSocket(tokenIds: string[]): Promise<PolymarketWebSocketClient> {
  const client = getWebSocketClient();
  
  if (!client.isConnected()) {
    try {
      await client.connect();
    } catch (error) {
      console.error('[WebSocket] Failed to connect:', error);
      // 返回客户端但不抛出错误，允许程序继续运行
    }
  }
  
  if (tokenIds.length > 0 && client.isConnected()) {
    client.subscribeToTokens(tokenIds);
  }
  
  return client;
}
