/**
 * 全网搜索 Pistons vs Celtics 比赛
 * 不限制 Series ID，查看它到底属于哪个 Series，或者有什么特征
 */

import axios from 'axios';

const GAMMA_API = "https://gamma-api.polymarket.com";

async function findTheGame() {
  console.log("🔍 全网搜索 'Pistons' 和 'Celtics' 的比赛...\n");

  try {
    let allEvents: any[] = [];
    let found = false;
    
    // 分页获取所有活跃 Event
    // 既然是正在进行的比赛，应该是活跃的 (active=true) 且未关闭 (closed=false)
    for (let offset = 0; offset <= 500; offset += 100) {
      console.log(`正在扫描 offset ${offset}...`);
      
      const res = await axios.get(`${GAMMA_API}/events`, {
        params: {
          limit: 100,
          offset: offset,
          closed: false, // 只要未关闭的
          active: true   // 只要活跃的
        }
      });
      
      const events = res.data;
      if (events.length === 0) break;
      
      // 检查这一页有没有目标比赛
      const target = events.filter((e: any) => {
        const title = (e.title || '').toLowerCase();
        return title.includes('pistons') && title.includes('celtics');
      });
      
      if (target.length > 0) {
        console.log(`\n🎉 找到了 ${target.length} 个匹配的 Event！\n`);
        target.forEach((e: any) => {
          console.log(`标题: ${e.title}`);
          console.log(`ID: ${e.id}`);
          console.log(`Series ID: ${e.series ? e.series.map((s: any) => s.id).join(', ') : 'None'}`);
          console.log(`Start Date: ${e.startDate}`);
          console.log(`Slug: ${e.slug}`);
          
          if (e.markets && e.markets.length > 0) {
            console.log(`Markets (${e.markets.length}个):`);
            e.markets.forEach((m: any) => {
              console.log(`  - ${m.question}`);
              console.log(`    Outcomes: ${m.outcomes}`);
              console.log(`    Prices: ${m.outcomePrices}`);
            });
          }
          console.log('-----------------------------------');
        });
        found = true;
      }
      
      allEvents = allEvents.concat(events);
    }
    
    if (!found) {
      console.log("\n❌ 扫描了所有活跃 Event 仍未找到。尝试放宽条件（包括已关闭的）...");
      // ... 代码省略，先看活跃的能不能找到
    }

  } catch (err: any) {
    console.error("❌ 搜索失败:", err.message);
  }
}

findTheGame();
