# 实时比赛时间数据说明

## 🕐 虎扑 API 提供的时间数据

根据你的前端项目需求，后端已完整支持以下实时时间数据：

### 1. 比赛状态字段

| 字段 | 类型 | 说明 | 示例 |
|------|------|------|------|
| `matchStatus` | string | 比赛状态 | "NOTSTARTED" / "LIVE" / "COMPLETED" |
| `matchStatusChinese` | string | 中文状态描述 | "已结束" / "第四节 05:30" |
| `currentQuarter` | number | 当前节次 | 1-4 (常规), 5+ (加时) |
| `costTime` | string | 比赛耗时 | "2:06" |
| `matchTime` | string | 开始时间 | "2025-12-15 08:00:00" |
| `chinaStartTime` | number | 中国时间戳（毫秒） | 1765413000000 |
| `beginTime` | number | 开始时间戳（秒） | 1765413000 |

### 2. 节次解析（Quarter）

**未开始：**
```json
{
  "quarter": "未开始",
  "timeRemaining": "2025-12-15 08:00:00"
}
```

**进行中：**
```json
{
  "quarter": "Q4",  // Q1, Q2, Q3, Q4, OT, OT2...
  "timeRemaining": "第四节 05:30"  // 虎扑提供的中文描述
}
```

**已结束：**
```json
{
  "quarter": "FINAL",
  "timeRemaining": "2:06"  // 总耗时
}
```

### 3. 完整数据示例

#### 未开始的比赛
```json
{
  "matchId": "1405864801686519808",
  "homeTeamName": "独行侠",
  "awayTeamName": "76人",
  "homeScore": null,
  "awayScore": null,
  "matchStatus": "NOTSTARTED",
  "matchStatusChinese": "未开始",
  "currentQuarter": 1,
  "matchTime": "2025-12-21 08:00:00",
  "chinaStartTime": 1766275200000,
  "costTime": null
}
```

#### 进行中的比赛
```json
{
  "matchId": "1444478071276044288",
  "homeTeamName": "骑士",
  "awayTeamName": "黄蜂",
  "homeScore": 111,
  "awayScore": 119,
  "matchStatus": "LIVE",
  "matchStatusChinese": "第四节",
  "currentQuarter": 5,  // 加时
  "matchTime": "2025-12-15 04:30:00",
  "chinaStartTime": 1765744200000,
  "costTime": ""  // 进行中时为空
}
```

#### 已结束的比赛
```json
{
  "matchId": "1444478068465860608",
  "homeTeamName": "雷霆",
  "awayTeamName": "太阳",
  "homeScore": 138,
  "awayScore": 89,
  "matchStatus": "COMPLETED",
  "matchStatusChinese": "已结束",
  "currentQuarter": 4,
  "matchTime": "2025-12-11 08:30:00",
  "chinaStartTime": 1765413000000,
  "costTime": "2:06",
  "winTeamName": "雷霆"
}
```

## 📊 前端集成建议

### 1. 显示比赛时间

```typescript
function getMatchTimeDisplay(match: any): string {
  const status = match.matchStatus;
  
  if (status === 'NOTSTARTED') {
    // 未开始：显示开始时间
    return match.matchTime; // "2025-12-15 08:00:00"
  } else if (status === 'COMPLETED') {
    // 已结束：显示总耗时
    return `已结束 (${match.costTime})`;
  } else {
    // 进行中：显示节次和状态
    const quarter = `Q${match.currentQuarter > 4 ? 'OT' + (match.currentQuarter - 4) : match.currentQuarter}`;
    return `${quarter} ${match.matchStatusChinese || '进行中'}`;
  }
}
```

### 2. 判断比赛阶段

```typescript
function getMatchPhase(match: any): string {
  const quarter = match.currentQuarter;
  
  if (match.matchStatus === 'NOTSTARTED') return '未开始';
  if (match.matchStatus === 'COMPLETED') return '已结束';
  
  // 进行中
  if (quarter <= 2) return '上半场';
  if (quarter <= 4) return '下半场';
  return '加时';
}
```

### 3. 时间因素权重

参考你的前端策略，时间因素影响套利信号置信度：

