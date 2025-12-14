/**
 * 虎扑 API 性能测试脚本
 * 
 * 用途：测试 HTTP Keep-Alive 连接复用的效果
 * 
 * 使用方法：
 * node scripts/test-hupu-performance.js
 */

import https from 'https';

// 测试配置
const TEST_CONFIG = {
  url: 'https://games.mobileapi.hupu.com/1/7.5.60/basketballapi/scheduleList?competitionTag=nba',
  iterations: 10,  // 测试次数
  interval: 1000,  // 请求间隔（毫秒）
};

// 创建带 Keep-Alive 的 Agent
const keepAliveAgent = new https.Agent({
  keepAlive: true,
  keepAliveMsecs: 30000,
  maxSockets: 10,
  maxFreeSockets: 5,
  timeout: 8000,
  scheduling: 'lifo'
});

// 创建不带 Keep-Alive 的 Agent（用于对比）
const normalAgent = new https.Agent({
  keepAlive: false
});

/**
 * 执行单次请求
 */
function makeRequest(agent, requestNumber) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    
    const req = https.get(TEST_CONFIG.url, {
      agent: agent,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
      }
    }, (res) => {
      const connectionTime = Date.now() - startTime;
      
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        const totalTime = Date.now() - startTime;
        const parseTime = totalTime - connectionTime;
        
        resolve({
          requestNumber,
          connectionTime,
          parseTime,
          totalTime,
          statusCode: res.statusCode
        });
      });
    });
    
    req.on('error', (error) => {
      reject(error);
    });
    
    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
  });
}

/**
 * 运行测试
 */
