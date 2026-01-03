# PolySniper 共享类型定义

这个包包含 PolySniper 前端和后端共享的 TypeScript 类型定义。

## 📁 目录结构

```
shared/
├── types/
│   └── index.ts          # 所有共享类型定义
├── package.json          # 包配置
├── tsconfig.json         # TypeScript 配置
└── README.md            # 本文件
```

## 🎯 设计原则

### 1. 单一数据源
- 所有核心业务类型（如 `UnifiedMatch`、`ArbitrageSignal`）只在这里定义一次
- 前后端都引用这些类型，确保一致性

### 2. 职责分离
- **共享类型**: 前后端都需要的数据结构和业务逻辑
- **后端特有类型**: 服务器配置、原始 API 响应等
- **前端特有类型**: UI 状态、用户偏好等

### 3. 版本控制
- 修改共享类型会同时影响前后端的类型检查
- 强制开发者处理类型不兼容问题

## 📦 安装和使用

### 在后端使用

#### 方法 1：使用相对路径（推荐）

```typescript
// server/src/services/dataAggregator.ts
import { UnifiedMatch, ArbitrageSignal, MatchStatus } from '../../../shared/types/index';

export function processMatch(match: UnifiedMatch): ArbitrageSignal[] {
  // 使用共享类型进行类型安全的开发
  if (match.status === MatchStatus.LIVE) {
    // 处理进行中的比赛
  }
  return match.signals;
}
```

#### 方法 2：使用路径别名（需要额外配置）

```typescript
// server/src/services/dataAggregator.ts
import { UnifiedMatch, ArbitrageSignal, MatchStatus } from '@shared/types';

export function processMatch(match: UnifiedMatch): ArbitrageSignal[] {
  // 使用共享类型进行类型安全的开发
  if (match.status === MatchStatus.LIVE) {
    // 处理进行中的比赛
  }
  return match.signals;
}
```

### 在前端使用

#### 方法 1：使用相对路径（推荐）

```typescript
// client/src/components/MatchCard.tsx
import { UnifiedMatch, ArbitrageSignal, getSignalTypeText } from '../../../shared/types/index';

interface MatchCardProps {
  match: UnifiedMatch;
}

export function MatchCard({ match }: MatchCardProps) {
  return (
    <div>
      <h3>{match.homeTeam.name} vs {match.awayTeam.name}</h3>
      {match.signals.map(signal => (
        <div key={signal.timestamp}>
          {getSignalTypeText(signal.type)}
        </div>
      ))}
    </div>
  );
}
```

#### 方法 2：使用路径别名（需要额外配置）

```typescript
// client/src/components/MatchCard.tsx
import { UnifiedMatch, ArbitrageSignal, getSignalTypeText } from '@shared/types';

interface MatchCardProps {
  match: UnifiedMatch;
}

export function MatchCard({ match }: MatchCardProps) {
  return (
    <div>
      <h3>{match.homeTeam.name} vs {match.awayTeam.name}</h3>
      {match.signals.map(signal => (
        <div key={signal.timestamp}>
          {getSignalTypeText(signal.type)}
        </div>
      ))}
    </div>
  );
}
```

## 🔧 开发工作流

### 1. 修改共享类型

当需要修改核心数据结构时：

1. **修改共享类型** (`shared/types/index.ts`)
2. **构建共享包** (`cd shared && npm run build`)
3. **更新依赖** (`cd server && npm install` 和 `cd client && npm install`)
4. **修复类型错误** (TypeScript 会自动检查前后端)
5. **测试验证** (确保前后端功能正常)

### 2. 添加新类型

```typescript
// 在 shared/types/index.ts 中添加
export interface NewFeature {
  id: string;
  name: string;
  config: NewFeatureConfig;
}

export interface NewFeatureConfig {
  enabled: boolean;
  threshold: number;
}
```

### 3. 添加工具函数

```typescript
// 在 shared/types/index.ts 中添加
export function isNewFeatureValid(feature: NewFeature): boolean {
  return feature.config.enabled && feature.config.threshold > 0;
}
```

## 📋 类型分类

