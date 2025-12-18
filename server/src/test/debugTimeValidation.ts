/**
 * 调试时间校验问题
 */

// 用户日志中的时间
const polyEndDate = "2025-12-17T01:30:00Z";
const hupuStartTime = 1765935000000;

console.log('========================================');
console.log('    时间校验调试');
console.log('========================================\n');

console.log('📅 Polymarket endDate (ISO 字符串):');
console.log(`   原始值: ${polyEndDate}`);
const polyEndTime = new Date(polyEndDate).getTime();
console.log(`   转换后: ${polyEndTime} (毫秒时间戳)`);
console.log(`   可读时间: ${new Date(polyEndTime).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })} (北京时间)`);
console.log(`   可读时间: ${new Date(polyEndTime).toISOString()} (UTC)`);

console.log('\n🏀 Hupu startTime (毫秒时间戳):');
console.log(`   原始值: ${hupuStartTime}`);
const hupuStart = new Date(hupuStartTime).getTime();
console.log(`   转换后: ${hupuStart} (毫秒时间戳)`);
console.log(`   可读时间: ${new Date(hupuStart).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })} (北京时间)`);
console.log(`   可读时间: ${new Date(hupuStart).toISOString()} (UTC)`);

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('⏰ 时间对比:\n');

const diffMs = polyEndTime - hupuStart;
const diffMinutes = Math.round(diffMs / 1000 / 60);
const diffHours = (diffMs / 1000 / 3600).toFixed(1);

console.log(`   Polymarket endDate:  ${new Date(polyEndTime).toISOString()}`);
console.log(`   Hupu startTime:      ${new Date(hupuStart).toISOString()}`);
console.log(`   时间差: ${diffMinutes} 分钟 (${diffHours} 小时)`);

console.log('\n🔍 校验结果:');
if (polyEndTime <= hupuStart) {
  console.log(`   ❌ 校验失败: endDate <= startTime`);
  console.log(`   原因: Polymarket 市场在比赛开始前就结束了`);
} else {
  console.log(`   ✅ 校验通过: endDate > startTime`);
  console.log(`   说明: Polymarket 市场会在比赛开始后 ${diffMinutes} 分钟结束`);
}

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('💡 说明:\n');
console.log('这个校验的目的是防止匹配到错误的市场。');
console.log('');
console.log('正常情况:');
console.log('  比赛开始时间: 2025-12-17 03:30 (北京时间)');
console.log('  市场结束时间: 2025-12-17 06:00 (比赛结束后)');
console.log('  ✅ endDate > startTime，校验通过');
console.log('');
console.log('异常情况:');
console.log('  比赛开始时间: 2025-12-17 03:30 (北京时间)');
console.log('  市场结束时间: 2025-12-17 01:30 (比赛开始前！)');
console.log('  ❌ endDate < startTime，校验失败');
console.log('  可能原因: 匹配到了同名球队的另一场比赛的市场');
console.log('\n========================================\n');
