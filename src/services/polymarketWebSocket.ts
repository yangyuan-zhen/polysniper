/**
 * Polymarket WebSocket Service for Real-Time Price Updates
 * 
 * Uses Polymarket's CLOB Market WebSocket to subscribe to price changes
 * Documentation: https://docs.polymarket.com/developers/CLOB/websocket/wss-overview
 */

interface PriceChange {
  a: string;  // asset_id (token_id)
  p: string;  // price (0-1)
  s: 'BUY' | 'SELL';  // side
  si: number; // size
  h?: string; // hash
  ba?: string; // best ask
  bb?: string; // best bid
}

interface PriceChangeMessage {
  m: string;  // market
  pc: PriceChange[];  // price changes array
  t: number;  // timestamp
}

interface WebSocketMessage {
  topic: string;
  type: string;
  timestamp: number;
  payload: PriceChangeMessage;
}

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
  
  // Polymarket Real-Time Data WebSocket endpoint
  private readonly WS_URL = 'wss://clob.polymarket.com/v2/ws';

  constructor() {
    console.log('[WebSocket] Client initialized');
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
          
          // Resubscribe to all tokens if this is a reconnection
          if (this.subscribedTokens.size > 0) {
            console.log('[WebSocket] Resubscribing to', this.subscribedTokens.size, 'tokens');
            this.subscribeToTokens(Array.from(this.subscribedTokens));
          }
          
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const message: WebSocketMessage = JSON.parse(event.data);
            this.handleMessage(message);
          } catch (error) {
            console.error('[WebSocket] Failed to parse message:', error);
          }
        };

        this.ws.onerror = (error) => {
          console.error('[WebSocket] Error:', error);
          this.isConnecting = false;
          reject(error);
        };

        this.ws.onclose = () => {
          console.log('[WebSocket] Connection closed');
          this.isConnecting = false;
          this.ws = null;
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
   */
  private handleMessage(message: WebSocketMessage): void {
    // We're interested in CLOB market price changes
    if (message.topic === 'market' && message.type === 'price_change') {
      const payload = message.payload;
      
      if (!payload.pc || !Array.isArray(payload.pc)) {
        return;
      }

      // Process each price change
      for (const priceChange of payload.pc) {
        const tokenId = priceChange.a;
        const price = priceChange.p;
        const side = priceChange.s;

        // Notify all callbacks
        this.callbacks.forEach(callback => {
          try {
            callback(tokenId, price, side);
          } catch (error) {
            console.error('[WebSocket] Callback error:', error);
          }
        });
      }
    }
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

    // Send subscription message
    const subscribeMsg = {
      type: 'subscribe',
      channel: 'market',
      auth: {},
      markets: tokenIds, // Subscribe to specific token IDs
    };

    console.log('[WebSocket] Subscribing to', tokenIds.length, 'tokens');
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

    const unsubscribeMsg = {
      type: 'unsubscribe',
      channel: 'market',
      markets: tokenIds,
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
   * Disconnect and cleanup
   */
  disconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.ws) {
      console.log('[WebSocket] Disconnecting');
      this.ws.close();
      this.ws = null;
    }

    this.subscribedTokens.clear();
    this.callbacks.clear();
    this.reconnectAttempts = 0;
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
    await client.connect();
  }
  
  if (tokenIds.length > 0) {
    client.subscribeToTokens(tokenIds);
  }
  
  return client;
}
