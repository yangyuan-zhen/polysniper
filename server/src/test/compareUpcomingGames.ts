/**
 * 对比虎扑和 Polymarket 的未开始比赛数量
 */

import { hupuService } from '../services/hupuService';
import { polymarketService } from '../services/polymarketService';
import { logger } from '../utils/logger';
import axios from 'axios';

async function analyzeUpcomingGames() {
  console.log('========================================');
  console.log('    虎扑 vs Polymarket 未开始比赛对比');
  console.log('========================================\n');

  // ========== 1. 虎扑数据分析 ==========
  console.log('📊 分析虎扑数据...\n');
  
  const hupuGames = await hupuService.getAllGames();
  console.log(`✅ 虎扑总比赛数: ${hupuGames.length} 场\n`);

  // 按状态分类
  const notStarted = hupuGames.filter((g: any) => g.matchStatus === 'NOTSTARTED');
  const live = hupuGames.filter((g: any) => g.matchStatus === 'LIVE');
  const completed = hupuGames.filter((g: any) => g.matchStatus === 'COMPLETED');

  console.log('📋 比赛状态统计:');
  console.log(`   未开始 (NOTSTARTED): ${notStarted.length} 场`);
  console.log(`   进行中 (LIVE):       ${live.length} 场`);
  console.log(`   已结束 (COMPLETED):  ${completed.length} 场`);

  console.log('\n🏀 未开始的比赛列表:');
  notStarted.forEach((g: any, index: number) => {
    const startTime = new Date(g.chinaStartTime || g.beginTime * 1000).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
    console.log(`   ${index + 1}. ${g.homeTeamName} vs ${g.awayTeamName}`);
    console.log(`      开始时间: ${startTime}`);
  });

  // ========== 2. Polymarket 数据分析 ==========
  console.log('\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('📊 分析 Polymarket 数据...\n');

  // 直接调用 Polymarket API
  const response = await axios.get('https://gamma-api.polymarket.com/events', {
    params: {
      series_id: '10345',  // NBA
      active: true,
      closed: false,
      limit: 100,
      offset: 0,
    },
    timeout: 10000,
  });

  const allEvents = response.data || [];
  console.log(`✅ Polymarket 总事件数: ${allEvents.length} 个\n`);

  // 筛选 NBA 相关
  const nbaEvents = allEvents.filter((e: any) => {
    if (e.closed === true) return false;
    if (e.active === false) return false;
    
    const text = `${e.title} ${e.slug} ${e.category}`.toLowerCase();
    return text.includes('nba') || text.includes('basketball');
  });

  console.log(`✅ NBA 相关事件: ${nbaEvents.length} 个\n`);

  // 按时间分类
  const now = new Date().getTime();
  const upcoming = nbaEvents.filter((e: any) => {
    const endDate = new Date(e.endDate || e.startDate).getTime();
    return endDate > now;
  });

  const past = nbaEvents.filter((e: any) => {
    const endDate = new Date(e.endDate || e.startDate).getTime();
    return endDate <= now;
  });

  console.log('📋 Polymarket 市场状态:');
  console.log(`   未来市场 (endDate > now):   ${upcoming.length} 个`);
  console.log(`   过去市场 (endDate <= now):  ${past.length} 个`);

  console.log('\n🎯 Polymarket 市场列表（前20个）:');
  nbaEvents.slice(0, 20).forEach((e: any, index: number) => {
    const endDate = new Date(e.endDate || e.startDate).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
    const status = new Date(e.endDate || e.startDate).getTime() > now ? '未来' : '过去';
    console.log(`   ${index + 1}. ${e.title}`);
    console.log(`      结束时间: ${endDate} (${status})`);
    console.log(`      active: ${e.active}, closed: ${e.closed}`);
  });

  // ========== 3. 对比分析 ==========
  console.log('\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('========================================');
  console.log('           对比分析');
  console.log('========================================\n');

  console.log('📊 数据对比:');
  console.log(`   虎扑未开始比赛:      ${notStarted.length} 场`);
  console.log(`   Polymarket 总市场:   ${nbaEvents.length} 个`);
  console.log(`   Polymarket 未来市场: ${upcoming.length} 个`);
  console.log(`   差距:                ${notStarted.length - upcoming.length} 场`);

  console.log('\n💡 分析结果:');
  if (notStarted.length > upcoming.length) {
    console.log(`   ⚠️ 虎扑比赛多于 Polymarket 市场`);
    console.log(`   可能原因:`);
    console.log(`   1. Polymarket 没有为所有比赛开盘`);
    console.log(`   2. Polymarket 只为重要比赛开盘`);
    console.log(`   3. 部分比赛市场已关闭`);
  } else if (notStarted.length < upcoming.length) {
    console.log(`   ⚠️ Polymarket 市场多于虎扑比赛`);
    console.log(`   可能原因:`);
    console.log(`   1. Polymarket 包含了其他日期的比赛`);
    console.log(`   2. 虎扑只显示特定日期范围的比赛`);
  } else {
    console.log(`   ✅ 数量匹配！`);
  }

  // ========== 4. 尝试匹配 ==========
  console.log('\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔍 尝试匹配前5场虎扑未开始的比赛...\n');

  for (let i = 0; i < Math.min(5, notStarted.length); i++) {
    const game = notStarted[i];
    const homeTeam = game.homeTeamName;
    const awayTeam = game.awayTeamName;

    console.log(`\n${i + 1}. ${homeTeam} vs ${awayTeam}`);
    
    try {
      const polyData = await polymarketService.searchNBAMarkets(homeTeam, awayTeam);
      if (polyData) {
        console.log(`   ✅ 找到匹配: 主队价格 ${polyData.homePrice}, 客队价格 ${polyData.awayPrice}`);
      } else {
        console.log(`   ❌ 未找到匹配`);
        
        // 显示可能的匹配
        const homeTeamEn = getEnglishTeamName(homeTeam);
        const awayTeamEn = getEnglishTeamName(awayTeam);
        
        console.log(`   可能的关键词: ${homeTeamEn}, ${awayTeamEn}`);
        
        const possibleMatches = nbaEvents.filter((e: any) => {
          const title = e.title.toLowerCase();
          return title.includes(homeTeamEn.toLowerCase()) || 
                 title.includes(awayTeamEn.toLowerCase());
        });
        
        if (possibleMatches.length > 0) {
          console.log(`   部分匹配的市场:`);
          possibleMatches.slice(0, 3).forEach((e: any) => {
            console.log(`     - ${e.title}`);
          });
        }
      }
    } catch (error: any) {
      console.log(`   ❌ 错误: ${error.message}`);
    }
  }

  console.log('\n\n========================================');
  console.log('✅ 分析完成');
  console.log('========================================\n');
}

// 辅助函数：获取英文队名
function getEnglishTeamName(chineseName: string): string {
  const mapping: Record<string, string> = {
    '湖人': 'Lakers',
    '勇士': 'Warriors',
    '快船': 'Clippers',
    '火箭': 'Rockets',
    '雷霆': 'Thunder',
    '马刺': 'Spurs',
    '掘金': 'Nuggets',
    '独行侠': 'Mavericks',
    '森林狼': 'Timberwolves',
    '尼克斯': 'Knicks',
    '篮网': 'Nets',
    '凯尔特人': 'Celtics',
    '76人': '76ers',
    '猛龙': 'Raptors',
    '公牛': 'Bulls',
    '骑士': 'Cavaliers',
    '活塞': 'Pistons',
    '步行者': 'Pacers',
    '雄鹿': 'Bucks',
    '老鹰': 'Hawks',
    '黄蜂': 'Hornets',
    '热火': 'Heat',
    '魔术': 'Magic',
    '奇才': 'Wizards',
    '太阳': 'Suns',
    '国王': 'Kings',
    '开拓者': 'Blazers',
    '爵士': 'Jazz',
    '灰熊': 'Grizzlies',
    '鹈鹕': 'Pelicans',
  };
  
  return mapping[chineseName] || chineseName;
}

analyzeUpcomingGames().then(() => {
  console.log('测试完成');
  process.exit(0);
}).catch(error => {
  console.error('测试失败:', error);
  process.exit(1);
});
