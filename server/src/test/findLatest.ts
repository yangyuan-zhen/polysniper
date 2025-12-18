/**
 * 使用正确的排序查找最新的比赛
 */
import axios from 'axios';

const GAMMA_API = "https://gamma-api.polymarket.com";

async function findLatestGames() {
  console.log("🔍 按时间降序查找最新的 Pistons 比赛...\n");

  try {
    const res = await axios.get(`${GAMMA_API}/events`, {
      params: {
        limit: 50,
        order: '-startDate', // 尝试降序
        // tag_slug: 'nba' // 先不加 tag，怕漏
      }
    });
    
    console.log(`获取到 ${res.data.length} 个 Events`);
    
    // 看看第一条是什么时候的
    if (res.data.length > 0) {
      console.log(`最新 Event: ${res.data[0].title} (${res.data[0].startDate})`);
    }
    
    // 找 Pistons
    const targets = res.data.filter((e: any) => 
      (e.title || '').toLowerCase().includes('pistons')
    );
    
    console.log(`\n找到 ${targets.length} 个 Pistons 比赛：`);
    targets.forEach((e: any) => {
      console.log(`- ${e.title} (${e.startDate}) ID=${e.id}`);
    });

  } catch (err: any) {
    console.error("失败:", err.message);
  }
}

findLatestGames();
