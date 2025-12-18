# NBA Game Matching Logic - The Funnel Model

## 概述 (Overview)

本系统采用**三层漏斗模型 (Three-Layer Funnel)**进行精准的NBA比赛匹配，确保虎扑、Polymarket、ESPN三个数据源的数据能够准确对应到同一场比赛。

---

## 漏斗模型 (The Funnel)

### 第一层：范围锁定 (Scope Filtering)
**位置**: `src/services/polymarketService.ts:325-369`

**条件**:
- 只向 Polymarket 请求 `series_id = "10345"` (NBA 2026 赛季)
- 必须 `active = true` (进行中/未结算)
- 必须 `closed = false` (未关闭)
- 注意：不检查 endDate 是否在未来，因为比赛结束后市场可能还需要时间结算

**目的**:
- 排除历史比赛
- 只保留当前的 10-20 场 NBA 比赛
- 隐式利用"时间"维度过滤

**实现**:
```typescript
// API 请求参数
{
  series_id: '10345',  // NBA 2026 series
  active: true,        // 只要进行中/未结算的市场
  closed: false,       // 排除已关闭的市场
}

// 二次过滤（双保险）
const nbaEvents = allEvents.filter((e: any) => {
  if (e.closed === true) return false;
  if (e.active === false) return false;
  
  // 必须是 NBA 相关
  const text = `${e.title} ${e.slug} ${e.category}`.toLowerCase();
  if (!text.includes('nba') && !text.includes('basketball')) return false;
  
  // 注意：不检查 endDate 是否在未来，因为比赛结束后市场可能还需要时间结算
  // active=true 和 closed=false 已经足够过滤了
  
  return true;
});
```

---

### 第二层：名称锚定 (Name Matching)
**位置**: `src/services/polymarketService.ts:386-405`

**条件**:
- Event Title 必须**同时包含**两个队的关键词（如 `Lakers` 和 `Warriors`）
- **不区分主客场顺序**（虎扑和 Polymarket 的主客场定义可能不同）

**目的**:
- 这是最精准的指纹识别
- NBA 不会在同一天有两场相同球队的对决
- 通过同时匹配两个队名确保唯一性

**实现**:
```typescript
const event = nbaEvents.find((e: any) => {
  const title = e.title.toLowerCase();
  const slug = e.slug.toLowerCase();
  
  // 使用 polymarketName 和 abbr 进行匹配
  const homeKeywords = [homeTeamMapping.polymarketName, homeTeamMapping.abbr]
    .map(k => k.toLowerCase());
  const awayKeywords = [awayTeamMapping.polymarketName, awayTeamMapping.abbr]
    .map(k => k.toLowerCase());
  
  const matchedHome = homeKeywords.some(kw => 
    title.includes(kw) || slug.includes(kw)
  );
  const matchedAway = awayKeywords.some(kw => 
    title.includes(kw) || slug.includes(kw)
  );
  
  // 【核心】只有同时匹配两个队才返回 true（不区分主客场顺序）
  // 例如：虎扑的"爵士 vs 独行侠"可以匹配到 Polymarket 的"Mavericks vs. Jazz"
  if (matchedHome && matchedAway) {
    logger.info(`[Layer 2] ✅ 名称匹配成功: "${e.title}"`);
    return true;
  }
  
  return false;
});
```

---

### 第三层：时间校验 (Time Validation)
**位置**: `src/services/dataAggregator.ts:122-141`

**条件**:
- Polymarket 的 `endDate` **不能早于**虎扑的 `startTime`
- **允许 `endDate == startTime`**（市场在比赛开始时关闭，这是正常的）

**目的**:
- 防止匹配到下周同名对决
- 比如今天 Lakers vs Warriors，不要匹配到下周的 Lakers vs Warriors 市场

**说明**:
- Polymarket 的 `endDate` 通常等于比赛开始时间（市场关闭，不能再下注）
- 比赛结束后市场仍然 `active=true` 等待结算
- 只有当 `endDate` 明显早于 `startTime` 时才拒绝异常未结算盘口

