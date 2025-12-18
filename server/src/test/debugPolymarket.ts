/**
 * 调试 Polymarket 市场数据
 */

import { polymarketService } from '../services/polymarketService';
import { cache } from '../utils/cache';

async function debugPolymarket() {
  try {
    await cache.initialize();
    
    console.log('\n====== 获取 Polymarket 市场数据 ======\n');
    
    // 获取市场列表
    const markets = await polymarketService.getMarkets({ 
      limit: 100,
      offset: 0,
    });
    
    if (!markets || !Array.isArray(markets)) {
      console.log('❌ 未获取到市场数据');
      return;
    }
    
    console.log(`✓ 获取到 ${markets.length} 个市场\n`);
    
    // 筛选 NBA 相关市场
    console.log('====== 搜索 NBA 相关市场 ======\n');
    
    const nbaMarkets = markets.filter((m: any) => {
      const question = (m.question || '').toLowerCase();
      const description = (m.description || '').toLowerCase();
      const text = question + ' ' + description;
      
      return text.includes('nba') || 
             text.includes('basketball') ||
             text.includes('celtics') ||
             text.includes('pistons') ||
             text.includes('lakers') ||
             text.includes('warriors');
    });
    
    console.log(`找到 ${nbaMarkets.length} 个 NBA 相关市场：\n`);
    
    if (nbaMarkets.length === 0) {
      console.log('⚠️ 没有找到 NBA 相关市场');
      console.log('\n显示所有开放市场的前20个：\n');
      markets.slice(0, 20).forEach((m: any, idx: number) => {
        console.log(`${idx + 1}. ${m.question || m.title || 'No question'}`);
        console.log(`   状态: ${m.closed ? '已关闭' : '开放中'}`);
      });
    } else {
      nbaMarkets.forEach((m: any, idx: number) => {
        console.log(`${idx + 1}. 问题: ${m.question || m.title}`);
        console.log(`   完整描述: ${m.description || 'N/A'}`);
        console.log(`   市场ID: ${m.condition_id || m.id}`);
        console.log(`   状态: ${m.closed ? '已关闭' : '开放中'}`);
        console.log(`   active: ${m.active}`);
        console.log(`   结束时间: ${m.end_date_iso || m.endDate || 'N/A'}`);
        
        // 显示完整的市场数据结构
        console.log(`   市场字段:`, Object.keys(m));
        
        // 显示代币信息
        const tokens = m.tokens || m.outcomes || [];
        if (Array.isArray(tokens) && tokens.length > 0) {
          console.log(`   结果选项 (${tokens.length}个):`);
          tokens.forEach((token: any, i: number) => {
            const price = token.price || token.last_price || 'N/A';
            const tokenId = token.token_id || token.id || 'N/A';
            const outcome = token.outcome || token.name || 'Outcome';
            console.log(`     ${i + 1}. ${outcome}:`);
            console.log(`        - 价格: $${price}`);
            console.log(`        - Token ID: ${tokenId}`);
            console.log(`        - 代币字段:`, Object.keys(token));
          });
        } else {
          console.log(`   代币数据类型: ${typeof tokens}`);
          console.log(`   代币原始数据:`, tokens);
        }
        console.log('\n' + '-'.repeat(80) + '\n');
      });
    }
    
    // 测试搜索特定比赛
    console.log('\n====== 测试搜索：Boston Celtics vs Detroit Pistons ======\n');
    
    const testMarket = await polymarketService.searchNBAMarkets('Boston Celtics', 'Detroit Pistons');
    
    if (testMarket) {
      console.log('✓ 找到市场！');
      console.log('市场数据:', JSON.stringify(testMarket, null, 2));
    } else {
      console.log('❌ 未找到匹配市场');
      
      // 尝试使用简称搜索
      console.log('\n尝试使用简称搜索：Celtics vs Pistons');
      const testMarket2 = await polymarketService.searchNBAMarkets('Celtics', 'Pistons');
      
      if (testMarket2) {
        console.log('✓ 使用简称找到市场！');
        console.log('市场数据:', JSON.stringify(testMarket2, null, 2));
      } else {
        console.log('❌ 使用简称仍未找到');
      }
    }
    
  } catch (error: any) {
    console.error('调试失败:', error.message);
    if (error.response) {
      console.error('API 响应:', error.response.data);
    }
  } finally {
    await cache.disconnect();
    process.exit(0);
  }
}

debugPolymarket();
