import { io, Socket } from 'socket.io-client';
import type {
  UnifiedMatch,
  MatchesUpdateEvent,
  MatchUpdateEvent,
  SignalAlertEvent,
  ConnectionStatusEvent,
} from '../types/backend';

type MatchesUpdateCallback = (data: MatchesUpdateEvent) => void;
type MatchUpdateCallback = (data: MatchUpdateEvent) => void;
type SignalAlertCallback = (data: SignalAlertEvent) => void;
type ConnectionStatusCallback = (data: ConnectionStatusEvent) => void;

class WebSocketService {
  private socket: Socket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  /**
   * 连接到后端 WebSocket 服务器
   */
  connect(url: string = 'http://localhost:3000'): void {
    if (this.socket?.connected) {
      console.log('[WebSocket] 已经连接');
      return;
    }

    console.log('[WebSocket] 正在连接到:', url);

    this.socket = io(url, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: this.maxReconnectAttempts,
    });

    this.setupEventHandlers();
  }

  /**
   * 设置事件处理器
   */
  private setupEventHandlers(): void {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log('✅ [WebSocket] 已连接, ID:', this.socket?.id);
      this.reconnectAttempts = 0;
    });

    this.socket.on('disconnect', (reason) => {
      console.log('❌ [WebSocket] 已断开:', reason);
    });

    this.socket.on('connect_error', (error) => {
      this.reconnectAttempts++;
      console.error(`⚠️ [WebSocket] 连接错误 (尝试 ${this.reconnectAttempts}/${this.maxReconnectAttempts}):`, error.message);
    });

    this.socket.on('reconnect', (attemptNumber) => {
      console.log(`🔄 [WebSocket] 重新连接成功 (尝试 ${attemptNumber} 次)`);
    });

    this.socket.on('reconnect_failed', () => {
      console.error('❌ [WebSocket] 重连失败，已达到最大尝试次数');
    });
  }

  /**
   * 订阅比赛更新
   */
  subscribe(matchIds?: string[]): void {
    if (!this.socket?.connected) {
      console.warn('[WebSocket] 未连接，无法订阅');
      return;
    }

    console.log('[WebSocket] 📡 订阅比赛:', matchIds ? matchIds.join(', ') : '所有比赛');
    this.socket.emit('subscribe', { matchIds });
  }

  /**
   * 取消订阅
   */
  unsubscribe(matchIds?: string[]): void {
    if (!this.socket?.connected) return;

    console.log('[WebSocket] 📴 取消订阅:', matchIds ? matchIds.join(', ') : '所有比赛');
    this.socket.emit('unsubscribe', { matchIds });
  }

  /**
   * 监听比赛数据更新（多场）
   */
  onMatchesUpdate(callback: MatchesUpdateCallback): void {
    if (!this.socket) return;
    this.socket.on('matchesUpdate', callback);
  }

  /**
   * 监听单场比赛更新
   */
  onMatchUpdate(callback: MatchUpdateCallback): void {
    if (!this.socket) return;
    this.socket.on('matchUpdate', callback);
  }

  /**
   * 监听套利信号告警
   */
  onSignalAlert(callback: SignalAlertCallback): void {
    if (!this.socket) return;
    this.socket.on('signalAlert', callback);
  }

  /**
   * 监听连接状态
   */
  onConnectionStatus(callback: ConnectionStatusCallback): void {
    if (!this.socket) return;
    this.socket.on('connectionStatus', callback);
  }

  /**
   * 移除事件监听器
   */
  off(event: string, callback?: (...args: any[]) => void): void {
    if (!this.socket) return;
    this.socket.off(event, callback);
  }

  /**
   * 断开连接
   */
  disconnect(): void {
    if (this.socket) {
      console.log('[WebSocket] 断开连接');
      this.socket.disconnect();
      this.socket = null;
    }
  }

  /**
   * 检查连接状态
   */
  isConnected(): boolean {
    return this.socket?.connected ?? false;
  }
}

// 导出单例
export const websocketService = new WebSocketService();
