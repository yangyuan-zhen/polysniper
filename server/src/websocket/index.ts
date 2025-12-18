import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';
import { logger } from '../utils/logger';
import { dataAggregator } from '../services/dataAggregator';
import { config } from '../config';

export class WebSocketServer {
  private io: SocketIOServer;
  private updateInterval: NodeJS.Timeout | null = null;

  constructor(httpServer: HTTPServer) {
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: config.cors.origin,
        methods: ['GET', 'POST'],
      },
    });

    this.setupEventHandlers();
  }

  /**
   * 设置事件处理器
   */
  private setupEventHandlers(): void {
    this.io.on('connection', (socket) => {
      logger.info(`客户端已连接: ${socket.id}`);

      // 订阅比赛更新
      socket.on('subscribe', (data: { matchIds?: string[] }) => {
        const { matchIds } = data;
        
        if (matchIds && matchIds.length > 0) {
          matchIds.forEach(id => {
            socket.join(`match:${id}`);
          });
          logger.info(`客户端 ${socket.id} 已订阅比赛: ${matchIds.join(', ')}`);
        } else {
          // 订阅所有比赛
          socket.join('all-matches');
          logger.info(`客户端 ${socket.id} 已订阅所有比赛`);
        }

        // 立即发送当前数据
        this.sendCurrentData(socket, matchIds);
      });

      // 取消订阅
      socket.on('unsubscribe', (data: { matchIds?: string[] }) => {
        const { matchIds } = data;
        
        if (matchIds && matchIds.length > 0) {
          matchIds.forEach(id => {
            socket.leave(`match:${id}`);
          });
          logger.info(`客户端 ${socket.id} 已取消订阅比赛: ${matchIds.join(', ')}`);
        } else {
          socket.leave('all-matches');
          logger.info(`客户端 ${socket.id} 已取消订阅所有比赛`);
        }
      });

      // 断开连接
      socket.on('disconnect', () => {
        logger.info(`客户端已断开: ${socket.id}`);
      });
    });
  }

  /**
   * 发送当前数据给客户端
   */
  private sendCurrentData(socket: any, matchIds?: string[]): void {
    try {
      if (matchIds && matchIds.length > 0) {
        const matches = matchIds
          .map(id => dataAggregator.getMatch(id))
          .filter(m => m !== null);
        
        socket.emit('matchesUpdate', {
          type: 'initial',
          data: matches,
          timestamp: Date.now(),
        });
      } else {
        const matches = dataAggregator.getAllMatches();
        socket.emit('matchesUpdate', {
          type: 'initial',
          data: matches,
          timestamp: Date.now(),
        });
      }
    } catch (error) {
      logger.error('发送当前数据失败:', error);
    }
  }

  /**
   * 启动实时推送
   */
  start(): void {
    // 每3秒向所有连接的客户端推送更新
    this.updateInterval = setInterval(() => {
      this.broadcastUpdates();
    }, 3000);

    logger.info('WebSocket 服务器已启动');
  }

  /**
   * 广播更新给所有客户端
   */
  private broadcastUpdates(): void {
    try {
      const matches = dataAggregator.getAllMatches();

      // 向订阅所有比赛的客户端广播
      this.io.to('all-matches').emit('matchesUpdate', {
        type: 'update',
        data: matches,
        timestamp: Date.now(),
      });

      // 向订阅特定比赛的客户端广播
      matches.forEach(match => {
        this.io.to(`match:${match.id}`).emit('matchUpdate', {
          type: 'update',
          data: match,
          timestamp: Date.now(),
        });

        // 如果有新的套利信号，发送告警
        if (match.signals.length > 0) {
          this.io.to(`match:${match.id}`).emit('signalAlert', {
            matchId: match.id,
            signals: match.signals,
            timestamp: Date.now(),
          });

          // 也发送给订阅所有比赛的客户端
          this.io.to('all-matches').emit('signalAlert', {
            matchId: match.id,
            signals: match.signals,
            timestamp: Date.now(),
          });
        }
      });
    } catch (error) {
      logger.error('广播更新失败:', error);
    }
  }

  /**
   * 发送连接状态
   */
  sendConnectionStatus(connected: boolean, message: string): void {
    this.io.emit('connectionStatus', {
      connected,
      message,
      timestamp: Date.now(),
    });
  }

  /**
   * 停止服务
   */
  stop(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
    
    this.io.close();
    logger.info('WebSocket 服务器已停止');
  }
}
