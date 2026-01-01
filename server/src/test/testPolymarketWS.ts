import { polymarketService } from '../services/polymarketService';
import { logger } from '../utils/logger';

/**
 * 测试 Polymarket WebSocket 连接和订阅
 */
async function testPolymarketWebSocket() {
  logger.info('========================================');
  logger.info('🧪 测试 Polymarket WebSocket 连接');
  logger.info('========================================\n');

  try {
    // 1. 连接 WebSocket
    logger.info('1️⃣ 连接 Polymarket WebSocket...');
    await polymarketService.connectWebSocket();
    
    // 等待连接建立
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // 2. 搜索一个真实的 NBA 市场
    logger.info('\n2️⃣ 搜索 NBA 市场...');
    const markets = await polymarketService.getMarkets({
      sport: 'basketball',
      limit: 5,
    });
    
    if (!markets || markets.length === 0) {
      logger.error('❌ 没有找到 NBA 市场');
      return;
    }
    
    logger.info(`✅ 找到 ${markets.length} 个市场`);
    
    // 找一个活跃的市场
    const activeMarket = markets.find((m: any) => !m.closed && m.tokens?.length >= 2);
    
    if (!activeMarket) {
      logger.error('❌ 没有找到活跃市场');
      return;
    }
    
    logger.info(`\n📊 使用市场: ${activeMarket.question}`);
    logger.info(`   Market ID: ${activeMarket.condition_id}`);
    
    const homeToken = activeMarket.tokens[0];
    const awayToken = activeMarket.tokens[1];
    
    logger.info(`   主队 Token: ${homeToken.token_id} (${homeToken.outcome})`);
    logger.info(`   客队 Token: ${awayToken.token_id} (${awayToken.outcome})`);
    
    // 3. 订阅 token 价格
    logger.info('\n3️⃣ 订阅 token 价格...');
    
    let homeUpdates = 0;
    let awayUpdates = 0;
    
    polymarketService.subscribe(homeToken.token_id, (data: any) => {
      homeUpdates++;
      logger.info(`🔴 主队价格更新 [${homeUpdates}]: $${data.price?.toFixed(4) || 'N/A'}`);
      if (data.bestBid && data.bestAsk) {
        logger.info(`   买: $${data.bestBid.toFixed(4)}, 卖: $${data.bestAsk.toFixed(4)}`);
      }
    });
    
    polymarketService.subscribe(awayToken.token_id, (data: any) => {
      awayUpdates++;
      logger.info(`🔵 客队价格更新 [${awayUpdates}]: $${data.price?.toFixed(4) || 'N/A'}`);
      if (data.bestBid && data.bestAsk) {
        logger.info(`   买: $${data.bestBid.toFixed(4)}, 卖: $${data.bestAsk.toFixed(4)}`);
      }
    });
    
    // 4. 等待接收更新
    logger.info('\n4️⃣ 等待接收价格更新（60秒）...');
    logger.info('   （如果 Polymarket 有交易活动，会收到实时更新）\n');
    
    await new Promise(resolve => setTimeout(resolve, 60000));
    
    // 5. 总结
    logger.info('\n========================================');
    logger.info('📊 测试总结');
    logger.info('========================================');
    logger.info(`主队更新次数: ${homeUpdates}`);
    logger.info(`客队更新次数: ${awayUpdates}`);
    logger.info(`总更新次数: ${homeUpdates + awayUpdates}`);
    
    if (homeUpdates === 0 && awayUpdates === 0) {
      logger.warn('\n⚠️ 没有收到任何价格更新！');
      logger.warn('可能的原因:');
      logger.warn('1. WebSocket 连接失败');
      logger.warn('2. 订阅消息格式不正确');
      logger.warn('3. 市场没有交易活动');
      logger.warn('4. Token ID 不正确');
    } else {
      logger.info('\n✅ WebSocket 工作正常！');
    }
    
  } catch (error) {
    logger.error('❌ 测试失败:', error);
  }
  
  process.exit(0);
}

// 运行测试
testPolymarketWebSocket();
