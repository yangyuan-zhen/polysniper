/**
 * 测试价格获取功能
 * 验证三层漏斗匹配是否能成功获取 Polymarket 价格
 */

import { hupuService } from '../services/hupuService';
import { polymarketService } from '../services/polymarketService';
import { logger } from '../utils/logger';

async function testPriceRetrieval() {
  logger.info('========== 开始测试价格获取功能 ==========');
  
  try {
    // 1. 获取虎扑比赛列表
    logger.info('\n[Step 1] 获取虎扑比赛列表...');
    const games = await hupuService.getAllGames();
    logger.info(`虎扑返回 ${games.length} 场比赛`);
    
    // 2. 过滤掉已结束的比赛
    const activeGames = games.filter((game: any) => {
      const matchStatus = game.matchStatus || '';
      return matchStatus !== 'COMPLETED';
    });
    logger.info(`过滤后剩余 ${activeGames.length} 场进行中或未开始的比赛`);
    
    if (activeGames.length === 0) {
      logger.warn('⚠️ 当前没有进行中或未开始的比赛');
      return;
    }
    
    // 3. 测试前3场比赛的价格获取
    logger.info('\n[Step 2] 测试前3场比赛的价格获取...\n');
    
    const testGames = activeGames.slice(0, 3);
    let successCount = 0;
    let failCount = 0;
    
    for (const game of testGames) {
      const homeTeamName = game.homeTeamName || '';
      const awayTeamName = game.awayTeamName || '';
      const matchStatus = game.matchStatusChinese || game.matchStatus || '未知';
      
      logger.info(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      logger.info(`🏀 测试比赛: ${homeTeamName} vs ${awayTeamName}`);
      logger.info(`   状态: ${matchStatus}`);
      logger.info(`   开始时间: ${game.matchTime || game.chinaStartTime}`);
      
      try {
        // 调用 Polymarket 价格获取
        const polyData = await polymarketService.searchNBAMarkets(homeTeamName, awayTeamName);
        
        if (polyData) {
          logger.info(`✅ 成功获取价格!`);
          logger.info(`   Market ID: ${polyData.marketId}`);
          logger.info(`   主队价格 (${homeTeamName}): $${polyData.homePrice.toFixed(4)}`);
          logger.info(`   客队价格 (${awayTeamName}): $${polyData.awayPrice.toFixed(4)}`);
          logger.info(`   流动性: $${polyData.liquidity?.toLocaleString() || 'N/A'}`);
          logger.info(`   交易量: $${polyData.homeVolume?.toLocaleString() || 'N/A'}`);
          if (polyData.endDate) {
            logger.info(`   结束时间: ${polyData.endDate}`);
          }
          successCount++;
        } else {
          logger.warn(`❌ 未找到 Polymarket 市场`);
          failCount++;
        }
      } catch (error: any) {
        logger.error(`❌ 获取价格失败: ${error.message}`);
        failCount++;
      }
      
      // 延迟避免请求过快
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // 4. 汇总结果
    logger.info(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    logger.info('========== 测试结果汇总 ==========');
    logger.info(`✅ 成功: ${successCount} 场`);
    logger.info(`❌ 失败: ${failCount} 场`);
    logger.info(`📊 成功率: ${((successCount / (successCount + failCount)) * 100).toFixed(1)}%`);
    
    if (successCount > 0) {
      logger.info(`\n🎉 价格获取功能正常工作!`);
    } else {
      logger.warn(`\n⚠️ 所有测试均失败，可能的原因：`);
      logger.warn(`   1. Polymarket 当前没有这些比赛的市场`);
      logger.warn(`   2. 球队名称映射有问题`);
      logger.warn(`   3. API 请求失败`);
    }
    
  } catch (error: any) {
    logger.error('测试过程中发生错误:', error);
  }
}

// 运行测试
testPriceRetrieval().then(() => {
  logger.info('\n测试完成');
  process.exit(0);
}).catch(error => {
  logger.error('测试失败:', error);
  process.exit(1);
});
