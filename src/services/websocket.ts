/**
 * Polymarket WebSocket 实时价格服务
 * 优化版 - 支持批量订阅和自动重连
 */

type PriceCallback = (assetId: string, price: string) => void;

interface PriceChangeEvent {
  event_type: 'price_change';
  market: string;
  price_changes: Array<{
    asset_id: string;
    price: string;
    size: string;
    side: 'BUY' | 'SELL';
  }>;
}

class PolymarketWebSocket {
  private ws: WebSocket | null = null;
  private subscribers: Map<string, Set<PriceCallback>> = new Map();
  private reconnectTimer: number | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 2000; // 2秒
  private isIntentionallyClosed = false;
  private subscribedTokens = new Set<string>();
  private heartbeatInterval: number | null = null;

  constructor() {
    this.connect();
  }

  private connect() {
    if (this.ws?.readyState === WebSocket.OPEN) {
      return;
    }

    try {
      // Polymarket CLOB WebSocket
      this.ws = new WebSocket('wss://ws-subscriptions-clob.polymarket.com/ws/market');
      
      this.ws.onopen = () => {
        console.log('[WebSocket] ✓ 已连接');
        this.reconnectAttempts = 0;
        
        // 重新订阅所有token
        if (this.subscribedTokens.size > 0) {
          this.sendSubscribe(Array.from(this.subscribedTokens));
        }

        // 心跳保活
        this.startHeartbeat();
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          // 处理价格变化事件
          if (data.event_type === 'price_change' && data.price_changes) {
            const priceEvent = data as PriceChangeEvent;
            for (const change of priceEvent.price_changes) {
              this.notifySubscribers(change.asset_id, change.price);
            }
          }
        } catch (error) {
          // 静默忽略解析错误
        }
      };

      this.ws.onerror = () => {
        // 静默处理错误，由onclose触发重连
      };

      this.ws.onclose = () => {
        this.stopHeartbeat();
        
        if (!this.isIntentionallyClosed) {
          this.scheduleReconnect();
        }
      };
    } catch (error) {
      console.error('[WebSocket] 创建失败:', error);
      this.scheduleReconnect();
    }
  }

  private startHeartbeat() {
    this.stopHeartbeat();
    // 每30秒ping一次
    this.heartbeatInterval = window.setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        try {
          this.ws.send(JSON.stringify({ type: 'ping' }));
        } catch (e) {
          // 忽略
        }
      }
    }, 30000);
  }

  private stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer !== null || this.isIntentionallyClosed) {
      return;
    }

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[WebSocket] 达到最大重连次数');
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(this.reconnectDelay * this.reconnectAttempts, 30000);
    
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      console.log(`[WebSocket] 重连中... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
      this.connect();
    }, delay);
  }

  private sendSubscribe(tokenIds: string[]) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN || tokenIds.length === 0) {
      return;
    }

    try {
      this.ws.send(JSON.stringify({
        type: 'subscribe',
        assets_ids: tokenIds,
        markets: []
      }));
      console.log(`[WebSocket] 订阅 ${tokenIds.length} 个token`);
    } catch (error) {
      console.error('[WebSocket] 订阅失败:', error);
    }
  }

  private sendUnsubscribe(tokenIds: string[]) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN || tokenIds.length === 0) {
      return;
    }

    try {
      this.ws.send(JSON.stringify({
        type: 'unsubscribe',
        assets_ids: tokenIds,
        markets: []
      }));
    } catch (error) {
      // 忽略取消订阅错误
    }
  }

  private notifySubscribers(assetId: string, price: string) {
    const callbacks = this.subscribers.get(assetId);
    if (callbacks && callbacks.size > 0) {
      callbacks.forEach(callback => {
        try {
          callback(assetId, price);
        } catch (error) {
          console.error('[WebSocket] 回调失败:', error);
        }
      });
    }
  }

  /**
   * 订阅价格更新
   */
  subscribe(tokenId: string, callback: PriceCallback) {
    // 添加回调
    if (!this.subscribers.has(tokenId)) {
      this.subscribers.set(tokenId, new Set());
    }
    this.subscribers.get(tokenId)!.add(callback);

    // 如果是新token，发送订阅
    if (!this.subscribedTokens.has(tokenId)) {
      this.subscribedTokens.add(tokenId);
      
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.sendSubscribe([tokenId]);
      }
    }
  }

  /**
   * 取消订阅
   */
  unsubscribe(tokenId: string, callback: PriceCallback) {
    const callbacks = this.subscribers.get(tokenId);
    if (callbacks) {
      callbacks.delete(callback);
      
      // 如果没有订阅者了，取消订阅该token
      if (callbacks.size === 0) {
        this.subscribers.delete(tokenId);
        this.subscribedTokens.delete(tokenId);
        
        if (this.ws?.readyState === WebSocket.OPEN) {
          this.sendUnsubscribe([tokenId]);
        }
      }
    }
  }

  /**
   * 关闭连接
   */
  disconnect() {
    this.isIntentionallyClosed = true;
    this.stopHeartbeat();
    
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    
    this.subscribers.clear();
    this.subscribedTokens.clear();
  }
}

// 全局单例
export const polymarketWS = new PolymarketWebSocket();
