/**
 * 匹配今天的比赛：从 ESPN 获取比赛，然后在 Polymarket 搜索
 */

import { espnService } from '../services/espnService';
import { polymarketService } from '../services/polymarketService';
import { cache } from '../utils/cache';

async function matchTodayGames() {
  try {
    await cache.initialize();
    
    console.log('\n====== 获取今天的 NBA 比赛（ESPN） ======\n');
    
    const scoreboard = await espnService.getScoreboard();
    const games = scoreboard.events || [];
    
    console.log(`ESPN 今天有 ${games.length} 场比赛\n`);
    
    if (games.length === 0) {
      console.log('今天没有比赛');
      return;
    }
    
    // 对每场比赛，尝试在 Polymarket 查找
    for (let i = 0; i < games.length; i++) {
      const game = games[i];
      const comp = game.competitions?.[0];
      const home = comp?.competitors?.find((c: any) => c.homeAway === 'home');
      const away = comp?.competitors?.find((c: any) => c.homeAway === 'away');
      
      const homeTeamName = home?.team?.displayName || '';
      const awayTeamName = away?.team?.displayName || '';
      const homeScore = home?.score || 0;
      const awayScore = away?.score || 0;
      const status = game.status?.type?.description || '';
      
      console.log(`\n${i + 1}. ${homeTeamName} vs ${awayTeamName}`);
      console.log(`   比分: ${homeScore} - ${awayScore}`);
      console.log(`   状态: ${status}`);
      
      // 在 Polymarket 搜索这场比赛
      console.log(`\n   🔍 在 Polymarket 搜索...`);
      
      const polyData = await polymarketService.searchNBAMarkets(homeTeamName, awayTeamName);
      
      if (polyData) {
        console.log(`   ✅ 找到 Polymarket 市场！`);
        console.log(`      市场ID: ${polyData.marketId}`);
        console.log(`      主队价格: $${polyData.homePrice.toFixed(3)} (${(polyData.homePrice * 100).toFixed(1)}%)`);
        console.log(`      客队价格: $${polyData.awayPrice.toFixed(3)} (${(polyData.awayPrice * 100).toFixed(1)}%)`);
        console.log(`      流动性: $${(polyData.liquidity || 0).toFixed(0)}`);
      } else {
        console.log(`   ❌ 未找到 Polymarket 市场`);
        
        // 尝试更多搜索策略
        console.log(`   尝试其他搜索方式...`);
        
        // 尝试只用队名（去掉城市）
        const homeTeamCore = homeTeamName.split(' ').pop() || '';
        const awayTeamCore = awayTeamName.split(' ').pop() || '';
        
        if (homeTeamCore && awayTeamCore) {
          const polyData2 = await polymarketService.searchNBAMarkets(homeTeamCore, awayTeamCore);
          
          if (polyData2) {
            console.log(`   ✅ 使用核心队名找到了！`);
            console.log(`      主队价格: $${polyData2.homePrice.toFixed(3)}`);
            console.log(`      客队价格: $${polyData2.awayPrice.toFixed(3)}`);
          } else {
            console.log(`   ❌ 使用核心队名也未找到`);
          }
        }
      }
      
      console.log('\n' + '-'.repeat(80));
    }
    
    console.log('\n\n====== 总结 ======\n');
    
    // 统计
    let foundCount = 0;
    for (const game of games) {
      const comp = game.competitions?.[0];
      const home = comp?.competitors?.find((c: any) => c.homeAway === 'home');
      const away = comp?.competitors?.find((c: any) => c.homeAway === 'away');
      
      const homeTeamName = home?.team?.displayName || '';
      const awayTeamName = away?.team?.displayName || '';
      
      const polyData = await polymarketService.searchNBAMarkets(homeTeamName, awayTeamName);
      if (polyData) foundCount++;
    }
    
    console.log(`ESPN 比赛总数: ${games.length}`);
    console.log(`找到 Polymarket 市场: ${foundCount} 场`);
    console.log(`未找到: ${games.length - foundCount} 场`);
    
    if (foundCount === 0) {
      console.log('\n⚠️ 提示：Polymarket 可能在常规赛期间没有创建比赛市场');
      console.log('   建议在季后赛期间（4-6月）重新测试');
    } else {
      console.log('\n✅ 成功找到市场，系统可以正常工作！');
    }
    
  } catch (error: any) {
    console.error('匹配失败:', error.message);
  } finally {
    await cache.disconnect();
    process.exit(0);
  }
}

matchTodayGames();
