// 调试：找到截图中的比赛（Pistons vs Celtics, 12月15-16日）
import axios from 'axios';

const GAMMA_API = "https://gamma-api.polymarket.com";

async function findCurrentGames() {
  console.log("🔍 查找当前的 NBA 比赛（12月15-16日）\n");

  try {
    // 测试1: 不用任何过滤，只看最新的
    console.log("=== 测试1: 获取最新的 events (无过滤) ===\n");
    const res1 = await axios.get(`${GAMMA_API}/events`, {
      params: { limit: 50 }
    });
    
    const recentEvents = res1.data.filter((e: any) => {
      const title = `${e.title} ${e.slug}`.toLowerCase();
      return title.includes('pistons') || 
             title.includes('celtics') || 
             title.includes('december') ||
             title.includes('12-15') ||
             title.includes('12-16');
    });
    
    console.log(`找到 ${recentEvents.length} 个可能相关的 events:\n`);
    recentEvents.forEach((e: any) => {
      console.log(`- ${e.title} (${e.slug})`);
      console.log(`  Closed: ${e.closed}, Start: ${e.startDate}`);
    });
    
    // 测试2: 尝试直接查询 markets 端点
    console.log("\n=== 测试2: 查询 /markets 端点 ===\n");
    const res2 = await axios.get(`${GAMMA_API}/markets`, {
      params: { limit: 50, closed: false }
    });
    
    const nbaMarkets = res2.data.filter((m: any) => {
      const text = `${m.question} ${m.slug}`.toLowerCase();
      return (text.includes('nba') || text.includes('pistons') || text.includes('celtics')) &&
             !text.includes('series');
    });
    
    console.log(`找到 ${nbaMarkets.length} 个 NBA markets:\n`);
    nbaMarkets.slice(0, 10).forEach((m: any) => {
      console.log(`- ${m.question}`);
      console.log(`  Closed: ${m.closed}`);
      if (m.outcomes) {
        console.log(`  Outcomes: ${m.outcomes}`);
      }
      if (m.outcomePrices) {
        console.log(`  Prices: ${m.outcomePrices}`);
      }
    });
    
    // 测试3: 尝试搜索特定日期
    console.log("\n=== 测试3: 搜索包含日期的 markets ===\n");
    const dateMarkets = res2.data.filter((m: any) => {
      const text = m.question?.toLowerCase() || '';
      return text.includes('2024-12-1') || 
             text.includes('december 1') ||
             text.includes('12/1');
    });
    
    console.log(`找到 ${dateMarkets.length} 个包含12月日期的 markets\n`);
    dateMarkets.slice(0, 5).forEach((m: any) => {
      console.log(`- ${m.question}`);
    });
    
    // 测试4: 检查 tag_slug 可用值
    console.log("\n=== 测试4: 尝试不同的查询方式 ===\n");
    
    const testParams = [
      { name: "无参数", params: { limit: 20 } },
      { name: "tag_slug=nba", params: { limit: 20, tag_slug: 'nba' } },
      { name: "tag_slug=sports", params: { limit: 20, tag_slug: 'sports' } },
      { name: "closed=false", params: { limit: 20, closed: false } },
      { name: "active=true", params: { limit: 20, active: true } },
      { name: "closed=false + tag_slug=nba", params: { limit: 20, closed: false, tag_slug: 'nba' } },
    ];
    
    for (const test of testParams) {
      try {
        const res = await axios.get(`${GAMMA_API}/events`, { params: test.params });
        const nbaCount = res.data.filter((e: any) => {
          const text = `${e.title} ${e.description}`.toLowerCase();
          return text.includes('pistons') || text.includes('celtics');
        }).length;
        
        console.log(`${test.name}: ${res.data.length} events, ${nbaCount} 个包含 Pistons/Celtics`);
      } catch (err) {
        console.log(`${test.name}: 失败`);
      }
    }
    
    // 测试5: 搜索 Pistons vs Celtics
    console.log("\n=== 测试5: 精确搜索 Pistons vs Celtics ===\n");
    
    const allMarkets = await axios.get(`${GAMMA_API}/markets`, {
      params: { limit: 200, closed: false }
    });
    
    const pistonsMarkets = allMarkets.data.filter((m: any) => {
      const text = `${m.question} ${m.description}`.toLowerCase();
      return text.includes('pistons') && text.includes('celtics');
    });
    
    console.log(`找到 ${pistonsMarkets.length} 个 Pistons vs Celtics 市场:\n`);
    pistonsMarkets.forEach((m: any) => {
      console.log(`✅ ${m.question}`);
      console.log(`   ID: ${m.conditionId || m.id}`);
      console.log(`   Outcomes: ${m.outcomes}`);
      console.log(`   Prices: ${m.outcomePrices}`);
      console.log(`   Closed: ${m.closed}`);
      console.log(`   Active: ${m.active}`);
      console.log('');
    });
    
  } catch (err: any) {
    console.error("❌ 失败:", err.message);
  }
}

findCurrentGames();
