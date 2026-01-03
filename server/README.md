# 🎯 PolySniper Backend

NBA 套利监控平台后端服务 - 基于 Node.js + TypeScript 构建的高性能数据聚合和套利计算引擎。

## 📚 完整文档

- **[API.md](./API.md)** - 📡 REST API & WebSocket 接口完整说明 ⭐ **推荐**
- **[DATABASE.md](./DATABASE.md)** - 🗄️ SQLite 数据库使用指南 ⭐ **新增**
- **[docs/PRICE_RETRIEVAL.md](./docs/PRICE_RETRIEVAL.md)** - 💰 Polymarket 价格获取指南
- **[docs/WEBSOCKET.md](./docs/WEBSOCKET.md)** - 🔌 WebSocket 连接和订阅指南
- **[docs/PUBLIC_API_MODE.md](./docs/PUBLIC_API_MODE.md)** - 🌐 公共 API 模式说明
- **[TEAM_MAPPINGS.md](./TEAM_MAPPINGS.md)** - 🏀 NBA 球队映射配置

---

## 🎯 核心功能

### 数据整合
- **ESPN API**: 实时比分和胜率数据（10秒更新）
- **Polymarket API**: 市场价格、流动性数据（WebSocket实时推送）
- **并行请求优化**: 同时获取多个数据源，性能提升 60% ⚡
- **智能匹配算法**: 精准匹配 ESPN 和 Polymarket 数据源的比赛数据
  - Layer 1: 范围锁定（NBA + active + 未关闭）
  - Layer 2: 名称锚定（同时匹配两队名，不区分主客场）
  - Layer 3: 时间校验（防止匹配错误）
  - **匹配成功率: 100%** ✅

### 套利引擎 & Paper Trading
- **EV+ 决策模型**: ESPN胜率 - Polymarket Ask价格 > 10% 触发买入
- **Q1-Q3 价值回归策略**: 只在前三节交易，避免第四节赌博逻辑
- **混合离场策略**:
  - 💰 获利了结: 收益率 >= 25% 时卖出
  - 📉 逻辑证伪: 当前价格 >= ESPN胜率时卖出
  - 🛑 硬止损: 价格 <= $0.15 或损失 >= 50% 时卖出
- **真实价格模拟**: 买入用Ask，卖出用Bid，包含滑点

### API 服务
- **REST API**: 获取比赛数据、套利信号、统计信息
- **WebSocket**: 实时推送比赛更新和套利告警
- **缓存优化**: Redis/内存双重缓存，降低API调用频率
- **限流保护**: 防止过度请求

## 📦 技术栈

- **运行环境**: Node.js 18+, TypeScript
- **Web框架**: Express.js
- **实时通信**: Socket.IO, WebSocket
- **数据库**: SQLite 3 (轻量级本地数据库)
- **缓存**: Redis (可选降级为内存缓存)
- **HTTP客户端**: Axios
- **日志**: Winston
- **进程管理**: PM2

## 🚀 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 初始化数据库

```bash
# 自动创建 SQLite 数据库和表结构
npm run init-db
```

### 3. 配置环境变量

复制 `.env.example` 为 `.env` 并配置：

```bash
cp .env.example .env
```

编辑 `.env` 文件：

```env
# 服务配置
PORT=3000
NODE_ENV=development

# Polymarket API（需要申请）
POLYMARKET_API_KEY=your_api_key_here

# CORS（前端地址）
CORS_ORIGIN=http://localhost:5173

# Redis（可选，默认使用内存缓存）
REDIS_ENABLED=false
```

### 3. 运行服务

**开发模式**（带热重载）
```bash
npm run dev
```

**生产模式**
```bash
npm run build
npm start
```

**使用 PM2**
```bash
npm run start:pm2
```

### 4. Docker 部署

```bash
# 构建镜像
docker build -t polysniper-backend .

# 运行容器
docker run -p 3000:3000 --env-file .env polysniper-backend

# 或使用 docker-compose（包含Redis）
docker-compose up -d
```

## 📡 API 端点

> 💡 **查看完整 API 文档**: [API.md](./API.md) - 包含详细说明、参数、响应示例和代码示例

### REST API 概览

| 端点 | 方法 | 说明 |
|------|------|------|
| `/health` | GET | 健康检查 |
| `/api/matches` | GET | 获取比赛列表（支持筛选） |
| `/api/matches/:id` | GET | 获取单场比赛详情 |
| `/api/signals` | GET | 获取套利信号（按置信度排序） |
| `/api/stats` | GET | 获取系统统计信息 |

**示例**:
```bash
# 获取进行中且有套利信号的比赛
GET /api/matches?status=LIVE&hasSignals=true
```

### WebSocket 事件概览

**连接地址**: `ws://localhost:3000`

**客户端事件**:
- `subscribe` - 订阅比赛更新
- `unsubscribe` - 取消订阅

**服务端事件**:
- `matchesUpdate` - 比赛数据更新（每3秒）
- `matchUpdate` - 单场比赛更新
- `signalAlert` - 套利信号告警
- `connectionStatus` - 连接状态变化

**快速示例**:
```javascript
import { io } from 'socket.io-client';

const socket = io('http://localhost:3000');

socket.on('connect', () => {
  socket.emit('subscribe', {}); // 订阅所有比赛
});

socket.on('signalAlert', (data) => {
  console.log('🚨 套利信号:', data);
});
```

> 📖 更多示例和详细说明请查看 [API.md](./API.md)

## 📊 数据模型

### UnifiedMatch（统一比赛数据）

