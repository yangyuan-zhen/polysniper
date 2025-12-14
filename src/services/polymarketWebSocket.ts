/**
 * Polymarket CLOB WebSocket 服务
 * 
 * 功能：
 * - 实时订阅市场价格更新
 * - 心跳保活机制（每 20-30 秒 ping）
 * - 断线自动重连（指数退避策略）
 * - 订阅管理（支持动态添加/移除订阅）
 * 
 * 基于 Polymarket 官方文档：
 * https://docs.polymarket.com/quickstart/introduction/rate-limits
 */

export interface PriceUpdate {
  tokenId: string;
  price: string;      // 卖出价格（0-1 范围）
  timestamp: number;
}

export type PriceUpdateCallback = (update: PriceUpdate) => void;

interface Subscription {
  tokenId: string;
  callbacks: Set<PriceUpdateCallback>;
}

interface WebSocketMessage {
  type: 'subscribed' | 'unsubscribed' | 'price_change' | 'error' | 'pong';
  data?: any;
  channel?: string;
  message?: string;
}

export class PolymarketWebSocket {
  private ws: WebSocket | null = null;
  private subscriptions = new Map<string, Subscription>();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private baseReconnectDelay = 1000; // 1秒
  private heartbeatInterval = 25000; // 25秒（建议 20-30 秒）
  private isConnecting = false;
  private isManualClose = false;
  private lastPongTime = 0;
  
  // WebSocket 连接状态
  private connectionState: 'disconnected' | 'connecting' | 'connected' | 'error' = 'disconnected';
  
  // 状态变化回调
  private stateChangeCallbacks = new Set<(state: string) => void>();

  constructor() {
    console.log('[WebSocket] PolymarketWebSocket 服务初始化');
  }

  /**
   * 连接到 Polymarket CLOB WebSocket
   */
  connect(): void {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      console.log('[WebSocket] 已连接或正在连接中，跳过重复连接');
      return;
    }

    if (this.isConnecting) {
      console.log('[WebSocket] 正在连接中，请稍候...');
      return;
    }

    this.isConnecting = true;
    this.isManualClose = false;
    this.updateConnectionState('connecting');

