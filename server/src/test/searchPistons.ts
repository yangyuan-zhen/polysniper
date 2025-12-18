/**
 * 暴力搜索所有 Pistons 比赛
 */
import axios from 'axios';

const GAMMA_API = "https://gamma-api.polymarket.com";

async function searchPistons() {
  console.log("🔍 搜索所有包含 'Pistons' 的 Events...\n");

  try {
    let count = 0;
    
    // 扫描前 1000 个 Events
    for (let offset = 0; offset < 1000; offset += 100) {
      const res = await axios.get(`${GAMMA_API}/events`, {
        params: { limit: 100, offset: offset } // 不加其他过滤
      });
      
      const events = res.data;
      if (events.length === 0) break;
      
      const targets = events.filter((e: any) => 
        (e.title || '').toLowerCase().includes('pistons')
      );
      
      if (targets.length > 0) {
        targets.forEach((e: any) => {
          console.log(`标题: ${e.title}`);
          console.log(`ID: ${e.id}`);
          console.log(`Start: ${e.startDate}`);
          console.log(`Closed: ${e.closed}`);
          console.log(`Markets: ${e.markets?.length || 0}`);
          console.log('---');
        });
        count += targets.length;
      }
    }
    
    console.log(`\n总共找到 ${count} 个 Pistons 相关 Event`);

  } catch (err: any) {
    console.error("失败:", err.message);
  }
}

searchPistons();
