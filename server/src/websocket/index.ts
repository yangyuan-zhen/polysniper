import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';
import { logger } from '../utils/logger';
import { dataAggregator } from '../services/dataAggregator';
import { config } from '../config';

export class WebSocketServer {
  private io: SocketIOServer;
  private updateInterval: NodeJS.Timeout | null = null;
  private lastMatchesSnapshot: string = '';

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
          const room = this.io.sockets.adapter.rooms.get('all-matches');
          const clientCount = room ? room.size : 0;
          logger.info(`客户端 ${socket.id} 已订阅所有比赛 (当前 ${clientCount} 个客户端)`);
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
        
        // 深度克隆确保前端能正确渲染
        const clonedMatches = JSON.parse(JSON.stringify(matches));
        
        socket.emit('matchesUpdate', {
          type: 'initial',
          data: clonedMatches,
          timestamp: Date.now(),
        });
      } else {
        const matches = dataAggregator.getAllMatches();
        
        // 深度克隆确保前端能正确渲染
        const clonedMatches = JSON.parse(JSON.stringify(matches));
        
        socket.emit('matchesUpdate', {
          type: 'initial',
          data: clonedMatches,
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
    // 每500毫秒检查并推送更新（更快响应价格变化）
    this.updateInterval = setInterval(() => {
      this.broadcastUpdates();
    }, 500);

    logger.info('WebSocket 服务器已启动（更新检测: 500ms）');
  }

  /**
   * 广播更新给所有客户端
   */
  private broadcastUpdates(): void {
    try {
      const matches = dataAggregator.getAllMatches();
      
      // 生成当前数据快照（用于比较）
      // 注意：价格使用4位小数提高精度，胜率使用3位小数
      const currentSnapshot = JSON.stringify(
        matches.map(m => ({
          id: m.id,
          status: m.status,
          homeScore: m.homeTeam.score,
          awayScore: m.awayTeam.score,
          // 价格四舍五入到4位小数（0.0001精度），捕捉更细微的变化
          homePrice: m.poly?.homePrice ? Math.round(m.poly.homePrice * 10000) / 10000 : null,
          awayPrice: m.poly?.awayPrice ? Math.round(m.poly.awayPrice * 10000) / 10000 : null,
          // 胜率四舍五入到3位小数（0.001精度）
          homeWinProb: m.espn?.homeWinProb ? Math.round(m.espn.homeWinProb * 1000) / 1000 : null,
          awayWinProb: m.espn?.awayWinProb ? Math.round(m.espn.awayWinProb * 1000) / 1000 : null,
          // 不包含 lastUpdate，避免时间戳变化导致误判
        }))
      );
      
      // 统计连接的客户端数量
      const room = this.io.sockets.adapter.rooms.get('all-matches');
      const clientCount = room ? room.size : 0;
      
      // 只在数据变化时推送
      if (currentSnapshot !== this.lastMatchesSnapshot) {
        this.lastMatchesSnapshot = currentSnapshot;
        
        // 深度克隆数据以确保前端能检测到变化
        // 使用 JSON 序列化/反序列化创建全新的对象引用
        const clonedMatches = JSON.parse(JSON.stringify(matches));
        
        // 向订阅所有比赛的客户端广播
        this.io.to('all-matches').emit('matchesUpdate', {
          type: 'update',
          data: clonedMatches,
          timestamp: Date.now(),
        });
        
        logger.info(`📡 数据变化，推送更新 (${matches.length} 场比赛) → ${clientCount} 个客户端`);
      } else if (clientCount > 0) {
        logger.debug(`⏭️ 数据无变化，跳过推送 (${clientCount} 个客户端等待中)`);
      }

      // 向订阅特定比赛的客户端广播
      matches.forEach(match => {
        // 深度克隆单场比赛数据
        const clonedMatch = JSON.parse(JSON.stringify(match));
        
        this.io.to(`match:${match.id}`).emit('matchUpdate', {
          type: 'update',
          data: clonedMatch,
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
