/**
 * 检查虎扑返回的比赛日期
 */

import { hupuService } from '../services/hupuService';
import { logger } from '../utils/logger';

async function checkHupuDates() {
  logger.info('========== 检查虎扑比赛日期 ==========\n');
  
  try {
    const games = await hupuService.getAllGames();
    logger.info(`虎扑返回 ${games.length} 场比赛\n`);
    
    // 按日期分组
    const gamesByDate: Record<string, any[]> = {};
    
    games.forEach((game: any) => {
      const startTime = game.chinaStartTime || game.beginTime;
      const date = new Date(startTime).toISOString().split('T')[0];
      
      if (!gamesByDate[date]) {
        gamesByDate[date] = [];
      }
      
      gamesByDate[date].push(game);
    });
    
    // 显示每天的比赛
    const dates = Object.keys(gamesByDate).sort();
    
    logger.info('按日期分组的比赛:\n');
    dates.forEach(date => {
      const games = gamesByDate[date];
      const activeGames = games.filter((g: any) => g.matchStatus !== 'COMPLETED');
      
      logger.info(`${date} (${games.length} 场比赛, ${activeGames.length} 场未结束):`);
      
      games.forEach((game: any) => {
        const status = game.matchStatus || 'UNKNOWN';
        const statusStr = game.matchStatusChinese || status;
        logger.info(`  ${game.homeTeamName} vs ${game.awayTeamName} [${statusStr}]`);
      });
      
      logger.info('');
    });
    
    // 今天的日期
    const today = new Date().toISOString().split('T')[0];
    logger.info(`今天是: ${today}`);
    logger.info(`今天的比赛数量: ${gamesByDate[today]?.length || 0}`);
    
  } catch (error: any) {
    logger.error('错误:', error.message);
  }
}

checkHupuDates().then(() => {
  logger.info('\n完成');
  process.exit(0);
}).catch(error => {
  logger.error('错误:', error);
  process.exit(1);
});