    try {
      // 通过 Vite 本地代理连接 Polymarket WebSocket
      // Vite 会将 ws://localhost:5173/ws-poly 转发到 wss://ws-subscriptions-clob.polymarket.com/ws/
      const wsUrl = `ws://${window.location.host}/ws-poly`;
      
      console.log(`[WebSocket] 🔌 连接到本地代理: ${wsUrl}`);
      console.log(`[WebSocket] 📡 代理目标: wss://ws-subscriptions-clob.polymarket.com/ws/`);
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = this.handleOpen.bind(this);
      this.ws.onmessage = this.handleMessage.bind(this);
      this.ws.onerror = this.handleError.bind(this);
      this.ws.onclose = this.handleClose.bind(this);
    } catch (error) {
      console.error('[WebSocket] ❌ 连接失败:', error);
      this.isConnecting = false;
      this.updateConnectionState('error');
      this.scheduleReconnect();
    }
  }

  /**
   * 连接成功处理
   */
  private handleOpen(): void {
    console.log('[WebSocket] ✅ 连接成功');
    this.isConnecting = false;
    this.reconnectAttempts = 0;
    this.updateConnectionState('connected');
    
    // 启动心跳
    this.startHeartbeat();
    
    // 重新订阅所有之前的订阅
    this.resubscribeAll();
  }

  /**
   * 消息处理
   */
  private handleMessage(event: MessageEvent): void {
    console.log('[WebSocket] 📨 收到消息:', event.data);
    
    try {
      const message: WebSocketMessage = JSON.parse(event.data);
      console.log('[WebSocket] 📦 解析后:', message);
      
      // 处理 pong 响应
      if (message.type === 'pong') {
        this.lastPongTime = Date.now();
        return;
      }
      
      // 处理订阅确认
      if (message.type === 'subscribed') {
        const tokenId = this.extractTokenIdFromChannel(message.channel);
        if (tokenId) {
          console.log(`[WebSocket] ✓ 已订阅 token ${tokenId}`);
        }
        return;
      }
      
      // 处理取消订阅确认
      if (message.type === 'unsubscribed') {
        const tokenId = this.extractTokenIdFromChannel(message.channel);
        if (tokenId) {
          console.log(`[WebSocket] ✓ 已取消订阅 token ${tokenId}`);
        }
        return;
      }
      
      // 处理价格更新
      if (message.type === 'price_change' && message.data) {
        const { token_id, price } = message.data;
        
        if (token_id && price !== undefined) {
          const priceUpdate: PriceUpdate = {
            tokenId: token_id,
            price: price.toString(),
            timestamp: Date.now()
          };
          
          this.notifySubscribers(priceUpdate);
        }
        return;
      }
      
      // 处理错误消息
      if (message.type === 'error') {
        console.error('[WebSocket] ❌ 服务器错误:', message.message);
        return;
      }
      
      // 其他消息类型（调试用）
      // console.log('[WebSocket] 📨 收到消息:', message);
    } catch (error) {
      console.error('[WebSocket] ❌ 解析消息失败:', error);
    }
  }

  /**
   * 错误处理
   */
  private handleError(event: Event): void {
    console.error('[WebSocket] ❌ 连接错误:', event);
    this.updateConnectionState('error');
  }

  /**
   * 连接关闭处理
   */
  private handleClose(event: CloseEvent): void {
    console.log(`[WebSocket] 🔌 连接关闭 (code: ${event.code}, reason: ${event.reason || '无原因'})`);
    this.isConnecting = false;
    this.stopHeartbeat();
    this.updateConnectionState('disconnected');
    
    // 如果不是手动关闭，则自动重连
    if (!this.isManualClose) {
      this.scheduleReconnect();
    }
  }

  /**
   * 心跳保活机制
   */
  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.lastPongTime = Date.now();
    
    this.heartbeatTimer = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        // 发送 ping
        this.send({
          type: 'ping'
        });
        
        // 检查上次 pong 时间
        const timeSinceLastPong = Date.now() - this.lastPongTime;
        if (timeSinceLastPong > this.heartbeatInterval * 2) {
          console.warn('[WebSocket] ⚠️ 心跳超时，可能连接已断开，尝试重连...');
          this.reconnect();
        }
      } else {
        console.warn('[WebSocket] ⚠️ WebSocket 未连接，停止心跳');
        this.stopHeartbeat();
      }
    }, this.heartbeatInterval);
    
    console.log(`[WebSocket] 💓 心跳启动 (每 ${this.heartbeatInterval / 1000} 秒)`);
  }

  /**
   * 停止心跳
   */
  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
      console.log('[WebSocket] 💔 心跳停止');
    }
  }

  /**
   * 安排重连（指数退避）
   */
  private scheduleReconnect(): void {
    // 清除之前的重连定时器
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }
    
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[WebSocket] ❌ 达到最大重连次数，停止重连');
      return;
    }
    
    // 指数退避：1s, 2s, 4s, 8s, 16s, 32s...（最多 60s）
    const delay = Math.min(
      this.baseReconnectDelay * Math.pow(2, this.reconnectAttempts),
      60000
    );
    
    this.reconnectAttempts++;
    console.log(`[WebSocket] 🔄 将在 ${delay / 1000} 秒后重连 (第 ${this.reconnectAttempts}/${this.maxReconnectAttempts} 次)`);
    
    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, delay);
  }

  /**
   * 手动重连
   */
  reconnect(): void {
    console.log('[WebSocket] 🔄 手动触发重连');
    this.disconnect();
    this.reconnectAttempts = 0;
    setTimeout(() => {
      this.connect();
    }, 1000);
  }

  /**
   * 断开连接
   */
  disconnect(): void {
    console.log('[WebSocket] 🔌 断开连接');
    this.isManualClose = true;
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    
    this.stopHeartbeat();
    
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    
    this.updateConnectionState('disconnected');
  }

  /**
   * 订阅市场价格
   */
  subscribe(tokenId: string, callback: PriceUpdateCallback): void {
    // 添加到订阅列表
    let subscription = this.subscriptions.get(tokenId);
    if (!subscription) {
      subscription = {
        tokenId,
        callbacks: new Set()
      };
      this.subscriptions.set(tokenId, subscription);
    }
    
    subscription.callbacks.add(callback);
    
    // 如果已连接，立即发送订阅请求
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.sendSubscribe(tokenId);
    } else {
      console.log(`[WebSocket] 📝 已加入订阅队列: ${tokenId}（等待连接）`);
      // 如果未连接，自动触发连接
      if (!this.isConnecting && this.connectionState === 'disconnected') {
        this.connect();
      }
    }
  }

  /**
   * 取消订阅
   */
  unsubscribe(tokenId: string, callback: PriceUpdateCallback): void {
    const subscription = this.subscriptions.get(tokenId);
    if (!subscription) return;
    
    subscription.callbacks.delete(callback);
    
    // 如果没有回调了，完全取消订阅
    if (subscription.callbacks.size === 0) {
      this.subscriptions.delete(tokenId);
      
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.sendUnsubscribe(tokenId);
      }
    }
  }

  /**
   * 发送订阅请求
   * 尝试多种格式
   */
  private sendSubscribe(tokenId: string): void {
    // 尝试格式 1: 简单订阅（无 auth）
    const message1 = {
      type: 'subscribe',
      channel: `market.${tokenId}`
    };
    
    // 尝试格式 2: 订阅 book
    const message2 = {
      type: 'subscribe',
      channel: `book.${tokenId}`
    };
    
    console.log(`[WebSocket] 📡 发送订阅请求: ${tokenId}`);
    console.log('[WebSocket] 📤 尝试格式 1 (market):', JSON.stringify(message1));
    
    // 先尝试格式 1
    this.send(message1);
    
    // 等待 100ms 后尝试格式 2
    setTimeout(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        console.log('[WebSocket] 📤 尝试格式 2 (book):', JSON.stringify(message2));
        this.send(message2);
      }
    }, 100);
  }

  /**
   * 发送取消订阅请求
   */
  private sendUnsubscribe(tokenId: string): void {
    this.send({
      type: 'unsubscribe',
      channel: `market.${tokenId}`
    });
    
    console.log(`[WebSocket] 📡 发送取消订阅请求: ${tokenId}`);
  }

  /**
   * 重新订阅所有
   */
  private resubscribeAll(): void {
    if (this.subscriptions.size === 0) {
      console.log('[WebSocket] 无需重新订阅（没有订阅）');
      return;
    }
    
    console.log(`[WebSocket] 🔄 重新订阅 ${this.subscriptions.size} 个市场`);
    
    for (const [tokenId] of this.subscriptions) {
      this.sendSubscribe(tokenId);
    }
  }

  /**
   * 通知订阅者
   */
  private notifySubscribers(update: PriceUpdate): void {
    const subscription = this.subscriptions.get(update.tokenId);
    if (!subscription) return;
    
    subscription.callbacks.forEach(callback => {
      try {
        callback(update);
      } catch (error) {
        console.error('[WebSocket] ❌ 回调执行失败:', error);
      }
    });
  }

  /**
   * 发送消息
   */
  private send(data: any): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const message = JSON.stringify(data);
      console.log('[WebSocket] 📤 发送数据:', message);
      this.ws.send(message);
    } else {
      console.warn('[WebSocket] ⚠️ WebSocket 未连接，无法发送消息');
      console.warn('[WebSocket]   readyState:', this.ws?.readyState);
    }
  }

  /**
   * 从 channel 提取 tokenId
   */
  private extractTokenIdFromChannel(channel?: string): string | null {
    if (!channel) return null;
    const match = channel.match(/market\.(.+)/);
    return match ? match[1] : null;
  }

  /**
   * 更新连接状态
   */
  private updateConnectionState(state: 'disconnected' | 'connecting' | 'connected' | 'error'): void {
    this.connectionState = state;
    this.stateChangeCallbacks.forEach(callback => {
      try {
        callback(state);
      } catch (error) {
        console.error('[WebSocket] ❌ 状态回调执行失败:', error);
      }
    });
  }

  /**
   * 监听连接状态变化
   */
  onStateChange(callback: (state: string) => void): () => void {
    this.stateChangeCallbacks.add(callback);
    
    // 返回取消监听的函数
    return () => {
      this.stateChangeCallbacks.delete(callback);
    };
  }

  /**
   * 获取当前连接状态
   */
  getConnectionState(): string {
    return this.connectionState;
  }

  /**
   * 获取订阅统计
   */
  getStats() {
    return {
      connectionState: this.connectionState,
      subscriptions: this.subscriptions.size,
      reconnectAttempts: this.reconnectAttempts,
      isConnected: this.ws?.readyState === WebSocket.OPEN,
      lastPongTime: this.lastPongTime
    };
  }
}

// 全局单例
export const polymarketWS = new PolymarketWebSocket();

// 自动连接（可选，根据需求开启）
// polymarketWS.connect();