async function runTest(useKeepAlive) {
  const agent = useKeepAlive ? keepAliveAgent : normalAgent;
  const mode = useKeepAlive ? 'Keep-Alive' : 'Normal';
  const results = [];
  
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🧪 测试模式: ${mode}`);
  console.log(`${'='.repeat(60)}\n`);
  
  for (let i = 1; i <= TEST_CONFIG.iterations; i++) {
    try {
      const result = await makeRequest(agent, i);
      results.push(result);
      
      console.log(
        `✅ 请求 ${i.toString().padStart(2, ' ')}/${TEST_CONFIG.iterations} - ` +
        `总耗时: ${result.totalTime.toString().padStart(4, ' ')}ms | ` +
        `连接: ${result.connectionTime.toString().padStart(4, ' ')}ms | ` +
        `解析: ${result.parseTime.toString().padStart(4, ' ')}ms`
      );
      
      // 等待间隔
      if (i < TEST_CONFIG.iterations) {
        await new Promise(resolve => setTimeout(resolve, TEST_CONFIG.interval));
      }
    } catch (error) {
      console.error(`❌ 请求 ${i} 失败:`, error.message);
    }
  }
  
  return results;
}

/**
 * 计算统计数据
 */
function calculateStats(results) {
  if (results.length === 0) return null;
  
  const totalTimes = results.map(r => r.totalTime);
  const connectionTimes = results.map(r => r.connectionTime);
  
  const avg = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length;
  const min = (arr) => Math.min(...arr);
  const max = (arr) => Math.max(...arr);
  
  return {
    avgTotal: Math.round(avg(totalTimes)),
    minTotal: min(totalTimes),
    maxTotal: max(totalTimes),
    avgConnection: Math.round(avg(connectionTimes)),
    minConnection: min(connectionTimes),
    maxConnection: max(connectionTimes),
    firstRequest: totalTimes[0],
    subsequentAvg: totalTimes.length > 1 ? Math.round(avg(totalTimes.slice(1))) : null
  };
}

/**
 * 打印统计报告
 */
function printReport(normalStats, keepAliveStats) {
  console.log(`\n${'='.repeat(60)}`);
  console.log('📊 性能对比报告');
  console.log(`${'='.repeat(60)}\n`);
  
  console.log('┌─────────────────────────┬──────────────┬──────────────┬─────────┐');
  console.log('│ 指标                    │ Normal       │ Keep-Alive   │ 提升    │');
  console.log('├─────────────────────────┼──────────────┼──────────────┼─────────┤');
  
  const metrics = [
    {
      name: '平均总耗时',
      normal: normalStats.avgTotal,
      keepAlive: keepAliveStats.avgTotal
    },
    {
      name: '首次请求耗时',
      normal: normalStats.firstRequest,
      keepAlive: keepAliveStats.firstRequest
    },
    {
      name: '后续请求平均耗时',
      normal: normalStats.subsequentAvg,
      keepAlive: keepAliveStats.subsequentAvg
    },
    {
      name: '平均连接耗时',
      normal: normalStats.avgConnection,
      keepAlive: keepAliveStats.avgConnection
    }
  ];
  
  metrics.forEach(({ name, normal, keepAlive }) => {
    if (normal === null || keepAlive === null) return;
    
    const improvement = ((normal - keepAlive) / normal * 100).toFixed(1);
    const symbol = improvement > 0 ? '↓' : '↑';
    
    console.log(
      `│ ${name.padEnd(24, ' ')}│ ${normal.toString().padStart(9, ' ')} ms │ ` +
      `${keepAlive.toString().padStart(9, ' ')} ms │ ${symbol}${Math.abs(improvement).toString().padStart(5, ' ')}% │`
    );
  });
  
  console.log('└─────────────────────────┴──────────────┴──────────────┴─────────┘\n');
  
  // 关键发现
  const subsequentImprovement = ((normalStats.subsequentAvg - keepAliveStats.subsequentAvg) / normalStats.subsequentAvg * 100).toFixed(1);
  
  console.log('🎯 关键发现:\n');
  console.log(`   1. Keep-Alive 使后续请求速度提升 ${subsequentImprovement}%`);
  console.log(`   2. 普通模式平均耗时: ${normalStats.avgTotal}ms`);
  console.log(`   3. Keep-Alive 平均耗时: ${keepAliveStats.avgTotal}ms`);
  console.log(`   4. 预计可支持更新频率: ${Math.floor(1000 / keepAliveStats.subsequentAvg)} 次/秒\n`);
  
  // 建议
  console.log('💡 优化建议:\n');
  if (keepAliveStats.subsequentAvg < 500) {
    console.log('   ✅ 性能优秀，建议使用 3-5 秒更新频率');
  } else if (keepAliveStats.subsequentAvg < 800) {
    console.log('   ⚠️  性能良好，建议使用 5-10 秒更新频率');
  } else {
    console.log('   ❌ 性能较差，建议保持 10 秒以上更新频率');
  }
  console.log('');
}

/**
 * 主函数
 */
async function main() {
  console.log('🚀 虎扑 API 性能测试\n');
  console.log(`测试配置:`);
  console.log(`  - 测试次数: ${TEST_CONFIG.iterations}`);
  console.log(`  - 请求间隔: ${TEST_CONFIG.interval}ms`);
  console.log(`  - 测试URL: ${TEST_CONFIG.url}`);
  
  try {
    // 测试普通模式
    const normalResults = await runTest(false);
    const normalStats = calculateStats(normalResults);
    
    // 等待一段时间，避免请求过于密集
    console.log('\n⏳ 等待 3 秒后开始 Keep-Alive 测试...\n');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // 测试 Keep-Alive 模式
    const keepAliveResults = await runTest(true);
    const keepAliveStats = calculateStats(keepAliveResults);
    
    // 打印对比报告
    if (normalStats && keepAliveStats) {
      printReport(normalStats, keepAliveStats);
    }
    
    // 清理连接
    keepAliveAgent.destroy();
    normalAgent.destroy();
    
    console.log('✅ 测试完成！\n');
  } catch (error) {
    console.error('❌ 测试失败:', error);
    process.exit(1);
  }
}

// 运行测试
main();
