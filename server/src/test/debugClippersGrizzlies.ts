/**
 * 调试为什么快船 vs 灰熊匹配不到
 */

import axios from 'axios';
import { logger } from '../utils/logger';

async function debugMatch() {
  logger.info('========== 调试快船 vs 灰熊 ==========\n');
  
  try {
    const response = await axios.get('https://gamma-api.polymarket.com/events', {
      params: {
        series_id: '10345',
        active: true,
        closed: false,
        limit: 100,
      },
      timeout: 10000,
    });
    
    const allEvents = response.data || [];
    logger.info(`获取到 ${allEvents.length} 个events\n`);
    
    // 查找包含 Clippers 或 Grizzlies 的
    const relevantEvents = allEvents.filter((e: any) => {
      const text = `${e.title} ${e.slug}`.toLowerCase();
      return (text.includes('clippers') || text.includes('grizzlies')) && 
             (text.includes('nba') || text.includes('basketball'));
    });
    
    logger.info(`找到 ${relevantEvents.length} 个包含 Clippers/Grizzlies 的events:\n`);
    
    const now = new Date();
    logger.info(`当前时间: ${now.toISOString()}\n`);
    
    relevantEvents.forEach((e: any) => {
      logger.info(`📋 ${e.title}`);
      logger.info(`   Slug: ${e.slug}`);
      logger.info(`   Active: ${e.active}, Closed: ${e.closed}`);
      logger.info(`   End Date: ${e.endDate}`);
      
      if (e.endDate) {
        const endTime = new Date(e.endDate);
        const isPast = endTime < now;
        logger.info(`   End Time: ${endTime.toISOString()} ${isPast ? '⏰已过期' : '✅未过期'}`);
      }
      
      // 检查是否同时包含两个队
      const text = `${e.title} ${e.slug}`.toLowerCase();
      const hasClippers = text.includes('clippers') || text.includes('lac');
      const hasGrizzlies = text.includes('grizzlies') || text.includes('mem');
      
      if (hasClippers && hasGrizzlies) {
        logger.info(`   🎯 同时包含 Clippers 和 Grizzlies！`);
      }
      
      logger.info('');
    });
    
  } catch (error: any) {
    logger.error('错误:', error.message);
  }
}

debugMatch().then(() => {
  logger.info('完成');
  process.exit(0);
}).catch(error => {
  logger.error('错误:', error);
  process.exit(1);
});
