/**
 * 调试 Polymarket Sports API
 * 尝试找到正确的体育/NBA 市场端点
 */

import axios from 'axios';
import { cache } from '../utils/cache';

async function debugSportsAPI() {
  try {
    await cache.initialize();
    
    const gammaApiUrl = 'https://gamma-api.polymarket.com';
    
    console.log('\n====== 测试不同的 API 端点和参数 ======\n');
    
    // 尝试不同的查询方式
    const testCases = [
      { name: 'sports 参数', params: { sport: 'nba', limit: 50 } },
      { name: 'tag 参数 - sports', params: { tag: 'sports', limit: 50 } },
      { name: 'tag 参数 - nba', params: { tag: 'nba', limit: 50 } },
      { name: 'tag 参数 - NBA', params: { tag: 'NBA', limit: 50 } },
      { name: 'tag 参数 - basketball', params: { tag: 'basketball', limit: 50 } },
      { name: 'category 参数 - sports', params: { category: 'sports', limit: 50 } },
      { name: 'category 参数 - Sports', params: { category: 'Sports', limit: 50 } },
      { name: 'category 参数 - NBA', params: { category: 'NBA', limit: 50 } },
      { name: 'active + tag', params: { active: true, tag: 'nba', limit: 50 } },
      { name: 'closed=false + tag', params: { closed: false, tag: 'sports', limit: 50 } },
    ];
    
    for (const test of testCases) {
      console.log(`\n测试: ${test.name}`);
      console.log(`参数: ${JSON.stringify(test.params)}`);
      
      try {
        const response = await axios.get(`${gammaApiUrl}/markets`, {
          params: test.params,
          timeout: 10000,
        });
        
        const markets = response.data || [];
        console.log(`✓ 获取到 ${markets.length} 个市场`);
        
        if (markets.length > 0) {
          // 显示前3个市场的问题
          markets.slice(0, 3).forEach((m: any, idx: number) => {
            console.log(`  ${idx + 1}. ${m.question}`);
          });
          
          // 检查是否有 NBA 比赛
          const nbaGames = markets.filter((m: any) => {
            const text = `${m.question} ${m.description}`.toLowerCase();
            return (text.includes('celtics') || text.includes('lakers') || 
                    text.includes('warriors') || text.includes('pistons')) &&
                   (text.includes('vs') || text.includes('beat') || text.includes('win'));
          });
          
          if (nbaGames.length > 0) {
            console.log(`  🎯 找到 ${nbaGames.length} 个疑似 NBA 比赛市场！`);
            nbaGames.forEach((m: any) => {
              console.log(`    - ${m.question}`);
            });
          }
        }
      } catch (error: any) {
        console.log(`✗ 失败: ${error.message}`);
      }
    }
    
    // 尝试直接访问可能的体育端点
    console.log('\n\n====== 测试可能的专用端点 ======\n');
    
    const endpoints = [
      '/sports',
      '/sports/nba',
      '/sports/markets',
      '/nba',
      '/nba/markets',
      '/nba/games',
      '/events',
      '/events/nba',
    ];
    
    for (const endpoint of endpoints) {
      console.log(`\n测试端点: ${gammaApiUrl}${endpoint}`);
      
      try {
        const response = await axios.get(`${gammaApiUrl}${endpoint}`, {
          timeout: 10000,
        });
        
        console.log(`✓ 成功！状态: ${response.status}`);
        const data = response.data;
        
        if (Array.isArray(data)) {
          console.log(`  返回数组，长度: ${data.length}`);
          if (data.length > 0) {
            console.log(`  第一个元素的字段:`, Object.keys(data[0]));
            console.log(`  示例:`, JSON.stringify(data[0], null, 2).substring(0, 300));
          }
        } else if (typeof data === 'object') {
          console.log(`  返回对象，字段:`, Object.keys(data));
          console.log(`  内容:`, JSON.stringify(data, null, 2).substring(0, 300));
        }
      } catch (error: any) {
        if (error.response) {
          console.log(`✗ ${error.response.status} ${error.response.statusText}`);
        } else {
          console.log(`✗ ${error.message}`);
        }
      }
    }
    
    // 查看 API 文档端点
    console.log('\n\n====== 尝试获取 API 信息 ======\n');
    
    const infoEndpoints = ['/', '/docs', '/api', '/swagger', '/openapi.json'];
    
    for (const endpoint of infoEndpoints) {
      try {
        const response = await axios.get(`${gammaApiUrl}${endpoint}`, {
          timeout: 5000,
        });
        console.log(`✓ ${endpoint}: ${response.status}`);
        if (typeof response.data === 'string' && response.data.length < 500) {
          console.log(`  内容: ${response.data.substring(0, 200)}`);
        }
      } catch (error: any) {
        // 忽略错误
      }
    }
    
  } catch (error: any) {
    console.error('调试失败:', error.message);
  } finally {
    await cache.disconnect();
    process.exit(0);
  }
}

debugSportsAPI();
