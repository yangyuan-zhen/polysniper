/**
 * 专门查找今天（12月16日）的比赛
 */

import axios from 'axios';
import { logger } from '../utils/logger';

async function findTodayGames() {
  logger.info('========== 查找今天的NBA比赛 ==========\n');
  
  try {
    // 尝试不同的API参数
    const tests = [
      {
        name: '使用 active=true, closed=false',
        params: { series_id: '10345', active: true, closed: false, limit: 200 }
      },
      {
        name: '只使用 closed=false（不限制 active）',
        params: { series_id: '10345', closed: false, limit: 200 }
      },
      {
        name: '不限制任何状态',
        params: { series_id: '10345', limit: 200 }
      },
      {
        name: '不使用 series_id',
        params: { closed: false, limit: 200 }
      },
    ];
    
    for (const test of tests) {
      logger.info(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      logger.info(`测试: ${test.name}`);
      logger.info(`参数: ${JSON.stringify(test.params)}\n`);
      
      const response = await axios.get('https://gamma-api.polymarket.com/events', {
        params: test.params,
        timeout: 15000,
      });
      
      const allEvents = response.data || [];
      logger.info(`返回 ${allEvents.length} 个 events`);
      
      // 过滤今天的NBA比赛
      const today = '2025-12-16';
      const todayGames = allEvents.filter((e: any) => {
        const text = `${e.title} ${e.slug}`.toLowerCase();
        if (!text.includes('nba') && !text.includes('basketball')) return false;
        
        // 检查日期
        const startDate = e.startDate ? new Date(e.startDate) : null;
        const endDate = e.endDate ? new Date(e.endDate) : null;
        
        if (startDate) {
          const dateStr = startDate.toISOString().split('T')[0];
          if (dateStr === today) return true;
        }
        
        if (endDate) {
          const dateStr = endDate.toISOString().split('T')[0];
          // 今天的比赛通常在今天结束
          if (dateStr === today || dateStr === '2025-12-17') return true;
        }
        
        // 检查 slug 中的日期
        if (e.slug && e.slug.includes('2025-12-16')) return true;
        
        return false;
      });
      
      logger.info(`今天的NBA比赛: ${todayGames.length} 场\n`);
      
      if (todayGames.length > 0) {
        todayGames.forEach((e: any) => {
          logger.info(`  ✅ ${e.title}`);
          logger.info(`     Slug: ${e.slug}`);
          logger.info(`     Active: ${e.active}, Closed: ${e.closed}`);
          logger.info(`     Start: ${e.startDate}, End: ${e.endDate}`);
        });
      }
      
      // 延迟避免请求过快
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // 最后尝试直接搜索今天的比赛关键词
    logger.info(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    logger.info(`直接搜索今天的比赛关键词\n`);
    
    const searchTerms = ['Jazz Mavericks', 'Nuggets Rockets', 'Clippers Grizzlies'];
    
    for (const term of searchTerms) {
      logger.info(`\n搜索: ${term}`);
      
      const response = await axios.get('https://gamma-api.polymarket.com/events', {
        params: {
          _q: term,
          closed: false,
          limit: 50,
        },
        timeout: 15000,
      });
      
      const results = response.data || [];
      logger.info(`  找到 ${results.length} 个结果`);
      
      results.slice(0, 3).forEach((e: any) => {
        logger.info(`    - ${e.title} (${e.slug})`);
      });
      
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
  } catch (error: any) {
    logger.error('错误:', error.message);
    if (error.response) {
      logger.error('状态:', error.response.status);
    }
  }
}

findTodayGames().then(() => {
  logger.info('\n\n完成');
  process.exit(0);
}).catch(error => {
  logger.error('错误:', error);
  process.exit(1);
});
