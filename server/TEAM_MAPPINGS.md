# NBA 球队映射配置说明

## 📋 概述

`src/config/teamMappings.ts` 包含了 NBA 全部 30 支球队的映射配置，用于在不同数据源之间进行球队匹配。

---

## 🏀 球队映射结构

```typescript
interface TeamMapping {
  id: string;           // 球队缩写 ID (如 "LAL")
  espnId: string;       // ESPN 球队 ID
  espnName: string;     // ESPN 英文全名 (如 "Los Angeles Lakers")
  espnAbbr: string;     // ESPN 缩写 (如 "LAL")
  chineseName: string;   // 中文名 (如 "湖人")
  polyKeywords: string[]; // Polymarket 关键词列表
  conference: 'East' | 'West'; // 分区
  division: string;     // 赛区
}
```

---

## 🎯 关键设计：polyKeywords

### 关键词优先级

**按优先级从高到低排列**：

1. **核心队名**（首选）：`Lakers`, `Celtics`, `Heat`
2. **球队缩写**：`LAL`, `BOS`, `MIA`
3. **常见变体**：`LA Lakers`, `NY Knicks`
4. **完整名称**（最后）：`Los Angeles Lakers`, `Miami Heat`

### 设计原因

Polymarket 市场的问题描述**通常省略城市名**，只使用核心队名：

- ✅ `"Will the Lakers beat the Warriors on Jan 15?"`
- ✅ `"Lakers vs Warriors - Jan 15, 2025"`
- ❌ ~~`"Will the Los Angeles Lakers beat Golden State?"`~~ （较少见）

---

## 📝 示例配置

### 洛杉矶湖人队

```typescript
{
  id: 'LAL',
  espnId: '13',
  espnName: 'Los Angeles Lakers',
  espnAbbr: 'LAL',
  chineseName: '湖人',
  polyKeywords: ['Lakers', 'LAL', 'LA Lakers', 'L.A. Lakers', 'Los Angeles Lakers'],
  conference: 'West',
  division: 'Pacific',
}
```

**匹配优先级**：
1. `Lakers` - ⭐ 最优先（核心队名）
2. `LAL` - 缩写
3. `LA Lakers` - 常见变体
4. `L.A. Lakers` - 带点号变体
5. `Los Angeles Lakers` - 完整名称

### 迈阿密热火队

```typescript
{
  id: 'MIA',
  espnId: '14',
  espnName: 'Miami Heat',
  espnAbbr: 'MIA',
  chineseName: '热火',
  polyKeywords: ['Heat', 'MIA', 'Miami Heat'],
  conference: 'East',
  division: 'Southeast',
}
```

**匹配优先级**：
1. `Heat` - ⭐ 最优先（核心队名）
2. `MIA` - 缩写
3. `Miami Heat` - 完整名称

---

## 🔍 使用方法

### 1. 根据 ESPN 名称查找球队

```typescript
import { findTeamByESPNName } from './config/teamMappings';

const team = findTeamByESPNName('Los Angeles Lakers');
// 返回: TeamMapping { id: 'LAL', ... }
```

### 2. 根据中文名称查找球队

```typescript
import { findTeamByChineseName } from './config/teamMappings';

const team = findTeamByChineseName('湖人');
// 返回: TeamMapping { id: 'LAL', ... }
```

### 3. 根据 Polymarket 关键词查找

```typescript
import { findTeamByPolyKeyword } from './config/teamMappings';

const team = findTeamByPolyKeyword('Lakers beat Warriors');
// 返回: TeamMapping { id: 'LAL', ... }
```

### 4. 匹配比赛双方

```typescript
import { matchTeams } from './config/teamMappings';

const { home, away } = matchTeams('Lakers', 'Warriors', 'poly');
// home: TeamMapping { id: 'LAL', ... }
// away: TeamMapping { id: 'GSW', ... }
```

---

## 🛠️ 维护指南

### 添加新球队

如果 NBA 扩军或有球队更名：

