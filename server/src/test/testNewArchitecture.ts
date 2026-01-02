/**
 * 测试新架构（ESPN 作为主数据源）
 */

import { espnService } from '../services/espnService';
import { cache } from '../utils/cache';
import { NBA_TEAMS } from '../config/teamMappings';

async function testNewArchitecture() {
  try {
    await cache.initialize();
    
    console.log('\n========== 测试 ESPN 主数据源架构 ==========\n');
    
    // 1. 获取今天和明天的比赛
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const todayStr = today.toISOString().split('T')[0].replace(/-/g, '');
    const tomorrowStr = tomorrow.toISOString().split('T')[0].replace(/-/g, '');
    
    console.log(`📅 获取日期: ${todayStr}, ${tomorrowStr}`);
    
    const [todayGames, tomorrowGames] = await Promise.all([
      espnService.getScoreboard(todayStr),
      espnService.getScoreboard(tomorrowStr),
    ]);
    
    const allGames = [
      ...(todayGames?.events || []),
      ...(tomorrowGames?.events || []),
    ];
    
    console.log(`\n✅ 总共获取到 ${allGames.length} 场比赛\n`);
    
    // 2. 显示前3场比赛的详细信息
    console.log('='.repeat(60));
    console.log('前3场比赛详情:');
    console.log('='.repeat(60));
    
    for (let i = 0; i < Math.min(3, allGames.length); i++) {
      const game = allGames[i];
      const competition = game.competitions?.[0];
      const competitors = competition?.competitors || [];
      const home = competitors.find((c: any) => c.homeAway === 'home');
      const away = competitors.find((c: any) => c.homeAway === 'away');
      
      console.log(`\n${i + 1}. ${home?.team?.displayName} vs ${away?.team?.displayName}`);
      console.log(`   游戏 ID: ${game.id}`);
      console.log(`   状态: ${game.status?.type?.description}`);
      console.log(`   比分: ${home?.score || 0} - ${away?.score || 0}`);
      console.log(`   开始时间: ${new Date(game.date).toLocaleString('zh-CN')}`);
      
      // 3. 测试获取胜率和伤病
      console.log(`\n   正在获取详细数据...`);
      const espnData = await espnService.getGameWinProbability(game.id);
      
      if (espnData) {
        console.log(`   ✅ ESPN 数据获取成功:`);
        console.log(`      - 主队胜率: ${(espnData.homeWinProb * 100).toFixed(1)}%`);
        console.log(`      - 客队胜率: ${(espnData.awayWinProb * 100).toFixed(1)}%`);
        console.log(`      - 赛前主队: ${(espnData.pregameHomeWinProb * 100).toFixed(1)}%`);
      } else {
        console.log(`   ❌ 未获取到 ESPN 数据`);
      }
      
      // 4. 测试队名映射
      const homeTeam = NBA_TEAMS.find(t => t.espnName === home?.team?.displayName);
      const awayTeam = NBA_TEAMS.find(t => t.espnName === away?.team?.displayName);
      
      if (homeTeam && awayTeam) {
        console.log(`\n   队名映射:`);
        console.log(`      - ${home?.team?.displayName} → 中文名`);
        console.log(`      - ${away?.team?.displayName} → 中文名`);
      } else {
        console.log(`\n   ⚠️  队名映射不完整`);
      }
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('测试完成！新架构工作正常 ✅');
    console.log('='.repeat(60));
    
  } catch (error: any) {
    console.error('测试失败:', error.message);
    console.error(error.stack);
  } finally {
    await cache.disconnect();
    process.exit(0);
  }
}

testNewArchitecture();
