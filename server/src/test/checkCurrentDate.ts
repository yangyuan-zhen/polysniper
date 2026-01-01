/**
 * 检查当前日期和 ESPN 数据
 */

import { espnService } from '../services/espnService';
import { cache } from '../utils/cache';

async function checkCurrentDate() {
  try {
    await cache.initialize();
    
    console.log('\n========== 检查当前日期和 ESPN 数据 ==========\n');
    
    // 1. 显示当前时间
    const now = new Date();
    console.log('🕐 服务器时间 (UTC):', now.toISOString());
    console.log('🕐 服务器时间 (本地):', now.toLocaleString());
    console.log('🕐 中国时间 (UTC+8):', now.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }));
    
    // 2. 计算中国时区的日期
    const getChinaDate = (daysOffset: number = 0): string => {
      const now = new Date();
      // 转换为中国时间（UTC+8）
      const chinaTime = new Date(now.getTime() + (8 * 60 * 60 * 1000));
      chinaTime.setUTCDate(chinaTime.getUTCDate() + daysOffset);
      const year = chinaTime.getUTCFullYear();
      const month = String(chinaTime.getUTCMonth() + 1).padStart(2, '0');
      const day = String(chinaTime.getUTCDate()).padStart(2, '0');
      return `${year}${month}${day}`;
    };
    
    console.log('\n📅 计算的查询日期:');
    const dates: string[] = [];
    for (let i = 0; i < 3; i++) {
      const date = getChinaDate(i);
      dates.push(date);
      const label = i === 0 ? '今天' : i === 1 ? '明天' : '后天';
      console.log(`  ${label}: ${date}`);
    }
    
    // 3. 查询 ESPN 数据
    console.log('\n🔍 查询 ESPN API...\n');
    
    for (const date of dates) {
      console.log(`\n查询日期: ${date}`);
      console.log('─'.repeat(60));
      
      try {
        const scoreboard = await espnService.getScoreboard(date);
        const events = scoreboard?.events || [];
        
        if (events.length === 0) {
          console.log(`❌ 没有找到比赛数据`);
        } else {
          console.log(`✅ 找到 ${events.length} 场比赛:\n`);
          
          events.forEach((game: any, index: number) => {
            const competition = game.competitions?.[0];
            const competitors = competition?.competitors || [];
            const home = competitors.find((c: any) => c.homeAway === 'home');
            const away = competitors.find((c: any) => c.homeAway === 'away');
            const status = game.status?.type?.state;
            const statusDesc = game.status?.type?.description;
            const gameDate = new Date(game.date).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
            
            console.log(`${index + 1}. ${home?.team?.displayName || 'N/A'} vs ${away?.team?.displayName || 'N/A'}`);
            console.log(`   游戏ID: ${game.id}`);
            console.log(`   状态: ${status} (${statusDesc})`);
            console.log(`   时间: ${gameDate}`);
            console.log(`   比分: ${home?.score || 0} - ${away?.score || 0}`);
            console.log('');
          });
        }
      } catch (error: any) {
        console.log(`❌ 查询失败: ${error.message}`);
      }
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('检查完成！');
    console.log('='.repeat(60));
    
  } catch (error: any) {
    console.error('测试失败:', error.message);
    console.error(error.stack);
  } finally {
    await cache.disconnect();
    process.exit(0);
  }
}

checkCurrentDate();
