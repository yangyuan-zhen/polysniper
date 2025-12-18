/**
 * 调试 Polymarket Events API（正确的端点）
 */

import axios from 'axios';
import { cache } from '../utils/cache';

async function debugEvents() {
  try {
    await cache.initialize();
    
    const gammaApiUrl = 'https://gamma-api.polymarket.com';
    
    console.log('\n====== 获取所有 Events ======\n');
    
    const response = await axios.get(`${gammaApiUrl}/events`, {
      params: { limit: 100, offset: 0 },
      timeout: 10000,
    });
    
    const events = response.data || [];
    console.log(`获取到 ${events.length} 个 events\n`);
    
    // 筛选 NBA 相关
    const nbaEvents = events.filter((e: any) => {
      const text = `${e.title} ${e.description} ${e.slug}`.toLowerCase();
      return text.includes('nba') || text.includes('basketball');
    });
    
    console.log(`找到 ${nbaEvents.length} 个 NBA 相关 events\n`);
    
    // 显示所有 NBA events
    nbaEvents.forEach((e: any, idx: number) => {
      console.log(`${idx + 1}. ${e.title}`);
      console.log(`   Slug: ${e.slug}`);
      console.log(`   ID: ${e.id}`);
      console.log(`   状态: ${e.closed ? '已关闭' : '开放中'}`);
      console.log(`   开始时间: ${e.startDate || 'N/A'}`);
      console.log(`   结束时间: ${e.endDate || 'N/A'}`);
      console.log(`   流动性: $${e.liquidity || e.liquidityClob || '0'}`);
      console.log(`   成交量: $${e.volume || '0'}`);
      console.log(`   分类: ${e.category || 'N/A'}`);
      console.log(`   标签: ${e.tags || 'N/A'}`);
      
      // Markets 数组
      if (e.markets && Array.isArray(e.markets)) {
        console.log(`   包含 ${e.markets.length} 个 markets:`);
        e.markets.forEach((m: any, i: number) => {
          console.log(`     ${i + 1}. ${m.question || m.groupItemTitle}`);
          if (m.outcomePrices) {
            console.log(`        价格: ${m.outcomePrices}`);
          }
          if (m.outcomes) {
            console.log(`        选项: ${m.outcomes}`);
          }
        });
      }
      
      console.log('\n' + '-'.repeat(80) + '\n');
    });
    
    // 查找今天的比赛
    console.log('\n====== 查找今天的 NBA 比赛 ======\n');
    
    const today = new Date().toISOString().split('T')[0];
    const todayEvents = nbaEvents.filter((e: any) => {
      const startDate = e.startDate ? e.startDate.split('T')[0] : '';
      return startDate === today;
    });
    
    console.log(`找到 ${todayEvents.length} 个今天的 NBA events\n`);
    
    todayEvents.forEach((e: any) => {
      console.log(`📍 ${e.title}`);
      console.log(`   时间: ${e.startDate}`);
      console.log(`   Markets: ${e.markets?.length || 0} 个`);
      console.log('');
    });
    
    // 查找包含 Celtics 或 Pistons 的比赛
    console.log('\n====== 查找 Celtics/Pistons 相关比赛 ======\n');
    
    const targetEvents = nbaEvents.filter((e: any) => {
      const text = `${e.title} ${e.description}`.toLowerCase();
      return text.includes('celtics') || text.includes('pistons');
    });
    
    console.log(`找到 ${targetEvents.length} 个相关 events\n`);
    
    targetEvents.forEach((e: any) => {
      console.log(`🎯 ${e.title}`);
      console.log(`   完整数据:`, JSON.stringify(e, null, 2));
      console.log('');
    });
    
  } catch (error: any) {
    console.error('调试失败:', error.message);
    if (error.response) {
      console.error('响应:', error.response.data);
    }
  } finally {
    await cache.disconnect();
    process.exit(0);
  }
}

debugEvents();
