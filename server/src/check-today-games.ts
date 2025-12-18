// 检查今天（12月16日）的 NBA 市场
import axios from 'axios';

const GAMMA_API = "https://gamma-api.polymarket.com";

async function checkTodayGames() {
  try {
    const res = await axios.get(`${GAMMA_API}/events`, {
      params: { series_id: '10345', closed: false, limit: 100 }
    });
    
    const events = res.data;
    console.log(`获取到 ${events.length} 个未关闭的 NBA events\n`);
    
    // 按日期分组
    const byDate = new Map<string, any[]>();
    
    events.forEach((e: any) => {
      const dateStr = e.startDate ? e.startDate.split('T')[0] : e.eventDate || 'unknown';
      if (!byDate.has(dateStr)) {
        byDate.set(dateStr, []);
      }
      byDate.get(dateStr)!.push(e);
    });
    
    // 排序并显示
    const sortedDates = Array.from(byDate.keys()).sort();
    
    console.log("=== 按日期分组 ===\n");
    sortedDates.forEach(date => {
      const dateEvents = byDate.get(date)!;
      console.log(`📅 ${date} (${dateEvents.length} 场比赛):`);
      dateEvents.forEach(e => {
        console.log(`  - ${e.title} (ID: ${e.id}, Closed: ${e.closed})`);
      });
      console.log('');
    });
    
    // 查找今天和明天的
    const today = '2025-12-16';
    const tomorrow = '2025-12-17';
    
    console.log(`\n=== 今天 (${today}) 的比赛 ===\n`);
    const todayEvents = byDate.get(today) || [];
    if (todayEvents.length > 0) {
      todayEvents.forEach(e => {
        console.log(`✅ ${e.title}`);
        console.log(`   Start: ${e.startDate}`);
        console.log(`   Markets: ${e.markets?.length || 0}`);
        
        // 检查是否包含 Pistons/Celtics
        if (e.title.toLowerCase().includes('pistons') || e.title.toLowerCase().includes('celtics')) {
          console.log(`   🎯 包含 Pistons/Celtics!`);
        }
      });
    } else {
      console.log(`❌ 没有今天的比赛市场`);
    }
    
    console.log(`\n=== 明天 (${tomorrow}) 的比赛 ===\n`);
    const tomorrowEvents = byDate.get(tomorrow) || [];
    if (tomorrowEvents.length > 0) {
      tomorrowEvents.forEach(e => {
        console.log(`${e.title}`);
      });
    }
    
    // 搜索包含 Pistons/Celtics 的所有市场
    console.log(`\n=== 包含 Pistons 或 Celtics 的市场 ===\n`);
    const relevantEvents = events.filter((e: any) => {
      const title = e.title.toLowerCase();
      return title.includes('pistons') || title.includes('celtics');
    });
    
    relevantEvents.forEach((e: any) => {
      const date = e.startDate ? e.startDate.split('T')[0] : e.eventDate;
      console.log(`${date}: ${e.title} (Closed: ${e.closed})`);
    });
    
  } catch (err: any) {
    console.error("失败:", err.message);
  }
}

checkTodayGames();
