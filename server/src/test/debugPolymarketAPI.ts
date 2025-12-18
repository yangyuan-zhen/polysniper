/**
 * 调试 Polymarket API 响应
 * 看看实际返回了什么数据
 */

import axios from 'axios';
import { logger } from '../utils/logger';
import { findTeamByChinese } from '../config/nbaTeamMap';

async function debugPolymarketAPI() {
  logger.info('========== 调试 Polymarket API ==========\n');
  
  try {
    // 1. 获取所有 NBA events
    logger.info('[Step 1] 获取 Polymarket NBA events...');
    const response = await axios.get('https://gamma-api.polymarket.com/events', {
      params: {
        series_id: '10345',
        limit: 100,
        offset: 0,
        closed: false,
        active: true,
      },
      timeout: 10000,
    });
    
    const allEvents = response.data || [];
    logger.info(`返回 ${allEvents.length} 个 events\n`);
    
    // 2. 过滤 NBA 相关的
    const now = new Date();
    const nbaEvents = allEvents.filter((e: any) => {
      if (e.closed === true) return false;
      if (e.active === false) return false;
      
      const text = `${e.title} ${e.slug} ${e.category}`.toLowerCase();
      if (!text.includes('nba') && !text.includes('basketball')) return false;
      
      const endDate = e.endDate || e.startDate;
      if (endDate && new Date(endDate) < now) return false;
      
      return true;
    });
    
    logger.info(`过滤后剩余 ${nbaEvents.length} 个 NBA events\n`);
    
    // 3. 显示所有比赛的标题
    logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    logger.info('所有 NBA 比赛列表:');
    logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    nbaEvents.forEach((event: any, index: number) => {
      logger.info(`${index + 1}. ${event.title}`);
      logger.info(`   Slug: ${event.slug}`);
      logger.info(`   Active: ${event.active}, Closed: ${event.closed}`);
      logger.info(`   End Date: ${event.endDate || event.startDate}`);
      
      // 显示市场信息
      const markets = event.markets || [];
      if (markets.length > 0) {
        logger.info(`   Markets (${markets.length}):`);
        markets.forEach((m: any) => {
          const question = m.question || m.groupItemTitle || 'N/A';
          logger.info(`     - ${question}`);
        });
      }
      logger.info('');
    });
    
    // 4. 测试几场虎扑比赛的匹配
    logger.info('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    logger.info('测试虎扑比赛匹配:');
    logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    const testMatches = [
      { home: '爵士', away: '独行侠' },
      { home: '掘金', away: '火箭' },
      { home: '快船', away: '灰熊' },
    ];
    
    for (const match of testMatches) {
      logger.info(`\n测试: ${match.home} vs ${match.away}`);
      
      const homeMapping = findTeamByChinese(match.home);
      const awayMapping = findTeamByChinese(match.away);
      
      if (!homeMapping || !awayMapping) {
        logger.warn(`  ❌ 映射失败`);
        continue;
      }
      
      logger.info(`  映射: ${homeMapping.polymarketName} vs ${awayMapping.polymarketName}`);
      
      // 尝试匹配
      const matchedEvent = nbaEvents.find((e: any) => {
        const title = e.title.toLowerCase();
        const slug = e.slug.toLowerCase();
        
        const homeKeywords = [homeMapping.polymarketName, homeMapping.abbr].map(k => k.toLowerCase());
        const awayKeywords = [awayMapping.polymarketName, awayMapping.abbr].map(k => k.toLowerCase());
        
        const matchedHome = homeKeywords.some(kw => title.includes(kw) || slug.includes(kw));
        const matchedAway = awayKeywords.some(kw => title.includes(kw) || slug.includes(kw));
        
        return matchedHome && matchedAway;
      });
      
      if (matchedEvent) {
        logger.info(`  ✅ 找到: ${matchedEvent.title}`);
      } else {
        logger.warn(`  ❌ 未找到匹配`);
        
        // 看看是否包含任意一个关键词
        const homeKeywords = [homeMapping.polymarketName, homeMapping.abbr].map(k => k.toLowerCase());
        const awayKeywords = [awayMapping.polymarketName, awayMapping.abbr].map(k => k.toLowerCase());
        
        logger.info(`  关键词: ${JSON.stringify(homeKeywords)} vs ${JSON.stringify(awayKeywords)}`);
        
        const partialMatches = nbaEvents.filter((e: any) => {
          const title = e.title.toLowerCase();
          const slug = e.slug.toLowerCase();
          
          const hasHome = homeKeywords.some(kw => title.includes(kw) || slug.includes(kw));
          const hasAway = awayKeywords.some(kw => title.includes(kw) || slug.includes(kw));
          
          return hasHome || hasAway;
        });
        
        if (partialMatches.length > 0) {
          logger.info(`  部分匹配 (${partialMatches.length} 个):`);
          partialMatches.forEach((e: any) => {
            logger.info(`    - ${e.title}`);
          });
        }
      }
    }
    
  } catch (error: any) {
    logger.error('调试失败:', error.message);
    if (error.response) {
      logger.error('响应状态:', error.response.status);
      logger.error('响应数据:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

debugPolymarketAPI().then(() => {
  logger.info('\n调试完成');
  process.exit(0);
}).catch(error => {
  logger.error('错误:', error);
  process.exit(1);
});
