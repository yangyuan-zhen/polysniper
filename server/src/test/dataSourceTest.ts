/**
 * 数据源测试脚本
 * 验证能否从三个API获取所需数据
 */

import axios from 'axios';

// 颜色输出
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[36m',
  reset: '\x1b[0m',
};

const log = {
  success: (msg: string) => console.log(`${colors.green}✓${colors.reset} ${msg}`),
  error: (msg: string) => console.log(`${colors.red}✗${colors.reset} ${msg}`),
  info: (msg: string) => console.log(`${colors.blue}ℹ${colors.reset} ${msg}`),
  warn: (msg: string) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`),
};

/**
 * 测试虎扑 API
 */
async function testHupuAPI() {
  console.log('\n' + '='.repeat(50));
  console.log('📱 测试虎扑 API (比分数据)');
  console.log('='.repeat(50));

  try {
    const url = 'https://games.mobileapi.hupu.com/1/7.5.60/basketballapi/scheduleList';
    log.info(`请求: ${url}`);

    const response = await axios.get(url, {
      params: { competitionTag: 'nba' },
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)',
      },
      timeout: 10000,
    });

    if (response.data && response.data.result) {
      const games = response.data.result.scheduleList || [];
      log.success(`成功获取 ${games.length} 场比赛数据`);

      if (games.length > 0) {
        const sample = games[0];
        console.log('\n📊 示例数据:');
        console.log({
          主队: sample.homeTeam?.name,
          客队: sample.awayTeam?.name,
          主队得分: sample.homeTeam?.score,
          客队得分: sample.awayTeam?.score,
          状态: sample.status,
          进程: sample.process,
          开始时间: sample.startTime,
        });

        log.success('虎扑 API 数据完整 ✓');
        return true;
      } else {
        log.warn('没有比赛数据（可能不是比赛日）');
        return true;
      }
    } else {
      log.error('响应格式异常');
      return false;
    }
  } catch (error: any) {
    log.error(`虎扑 API 失败: ${error.message}`);
    return false;
  }
}

/**
 * 测试 ESPN API
 */
async function testESPNAPI() {
  console.log('\n' + '='.repeat(50));
  console.log('🏀 测试 ESPN API (胜率、伤病数据)');
  console.log('='.repeat(50));

  try {
    const url = 'http://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard';
    log.info(`请求: ${url}`);

    const response = await axios.get(url, { timeout: 10000 });

    if (response.data && response.data.events) {
      const events = response.data.events || [];
      log.success(`成功获取 ${events.length} 场比赛数据`);

      if (events.length > 0) {
        const sample = events[0];
        const competition = sample.competitions?.[0];
        const homeTeam = competition?.competitors?.find((c: any) => c.homeAway === 'home');
        const awayTeam = competition?.competitors?.find((c: any) => c.homeAway === 'away');

        console.log('\n📊 示例数据:');
        console.log({
          比赛名称: sample.name,
          主队: homeTeam?.team?.displayName,
          客队: awayTeam?.team?.displayName,
          主队得分: homeTeam?.score,
          客队得分: awayTeam?.score,
          状态: sample.status?.type?.description,
        });

        // 检查胜率数据
        const homeWinProb = homeTeam?.statistics?.find((s: any) => s.name === 'winProbability');
        const awayWinProb = awayTeam?.statistics?.find((s: any) => s.name === 'winProbability');

        if (homeWinProb || awayWinProb) {
          log.success('✓ 找到胜率数据');
          console.log({
            主队胜率: homeWinProb?.displayValue,
            客队胜率: awayWinProb?.displayValue,
          });
        } else {
          log.warn('未找到胜率数据（可能是赛前状态）');
        }

        // 检查赛前胜率（odds）
        const odds = competition?.odds?.[0];
        if (odds) {
          log.success('✓ 找到赔率数据（可用于计算赛前胜率）');
          console.log({
            主队赔率: odds.homeTeamOdds?.moneyLine,
            客队赔率: odds.awayTeamOdds?.moneyLine,
          });
        }

        log.success('ESPN API 数据可用 ✓');
        return true;
      } else {
        log.warn('没有比赛数据（可能不是比赛日）');
        return true;
      }
    } else {
      log.error('响应格式异常');
      return false;
    }
  } catch (error: any) {
    log.error(`ESPN API 失败: ${error.message}`);
    return false;
  }
}

/**
 * 测试 ESPN 球队 API
 */
async function testESPNTeamsAPI() {
  console.log('\n' + '='.repeat(50));
  console.log('🏀 测试 ESPN Teams API (球队信息)');
  console.log('='.repeat(50));

  try {
    const url = 'http://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams';
    log.info(`请求: ${url}`);

    const response = await axios.get(url, { timeout: 10000 });

    if (response.data && response.data.sports?.[0]?.leagues?.[0]?.teams) {
      const teams = response.data.sports[0].leagues[0].teams;
      log.success(`成功获取 ${teams.length} 支球队信息`);

      const sample = teams[0].team;
      console.log('\n📊 示例数据:');
      console.log({
        球队名: sample.displayName,
        缩写: sample.abbreviation,
        ID: sample.id,
        Logo: sample.logos?.[0]?.href,
      });

      log.success('ESPN Teams API 可用 ✓');
      return true;
    } else {
      log.error('响应格式异常');
      return false;
    }
  } catch (error: any) {
    log.error(`ESPN Teams API 失败: ${error.message}`);
    return false;
  }
}

/**
 * 测试 Polymarket Gamma API
 */
async function testPolymarketGammaAPI() {
  console.log('\n' + '='.repeat(50));
  console.log('💰 测试 Polymarket Gamma API (市场价格)');
  console.log('='.repeat(50));

  try {
    const url = 'https://gamma-api.polymarket.com/markets';
    log.info(`请求: ${url}`);

    const response = await axios.get(url, {
      params: {
        limit: 20,
        offset: 0,
      },
      timeout: 10000,
    });

    if (response.data && Array.isArray(response.data)) {
      const markets = response.data;
      log.success(`成功获取 ${markets.length} 个市场`);

      // 查找 NBA 相关市场
      const nbaMarkets = markets.filter((m: any) => 
        m.question?.toLowerCase().includes('nba') || 
        m.question?.toLowerCase().includes('lakers') ||
        m.question?.toLowerCase().includes('warriors')
      );

      if (nbaMarkets.length > 0) {
        log.success(`✓ 找到 ${nbaMarkets.length} 个 NBA 相关市场`);
        
        const sample = nbaMarkets[0];
        console.log('\n📊 示例 NBA 市场:');
        console.log({
          问题: sample.question,
          市场ID: sample.condition_id,
          状态: sample.closed ? '已关闭' : '开放中',
          结束时间: sample.end_date_iso,
        });

        // 检查价格数据
        if (sample.tokens && sample.tokens.length > 0) {
          log.success('✓ 找到价格数据');
          sample.tokens.forEach((token: any, index: number) => {
            console.log(`  选项${index + 1}: ${token.outcome} - 价格: $${token.price}`);
          });
        }

        log.success('Polymarket Gamma API 数据完整 ✓');
        return true;
      } else {
        log.warn('未找到 NBA 相关市场（尝试搜索其他关键词）');
        
        // 显示其他市场作为参考
        console.log('\n📊 其他市场示例:');
        markets.slice(0, 3).forEach((m: any, i: number) => {
          console.log(`${i + 1}. ${m.question?.substring(0, 80)}...`);
        });

        log.info('Polymarket Gamma API 连接正常，但需要调整搜索策略');
        return true;
      }
    } else {
      log.error('响应格式异常');
      console.log('响应数据:', JSON.stringify(response.data).substring(0, 200));
      return false;
    }
  } catch (error: any) {
    log.error(`Polymarket Gamma API 失败: ${error.message}`);
    if (error.response) {
      console.log('状态码:', error.response.status);
      console.log('响应数据:', JSON.stringify(error.response.data).substring(0, 200));
    }
    return false;
  }
}

/**
 * 测试 Polymarket 搜索功能
 */
async function testPolymarketSearch() {
  console.log('\n' + '='.repeat(50));
  console.log('🔍 测试 Polymarket 搜索 API');
  console.log('='.repeat(50));

  const searchTerms = ['NBA', 'Lakers', 'basketball'];

  for (const term of searchTerms) {
    try {
      const url = 'https://gamma-api.polymarket.com/markets';
      log.info(`搜索关键词: "${term}"`);

      const response = await axios.get(url, {
        params: {
          limit: 100,
          offset: 0,
          // 注意：实际的搜索参数可能不同，需要查看文档
        },
        timeout: 10000,
      });

      if (response.data && Array.isArray(response.data)) {
        const filtered = response.data.filter((m: any) => 
          m.question?.toLowerCase().includes(term.toLowerCase())
        );

        if (filtered.length > 0) {
          log.success(`找到 ${filtered.length} 个包含 "${term}" 的市场`);
          console.log('示例:');
          filtered.slice(0, 2).forEach((m: any, i: number) => {
            console.log(`  ${i + 1}. ${m.question}`);
          });
          return true;
        } else {
          log.warn(`未找到包含 "${term}" 的市场`);
        }
      }
    } catch (error: any) {
      log.error(`搜索失败: ${error.message}`);
    }
  }

  return false;
}

/**
 * 主测试函数
 */
async function runAllTests() {
  console.log('\n');
  console.log('╔════════════════════════════════════════════════╗');
  console.log('║   PolySniper Backend - 数据源测试           ║');
  console.log('╚════════════════════════════════════════════════╝');

  const results = {
    hupu: false,
    espn: false,
    espnTeams: false,
    polymarket: false,
    polymarketSearch: false,
  };

  // 测试各个 API
  results.hupu = await testHupuAPI();
  results.espn = await testESPNAPI();
  results.espnTeams = await testESPNTeamsAPI();
  results.polymarket = await testPolymarketGammaAPI();
  results.polymarketSearch = await testPolymarketSearch();

  // 总结
  console.log('\n' + '='.repeat(50));
  console.log('📋 测试总结');
  console.log('='.repeat(50));

  const allResults = [
    { name: '虎扑 API (比分)', passed: results.hupu },
    { name: 'ESPN API (胜率)', passed: results.espn },
    { name: 'ESPN Teams API', passed: results.espnTeams },
    { name: 'Polymarket Gamma API', passed: results.polymarket },
    { name: 'Polymarket 搜索', passed: results.polymarketSearch },
  ];

  allResults.forEach((result) => {
    if (result.passed) {
      log.success(result.name);
    } else {
      log.error(result.name);
    }
  });

  const passedCount = allResults.filter(r => r.passed).length;
  const totalCount = allResults.length;

  console.log('\n' + '='.repeat(50));
  if (passedCount === totalCount) {
    log.success(`所有测试通过！(${passedCount}/${totalCount})`);
    console.log('\n✨ 数据源准备就绪，可以开始开发！');
  } else {
    log.warn(`部分测试通过 (${passedCount}/${totalCount})`);
    console.log('\n💡 建议：');
    console.log('  1. 检查网络连接');
    console.log('  2. 确认 API 端点是否正确');
    console.log('  3. 查看失败的 API 文档');
  }
  console.log('='.repeat(50) + '\n');
}

// 运行测试
runAllTests().catch((error) => {
  console.error('测试过程出错:', error);
  process.exit(1);
});
