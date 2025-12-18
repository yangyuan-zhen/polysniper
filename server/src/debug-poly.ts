// src/debug-poly.ts
import axios from 'axios';

const GAMMA_API = "https://gamma-api.polymarket.com/events";

async function checkRawMarkets() {
  console.log("🔍 正在扫描 Polymarket NBA 市场...\n");

  try {
    // 1. 宽泛搜索：只用 tag_slug=nba，不要加 active/closed 等严格过滤
    console.log("测试 1: 使用 tag_slug=nba, active=true");
    const res = await axios.get(GAMMA_API, {
      params: {
        limit: 20,
        tag_slug: 'nba', // 关键：确保这里是用 tag_slug
        active: true     // 只看活跃的
      }
    });

    const events = res.data;

    if (events.length === 0) {
      console.log("❌ 未找到任何 NBA Event。可能原因：");
      console.log("   1. 休赛期或今天没比赛");
      console.log("   2. API 变了 (tag 不叫 nba?)");
      
      // 尝试其他参数
      console.log("\n测试 2: 尝试 tag_slug=basketball");
      const res2 = await axios.get(GAMMA_API, {
        params: { limit: 20, tag_slug: 'basketball', active: true }
      });
      
      if (res2.data.length > 0) {
        console.log(`✅ 找到 ${res2.data.length} 个 basketball events`);
        res2.data.slice(0, 3).forEach((e: any) => {
          console.log(`  - ${e.title}`);
        });
      }
      
      console.log("\n测试 3: 不用 tag_slug，只看最近的 events");
      const res3 = await axios.get(GAMMA_API, {
        params: { limit: 20, active: true }
      });
      
      console.log(`找到 ${res3.data.length} 个活跃 events`);
      const nbaEvents = res3.data.filter((e: any) => 
        e.title.toLowerCase().includes('nba') || 
        e.title.toLowerCase().includes('lakers') ||
        e.title.toLowerCase().includes('celtics')
      );
      console.log(`其中 NBA 相关: ${nbaEvents.length} 个\n`);
      
      return;
    }

    console.log(`✅ 找到了 ${events.length} 个 NBA Event，请检查命名规则：\n`);

    events.forEach((evt: any) => {
      console.log("------------------------------------------------");
      console.log(`标题 (Title): ${evt.title}`);
      console.log(`ID: ${evt.id}`);
      console.log(`Slug: ${evt.slug}`);
      console.log(`Active: ${evt.active}`);
      console.log(`Closed: ${evt.closed}`);
      console.log(`Start Date: ${evt.startDate}`);
      console.log(`End Date: ${evt.endDate}`);
      
      // 看看里面的 Markets 长什么样
      if (evt.markets && evt.markets.length > 0) {
        console.log(`\nMarkets 数量: ${evt.markets.length}`);
        
        evt.markets.forEach((m: any, idx: number) => {
          console.log(`\n  Market ${idx + 1}:`);
          console.log(`    Question: ${m.question}`);
          
          // 解析 outcomes（可能是 JSON 字符串）
          let outcomes;
          try {
            outcomes = typeof m.outcomes === 'string' ? JSON.parse(m.outcomes) : m.outcomes;
          } catch {
            outcomes = m.outcomes;
          }
          console.log(`    Outcomes: ${JSON.stringify(outcomes)}`);
          
          // 解析 outcomePrices
          let prices;
          try {
            prices = typeof m.outcomePrices === 'string' ? JSON.parse(m.outcomePrices) : m.outcomePrices;
          } catch {
            prices = m.outcomePrices;
          }
          console.log(`    Prices: ${JSON.stringify(prices)}`);
          
          console.log(`    Market Type: ${m.marketType || 'N/A'}`);
          console.log(`    Active: ${m.active}`);
        });
      } else {
        console.log("\n  ⚠️ 没有 Markets 数据");
      }
      
      console.log("");
    });

  } catch (err: any) {
    console.error("❌ API 请求失败:", err.message);
    if (err.response) {
      console.error("状态码:", err.response.status);
      console.error("响应数据:", err.response.data);
    }
  }
}

checkRawMarkets();
