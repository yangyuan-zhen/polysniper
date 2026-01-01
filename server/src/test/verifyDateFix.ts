/**
 * 验证日期修复效果
 */

import { espnService } from '../services/espnService';
import { cache } from '../utils/cache';

async function verifyDateFix() {
  try {
    await cache.initialize();
    
    console.log('\n========== 验证 ESPN 日期修复 ==========\n');
    
    // 当前中国时间
    const now = new Date();
    const chinaTime = new Date(now.getTime() + (8 * 60 * 60 * 1000));
    console.log('🕐 中国时间:', chinaTime.toISOString().replace('T', ' ').substring(0, 19));
    
    // 新的日期计算逻辑
    const getESPNDate = (daysOffset: number = 0): string => {
      const now = new Date();
      const chinaTime = new Date(now.getTime() + (8 * 60 * 60 * 1000));
      // 提前一天查询
      chinaTime.setUTCDate(chinaTime.getUTCDate() + daysOffset - 1);
      const year = chinaTime.getUTCFullYear();
      const month = String(chinaTime.getUTCMonth() + 1).padStart(2, '0');
      const day = String(chinaTime.getUTCDate()).padStart(2, '0');
      return `${year}${month}${day}`;
    };
    
    console.log('\n📅 查询日期范围:');
    const dates: string[] = [];
    for (let i = 0; i < 4; i++) {
      const date = getESPNDate(i);
      dates.push(date);
      const label = i === 0 ? '昨天' : i === 1 ? '今天' : i === 2 ? '明天' : '后天';
      console.log(`  ESPN ${date} (中国${label}的比赛)`);
    }
    
    // 查询所有比赛并按中国日期分组
    console.log('\n🔍 获取并分组比赛...\n');
    
    const allGames: any[] = [];
    for (const date of dates) {
      const scoreboard = await espnService.getScoreboard(date);
      if (scoreboard?.events) {
        allGames.push(...scoreboard.events);
      }
    }
    
    console.log(`✅ 总共获取 ${allGames.length} 场比赛\n`);
    
    // 按中国日期分组
    const groupedByDate = new Map<string, any[]>();
    
    allGames.forEach(game => {
      const gameTime = new Date(game.date);
      const chinaGameTime = new Date(gameTime.getTime() + (8 * 60 * 60 * 1000));
      const dateKey = chinaGameTime.toISOString().split('T')[0];
      
      if (!groupedByDate.has(dateKey)) {
        groupedByDate.set(dateKey, []);
      }
      groupedByDate.get(dateKey)!.push(game);
    });
    
    // 按日期排序并显示
    const sortedDates = Array.from(groupedByDate.keys()).sort();
    
    sortedDates.forEach((dateKey, index) => {
      const games = groupedByDate.get(dateKey)!;
      const [year, month, day] = dateKey.split('-');
      
      // 计算相对日期
      const todayStr = new Date(now.getTime() + (8 * 60 * 60 * 1000))
        .toISOString().split('T')[0];
      let label = '';
      if (dateKey === todayStr) {
        label = '今天';
      } else if (dateKey === getTomorrow(todayStr)) {
        label = '明天';
      } else if (dateKey === getDayAfter(todayStr, 2)) {
        label = '后天';
      } else {
        label = dateKey;
      }
      
      console.log(`\n📅 ${label} (${dateKey}) - ${games.length} 场比赛`);
      console.log('─'.repeat(60));
      
      games.forEach((game, i) => {
        const competition = game.competitions?.[0];
        const competitors = competition?.competitors || [];
        const home = competitors.find((c: any) => c.homeAway === 'home');
        const away = competitors.find((c: any) => c.homeAway === 'away');
        const status = game.status?.type?.state;
        const gameTime = new Date(game.date);
        const chinaGameTime = gameTime.toLocaleString('zh-CN', { 
          timeZone: 'Asia/Shanghai',
          hour: '2-digit',
          minute: '2-digit'
        });
        
        console.log(`${i + 1}. ${home?.team?.displayName || 'N/A'} vs ${away?.team?.displayName || 'N/A'}`);
        console.log(`   时间: ${chinaGameTime} | 状态: ${status}`);
      });
    });
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ 验证完成！现在应该能看到中国26号的比赛了');
    console.log('='.repeat(60));
    
  } catch (error: any) {
    console.error('测试失败:', error.message);
    console.error(error.stack);
  } finally {
    await cache.disconnect();
    process.exit(0);
  }
}

function getTomorrow(dateStr: string): string {
  const date = new Date(dateStr);
  date.setDate(date.getDate() + 1);
  return date.toISOString().split('T')[0];
}

function getDayAfter(dateStr: string, days: number): string {
  const date = new Date(dateStr);
  date.setDate(date.getDate() + days);
  return date.toISOString().split('T')[0];
}

verifyDateFix();
