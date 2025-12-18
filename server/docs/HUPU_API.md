# 虎扑 API 使用说明

## 🎯 重要发现

虎扑 API 实际上提供了 **12月11日到12月23日** 期间的所有 NBA 比赛数据！

## 📡 API 端点

```
GET https://games.mobileapi.hupu.com/1/7.5.60/basketballapi/scheduleList?competitionTag=nba
```

## 📊 数据结构

### 响应格式

```json
{
  "errorCode": "",
  "errorMsg": "",
  "result": {
    "scheduleListStats": {
      "earliestDate": "20210220",
      "latestDate": "20260413",
      "currentDate": "20251215"
    },
    "gameList": [
      {
        "day": "20251211",
        "dayBlock": "12月11日 周四",
        "matchList": [
          {
            "matchId": "1444478068465860608",
            "matchStatus": "COMPLETED",  // NOTSTARTED / LIVE / COMPLETED
            "homeScore": 138,
            "awayScore": 89,
            "homeTeamId": "1901000000501329",
            "awayTeamId": "1901000000501327",
            "homeTeamName": "雷霆",
            "awayTeamName": "太阳",
            "homeTeamLogo": "http://...",
            "awayTeamLogo": "http://...",
            "currentQuarter": 4,
            "beginTime": 1765413000,
            "chinaStartTime": 1765413000000,
            "matchTime": "2025-12-11 08:30:00",
            "costTime": "2:06",
            "winTeamName": "雷霆"
          }
        ]
      },
      {
        "day": "20251212",
        "matchList": [...]
      }
    ]
  }
}
```

### 关键字段说明

| 字段 | 说明 | 示例 |
|------|------|------|
| `matchId` | 比赛ID | "1444478068465860608" |
| `matchStatus` | 比赛状态 | NOTSTARTED / LIVE / COMPLETED |
| `homeTeamName` | 主队名称 | "雷霆" |
| `awayTeamName` | 客队名称 | "太阳" |
| `homeScore` | 主队得分 | 138 |
| `awayScore` | 客队得分 | 89 |
| `currentQuarter` | 当前节次 | 1-4 (常规), 5+ (加时) |
| `chinaStartTime` | 中国时间戳（毫秒） | 1765413000000 |
| `costTime` | 比赛耗时 | "2:06" |
| `winTeamName` | 获胜球队 | "雷霆" |

## 🔧 更新的实现

### 1. 获取所有比赛

```typescript
// 扁平化所有日期的比赛
const allGames = await hupuService.getAllGames();
console.log(`获取到 ${allGames.length} 场比赛`);
```

### 2. 获取今日比赛

```typescript
const todayGames = await hupuService.getTodayGames();
```

### 3. 获取进行中的比赛

```typescript
const liveGames = await hupuService.getLiveGames();
```

### 4. 根据球队查找比赛

```typescript
const game = await hupuService.getGameByTeams('雷霆', '太阳');
```

## ✅ 优势

1. **数据范围广**：提供近2周的比赛数据
2. **更新及时**：实时比分和状态
3. **数据完整**：包含球队信息、比分、时间等
4. **免费访问**：无需认证
5. **中文友好**：球队名称为中文

## 📈 测试结果

运行测试：
```bash
npm run test:quick
```

预期输出：
```
从虎扑获取到 XX 场比赛
✓ 包含已完成、进行中和未开始的比赛
✓ 数据完整：球队名称、比分、状态
```

## 🔄 数据更新频率

- **建议刷新间隔**：3秒（比赛进行中）
- **缓存策略**：
  - 未开始：120秒
  - 进行中：3秒
  - 已结束：24小时

## 💡 使用建议

### 筛选今日比赛

```typescript
const today = new Date().toISOString().split('T')[0].replace(/-/g, '');
const todayGames = allGames.filter(game => {
  const gameDate = new Date(game.chinaStartTime)
    .toISOString()
    .split('T')[0]
    .replace(/-/g, '');
  return gameDate === today;
});
```

### 筛选进行中的比赛

```typescript
const liveGames = allGames.filter(game => {
  const status = game.matchStatus;
  return status !== 'NOTSTARTED' && status !== 'COMPLETED';
});
```

### 球队名称匹配

虎扑使用中文球队名称，需要映射：

```typescript
// 使用球队映射配置
import { findTeamByHupuName } from '../config/teamMappings';

const team = findTeamByHupuName('雷霆');
// 输出: { espnId: 'OKC', chineseName: '雷霆', englishName: 'Thunder' }
```

## 🐛 常见问题

### Q: 为什么之前显示 "0场比赛"？

**A**: 之前的实现假设数据在 `result.scheduleList`，但实际是 `result.gameList[]`，每个元素是一天的比赛数据。

### Q: 如何获取特定日期的比赛？

**A**: API 参数支持 `date` 参数（格式：YYYY-MM-DD），但默认返回所有可用日期。

### Q: 比赛状态有哪些？

**A**: 
- `NOTSTARTED` - 未开始
- `LIVE` - 进行中
- `COMPLETED` - 已结束

## 🎯 下一步优化

1. **添加日期过滤**：只获取需要的日期范围
2. **球队映射**：自动转换中英文名称
3. **数据缓存**：根据比赛状态智能缓存
4. **WebHook 通知**：比赛开始/结束时推送

## 📚 相关文档

- [虎扑官网](https://hupu.com)
- [球队映射配置](../src/config/teamMappings.ts)
- [数据聚合器](../src/services/dataAggregator.ts)