**实现**:
```typescript
if (polyData) {
  let timeValid = true;
  if (polyData.endDate && match.startTime) {
    const polyEndTime = new Date(polyData.endDate).getTime();
    const hupuStartTime = new Date(match.startTime).getTime();
    
    if (polyEndTime <= hupuStartTime) {
      logger.warn(`[Layer 3] ⚠️ 时间校验失败`);
      timeValid = false;
    } else {
      logger.debug(`[Layer 3] ✅ 时间校验通过`);
    }
  }
  
  // 只有通过时间校验才接受数据
  if (timeValid) {
    match.poly = polyData;
    match.dataCompleteness.hasPolyData = true;
  }
}
```

---

## 数据流 (Data Flow)

```
虎扑 API (获取所有比赛)
    ↓
[虎扑比赛列表] → 预过滤（排除 matchStatus='COMPLETED' 的比赛）
    ↓
[进行中或未开始的比赛] → 遍历每场比赛
    ↓
对每场比赛:
    1. 提取主队名（中文）、客队名（中文）
    2. 调用 polymarketService.searchNBAMarkets(主队, 客队)
        ├─ Layer 1: 范围锁定 (active=true, closed=false, 不检查endDate)
        ├─ Layer 2: 名称锚定 (两队都匹配，不区分主客场顺序，使用中文映射)
        └─ Layer 3: 返回 endDate
    3. 在 dataAggregator 中进行 Layer 3 时间校验
    4. 只有通过全部三层的数据才会被接受
```

---

## 性能优化 (Performance Optimization)

### 预过滤已结束的比赛
**位置**: `src/services/dataAggregator.ts:70-78`

**问题**: 
- 虎扑 API 返回所有比赛（包括已结束的）
- Polymarket 对已结束的比赛不会有 `active=true` 的市场
- 对已结束比赛调用 Polymarket API 是无意义的浪费

**解决方案**:
```typescript
// 过滤掉已结束的比赛（COMPLETED）
const activeGames = games.filter((game: any) => {
  const matchStatus = game.matchStatus || '';
  return matchStatus !== 'COMPLETED';
});

logger.debug(`过滤后剩余 ${activeGames.length} 场进行中或未开始的比赛`);
```

**效果**: 
- 减少不必要的 Polymarket API 调用
- 避免 "无法找到球队映射" 的警告日志
- 提高系统整体性能

### 中文名称映射
**位置**: `src/services/polymarketService.ts:372-378`

**问题**:
- 虎扑返回的是中文队名（如：活塞、老鹰、独行侠）
- 之前错误使用 `findTeamByEnglish` 导致所有映射失败

**解决方案**:
```typescript
// 虎扑传入的是中文名（如：活塞、老鹰），需要使用 findTeamByChinese
const homeTeamMapping = findTeamByChinese(homeTeam);
const awayTeamMapping = findTeamByChinese(awayTeam);
```

**映射表**: `src/config/nbaTeamMap.ts`
```typescript
'DET': {
  chineseName: '活塞',
  englishName: 'Detroit Pistons',
  polymarketName: 'Pistons',
  abbr: 'DET'
}
```

---

## 关键改动 (Key Changes)

### 1. `src/types/index.ts`
添加 `endDate` 字段到 `PolymarketData`:
```typescript
export interface PolymarketData {
  // ... 其他字段
  endDate?: string; // 市场结束时间（用于 Layer 3 时间校验）
}
```

### 2. `src/services/polymarketService.ts`
- 添加 `active: true` 参数到 API 请求 (Layer 1)
- 移除 `endDate < now` 的严格检查，允许比赛结束后的未结算市场 (Layer 1)
- **修复主客场顺序问题**：不区分主客场，只要两队名都在标题中即可 (Layer 2)
- 使用 `findTeamByChinese` 正确处理虎扑的中文队名 (Layer 2)
- 返回 `endDate` 字段用于时间校验 (Layer 3)

### 3. `src/services/dataAggregator.ts`
- 在接受 Polymarket 数据前进行时间校验 (Layer 3)
- 只有通过时间校验的数据才会被标记为 `hasPolyData = true`

---

## 日志标记 (Log Markers)

系统会在日志中标记每一层的处理状态：

