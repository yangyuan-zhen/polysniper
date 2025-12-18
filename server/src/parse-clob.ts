// 解析 CLOB sampling-markets 数据
import axios from 'axios';

const CLOB_API = "https://clob.polymarket.com";

async function parseCLOBMarkets() {
  console.log("🔍 解析 CLOB sampling-markets 找到当前 NBA 市场\n");

  try {
    const res = await axios.get(`${CLOB_API}/sampling-markets`, {
      timeout: 10000
    });
    
    const markets = res.data;
    console.log(`获取到数据，类型: ${typeof markets}`);
    console.log(`数据大小: ${JSON.stringify(markets).length} 字符\n`);
    
    // 如果是数组
    if (Array.isArray(markets)) {
      console.log(`是数组，包含 ${markets.length} 个元素\n`);
      
      // 搜索 NBA 相关
      const nbaMarkets = markets.filter((m: any) => {
        const str = JSON.stringify(m).toLowerCase();
        return str.includes('nba') || 
               str.includes('pistons') || 
               str.includes('celtics') ||
               str.includes('lakers') ||
               str.includes('warriors');
      });
      
      console.log(`找到 ${nbaMarkets.length} 个 NBA 相关市场\n`);
      
      // 显示前10个
      nbaMarkets.slice(0, 10).forEach((m: any, idx: number) => {
        console.log(`${idx + 1}. ================`);
        console.log(`完整数据:`);
        console.log(JSON.stringify(m, null, 2).substring(0, 500));
        console.log('...\n');
      });
      
      // 精确搜索 Pistons vs Celtics
      const pistonsCeltics = nbaMarkets.filter((m: any) => {
        const str = JSON.stringify(m).toLowerCase();
        return (str.includes('pistons') && str.includes('celtics')) ||
               (str.includes('detroit') && str.includes('boston'));
      });
      
      console.log(`\n🎯 精确匹配 Pistons vs Celtics: ${pistonsCeltics.length} 个\n`);
      pistonsCeltics.forEach((m: any) => {
        console.log(JSON.stringify(m, null, 2));
        console.log('\n');
      });
      
    } else if (typeof markets === 'object' && markets.data) {
      // 可能是 { data: [...] } 格式
      console.log(`是对象，包含 'data' 字段`);
      const dataArray = markets.data;
      
      if (Array.isArray(dataArray)) {
        console.log(`data 数组包含 ${dataArray.length} 个元素\n`);
        
        // 搜索 NBA
        const nbaMarkets = dataArray.filter((m: any) => {
          const str = JSON.stringify(m).toLowerCase();
          return str.includes('nba') || 
                 str.includes('pistons') || 
                 str.includes('celtics');
        });
        
        console.log(`找到 ${nbaMarkets.length} 个 NBA 相关\n`);
        
        nbaMarkets.slice(0, 5).forEach((m: any, idx: number) => {
          console.log(`${idx + 1}. ${JSON.stringify(m, null, 2).substring(0, 400)}\n`);
        });
        
        // 精确搜索
        const pistonsCeltics = nbaMarkets.filter((m: any) => {
          const str = JSON.stringify(m).toLowerCase();
          return str.includes('pistons') && str.includes('celtics');
        });
        
        console.log(`\n🎯 Pistons vs Celtics: ${pistonsCeltics.length} 个\n`);
        pistonsCeltics.forEach((m: any) => {
          console.log("完整市场数据:");
          console.log(JSON.stringify(m, null, 2));
        });
      }
    }
    
  } catch (err: any) {
    console.error("❌ 失败:", err.message);
  }
}

parseCLOBMarkets();
