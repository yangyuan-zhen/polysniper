# PolySniper Backend - 开发文档

## 📚 文档索引

- **[API.md](./API.md)** - REST API 和 WebSocket 接口完整说明 ⭐ **推荐先看**
- **[DEVELOPMENT.md](./DEVELOPMENT.md)** - 本文档，开发指南
- **[TEAM_MAPPINGS.md](./TEAM_MAPPINGS.md)** - NBA 球队映射配置说明 ⭐ **NEW**
- **[HUPU_API.md](./HUPU_API.md)** - 虎扑 API 详细说明
- **[REALTIME_DATA.md](./REALTIME_DATA.md)** - 实时数据采集流程
- **[WEBSOCKET.md](./WEBSOCKET.md)** - WebSocket 使用说明
- **[FINAL_SUMMARY.md](./FINAL_SUMMARY.md)** - 项目完成总结

---

## 📋 项目概述

本项目是 PolySniper 的后端服务，负责：
- 整合多个数据源（虎扑、ESPN、Polymarket）
- 计算套利信号
- 提供 REST API 和 WebSocket 实时推送

## ✅ 已完成的工作

### 1. 项目架构 ✓
- [x] TypeScript 配置
- [x] 项目结构设计
- [x] 环境变量管理
- [x] Docker 支持
- [x] PM2 进程管理配置

### 2. 核心服务 ✓
- [x] **虎扑服务** (`src/services/hupuService.ts`)
  - 获取 NBA 赛程
  - 实时比分数据
  - 缓存优化

- [x] **ESPN 服务** (`src/services/espnService.ts`)
  - 比赛比分
  - 实时胜率（winProbability）
  - 赛前预测
  - 球队信息

- [x] **Polymarket 服务** (`src/services/polymarketService.ts`)
  - Gamma Markets API 集成（公开，无需认证）
  - 智能市场搜索
  - WebSocket 实时价格推送（预留）
  - 缓存优化

- [x] **套利引擎** (`src/services/arbitrageEngine.ts`)
  - 4种交易策略
  - 置信度评分算法
  - 多因素分析（价格差、胜率差、比分、时间）

- [x] **数据聚合器** (`src/services/dataAggregator.ts`)
  - 统一数据格式
  - 定时更新
  - 数据完整性检查

### 3. 工具模块 ✓
- [x] **日志系统** (`src/utils/logger.ts`)
  - Winston 日志
  - 文件和控制台输出
  - 日志分级

- [x] **缓存系统** (`src/utils/cache.ts`)
  - Redis 支持
  - 内存缓存降级
  - 自动 TTL 管理

- [x] **球队映射** (`src/config/teamMappings.ts`)
  - 30支 NBA 球队完整配置
  - 中英文名称映射
  - 多种搜索方法

- [x] **比赛ID生成器** (`src/utils/matchIdGenerator.ts`)
  - 统一ID格式
  - 比赛匹配算法

### 4. API 接口 ✓
- [x] **REST API** (`src/routes/index.ts`)
  - `GET /health` - 健康检查
  - `GET /api/matches` - 获取所有比赛
  - `GET /api/matches/:id` - 获取单场比赛
  - `GET /api/signals` - 获取套利信号
  - `GET /api/stats` - 统计信息

- [x] **WebSocket** (`src/websocket/index.ts`)
  - 实时比赛更新
  - 套利信号推送
  - 订阅管理

### 5. 测试工具 ✓
- [x] **数据源测试** (`src/test/dataSourceTest.ts`)
  - 测试所有API连接
  - 数据格式验证

- [x] **快速启动测试** (`src/test/quickStart.ts`)
  - 完整数据流程测试
  - 套利计算演示

## 🧪 测试结果

运行 `npm run test:quick` 的结果：

```
✓ 缓存系统: 正常（内存模式）
⚠ 虎扑 API: 暂无比赛数据（休赛期）
✓ ESPN API: 正常（获取8场比赛）
✓ Polymarket API: 正常连接
✓ 套利引擎: 就绪
```

### 当前限制

1. **虎扑 API**: 今天没有比赛（可能是休赛期或非比赛日）
2. **Polymarket 市场**: 未找到当前活跃的 NBA 比赛市场
   - Gamma API 返回的主要是历史或非体育市场
   - 可能需要在比赛日才能找到匹配的市场

## 🚀 启动服务

### 开发模式
```bash
# 1. 复制环境变量
copy .env.example .env

# 2. 启动服务（带热重载）
npm run dev
```

### 生产模式
```bash
# 构建
npm run build

# 启动
npm start

# 或使用 PM2
npm run start:pm2
```