### 核心业务类型
- `UnifiedMatch` - 统一的比赛数据模型
- `ArbitrageSignal` - 套利信号
- `Team` - 球队信息
- `ESPNData` - ESPN 数据
- `PolymarketData` - Polymarket 数据

### 基础枚举
- `MatchStatus` - 比赛状态
- `SignalType` - 信号类型
- `OrderType` - 订单类型
- `OrderStatus` - 订单状态

### API 通信类型
- `ApiResponse<T>` - 统一 API 响应格式
- `WSMessage` - WebSocket 消息格式
- `MatchesUpdateEvent` - 前端 WebSocket 事件

### Paper Trading 类型
- `Order` - 订单记录
- `Position` - 持仓记录
- `AccountStatus` - 账户状态

## 🚀 最佳实践

### 1. 保持向后兼容
- 修改现有类型时，尽量使用可选属性
- 避免删除字段，考虑标记为 `@deprecated`

### 2. 使用类型守卫
```typescript
export function isValidMatch(match: any): match is UnifiedMatch {
  return (
    typeof match.id === 'string' &&
    match.homeTeam && match.awayTeam &&
    typeof match.status === 'string'
  );
}
```

### 3. 提供工具函数
```typescript
export function getHomeWinProbability(match: UnifiedMatch): number {
  return match.espn.homeWinProb;
}

export function hasArbitrageSignals(match: UnifiedMatch): boolean {
  return match.signals.length > 0;
}
```

### 4. 文档注释
```typescript
/** 
 * 统一的比赛数据模型
 * @example
 * const match: UnifiedMatch = {
 *   id: 'LAL-GSW-20231215',
 *   homeTeam: { id: 'LAL', name: 'Lakers', score: 110 },
 *   // ...
 * };
 */
export interface UnifiedMatch {
  // ...
}
```

## 🔍 故障排除

### 类型不匹配错误
如果遇到前后端类型不匹配：

1. 检查是否都安装了最新的共享类型包
2. 运行 `npm run build` 构建共享类型
3. 清理 node_modules 重新安装

### 路径解析问题
如果 `@shared/types` 导入失败：

1. 尝试使用相对路径导入：`import { ... } from '../../../shared/types/index';`
2. 检查 `tsconfig.json` 中的路径映射
3. 检查 `vite.config.ts` 中的别名配置
4. 重启 TypeScript 服务器

### Node.js 运行时路径别名问题
如果服务端运行时报错 `Cannot find module '@shared/types'`：

1. 安装 `module-alias` 包：`npm install module-alias --save`
2. 在入口文件顶部添加：
   ```typescript
   import 'module-alias/register';
   import path from 'path';
   import { addAliases } from 'module-alias';
   
   addAliases({
     '@shared': path.resolve(__dirname, '../../shared'),
     '@shared/types': path.resolve(__dirname, '../../shared/dist/types')
   });
   ```
3. 或者直接使用相对路径导入（推荐）

### 构建失败
如果共享类型构建失败：

1. 检查 TypeScript 语法错误
2. 确保所有导入都正确
3. 运行 `npm run clean` 清理构建缓存

## 📈 性能优化

### 1. 按需导入
```typescript
// 推荐：只导入需要的类型
import { UnifiedMatch, MatchStatus } from '@shared/types';

// 避免：导入所有类型
import * as Types from '@shared/types';
```

### 2. 类型推导
```typescript
// 利用 TypeScript 的类型推导
function processMatch(match: UnifiedMatch) {
  // 自动推导返回类型
  return match.signals.filter(s => s.confidence > 0.7);
}
```

## 🔄 版本历史

- **v1.0.0** - 初始版本，包含所有核心类型定义
- 移除了虎扑相关类型，统一使用 ESPN + Polymarket 数据源
- 添加了完整的工具函数和类型守卫

## 🤝 贡献指南

1. 修改类型前，先评估对前后端的影响
2. 添加适当的类型守卫和工具函数
3. 更新相关文档和示例
4. 确保前后端都能正常编译和运行

---

**记住**: 修改共享类型会影响整个项目，请谨慎操作！ 🚨
