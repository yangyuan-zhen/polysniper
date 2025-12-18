// 查找所有 NBA series，特别是当前活跃的
import axios from 'axios';

const GAMMA_API = "https://gamma-api.polymarket.com";

async function findActiveSeries() {
  console.log("🔍 查找所有 NBA series\n");

  try {
    // 1. 获取所有 series
    const seriesRes = await axios.get(`${GAMMA_API}/series`);
    const allSeries = seriesRes.data;
    
    console.log(`获取到 ${allSeries.length} 个 series\n`);
    
    // 2. 筛选 NBA 相关的
    const nbaSeries = allSeries.filter((s: any) => {
      const text = `${s.title} ${s.slug} ${s.ticker}`.toLowerCase();
      return text.includes('nba') || text.includes('basketball');
    });
    
    console.log(`找到 ${nbaSeries.length} 个 NBA series:\n`);
    
    nbaSeries.forEach((s: any) => {
      console.log(`ID: ${s.id}`);
      console.log(`Title: ${s.title}`);
      console.log(`Slug: ${s.slug}`);
      console.log(`Active: ${s.active}`);
      console.log(`Closed: ${s.closed}`);
      console.log(`Created: ${s.createdAt}`);
      console.log(`Start Date: ${s.startDate || 'N/A'}`);
      console.log('---');
    });
    
    // 3. 对每个活跃的 NBA series，查询其 events
    const activeSeries = nbaSeries.filter((s: any) => s.active && !s.closed);
    
    console.log(`\n\n=== 活跃的 NBA series: ${activeSeries.length} 个 ===\n`);
    
    for (const series of activeSeries) {
      console.log(`\n查询 Series: ${series.title} (ID=${series.id})`);
      
      try {
        const eventsRes = await axios.get(`${GAMMA_API}/events`, {
          params: { series_id: series.id, limit: 50 }
        });
        
        const events = eventsRes.data;
        console.log(`  包含 ${events.length} 个 events`);
        
        // 找出未关闭的
        const openEvents = events.filter((e: any) => !e.closed);
        console.log(`  其中未关闭: ${openEvents.length} 个`);
        
        if (openEvents.length > 0) {
          console.log(`  \n  未关闭的 events:`);
          openEvents.slice(0, 5).forEach((e: any) => {
            const date = e.startDate ? new Date(e.startDate).toISOString().split('T')[0] : 'N/A';
            console.log(`    - ${e.title} (${date})`);
            
            // 检查是否包含 markets
            if (e.markets && e.markets.length > 0) {
              console.log(`      Markets: ${e.markets.length} 个`);
              e.markets.slice(0, 2).forEach((m: any) => {
                console.log(`        * ${m.question || m.groupItemTitle}`);
              });
            }
          });
        }
        
        // 查找包含 Pistons/Celtics 的
        const targetEvents = events.filter((e: any) => {
          const text = `${e.title} ${e.description}`.toLowerCase();
          return text.includes('pistons') || text.includes('celtics');
        });
        
        if (targetEvents.length > 0) {
          console.log(`\n  🎯 包含 Pistons/Celtics 的 events: ${targetEvents.length} 个`);
          targetEvents.forEach((e: any) => {
            console.log(`    - ${e.title} (Closed: ${e.closed})`);
          });
        }
        
      } catch (err: any) {
        console.log(`  ❌ 查询失败: ${err.message}`);
      }
    }
    
  } catch (err: any) {
    console.error("❌ 失败:", err.message);
  }
}

findActiveSeries();
