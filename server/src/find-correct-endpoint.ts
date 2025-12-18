// 找到正确的端点：网页前端用的是什么？
import axios from 'axios';

async function findCorrectEndpoint() {
  console.log("🔍 查找网页前端使用的 API 端点\n");

  const GAMMA_API = "https://gamma-api.polymarket.com";
  
  try {
    // 根据截图，网页显示的是 "Games" 标签下的比赛
    // 尝试直接查询 events，但用更灵活的参数
    
    console.log("=== 尝试1: /events 不带任何过滤 ===\n");
    const res1 = await axios.get(`${GAMMA_API}/events`, {
      params: { limit: 100 }
    });
    
    console.log(`获取 ${res1.data.length} 个 events`);
    
    // 按 startDate 排序，找最新的
    const sorted = res1.data.sort((a: any, b: any) => {
      const dateA = new Date(a.startDate || a.creationDate || 0);
      const dateB = new Date(b.startDate || b.creationDate || 0);
      return dateB.getTime() - dateA.getTime();
    });
    
    console.log("\n最新10个 events:");
    sorted.slice(0, 10).forEach((e: any, idx: number) => {
      const startDate = e.startDate ? new Date(e.startDate).toISOString().split('T')[0] : 'N/A';
      console.log(`${idx + 1}. ${e.title} (${startDate})`);
    });
    
    // 尝试2: 查询特定 series
    console.log("\n\n=== 尝试2: 查询 NBA series (ID=10345) ===\n");
    try {
      const res2 = await axios.get(`${GAMMA_API}/events`, {
        params: { series_id: '10345', limit: 50 }
      });
      console.log(`✅ series_id 参数有效！获取 ${res2.data.length} 个 events`);
      
      res2.data.slice(0, 5).forEach((e: any) => {
        console.log(`- ${e.title} (Closed: ${e.closed})`);
      });
    } catch (err) {
      console.log(`❌ series_id 参数无效`);
    }
    
    // 尝试3: 直接查询 series
    console.log("\n\n=== 尝试3: /series/10345 ===\n");
    try {
      const res3 = await axios.get(`${GAMMA_API}/series/10345`);
      console.log(`✅ 成功！`);
      console.log(JSON.stringify(res3.data, null, 2).substring(0, 500));
    } catch (err: any) {
      console.log(`❌ 失败: ${err.message}`);
    }
    
    // 尝试4: 查看是否有 next_active 参数
    console.log("\n\n=== 尝试4: 不同的排序和过滤 ===\n");
    
    const testParams = [
      { name: "order=-start_date", params: { limit: 20, order: '-start_date' } },
      { name: "order=-created_at", params: { limit: 20, order: '-created_at' } },
      { name: "next_active=true", params: { limit: 20, next_active: true } },
      { name: "upcoming=true", params: { limit: 20, upcoming: true } },
      { name: "live=true", params: { limit: 20, live: true } },
    ];
    
    for (const test of testParams) {
      try {
        const res = await axios.get(`${GAMMA_API}/events`, { params: test.params });
        console.log(`${test.name}: ✅ ${res.data.length} events`);
        
        const nba = res.data.filter((e: any) => {
          const text = `${e.title} ${e.slug}`.toLowerCase();
          return text.includes('nba') || text.includes('pistons') || text.includes('celtics');
        });
        
        if (nba.length > 0) {
          console.log(`  🎯 包含 ${nba.length} 个 NBA events！`);
          nba.slice(0, 3).forEach((e: any) => {
            const date = e.startDate ? new Date(e.startDate).toISOString().split('T')[0] : 'N/A';
            console.log(`    - ${e.title} (${date}, Closed: ${e.closed})`);
          });
        }
      } catch (err) {
        console.log(`${test.name}: ❌`);
      }
    }
    
  } catch (err: any) {
    console.error("❌ 失败:", err.message);
  }
}

findCorrectEndpoint();