```typescript
function getTimeWeightFactor(match: any): number {
  const quarter = match.currentQuarter;
  const status = match.matchStatus;
  
  if (status !== 'LIVE') return 0;
  
  // Q1-Q2: 早期，机会大，权重高
  if (quarter <= 2) return 1.2;
  
  // Q3: 中期，权重正常
  if (quarter === 3) return 1.0;
  
  // Q4前半段: 权重略降
  if (quarter === 4) return 0.8;
  
  // 加时: 变数小，权重低
  return 0.5;
}
```

## 🔄 更新频率

根据你的前端设计：

### HTTP Keep-Alive 优化后的性能
- **更新频率**：5秒
- **响应时间**：~300ms（优化前 ~896ms）
- **性能提升**：66%

### 后端配置
```typescript
// src/config/index.ts
hupu: {
  apiUrl: 'https://games.mobileapi.hupu.com/1/7.5.60/basketballapi',
  updateInterval: 5000, // 5秒更新一次（实时比赛）
}
```

### 缓存策略
```typescript
// 根据比赛状态动态调整
if (status === 'LIVE') {
  cacheTTL = 3;  // 3秒（实时更新）
} else if (status === 'NOTSTARTED') {
  cacheTTL = 120;  // 2分钟
} else {
  cacheTTL = 86400;  // 24小时
}
```

## 🎯 API 端点

### 获取所有比赛
```http
GET http://localhost:3000/api/matches
```

返回包含完整时间信息的所有比赛：
```json
[
  {
    "id": "1444478071276044288-20251215",
    "homeTeam": {
      "id": "1901000000501288",
      "name": "骑士",
      "score": 111,
      "logo": "http://..."
    },
    "awayTeam": {
      "id": "1901000000501334",
      "name": "黄蜂",
      "score": 119,
      "logo": "http://..."
    },
    "status": "LIVE",
    "statusStr": "Q5 (加时)",
    "startTime": "2025-12-15 04:30:00",
    "hupu": {
      "homeScore": 111,
      "awayScore": 119,
      "quarter": "OT1",
      "timeRemaining": "第五节",
      "status": "LIVE"
    }
  }
]
```

### WebSocket 实时推送
```javascript
socket.on('matchesUpdate', (data) => {
  // 每5秒推送一次实时数据
  console.log('实时更新:', data);
});
```

## 📝 前端显示效果

根据你的项目设计，应该显示：

### 比赛卡片

**未开始：**
```
🏀 湖人 vs 快船
⏰ 2025-12-21 11:30
📊 预测胜率: 湖人 58% | 快船 42%
```

**进行中：**
```
🏀 骑士 111 vs 黄蜂 119
⏱️ Q5 (加时)
📊 实时胜率: 骑士 35% | 黄蜂 65%
💰 价格: 0.32¢ | 0.68¢
🎯 信号: 强卖出黄蜂 (置信度 85%)
```

**已结束：**
```
🏀 雷霆 138 vs 太阳 89
✅ 已结束 (2:06)
🏆 雷霆获胜
```

## 🔍 调试工具

### 查看实时数据
```bash
# 获取所有比赛
curl http://localhost:3000/api/matches

# 获取进行中的比赛（筛选 status=LIVE）
curl http://localhost:3000/api/matches | jq '.[] | select(.status=="LIVE")'

# 查看虎扑原始数据
curl "https://games.mobileapi.hupu.com/1/7.5.60/basketballapi/scheduleList?competitionTag=nba"
```

## ✅ 已实现的功能

- ✅ 12月11日-23日完整比赛数据
- ✅ 实时比分更新（5秒）
- ✅ 节次信息（Q1-Q4, OT）
- ✅ 比赛状态（未开始/进行中/已结束）
- ✅ 比赛开始时间
- ✅ 比赛耗时
- ✅ 中文状态描述
- ✅ 智能缓存策略
- ✅ WebSocket 实时推送

## 🚀 测试

```bash
# 运行快速测试
npm run test:quick

# 启动开发服务器
npm run dev

# 查看实时日志
tail -f logs/combined.log
```

预期输出：
```
[info]: 从虎扑获取到 XX 场比赛
[debug]: 比赛状态：进行中 3场，未开始 5场，已结束 10场
[info]: 实时数据每5秒更新
```

## 📚 相关文档

- [虎扑 API 说明](./HUPU_API.md)
- [前端项目](https://github.com/yangyuan-zhen/polysniper)
- [WebSocket 文档](./WEBSOCKET.md)
