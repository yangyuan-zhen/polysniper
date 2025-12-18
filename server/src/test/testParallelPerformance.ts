/**
 * 测试并行请求的性能提升
 */

import { hupuService } from '../services/hupuService';
import { espnService } from '../services/espnService';
import { polymarketService } from '../services/polymarketService';
import { logger } from '../utils/logger';

async function testSerialRequests(homeTeam: string, awayTeam: string) {
  logger.info('🔄 测试串行请求（旧方式）...\n');
  
  const startTime = Date.now();
  
  // 1. 虎扑
  const hupuStart = Date.now();
  const hupuData = await hupuService.getGameByTeams(homeTeam, awayTeam);
  const hupuTime = Date.now() - hupuStart;
  
  // 2. ESPN
  const espnStart = Date.now();
  const espnData = await espnService.getWinProbabilityByTeams(homeTeam, awayTeam);
  const espnTime = Date.now() - espnStart;
  
  // 3. Polymarket
  const polyStart = Date.now();
  const polyData = await polymarketService.searchNBAMarkets(homeTeam, awayTeam);
  const polyTime = Date.now() - polyStart;
  
  const totalTime = Date.now() - startTime;
  
  logger.info(`  虎扑耗时: ${hupuTime}ms ${hupuData ? '✅' : '❌'}`);
  logger.info(`  ESPN耗时: ${espnTime}ms ${espnData ? '✅' : '❌'}`);
  logger.info(`  Poly耗时: ${polyTime}ms ${polyData ? '✅' : '❌'}`);
  logger.info(`  📊 总耗时: ${totalTime}ms (${hupuTime} + ${espnTime} + ${polyTime})\n`);
  
  return { totalTime, hupuTime, espnTime, polyTime };
}

async function testParallelRequests(homeTeam: string, awayTeam: string) {
  logger.info('⚡ 测试并行请求（新方式）...\n');
  
  const startTime = Date.now();
  
  // 并行请求
  const [hupuResult, espnResult, polyResult] = await Promise.allSettled([
    hupuService.getGameByTeams(homeTeam, awayTeam),
    espnService.getWinProbabilityByTeams(homeTeam, awayTeam),
    polymarketService.searchNBAMarkets(homeTeam, awayTeam),
  ]);
  
  const totalTime = Date.now() - startTime;
  
  const hupuSuccess = hupuResult.status === 'fulfilled' && hupuResult.value;
  const espnSuccess = espnResult.status === 'fulfilled' && espnResult.value;
  const polySuccess = polyResult.status === 'fulfilled' && polyResult.value;
  
  logger.info(`  虎扑: ${hupuSuccess ? '✅' : '❌'}`);
  logger.info(`  ESPN: ${espnSuccess ? '✅' : '❌'}`);
  logger.info(`  Poly: ${polySuccess ? '✅' : '❌'}`);
  logger.info(`  📊 总耗时: ${totalTime}ms (并行执行)\n`);
  
  return { totalTime };
}

async function main() {
  logger.info('========================================');
  logger.info('    并行请求性能优化测试');
  logger.info('========================================\n');
  
  // 获取一场测试比赛
  logger.info('🔍 查找测试比赛...\n');
  const games = await hupuService.getAllGames();
  const activeGames = games.filter((g: any) => g.matchStatus !== 'COMPLETED');
  
  if (activeGames.length === 0) {
    logger.warn('没有找到进行中或未开始的比赛');
    return;
  }
  
  const testGame = activeGames[0];
  const homeTeam = testGame.homeTeamName;
  const awayTeam = testGame.awayTeamName;
  
  logger.info(`✅ 找到测试比赛: ${homeTeam} vs ${awayTeam}\n`);
  logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  // 测试3轮
  const serialTimes: number[] = [];
  const parallelTimes: number[] = [];
  
  for (let round = 1; round <= 3; round++) {
    logger.info(`\n🔢 第 ${round} 轮测试\n`);
    logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    // 串行测试
    const serialResult = await testSerialRequests(homeTeam, awayTeam);
    serialTimes.push(serialResult.totalTime);
    
    // 等待2秒，让缓存过期
    logger.info('⏳ 等待缓存过期...\n');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // 并行测试
    const parallelResult = await testParallelRequests(homeTeam, awayTeam);
    parallelTimes.push(parallelResult.totalTime);
    
    // 等待3秒再进行下一轮
    if (round < 3) {
      logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }
  
  // 汇总结果
  logger.info('\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  logger.info('========================================');
  logger.info('           测试结果汇总');
  logger.info('========================================\n');
  
  const serialAvg = serialTimes.reduce((a, b) => a + b, 0) / serialTimes.length;
  const parallelAvg = parallelTimes.reduce((a, b) => a + b, 0) / parallelTimes.length;
  const improvement = serialAvg - parallelAvg;
  const improvementPercent = ((improvement / serialAvg) * 100).toFixed(1);
  
  logger.info('📊 串行请求（旧方式）:');
  logger.info(`   平均耗时: ${serialAvg.toFixed(0)}ms`);
  logger.info(`   详细数据: ${serialTimes.map(t => `${t}ms`).join(', ')}`);
  
  logger.info('\n⚡ 并行请求（新方式）:');
  logger.info(`   平均耗时: ${parallelAvg.toFixed(0)}ms`);
  logger.info(`   详细数据: ${parallelTimes.map(t => `${t}ms`).join(', ')}`);
  
  logger.info('\n🎯 性能提升:');
  logger.info(`   节省时间: ${improvement.toFixed(0)}ms`);
  logger.info(`   提升比例: ${improvementPercent}%`);
  logger.info(`   ${improvement > 0 ? '✅ 性能提升成功！' : '⚠️ 未见明显提升（可能受缓存影响）'}`);
  
  // 理论分析
  logger.info('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  logger.info('💡 理论分析:\n');
  logger.info('串行请求: 总时间 = 虎扑耗时 + ESPN耗时 + Polymarket耗时');
  logger.info('并行请求: 总时间 = max(虎扑耗时, ESPN耗时, Polymarket耗时)');
  logger.info('\n举例说明:');
  logger.info('  虎扑: 265ms');
  logger.info('  ESPN: 480ms');
  logger.info('  Poly: 500ms');
  logger.info('  ');
  logger.info('  串行: 265 + 480 + 500 = 1245ms');
  logger.info('  并行: max(265, 480, 500) = 500ms');
  logger.info('  提升: 1245 - 500 = 745ms (59.8%)');
  
  logger.info('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  logger.info('✅ 测试完成！');
  logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

main().then(() => {
  process.exit(0);
}).catch(error => {
  logger.error('测试失败:', error);
  process.exit(1);
});
