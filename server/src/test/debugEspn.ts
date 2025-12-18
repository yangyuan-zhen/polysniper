/**
 * 调试 ESPN API 数据结构
 */

import { espnService } from '../services/espnService';
import { cache } from '../utils/cache';

async function debugEspn() {
  try {
    await cache.initialize();
    
    console.log('\n====== 获取 ESPN 比分板数据 ======\n');
    const scoreboard = await espnService.getScoreboard();
    
    if (!scoreboard.events || scoreboard.events.length === 0) {
      console.log('没有比赛数据');
      return;
    }
    
    const game = scoreboard.events[0];
    console.log('比赛 ID:', game.id);
    console.log('比赛名称:', game.name);
    console.log('比赛状态:', game.status?.type?.description);
    
    const competition = game.competitions?.[0];
    console.log('\n====== Competition 数据 ======');
    console.log('Competition ID:', competition?.id);
    
    // 查看 competitors
    console.log('\n====== Competitors 数据 ======');
    const competitors = competition?.competitors || [];
    competitors.forEach((comp: any) => {
      console.log(`\n${comp.homeAway.toUpperCase()} (${comp.team?.displayName}):`);
      console.log('  Score:', comp.score);
      console.log('  Statistics:', JSON.stringify(comp.statistics, null, 2));
      console.log('  Records:', JSON.stringify(comp.records, null, 2));
    });
    
    // 查看 odds
    console.log('\n====== Odds 数据 ======');
    console.log('Odds:', JSON.stringify(competition?.odds, null, 2));
    
    // 查看 predictor
    console.log('\n====== Predictor 数据 ======');
    console.log('Predictor:', JSON.stringify(competition?.predictor, null, 2));
    
    // 查看 situation
    console.log('\n====== Situation 数据 ======');
    console.log('Situation:', JSON.stringify(competition?.situation, null, 2));
    
    // 输出完整的 competition 对象的 keys
    console.log('\n====== Competition 所有字段 ======');
    console.log('Keys:', Object.keys(competition || {}));
    
  } catch (error: any) {
    console.error('调试失败:', error.message);
  } finally {
    await cache.disconnect();
    process.exit(0);
  }
}

debugEspn();
