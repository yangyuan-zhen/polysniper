/**
 * 深度调试 Polymarket 市场
 * 查看所有可用的 NBA 相关市场及其价格
 */

import axios from 'axios';
import { cache } from '../utils/cache';

async function debugMarkets() {
  try {
    await cache.initialize();
    
    const gammaApiUrl = 'https://gamma-api.polymarket.com';
    
    console.log('\n====== 查询所有开放的市场 ======\n');
    
    // 尝试不同的查询参数
    const queries = [
      { limit: 100, closed: false },
      { limit: 100, closed: false, offset: 0 },
      { limit: 100, closed: false, offset: 100 },
      { limit: 100, closed: false, offset: 200 },
    ];
    
    let allMarkets: any[] = [];
    
    for (const params of queries) {
      console.log(`查询参数: ${JSON.stringify(params)}`);
      const response = await axios.get(`${gammaApiUrl}/markets`, { params, timeout: 10000 });
      const markets = response.data || [];
      console.log(`  获取到 ${markets.length} 个市场`);
      allMarkets = allMarkets.concat(markets);
      
      if (markets.length === 0) break;
    }
    
    console.log(`\n总共获取到 ${allMarkets.length} 个市场`);
    
    // 去重
    const uniqueMarkets = Array.from(new Map(allMarkets.map(m => [m.id, m])).values());
    console.log(`去重后: ${uniqueMarkets.length} 个唯一市场\n`);
    
    // 按分类统计
    const categories = new Map<string, number>();
    uniqueMarkets.forEach(m => {
      const cat = m.category || 'uncategorized';
      categories.set(cat, (categories.get(cat) || 0) + 1);
    });
    
    console.log('====== 分类统计 ======\n');
    Array.from(categories.entries())
      .sort((a, b) => b[1] - a[1])
      .forEach(([cat, count]) => {
        console.log(`${cat}: ${count} 个市场`);
      });
    
    // 搜索 Sports 分类
    console.log('\n====== Sports 分类市场 ======\n');
    const sportsMarkets = uniqueMarkets.filter(m => 
      (m.category || '').toLowerCase().includes('sports') ||
      (m.category || '').toLowerCase().includes('sport')
    );
    
    console.log(`找到 ${sportsMarkets.length} 个体育市场：\n`);
    sportsMarkets.slice(0, 20).forEach((m, idx) => {
      console.log(`${idx + 1}. ${m.question}`);
      console.log(`   分类: ${m.category}`);
      console.log(`   状态: ${m.closed ? '已关闭' : '开放中'}`);
      console.log(`   结束时间: ${m.endDateIso || 'N/A'}`);
      if (m.outcomePrices) {
        console.log(`   价格: ${m.outcomePrices.join(' / ')}`);
      }
      console.log('');
    });
    
    // 搜索 NBA 相关
    console.log('\n====== 搜索所有包含 NBA/Basketball/Celtics/Lakers 的市场 ======\n');
    const nbaKeywords = ['nba', 'basketball', 'celtics', 'lakers', 'warriors', 'lebron', 'curry', 'tatum'];
    
    const nbaMarkets = uniqueMarkets.filter(m => {
      const text = `${m.question} ${m.description} ${m.category}`.toLowerCase();
      return nbaKeywords.some(keyword => text.includes(keyword));
    });
    
    console.log(`找到 ${nbaMarkets.length} 个 NBA 相关市场：\n`);
    
    // 按状态分类
    const openNBA = nbaMarkets.filter(m => !m.closed);
    const closedNBA = nbaMarkets.filter(m => m.closed);
    
    console.log(`  - 开放中: ${openNBA.length} 个`);
    console.log(`  - 已关闭: ${closedNBA.length} 个\n`);
    
    if (openNBA.length > 0) {
      console.log('====== 开放中的 NBA 市场 ======\n');
      openNBA.forEach((m, idx) => {
        console.log(`${idx + 1}. 【${m.category}】${m.question}`);
        console.log(`   描述: ${(m.description || 'N/A').substring(0, 150)}...`);
        console.log(`   市场ID: ${m.conditionId || m.id}`);
        console.log(`   结束时间: ${m.endDateIso || 'N/A'}`);
        const outcomes = Array.isArray(m.outcomes) ? m.outcomes : (typeof m.outcomes === 'string' ? JSON.parse(m.outcomes) : []);
        console.log(`   选项: ${outcomes.join(' vs ')}`);
        
        const prices = Array.isArray(m.outcomePrices) ? m.outcomePrices : (typeof m.outcomePrices === 'string' ? JSON.parse(m.outcomePrices) : []);
        if (prices.length > 0) {
          console.log(`   价格: ${prices.map((p: string) => `$${p}`).join(' / ')}`);
        } else {
          console.log(`   价格: 未找到 (lastTradePrice: ${m.lastTradePrice || 'N/A'})`);
        }
        console.log(`   流动性: $${m.liquidityNum || m.liquidity || '0'}`);
        console.log(`   成交量: $${m.volumeNum || m.volume || '0'}`);
        console.log('');
      });
    } else {
      console.log('⚠️ 当前没有开放中的 NBA 市场\n');
      
      console.log('最近关闭的 NBA 市场（前5个）：\n');
      closedNBA
        .sort((a, b) => {
          const dateA = new Date(a.closedTime || a.endDateIso || 0);
          const dateB = new Date(b.closedTime || b.endDateIso || 0);
          return dateB.getTime() - dateA.getTime();
        })
        .slice(0, 5)
        .forEach((m, idx) => {
          console.log(`${idx + 1}. ${m.question}`);
          console.log(`   关闭时间: ${m.closedTime || m.endDateIso || 'N/A'}`);
          console.log('');
        });
    }
    
    // 搜索今天/本周的比赛市场
    console.log('\n====== 搜索包含日期的市场 ======\n');
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0]; // YYYY-MM-DD
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    
    const dateMarkets = uniqueMarkets.filter(m => {
      const text = `${m.question} ${m.description}`.toLowerCase();
      return text.includes(todayStr) || 
             text.includes(tomorrowStr) ||
             text.includes('december 16') ||
             text.includes('dec 16');
    });
    
    console.log(`找到 ${dateMarkets.length} 个包含今天/明天日期的市场：\n`);
    dateMarkets.slice(0, 10).forEach((m, idx) => {
      console.log(`${idx + 1}. ${m.question}`);
      console.log(`   状态: ${m.closed ? '已关闭' : '开放中'}`);
      console.log('');
    });
    
  } catch (error: any) {
    console.error('调试失败:', error.message);
    if (error.response) {
      console.error('状态码:', error.response.status);
      console.error('响应:', JSON.stringify(error.response.data, null, 2));
    }
  } finally {
    await cache.disconnect();
    process.exit(0);
  }
}

debugMarkets();
