/**
 * 测试 ESPN Summary API
 */

import { espnService } from '../services/espnService';
import { cache } from '../utils/cache';

async function testSummary() {
  try {
    await cache.initialize();
    
    console.log('\n====== 测试 ESPN Summary API ======\n');
    
    // 先获取一个比赛 ID
    const scoreboard = await espnService.getScoreboard();
    const game = scoreboard.events?.[0];
    
    if (!game) {
      console.log('没有找到比赛');
      return;
    }
    
    console.log('测试比赛:', game.name);
    console.log('比赛 ID:', game.id);
    console.log('状态:', game.status?.type?.description);
    
    // 测试通过球队名称获取胜率
    const competitors = game.competitions?.[0]?.competitors;
    const home = competitors?.find((c: any) => c.homeAway === 'home');
    const away = competitors?.find((c: any) => c.homeAway === 'away');
    
    console.log('\n主队:', home?.team?.displayName);
    console.log('客队:', away?.team?.displayName);
    
    console.log('\n====== 调用 getWinProbabilityByTeams ======\n');
    const result = await espnService.getWinProbabilityByTeams(
      home?.team?.displayName || '',
      away?.team?.displayName || ''
    );
    
    if (result) {
      console.log('\n✅ 成功获取数据:');
      console.log('主队胜率:', (result.homeWinProb * 100).toFixed(1) + '%');
      console.log('客队胜率:', (result.awayWinProb * 100).toFixed(1) + '%');
      console.log('赛前主队胜率:', (result.pregameHomeWinProb * 100).toFixed(1) + '%');
      console.log('赛前客队胜率:', (result.pregameAwayWinProb * 100).toFixed(1) + '%');
      console.log('伤病数量:', result.injuries?.length || 0);
      
      if (result.injuries && result.injuries.length > 0) {
        console.log('\n伤病列表:');
        result.injuries.forEach((injury: any, i: number) => {
          console.log(`  ${i + 1}. ${injury.athlete?.displayName} (${injury.team?.displayName}) - ${injury.status}`);
        });
      }
    } else {
      console.log('❌ 未获取到数据');
    }
    
  } catch (error: any) {
    console.error('测试失败:', error.message);
    console.error(error.stack);
  } finally {
    await cache.disconnect();
    process.exit(0);
  }
}

testSummary();
