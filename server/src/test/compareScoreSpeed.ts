/**
 * 对比虎扑和 ESPN 的比分获取速度
 */

import { hupuService } from '../services/hupuService';
import { espnService } from '../services/espnService';
import { logger } from '../utils/logger';

async function compareSpeed() {
  logger.info('========== 比分获取速度对比 ==========\n');
  
  const tests = 5; // 测试5次
  const hupuTimes: number[] = [];
  const espnTimes: number[] = [];
  
  for (let i = 1; i <= tests; i++) {
    logger.info(`\n━━━ 第 ${i} 次测试 ━━━\n`);
    
    // 测试虎扑
    logger.info('🏀 测试虎扑 API...');
    const hupuStart = Date.now();
    try {
      const hupuGames = await hupuService.getAllGames();
      const hupuEnd = Date.now();
      const hupuTime = hupuEnd - hupuStart;
      hupuTimes.push(hupuTime);
      
      logger.info(`✅ 虎扑响应时间: ${hupuTime}ms`);
      logger.info(`   获取到 ${hupuGames.length} 场比赛`);
      
      // 显示一个比分示例
      const liveGame = hupuGames.find((g: any) => g.matchStatus === 'LIVE');
      if (liveGame) {
        logger.info(`   进行中比赛示例: ${liveGame.homeTeamName} ${liveGame.homeScore || 0} - ${liveGame.awayScore || 0} ${liveGame.awayTeamName}`);
        logger.info(`   状态: ${liveGame.matchStatusChinese}`);
      }
    } catch (error: any) {
      logger.error(`❌ 虎扑失败: ${error.message}`);
    }
    
    // 延迟1秒避免缓存
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // 测试 ESPN
    logger.info('\n🏈 测试 ESPN API...');
    const espnStart = Date.now();
    try {
      const espnScoreboard = await espnService.getScoreboard();
      const espnEnd = Date.now();
      const espnTime = espnEnd - espnStart;
      espnTimes.push(espnTime);
      
      logger.info(`✅ ESPN 响应时间: ${espnTime}ms`);
      
      const events = espnScoreboard.events || [];
      logger.info(`   获取到 ${events.length} 场比赛`);
      
      // 显示一个比分示例
      if (events.length > 0) {
        const event = events[0];
        const competition = event.competitions?.[0];
        const competitors = competition?.competitors || [];
        const home = competitors.find((c: any) => c.homeAway === 'home');
        const away = competitors.find((c: any) => c.homeAway === 'away');
        
        if (home && away) {
          logger.info(`   比赛示例: ${home.team.displayName} ${home.score || 0} - ${away.score || 0} ${away.team.displayName}`);
          logger.info(`   状态: ${competition.status?.type?.description || 'Unknown'}`);
        }
      }
    } catch (error: any) {
      logger.error(`❌ ESPN 失败: ${error.message}`);
    }
    
    // 延迟2秒避免缓存
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  // 统计结果
  logger.info('\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  logger.info('========== 测试结果汇总 ==========\n');
  
  if (hupuTimes.length > 0) {
    const hupuAvg = hupuTimes.reduce((a, b) => a + b, 0) / hupuTimes.length;
    const hupuMin = Math.min(...hupuTimes);
    const hupuMax = Math.max(...hupuTimes);
    
    logger.info('🏀 虎扑 API:');
    logger.info(`   平均响应时间: ${hupuAvg.toFixed(0)}ms`);
    logger.info(`   最快: ${hupuMin}ms`);
    logger.info(`   最慢: ${hupuMax}ms`);
    logger.info(`   稳定性: ${hupuTimes.map(t => `${t}ms`).join(', ')}`);
  }
  
  logger.info('');
  
  if (espnTimes.length > 0) {
    const espnAvg = espnTimes.reduce((a, b) => a + b, 0) / espnTimes.length;
    const espnMin = Math.min(...espnTimes);
    const espnMax = Math.max(...espnTimes);
    
    logger.info('🏈 ESPN API:');
    logger.info(`   平均响应时间: ${espnAvg.toFixed(0)}ms`);
    logger.info(`   最快: ${espnMin}ms`);
    logger.info(`   最慢: ${espnMax}ms`);
    logger.info(`   稳定性: ${espnTimes.map(t => `${t}ms`).join(', ')}`);
  }
  
  // 对比分析
  if (hupuTimes.length > 0 && espnTimes.length > 0) {
    const hupuAvg = hupuTimes.reduce((a, b) => a + b, 0) / hupuTimes.length;
    const espnAvg = espnTimes.reduce((a, b) => a + b, 0) / espnTimes.length;
    const diff = Math.abs(hupuAvg - espnAvg);
    const faster = hupuAvg < espnAvg ? '虎扑' : 'ESPN';
    const percent = ((diff / Math.max(hupuAvg, espnAvg)) * 100).toFixed(1);
    
    logger.info('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    logger.info('🏆 对比结果:');
    logger.info(`   ${faster} 更快 ${diff.toFixed(0)}ms (${percent}%)`);
  }
  
  // 建议
  logger.info('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  logger.info('💡 建议:\n');
  
  logger.info('1. **响应速度**: 看上面的测试结果');
  logger.info('2. **数据完整性**:');
  logger.info('   - 虎扑: 中文名称，更适合国内用户');
  logger.info('   - ESPN: 英文名称，需要额外映射');
  logger.info('3. **更新频率**:');
  logger.info('   - 虎扑: 官方声称实时更新');
  logger.info('   - ESPN: 官方 API，可能更稳定');
  logger.info('4. **当前策略**: 虎扑获取比分 + ESPN 获取胜率（最优组合）');
}

compareSpeed().then(() => {
  logger.info('\n测试完成');
  process.exit(0);
}).catch(error => {
  logger.error('测试失败:', error);
  process.exit(1);
});
