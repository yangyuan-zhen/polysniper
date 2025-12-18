// 检查 series 端点返回什么
import axios from 'axios';

const GAMMA_API = "https://gamma-api.polymarket.com";

async function checkSeries() {
  try {
    const res = await axios.get(`${GAMMA_API}/series`);
    const series = res.data;
    
    console.log(`返回 ${series.length} 个 series`);
    console.log(`\n前20个:\n`);
    
    series.slice(0, 20).forEach((s: any, idx: number) => {
      console.log(`${idx + 1}. ID=${s.id} Title="${s.title || s.ticker || s.slug}"`);
    });
    
    // 直接查询我们知道的 ID
    console.log(`\n\n直接查询 series ID=10345:`);
    try {
      const res2 = await axios.get(`${GAMMA_API}/series/10345`);
      console.log(JSON.stringify(res2.data, null, 2));
      
      // 查这个 series 下的 events
      console.log(`\n\n查询 series 10345 的 events:`);
      const eventsRes = await axios.get(`${GAMMA_API}/events`, {
        params: { series_id: '10345', limit: 100, closed: false }
      });
      
      console.log(`找到 ${eventsRes.data.length} 个未关闭的 events`);
      
      eventsRes.data.slice(0, 10).forEach((e: any) => {
        const date = e.startDate ? new Date(e.startDate).toISOString().split('T')[0] : 'N/A';
        console.log(`- ${e.title} (${date}, Active: ${e.active})`);
      });
      
    } catch (err: any) {
      console.log(`查询失败: ${err.message}`);
    }
    
    // 尝试查找 sports 相关的数据
    console.log(`\n\n查询 /sports:`);
    const sportsRes = await axios.get(`${GAMMA_API}/sports`);
    console.log(`找到 ${sportsRes.data.length} 个 sports`);
    
    const nbaSport = sportsRes.data.find((s: any) => s.sport === 'nba');
    if (nbaSport) {
      console.log(`\nNBA Sport:`);
      console.log(JSON.stringify(nbaSport, null, 2));
      
      // 通过 sport 的 series ID 查询
      if (nbaSport.series) {
        console.log(`\n\n通过 NBA sport series ID (${nbaSport.series}) 查询 events:`);
        const eventsRes2 = await axios.get(`${GAMMA_API}/events`, {
          params: { series_id: nbaSport.series, limit: 100, closed: false }
        });
        
        console.log(`找到 ${eventsRes2.data.length} 个未关闭的 events`);
        
        if (eventsRes2.data.length > 0) {
          console.log(`\n前10个:`);
          eventsRes2.data.slice(0, 10).forEach((e: any) => {
            const date = e.startDate ? new Date(e.startDate).toISOString().split('T')[0] : 'N/A';
            console.log(`- ${e.title} (${date})`);
          });
        }
      }
    }
    
  } catch (err: any) {
    console.error("失败:", err.message);
  }
}

checkSeries();
