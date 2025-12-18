/**
 * 快速启动测试
 * 测试完整的数据流程：获取比赛 -> 整合数据 -> 计算套利信号
 */

import { espnService } from '../services/espnService';
import { hupuService } from '../services/hupuService';
import { polymarketService } from '../services/polymarketService';
import { arbitrageEngine } from '../services/arbitrageEngine';
import { logger } from '../utils/logger';
import { cache } from '../utils/cache';

const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[36m',
  magenta: '\x1b[35m',
  reset: '\x1b[0m',
};

async function testDataFlow() {
  console.log('\n' + '='.repeat(60));
  console.log('🚀 PolySniper Backend - 快速启动测试');
  console.log('='.repeat(60) + '\n');

  try {
    // 1. 初始化缓存
    console.log(`${colors.blue}[1/5]${colors.reset} 初始化缓存...`);
    await cache.initialize();
    console.log(`${colors.green}✓${colors.reset} 缓存初始化完成\n`);

    // 2. 获取虎扑赛程
    console.log(`${colors.blue}[2/5]${colors.reset} 获取虎扑比赛数据...`);
    const hupuGames = await hupuService.getAllGames();
    console.log(`${colors.green}✓${colors.reset} 获取到 ${hupuGames.length} 场比赛`);
    
    if (hupuGames.length > 0) {
      const sample = hupuGames[0];
      console.log(`  示例: ${sample.homeTeamName} vs ${sample.awayTeamName}`);
      console.log(`  状态: ${sample.matchStatusChinese || sample.matchStatus || '未知'}\n`);
    } else {
      console.log(`${colors.yellow}⚠${colors.reset} 今天没有比赛（可能是休赛期）\n`);
    }

    // 3. 获取 ESPN 数据
    console.log(`${colors.blue}[3/5]${colors.reset} 获取 ESPN 比赛数据...`);
    const scoreboard = await espnService.getScoreboard();
    const espnGames = scoreboard.events || [];
    console.log(`${colors.green}✓${colors.reset} 获取到 ${espnGames.length} 场比赛`);
    
    if (espnGames.length > 0) {
      const sample = espnGames[0];
      const comp = sample.competitions?.[0];
      const home = comp?.competitors?.find((c: any) => c.homeAway === 'home');
      const away = comp?.competitors?.find((c: any) => c.homeAway === 'away');
      
      console.log(`  示例: ${home?.team?.displayName} vs ${away?.team?.displayName}`);
      console.log(`  比分: ${home?.score} - ${away?.score}`);
      console.log(`  状态: ${sample.status?.type?.description}\n`);
    }

    // 4. 测试 Polymarket 连接
    console.log(`${colors.blue}[4/5]${colors.reset} 测试 Polymarket API...`);
    const polyMarkets = await polymarketService.getMarkets({ limit: 20 });
    
    if (polyMarkets && Array.isArray(polyMarkets)) {
      console.log(`${colors.green}✓${colors.reset} 成功连接 Polymarket`);
      console.log(`  获取到 ${polyMarkets.length} 个市场`);
      
      // 查找 NBA 市场
      const nbaMarkets = polyMarkets.filter((m: any) => {
        const q = (m.question || '').toLowerCase();
        return q.includes('nba') || q.includes('lakers') || q.includes('warriors');
      });
      
      console.log(`  其中 NBA 相关市场: ${nbaMarkets.length} 个`);
      
      if (nbaMarkets.length > 0) {
        console.log(`  示例: ${nbaMarkets[0].question?.substring(0, 60)}...\n`);
      } else {
        console.log(`${colors.yellow}  ⚠ 当前没有找到活跃的 NBA 市场${colors.reset}\n`);
      }
    } else {
      console.log(`${colors.red}✗${colors.reset} Polymarket 连接失败\n`);
    }

    // 5. 测试完整数据整合
    console.log(`${colors.blue}[5/5]${colors.reset} 测试数据整合流程...`);
    
    if (espnGames.length > 0) {
      const sampleGame = espnGames[0];
      const comp = sampleGame.competitions?.[0];
      const home = comp?.competitors?.find((c: any) => c.homeAway === 'home');
      const away = comp?.competitors?.find((c: any) => c.homeAway === 'away');
      
      const homeTeamName = home?.team?.displayName || '';
      const awayTeamName = away?.team?.displayName || '';
      
      console.log(`  测试比赛: ${homeTeamName} vs ${awayTeamName}`);
      
      // 尝试获取 ESPN 胜率
      const espnData = await espnService.getWinProbabilityByTeams(homeTeamName, awayTeamName);
      if (espnData) {
        console.log(`  ${colors.green}✓${colors.reset} ESPN 胜率数据:`);
        console.log(`    主队胜率: ${(espnData.homeWinProb * 100).toFixed(1)}%`);
        console.log(`    客队胜率: ${(espnData.awayWinProb * 100).toFixed(1)}%`);
      } else {
        console.log(`  ${colors.yellow}⚠${colors.reset} 未找到 ESPN 胜率数据`);
      }
      
      // 尝试获取 Polymarket 价格
      const polyData = await polymarketService.searchNBAMarkets(homeTeamName, awayTeamName);
      if (polyData) {
        console.log(`  ${colors.green}✓${colors.reset} Polymarket 价格数据:`);
        console.log(`    主队价格: $${polyData.homePrice.toFixed(3)}`);
        console.log(`    客队价格: $${polyData.awayPrice.toFixed(3)}`);
        
        // 如果两个数据都有，计算套利信号
        if (espnData && polyData) {
          console.log(`\n  ${colors.magenta}🎯 计算套利信号...${colors.reset}`);
          
          // 构建临时比赛对象
          const mockMatch: any = {
            id: 'test',
            homeTeam: { name: homeTeamName, score: parseInt(home?.score || '0') },
            awayTeam: { name: awayTeamName, score: parseInt(away?.score || '0') },
            status: sampleGame.status?.type?.state,
            espn: espnData,
            poly: polyData,
            hupu: {
              homeScore: parseInt(home?.score || '0'),
              awayScore: parseInt(away?.score || '0'),
              quarter: sampleGame.status?.type?.shortDetail || '',
              timeRemaining: '',
            },
          };
          
          const signals = arbitrageEngine.calculateSignals(mockMatch);
          
          if (signals.length > 0) {
            console.log(`  ${colors.green}✓ 发现 ${signals.length} 个套利信号!${colors.reset}`);
            signals.forEach((signal, idx) => {
              console.log(`\n  信号 ${idx + 1}:`);
              console.log(`    类型: ${signal.type}`);
              console.log(`    置信度: ${(signal.confidence * 100).toFixed(1)}%`);
              console.log(`    预期收益: ${signal.edge.toFixed(2)}%`);
              console.log(`    原因: ${signal.reason}`);
            });
          } else {
            console.log(`  ${colors.yellow}⚠ 暂无套利机会${colors.reset}`);
          }
        }
      } else {
        console.log(`  ${colors.yellow}⚠${colors.reset} 未找到 Polymarket 市场`);
        console.log(`  ${colors.blue}ℹ${colors.reset} 这是正常现象：Polymarket 不是每场比赛都有市场`);
        console.log(`  ${colors.blue}ℹ${colors.reset} 主要集中在季后赛、总决赛等重要比赛`);
      }
    }

    // 总结
    console.log('\n' + '='.repeat(60));
    console.log(`${colors.green}✓ 测试完成！${colors.reset}`);
    console.log('='.repeat(60));
    
    console.log('\n📋 系统状态:');
    console.log(`  - 虎扑 API: ${hupuGames.length > 0 ? '✓ 正常' : '⚠ 暂无数据'}`);
    console.log(`  - ESPN API: ${espnGames.length > 0 ? '✓ 正常' : '⚠ 暂无数据'}`);
    console.log(`  - Polymarket API: ${polyMarkets ? '✓ 正常' : '✗ 失败'}`);
    console.log(`  - 套利引擎: ✓ 就绪`);
    
    console.log('\n💡 下一步:');
    console.log('  1. 运行 npm run dev 启动完整服务');
    console.log('  2. 访问 http://localhost:3000/health 检查服务状态');
    console.log('  3. 访问 http://localhost:3000/api/matches 查看比赛数据');
    console.log('  4. 访问 http://localhost:3000/api/signals 查看套利信号\n');

  } catch (error: any) {
    console.error(`\n${colors.red}✗ 测试失败:${colors.reset}`, error.message);
    if (error.stack) {
      console.error(error.stack);
    }
  } finally {
    // 清理
    await cache.disconnect();
    process.exit(0);
  }
}

// 运行测试
console.log('');
testDataFlow();
