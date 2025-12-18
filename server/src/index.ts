import http from 'http';
import app from './app';
import { config } from './config';
import { logger } from './utils/logger';
import { cache } from './utils/cache';
import { dataAggregator } from './services/dataAggregator';
import { WebSocketServer } from './websocket';

// 创建HTTP服务器
const server = http.createServer(app);

// 创建WebSocket服务器
const wsServer = new WebSocketServer(server);

/**
 * 启动服务
 */
async function start() {
  try {
    logger.info('正在启动 PolySniper 后端服务...');
    logger.info(`运行环境: ${config.nodeEnv}`);
    logger.info(`端口: ${config.port}`);

    // 初始化缓存
    await cache.initialize();

    // 启动HTTP服务器（先启动服务器）
    server.listen(config.port, () => {
      logger.info(`服务器运行中: http://localhost:${config.port}`);
      logger.info('API 接口:');
      logger.info('  GET  /health              - 健康检查');
      logger.info('  GET  /api/matches         - 获取所有比赛');
      logger.info('  GET  /api/matches/:id     - 获取指定比赛');
      logger.info('  GET  /api/signals         - 获取套利信号');
      logger.info('  GET  /api/stats           - 获取统计信息');
      logger.info('');
      logger.info('WebSocket 事件:');
      logger.info('  subscribe                 - 订阅比赛更新');
      logger.info('  unsubscribe               - 取消订阅');
      logger.info('  matchesUpdate             - 接收比赛更新');
      logger.info('  signalAlert               - 接收套利信号告警');
    });

    // 启动WebSocket服务
    wsServer.start();

    // 启动数据采集（放在最后，即使失败也不影响服务器运行）
    try {
      await dataAggregator.start();
    } catch (error) {
      logger.error('数据采集启动失败，但服务器继续运行:', error);
    }
  } catch (error) {
    logger.error('服务器启动失败:', error);
    process.exit(1);
  }
}

/**
 * 优雅关闭
 */
async function shutdown() {
  logger.info('正在优雅关闭服务...');

  try {
    // 停止数据采集
    dataAggregator.stop();

    // 停止WebSocket服务
    wsServer.stop();

    // 断开缓存连接
    await cache.disconnect();

    // 关闭HTTP服务器
    server.close(() => {
      logger.info('服务器已关闭');
      process.exit(0);
    });

    // 强制退出（超时10秒）
    setTimeout(() => {
      logger.error('强制关闭');
      process.exit(1);
    }, 10000);
  } catch (error) {
    logger.error('关闭过程出错:', error);
    process.exit(1);
  }
}

// 监听进程信号
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// 未捕获的异常
process.on('uncaughtException', (error) => {
  logger.error('未捕获的异常:', error);
  shutdown();
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('未处理的 Promise 拒绝:', promise, '原因:', reason);
  shutdown();
});

// 启动服务
start();
