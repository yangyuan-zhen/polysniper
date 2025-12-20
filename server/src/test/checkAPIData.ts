/**
 * 检查 API 返回的数据
 */

import axios from 'axios';

async function checkAPIData() {
  try {
    const response = await axios.get('http://localhost:3000/api/matches');
    
    // API 返回格式: { success: true, data: matches[], timestamp, cached }
    const apiResponse = response.data;
    const matches = apiResponse.data || [];
    
    console.log('='.repeat(60));
    console.log('API 数据检查');
    console.log('='.repeat(60));
    console.log('\n📊 总比赛数:', matches.length);
    
    const withESPN = matches.filter((m: any) => m.dataCompleteness.hasESPNData);
    const withPoly = matches.filter((m: any) => m.dataCompleteness.hasPolyData);
    
    console.log('✅ 有 ESPN 数据:', withESPN.length);
    console.log('✅ 有 Polymarket 数据:', withPoly.length);
    
    console.log('\n' + '='.repeat(60));
    console.log('前 5 场比赛详情:');
    console.log('='.repeat(60));
    
    matches.slice(0, 5).forEach((match: any, i: number) => {
      console.log(`\n${i + 1}. ${match.homeTeam.name} vs ${match.awayTeam.name}`);
      console.log(`   状态: ${match.status} - ${match.statusStr}`);
      console.log(`   开始时间: ${new Date(match.startTime).toLocaleString('zh-CN')}`);
      console.log(`   数据完整性:`);
      console.log(`      - hasESPNData: ${match.dataCompleteness.hasESPNData}`);
      console.log(`      - hasPolyData: ${match.dataCompleteness.hasPolyData}`);
      console.log(`      - hasHupuData: ${match.dataCompleteness.hasHupuData}`);
      
      if (match.dataCompleteness.hasESPNData) {
        console.log(`   ESPN 数据:`);
        console.log(`      - 主队胜率: ${(match.espn.homeWinProb * 100).toFixed(1)}%`);
        console.log(`      - 客队胜率: ${(match.espn.awayWinProb * 100).toFixed(1)}%`);
        console.log(`      - 赛前主队: ${(match.espn.pregameHomeWinProb * 100).toFixed(1)}%`);
        console.log(`      - 赛前客队: ${(match.espn.pregameAwayWinProb * 100).toFixed(1)}%`);
        console.log(`      - 伤病数: ${match.espn.injuries ? match.espn.injuries.length : 0}`);
      } else {
        console.log(`   ❌ 无 ESPN 数据`);
      }
      
      if (match.dataCompleteness.hasPolyData) {
        console.log(`   Polymarket 数据:`);
        console.log(`      - 主队价格: $${match.poly.homePrice.toFixed(2)}`);
        console.log(`      - 客队价格: $${match.poly.awayPrice.toFixed(2)}`);
      }
    });
    
  } catch (error: any) {
    console.error('检查失败:', error.message);
  }
}

checkAPIData();
