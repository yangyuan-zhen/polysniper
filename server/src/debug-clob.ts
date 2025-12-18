// 尝试 CLOB API（这可能是前端实际使用的）
import axios from 'axios';

const CLOB_API = "https://clob.polymarket.com";
const GAMMA_API = "https://gamma-api.polymarket.com";

async function tryCLOB() {
  console.log("🔍 尝试 CLOB API 查找当前 NBA 市场\n");

  try {
    // 测试1: CLOB markets 端点
    console.log("=== 测试1: CLOB /markets ===\n");
    try {
      const res = await axios.get(`${CLOB_API}/markets`, {
        timeout: 5000
      });
      console.log(`✅ 成功！返回: ${JSON.stringify(res.data).substring(0, 200)}`);
    } catch (err: any) {
      console.log(`❌ 失败: ${err.message}`);
    }

    // 测试2: CLOB sampling-markets
    console.log("\n=== 测试2: CLOB /sampling-markets ===\n");
    try {
      const res = await axios.get(`${CLOB_API}/sampling-markets`, {
        timeout: 5000
      });
      console.log(`✅ 成功！返回数据量: ${JSON.stringify(res.data).length} 字符`);
      
      if (Array.isArray(res.data)) {
        console.log(`返回 ${res.data.length} 个markets`);
        const nba = res.data.filter((m: any) => 
          JSON.stringify(m).toLowerCase().includes('pistons') ||
          JSON.stringify(m).toLowerCase().includes('celtics')
        );
        console.log(`其中 Pistons/Celtics 相关: ${nba.length} 个`);
      }
    } catch (err: any) {
      console.log(`❌ 失败: ${err.message}`);
    }

    // 测试3: 尝试 simplified-markets
    console.log("\n=== 测试3: CLOB /simplified-markets ===\n");
    try {
      const res = await axios.get(`${CLOB_API}/simplified-markets`, {
        timeout: 5000
      });
      console.log(`✅ 成功！`);
      console.log(`数据: ${JSON.stringify(res.data).substring(0, 300)}`);
    } catch (err: any) {
      console.log(`❌ 失败: ${err.message}`);
    }

    // 测试4: 尝试查询特定的 token ID（从之前的数据中找到的）
    console.log("\n=== 测试4: Gamma /markets 详细查询 ===\n");
    try {
      const res = await axios.get(`${GAMMA_API}/markets`, {
        params: {
          limit: 500,  // 获取更多
          offset: 0,
          _embed: true,  // 尝试获取嵌入数据
        },
        timeout: 10000
      });
      
      console.log(`获取到 ${res.data.length} 个 markets`);
      
      // 搜索当前的 NBA 比赛
      const current = res.data.filter((m: any) => {
        const text = `${m.question} ${m.description} ${m.slug}`.toLowerCase();
        // 搜索 Pistons, Celtics, 且是最近的日期
        if ((text.includes('pistons') || text.includes('celtics')) && 
            !m.closed) {
          return true;
        }
        // 或者搜索包含 "2024-12" 的
        if (text.includes('2024-12') || text.includes('december 2024')) {
          return true;
        }
        return false;
      });
      
      console.log(`找到 ${current.length} 个可能的当前市场\n`);
      current.forEach((m: any) => {
        console.log(`- ${m.question}`);
        console.log(`  End Date: ${m.endDateIso || m.endDate}`);
        console.log(`  Closed: ${m.closed}`);
      });
      
    } catch (err: any) {
      console.log(`❌ 失败: ${err.message}`);
    }

    // 测试5: 尝试直接访问 sports API
    console.log("\n=== 测试5: Gamma /sports/[id] ===\n");
    try {
      // 从之前我们知道有 /sports 端点，尝试获取 NBA 的
      const sportsRes = await axios.get(`${GAMMA_API}/sports`);
      const nbaSport = sportsRes.data.find((s: any) => s.sport === 'nba');
      
      if (nbaSport) {
        console.log(`找到 NBA sport: ID=${nbaSport.id}`);
        
        // 尝试获取这个 sport 的详情
        try {
          const detailRes = await axios.get(`${GAMMA_API}/sports/${nbaSport.id}`);
          console.log(`Sport 详情: ${JSON.stringify(detailRes.data).substring(0, 300)}`);
        } catch (err) {
          console.log(`无法获取 sport 详情`);
        }
      }
    } catch (err: any) {
      console.log(`❌ 失败: ${err.message}`);
    }

  } catch (err: any) {
    console.error("❌ 总体失败:", err.message);
  }
}

tryCLOB();
