/**
 * 查找最近的 NBA events（包括已关闭的）
 */

import axios from 'axios';
import { cache } from '../utils/cache';

async function findRecentNBA() {
  try {
    await cache.initialize();
    
    const gammaApiUrl = 'https://gamma-api.polymarket.com';
    
    console.log('\n====== 获取所有 NBA Events（包括已关闭的） ======\n');
    
    let allEvents: any[] = [];
    
    // 获取多页数据
    for (let offset = 0; offset < 500; offset += 100) {
      const response = await axios.get(`${gammaApiUrl}/events`, {
        params: { limit: 100, offset },
        timeout: 10000,
      });
      
      const events = response.data || [];
      if (events.length === 0) break;
      
      allEvents = allEvents.concat(events);
      console.log(`获取 offset=${offset}: ${events.length} 个 events`);
    }
    
    console.log(`\n总共: ${allEvents.length} 个 events\n`);
    
    // 筛选 NBA 相关
    const nbaEvents = allEvents.filter((e: any) => {
      const text = `${e.title} ${e.slug} ${e.category}`.toLowerCase();
      return text.includes('nba') || (text.includes('basketball') && !text.includes('ncaa'));
    });
    
    console.log(`NBA 相关: ${nbaEvents.length} 个\n`);
    
    // 按开始时间排序（最近的在前）
    nbaEvents.sort((a, b) => {
      const dateA = new Date(a.startDate || a.creationDate || 0);
      const dateB = new Date(b.startDate || b.creationDate || 0);
      return dateB.getTime() - dateA.getTime();
    });
    
    // 显示最近20个 NBA events
    console.log('====== 最近20个 NBA Events ======\n');
    nbaEvents.slice(0, 20).forEach((e, idx) => {
      const startDate = e.startDate ? new Date(e.startDate).toISOString().split('T')[0] : 'N/A';
      console.log(`${idx + 1}. ${e.title}`);
      console.log(`   日期: ${startDate}`);
      console.log(`   状态: ${e.closed ? '已关闭' : '开放中'}`);
      console.log(`   Markets: ${e.markets?.length || 0}`);
      
      // 检查是否是今天的比赛
      const today = new Date().toISOString().split('T')[0];
      if (startDate === today) {
        console.log(`   🎯 今天的比赛！`);
      }
      
      console.log('');
    });
    
    // 统计开放中的
    const openNBA = nbaEvents.filter(e => !e.closed);
    console.log(`\n开放中的 NBA events: ${openNBA.length} 个\n`);
    
    if (openNBA.length > 0) {
      console.log('====== 所有开放中的 NBA Events ======\n');
      openNBA.forEach((e, idx) => {
        console.log(`${idx + 1}. ${e.title}`);
        console.log(`   日期: ${e.startDate ? new Date(e.startDate).toISOString().split('T')[0] : 'N/A'}`);
        console.log(`   结束: ${e.endDate ? new Date(e.endDate).toISOString().split('T')[0] : 'N/A'}`);
        console.log('');
      });
    }
    
    // 查找今天的
    const today = new Date().toISOString().split('T')[0];
    const todayEvents = nbaEvents.filter(e => {
      const startDate = e.startDate ? e.startDate.split('T')[0] : '';
      return startDate === today || startDate === '2025-12-16';
    });
    
    console.log(`\n今天(${today})的 NBA events: ${todayEvents.length} 个\n`);
    
    if (todayEvents.length > 0) {
      todayEvents.forEach(e => {
        console.log(`📍 ${e.title}`);
        console.log(`   状态: ${e.closed ? '已关闭' : '开放中'}`);
        console.log('');
      });
    }
    
  } catch (error: any) {
    console.error('失败:', error.message);
  } finally {
    await cache.disconnect();
    process.exit(0);
  }
}

findRecentNBA();