### Docker 部署
```bash
# 使用 docker-compose（包含 Redis）
docker-compose up -d

# 或单独构建
docker build -t polysniper-backend .
docker run -p 3000:3000 --env-file .env polysniper-backend
```

## 📊 数据流程

```
┌─────────────────────────────────────────────────────────┐
│                   外部 API 数据源                        │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  虎扑 API          ESPN API         Polymarket Gamma     │
│  (比分)            (胜率)           (市场价格)            │
│     │                 │                   │              │
│     └─────────────────┴───────────────────┘              │
│                       │                                  │
│                  数据聚合器                              │
│                       │                                  │
│              ┌────────┴────────┐                         │
│              │                 │                         │
│         统一数据格式      套利引擎                        │
│              │            (计算信号)                      │
│              │                 │                         │
│              └────────┬────────┘                         │
│                       │                                  │
│              ┌────────┴────────┐                         │
│              │                 │                         │
│          REST API        WebSocket                       │
│              │                 │                         │
│         ┌────┴────┐       ┌───┴───┐                     │
│         │         │       │       │                      │
│      前端应用   第三方    实时推送                        │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

## 🔑 核心配置

### 环境变量
```env
# 服务配置
PORT=3000
NODE_ENV=development

# Polymarket API（公开，无需认证）
POLYMARKET_GAMMA_API_URL=https://gamma-api.polymarket.com
POLYMARKET_WS_URL=wss://ws-subscriptions-clob.polymarket.com/ws/market

# Redis（可选）
REDIS_ENABLED=false
REDIS_URL=redis://localhost:6379

# CORS
CORS_ORIGIN=http://localhost:5173
```

### 缓存策略
- 进行中比赛: 45秒 TTL
- 未开始比赛: 120秒 TTL
- 已结束比赛: 24小时 TTL

## 📈 性能优化

1. **缓存机制**
   - Redis/内存双重缓存
   - 智能 TTL 策略
   - 请求去重

2. **数据更新**
   - 虎扑: 3秒更新
   - ESPN: 10秒更新
   - Polymarket: WebSocket 实时

3. **限流保护**
   - 100 请求/分钟
   - 防止 API 滥用

## 🐛 已知问题

### 1. Polymarket 市场匹配
**问题**: 当前未找到活跃的 NBA 比赛市场

**可能原因**:
- Gamma API 主要返回历史市场
- NBA 赛季时间问题
- 搜索关键词需要优化

**解决方案**:
1. 在比赛日重新测试
2. 尝试不同的搜索参数
3. 考虑使用 Polymarket 的其他 API 端点

### 2. ESPN 胜率数据
**问题**: 已结束比赛的胜率显示为 0%

**原因**: 比赛结束后，ESPN 移除实时胜率数据

**这是正常行为**: 只有进行中的比赛才有实时胜率

## 🎯 下一步计划

### 短期（1-2周）
- [ ] 优化 Polymarket 市场搜索算法
- [ ] 添加更多测试用例
- [ ] 完善错误处理
- [ ] 添加性能监控

### 中期（1个月）
- [ ] 实现 WebSocket 订阅 Polymarket 价格推送
- [ ] 添加数据持久化（PostgreSQL）
- [ ] 实现用户告警系统
- [ ] 添加历史数据分析

### 长期（3个月+）
- [ ] 支持更多运动项目（NFL, MLB等）
- [ ] 机器学习模型优化套利计算
- [ ] 移动端 App 支持
- [ ] 自动交易功能（需要 CLOB Client）

## 📚 技术栈

- **运行时**: Node.js 18+, TypeScript 5+
- **Web框架**: Express.js
- **实时通信**: Socket.IO, WebSocket
- **缓存**: Redis, Memory Cache
- **HTTP客户端**: Axios
- **日志**: Winston
- **进程管理**: PM2
- **容器化**: Docker, Docker Compose

## 🔗 相关资源

- [Polymarket 官方文档](https://docs.polymarket.com)
- [ESPN API](http://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard)
- [虎扑 API](https://games.mobileapi.hupu.com)
- [前端项目](https://github.com/yangyuan-zhen/polysniper)

## 💡 开发建议

1. **代码规范**: 使用 ESLint 检查代码质量
2. **类型安全**: 充分利用 TypeScript 类型系统
3. **日志记录**: 记录关键操作和错误
4. **缓存优先**: 优先使用缓存数据
5. **错误处理**: 优雅降级，避免服务中断

## 🤝 贡献指南

1. Fork 项目
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

## 📄 License

ISC