```
[Layer 1] 从 Polymarket 获取到 15 个 active 且未关闭的 NBA events
[Layer 1] 筛选后剩余 12 个开放的 NBA events
[Layer 2] 开始名称锚定: Lakers vs Warriors
[Layer 2] 使用 Polymarket 关键词: [Lakers] vs [Warriors]
[Layer 2] ✅ 名称匹配成功: "Lakers vs. Warriors - Winner"
[Layer 3] ✅ 时间校验通过: endDate > startTime
```

---

## 为什么需要三层？

| 层级 | 问题 | 解决方案 |
|------|------|----------|
| **Layer 1** | Polymarket 有数百个市场（包括历史和其他运动） | 只请求 NBA 且 active 的市场，缩小到 10-20 个 |
| **Layer 2** | 可能有多个 Lakers 或 Warriors 的比赛；主客场顺序可能不同 | 必须同时匹配两个队名，不区分主客场，确保唯一性 |
| **Layer 3** | 可能匹配到下周的同名对决 | 验证时间合理性，endDate 必须晚于 startTime |

---

## 测试建议 (Testing)

1. **正常匹配**: Lakers vs Warriors 今天的比赛 → 应该成功匹配
2. **主客场相反**: 虎扑"爵士 vs 独行侠"，Polymarket"Mavericks vs. Jazz" → 应该成功匹配 ✅
3. **历史比赛**: 昨天的 Lakers vs Warriors → Layer 1 过滤掉（active=false 或 closed=true）
4. **未来比赛**: 下周的 Lakers vs Warriors → Layer 3 时间校验失败
5. **单队匹配**: 只有 Lakers 关键词 → Layer 2 失败（缺少 Warriors）
6. **其他运动**: NFL Patriots vs Jets → Layer 1 过滤掉（series_id 不匹配）
7. **已结束未结算**: 比赛结束但市场还未结算 → 应该成功匹配（endDate 可能已过期但 active=true）✅

---

## 维护说明 (Maintenance)

- 如果 Polymarket 的 series_id 更新（如 NBA 2027），需要更新 `series_id: '10345'`
- 球队名称映射在 `src/config/nbaTeamMap.ts` 中维护
- 每一层的日志都有清晰的标记，便于调试和监控

---

## 已解决的问题 (Fixed Issues)

### 问题 #1: 主客场顺序不匹配 (2025-12-16)
**现象**: 测试发现只有 33.3% 的比赛能成功匹配到 Polymarket 价格

**根本原因**: 
- 虎扑: "爵士(主) vs 独行侠(客)"
- Polymarket: "Mavericks(主) vs. Jazz(客)"
- 主客场定义相反，导致匹配失败

**解决方案**: 
修改 Layer 2 逻辑，不区分主客场顺序，只要标题同时包含两个队名即可

**测试结果**: 成功率从 33.3% 提升到 100% ✅

**相关 Commit**: `修复主客场顺序问题`

---

### 问题 #2: 已结束未结算的比赛无法匹配 (2025-12-16)
**现象**: "快船 vs 灰熊" 比赛已结束但仍未匹配到

**根本原因**: 
- 比赛已结束（endDate: 2025-12-16T03:30:00Z 已过期）
- 但市场仍然 active=true, closed=false（等待结算）
- Layer 1 的 `endDate < now` 过滤掉了这种情况

**解决方案**: 
移除 Layer 1 中的 `endDate < now` 检查，因为 `active=true` 和 `closed=false` 已经足够过滤了

**测试结果**: "快船 vs 灰熊" 成功匹配 ✅

**相关 Commit**: `移除endDate时间检查`

---

### 问题 #3: 中文队名映射失败 (2025-12-16)
**现象**: 日志显示 "无法找到球队映射: 活塞 或 老鹰"

**根本原因**: 
- 虎扑返回中文队名（如：活塞、老鹰）
- 代码错误使用 `findTeamByEnglish` 查找

**解决方案**: 
改用 `findTeamByChinese` 函数进行映射

**测试结果**: 所有中文队名成功映射 ✅

**相关 Commit**: `修复球队映射函数调用`