```typescript
interface UnifiedMatch {
  id: string;              // "LAL-GSW-20231215"
  
  homeTeam: Team;          // 主队信息（名称、分数）
  awayTeam: Team;          // 客队信息
  
  status: MatchStatus;     // PRE/LIVE/FINAL
  statusStr: string;       // "Q4 02:30"
  
  poly: {                  // Polymarket数据
    marketId: string;
    homePrice: number;     // 0-1
    awayPrice: number;
    liquidity?: number;
  };
  
  espn: {                  // ESPN数据
    homeWinProb: number;   // 实时胜率
    awayWinProb: number;
    pregameHomeWinProb: number; // 赛前胜率
    pregameAwayWinProb: number;
    injuries?: InjuryReport[];  // 伤病信息
  };
  
  // 注意：虎扑数据源已移除，现在完全使用 ESPN + Polymarket
  
  signals: ArbitrageSignal[]; // 套利信号
  
  lastUpdate: number;
  dataCompleteness: {
    hasPolyData: boolean;
    hasESPNData: boolean;
  };
}
```

### ArbitrageSignal（套利信号）

```typescript
interface ArbitrageSignal {
  type: SignalType;        // BUY_HOME/SELL_HOME/BUY_AWAY/SELL_AWAY
  confidence: number;      // 0-1，置信度
  edge: number;           // 预期收益率（百分比）
  reason: string;         // 信号原因说明
  timestamp: number;
  details: {
    espnProb: number;
    polyPrice: number;
    priceDiff: number;
    scoreDiff: number;
    timeRemaining: string;
  };
}
```

## 🔧 配置说明

### 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| PORT | 服务端口 | 3000 |
| NODE_ENV | 运行环境 | development |
| POLYMARKET_API_KEY | Polymarket API密钥 | - |
| POLYMARKET_WS_URL | Polymarket WebSocket地址 | wss://... |
| POLYMARKET_API_URL | Polymarket API地址 | https://... |
| REDIS_ENABLED | 启用Redis | false |
| REDIS_URL | Redis连接地址 | redis://localhost:6379 |
| CORS_ORIGIN | 允许的前端地址 | http://localhost:5173 |
| CACHE_TTL_LIVE | 进行中比赛缓存时间（秒） | 45 |
| CACHE_TTL_UPCOMING | 未开始比赛缓存时间（秒） | 120 |
| CACHE_TTL_ENDED | 已结束比赛缓存时间（秒） | 86400 |
| RATE_LIMIT_WINDOW_MS | 限流时间窗口（毫秒） | 60000 |
| RATE_LIMIT_MAX_REQUESTS | 最大请求数 | 100 |
| LOG_LEVEL | 日志级别 | info |

### 缓存策略

- **内存缓存**: 默认模式，无需额外配置
- **Redis缓存**: 设置 `REDIS_ENABLED=true`，提供更好的性能和持久化
- **自动降级**: Redis不可用时自动切换到内存缓存

## 🏗️ 项目结构

```
polysniper-backend/
├── src/
│   ├── config/           # 配置文件
│   │   └── index.ts
│   ├── types/            # TypeScript类型定义
│   │   └── index.ts
│   ├── utils/            # 工具函数
│   │   ├── logger.ts     # 日志
│   │   └── cache.ts      # 缓存服务
│   ├── services/         # 业务服务
│   │   ├── espnService.ts         # ESPN数据采集
│   │   ├── polymarketService.ts   # Polymarket数据采集
│   │   ├── arbitrageEngine.ts     # 套利计算引擎
│   │   └── dataAggregator.ts      # 数据整合服务
│   ├── routes/           # API路由
│   │   └── index.ts
│   ├── websocket/        # WebSocket服务
│   │   └── index.ts
│   ├── app.ts            # Express应用
│   └── index.ts          # 入口文件
├── logs/                 # 日志文件
├── dist/                 # 编译输出
├── .env.example          # 环境变量示例
├── tsconfig.json         # TypeScript配置
├── package.json
├── Dockerfile
├── docker-compose.yml
├── ecosystem.config.js   # PM2配置
└── README.md
```

## 🧪 开发

### 运行测试
```bash
npm test
```

### 测试价格获取功能
```bash
# 测试 Polymarket 价格获取（三层漏斗匹配）
npm run test:price

# 调试 Polymarket API
npm run test:poly-debug

# 测试并行请求性能提升
npm run test:parallel
```

### 代码检查
```bash
npm run lint
npm run lint:fix
```

### 构建
```bash
npm run build
```

## 📝 日志

日志文件位于 `logs/` 目录：
- `error.log`: 错误日志
- `combined.log`: 所有日志

## 🔒 安全

- ✅ API Key 通过环境变量管理，不提交到代码仓库
- ✅ CORS 白名单限制
- ✅ API 请求频率限制
- ✅ 错误信息不暴露敏感数据

## 🐛 故障排查

### WebSocket 连接失败
- 检查 `POLYMARKET_WS_URL` 配置
- 确认 `POLYMARKET_API_KEY` 有效
- 查看 `logs/error.log` 获取详细错误

### Redis 连接失败
- 设置 `REDIS_ENABLED=false` 使用内存缓存
- 或检查 Redis 服务是否运行

### 数据不完整
- 部分比赛可能无法匹配到 Polymarket 市场
- ESPN/虎扑 API 可能偶尔不稳定
- 查看日志了解具体原因

## 📄 License

ISC

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📧 联系

如有问题，请通过 GitHub Issues 联系。