```typescript
{
  id: 'NEW',
  espnId: 'XX',
  espnName: 'New Team Name',
  espnAbbr: 'NEW',
  chineseName: '新队名',
  polyKeywords: [
    'CoreName',      // 核心队名（最重要）
    'NEW',           // 缩写
    'New Team Name'  // 完整名称
  ],
  conference: 'East', // 或 'West'
  division: 'Division',
}
```

### 更新关键词

如果发现 Polymarket 使用了新的命名方式：

1. 在 `polyKeywords` 数组前面添加新关键词
2. 保持核心队名在第一位
3. 避免添加单独的城市名

**示例**：如果发现 Polymarket 使用 "LeBron's Lakers"

```typescript
polyKeywords: [
  'Lakers',           // 核心队名（保持第一位）
  'LeBron\'s Lakers', // 添加新发现的关键词
  'LAL',
  'LA Lakers',
  'Los Angeles Lakers'
]
```

---

## 📊 30支球队完整列表

### 东部联盟

#### 大西洋赛区
- **BOS** - Boston Celtics (凯尔特人)
- **BKN** - Brooklyn Nets (篮网)
- **NYK** - New York Knicks (尼克斯)
- **PHI** - Philadelphia 76ers (76人)
- **TOR** - Toronto Raptors (猛龙)

#### 中部赛区
- **CHI** - Chicago Bulls (公牛)
- **CLE** - Cleveland Cavaliers (骑士)
- **DET** - Detroit Pistons (活塞)
- **IND** - Indiana Pacers (步行者)
- **MIL** - Milwaukee Bucks (雄鹿)

#### 东南赛区
- **ATL** - Atlanta Hawks (老鹰)
- **CHA** - Charlotte Hornets (黄蜂)
- **MIA** - Miami Heat (热火)
- **ORL** - Orlando Magic (魔术)
- **WAS** - Washington Wizards (奇才)

### 西部联盟

#### 西北赛区
- **DEN** - Denver Nuggets (掘金)
- **MIN** - Minnesota Timberwolves (森林狼)
- **OKC** - Oklahoma City Thunder (雷霆)
- **POR** - Portland Trail Blazers (开拓者)
- **UTA** - Utah Jazz (爵士)

#### 太平洋赛区
- **GSW** - Golden State Warriors (勇士)
- **LAC** - LA Clippers (快船)
- **LAL** - Los Angeles Lakers (湖人)
- **PHX** - Phoenix Suns (太阳)
- **SAC** - Sacramento Kings (国王)

#### 西南赛区
- **DAL** - Dallas Mavericks (独行侠)
- **HOU** - Houston Rockets (火箭)
- **MEM** - Memphis Grizzlies (灰熊)
- **NOP** - New Orleans Pelicans (鹈鹕)
- **SAS** - San Antonio Spurs (马刺)

---

## ⚠️ 特殊注意事项

### 1. 洛杉矶双雄

- **Lakers (LAL)**: `polyKeywords: ['Lakers', 'LAL', 'LA Lakers', ...]`
- **Clippers (LAC)**: `polyKeywords: ['Clippers', 'LAC', 'LA Clippers', ...]`

**避免混淆**：搜索时同时检查主客队，避免单纯 "LA" 导致误匹配。

### 2. 纽约双雄

- **Knicks (NYK)**: `polyKeywords: ['Knicks', 'NYK', 'NY Knicks', ...]`
- **Nets (BKN)**: `polyKeywords: ['Nets', 'BKN', 'Brooklyn Nets', ...]`

### 3. Trail Blazers

- **关键词顺序**: `['Blazers', 'Trail Blazers', 'POR', ...]`
- **原因**: Polymarket 更常用 "Blazers" 而非 "Trail Blazers"

### 4. Timberwolves

- **关键词顺序**: `['Timberwolves', 'Wolves', 'MIN', ...]`
- **原因**: 两种简称都很常见

---

## 🔗 相关文件

- **配置文件**: `src/config/teamMappings.ts`
- **使用示例**: `src/services/polymarketService.ts` (line 340-369)
- **测试脚本**: `src/test/debugPolymarket.ts`

---

## 📖 扩展阅读

- [API.md](./API.md) - API 接口文档
- [DEVELOPMENT.md](./DEVELOPMENT.md) - 开发指南
