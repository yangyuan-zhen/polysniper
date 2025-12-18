/**
 * 深度搜索：包括已关闭的，以及直接搜索 Markets
 */
import axios from 'axios';

const GAMMA_API = "https://gamma-api.polymarket.com";

async function deepSearch() {
  console.log("🔍 深度搜索 Pistons vs Celtics...\n");

  try {
    // 1. 搜索已关闭的 Events
    console.log("=== 1. 搜索 closed=true 的 Events ===");
    const res1 = await axios.get(`${GAMMA_API}/events`, {
      params: {
        limit: 50,
        closed: true, // 试试已关闭的
        tag_slug: 'nba' // 加个 tag 缩小范围
      }
    });
    
    const closedTarget = res1.data.filter((e: any) => {
      const title = (e.title || '').toLowerCase();
      return title.includes('pistons') && title.includes('celtics');
    });
    
    if (closedTarget.length > 0) {
      console.log(`找到了 ${closedTarget.length} 个已关闭的匹配 Event！`);
      console.log(`Title: ${closedTarget[0].title}`);
      console.log(`ID: ${closedTarget[0].id}`);
      console.log(`Date: ${closedTarget[0].startDate}`);
    } else {
      console.log("未找到匹配的已关闭 Event。\n");
    }

    // 2. 直接搜索 Markets (不通过 Events)
    console.log("=== 2. 直接搜索 Markets 端点 ===");
    // Gamma API 的 /markets 支持 text 搜索吗？通常不支持，只能遍历
    // 我们获取最近的 200 个 Markets
    const res2 = await axios.get(`${GAMMA_API}/markets`, {
      params: {
        limit: 200,
        closed: false // 活跃市场
      }
    });
    
    const targetMarkets = res2.data.filter((m: any) => {
      const q = (m.question || '').toLowerCase();
      return q.includes('pistons') && q.includes('celtics');
    });
    
    if (targetMarkets.length > 0) {
      console.log(`🎉 找到了 ${targetMarkets.length} 个匹配的 Market！`);
      targetMarkets.forEach((m: any) => {
        console.log(`Question: ${m.question}`);
        console.log(`ID: ${m.id}`);
        console.log(`Prices: ${m.outcomePrices}`);
      });
    } else {
      console.log("最近 200 个活跃 Market 中未找到。\n");
    }

  } catch (err: any) {
    console.error("搜索失败:", err.message);
  }
}

deepSearch();
