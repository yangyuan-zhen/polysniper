/**
 * 调试 ESPN Predictor 数据
 */

import { espnService } from '../services/espnService';
import { cache } from '../utils/cache';

async function debugPredictor() {
  try {
    await cache.initialize();
    
    console.log('\n====== 获取 ESPN 比分板数据 ======\n');
    const scoreboard = await espnService.getScoreboard();
    
    if (!scoreboard.events || scoreboard.events.length === 0) {
      console.log('没有比赛数据');
      return;
    }
    
    // 查找未开始的比赛
    const upcomingGame = scoreboard.events.find((e: any) => 
      e.status?.type?.state === 'pre'
    );
    
    if (!upcomingGame) {
      console.log('没有找到未开始的比赛，查看第一场比赛');
      const game = scoreboard.events[0];
      console.log('\n比赛:', game.name);
      console.log('状态:', game.status?.type?.description);
      
      const competition = game.competitions?.[0];
      console.log('\n====== Predictor 数据 ======');
      console.log(JSON.stringify(competition?.predictor, null, 2));
      
      console.log('\n====== Odds 数据 ======');
      console.log(JSON.stringify(competition?.odds, null, 2));
      
      console.log('\n====== Situation 数据 ======');
      console.log(JSON.stringify(competition?.situation, null, 2));
      
      return;
    }
    
    console.log('找到未开始的比赛:', upcomingGame.name);
    console.log('状态:', upcomingGame.status?.type?.description);
    console.log('开始时间:', upcomingGame.date);
    
    const competition = upcomingGame.competitions?.[0];
    console.log('\n====== Competition 所有字段 ======');
    console.log('Keys:', Object.keys(competition || {}));
    
    console.log('\n====== Predictor 数据 ======');
    console.log(JSON.stringify(competition?.predictor, null, 2));
    
    console.log('\n====== Odds 数据 ======');
    console.log(JSON.stringify(competition?.odds, null, 2));
    
    console.log('\n====== Competitors 数据 ======');
    const competitors = competition?.competitors || [];
    competitors.forEach((comp: any) => {
      console.log(`\n${comp.homeAway.toUpperCase()} (${comp.team?.displayName}):`);
      console.log('  Team Keys:', Object.keys(comp.team || {}));
      console.log('  Records:', JSON.stringify(comp.records, null, 2));
    });
    
  } catch (error: any) {
    console.error('调试失败:', error.message);
    console.error(error.stack);
  } finally {
    await cache.disconnect();
    process.exit(0);
  }
}

debugPredictor();
