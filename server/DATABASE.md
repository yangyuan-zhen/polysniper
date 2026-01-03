# 📊 PolySniper 数据库使用指南

## 🗄️ SQLite 轻量级数据库

PolySniper 使用 SQLite 作为本地数据库，用于存储回测数据和 Paper Trading 记录。

### 🚀 快速开始

```bash
# 初始化数据库（首次运行）
npm run init-db

# 启动开发服务器（会自动初始化数据库）
npm run dev

# 运行回测分析
npm run backtest

# 重置数据库（危险操作）
npm run reset-db
```

## 📁 文件结构

```
server/
├── data/
│   └── polysniper.db          # SQLite 数据库文件（不会提交到 Git）
├── scripts/
│   ├── initDatabase.ts        # 数据库初始化脚本
│   └── backtestAnalysis.ts    # 回测分析脚本
└── src/services/
    └── databaseService.ts     # 数据库服务
```

## 🗃️ 数据库表结构

### 1. market_snapshots（市场快照表）
**用途**：存储每3秒的完整市场数据，用于回测分析

| 字段 | 类型 | 说明 |
|------|------|------|
| timestamp | INTEGER | 时间戳 |
| match_id | TEXT | 比赛ID |
| home_team | TEXT | 主队名称 |
| away_team | TEXT | 客队名称 |
| home_score | INTEGER | 主队比分 |
| away_score | INTEGER | 客队比分 |
| match_status | TEXT | 比赛状态 |
| espn_home_win_prob | REAL | ESPN主队胜率 |
| espn_away_win_prob | REAL | ESPN客队胜率 |
| poly_home_price | REAL | Polymarket主队价格 |
| poly_away_price | REAL | Polymarket客队价格 |
| poly_home_best_bid | REAL | 主队最佳买价 |
| poly_home_best_ask | REAL | 主队最佳卖价 |
| arbitrage_signals | TEXT | 套利信号（JSON格式） |

### 2. paper_accounts（Paper Trading 账户表）
**用途**：存储模拟交易账户状态

| 字段 | 类型 | 说明 |
|------|------|------|
| initial_balance | REAL | 初始余额 |
| current_balance | REAL | 当前余额 |
| total_trades | INTEGER | 总交易数 |
| winning_trades | INTEGER | 获胜交易数 |
| total_pnl | REAL | 总盈亏 |

### 3. paper_orders（交易订单表）
**用途**：记录每笔交易的完整战场情况

| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT | 订单ID |
| match_id | TEXT | 比赛ID |
| team | TEXT | 交易队伍 |
| entry_price | REAL | 买入价格 |
| exit_price | REAL | 卖出价格 |
| pnl | REAL | 盈亏金额 |
| **entry_home_score** | INTEGER | **买入时主队比分** |
| **entry_away_score** | INTEGER | **买入时客队比分** |
| **entry_espn_prob** | REAL | **买入时ESPN胜率** |
| **exit_home_score** | INTEGER | **卖出时主队比分** |
| **exit_away_score** | INTEGER | **卖出时客队比分** |
| **exit_reason** | TEXT | **离场原因** |

### 4. paper_positions（当前持仓表）
**用途**：存储当前持有的仓位

| 字段 | 类型 | 说明 |
|------|------|------|
| match_id | TEXT | 比赛ID |
| team | TEXT | 持仓队伍 |
| quantity | REAL | 持仓数量 |
| avg_cost | REAL | 平均成本 |
| current_price | REAL | 当前价格 |
| unrealized_pnl | REAL | 未实现盈亏 |

## 🔍 数据分析示例

### 回测查询
```sql
-- 查看不同阈值下的信号数量
SELECT 
  CASE 
    WHEN (espn_home_win_prob - poly_home_price) >= 0.15 THEN '15%+'
    WHEN (espn_home_win_prob - poly_home_price) >= 0.10 THEN '10-14%'
    WHEN (espn_home_win_prob - poly_home_price) >= 0.05 THEN '5-9%'
    ELSE '<5%'
  END as edge_range,
  COUNT(*) as signal_count
FROM market_snapshots 
WHERE espn_home_win_prob IS NOT NULL 
GROUP BY edge_range;
```

### Paper Trading 分析
```sql
-- 分析最佳买入时机（按比分差异）
SELECT 
  CASE 
    WHEN entry_home_score - entry_away_score >= 10 THEN '领先10+'
    WHEN entry_home_score - entry_away_score >= 5 THEN '领先5-9'
    WHEN entry_home_score - entry_away_score >= 0 THEN '领先0-4'
    WHEN entry_home_score - entry_away_score >= -4 THEN '落后0-4'
    WHEN entry_home_score - entry_away_score >= -9 THEN '落后5-9'
    ELSE '落后10+'
  END as score_range,
  COUNT(*) as trades,
  AVG(pnl) as avg_pnl,
  SUM(CASE WHEN pnl > 0 THEN 1 ELSE 0 END) * 100.0 / COUNT(*) as win_rate
FROM paper_orders 
WHERE status = 'CLOSED'
GROUP BY score_range
ORDER BY avg_pnl DESC;
```

## 🔐 数据安全

### ⚠️ 重要提醒
- **数据库文件已添加到 `.gitignore`**
- **绝对不要将 `.db` 文件提交到 Git**
- **数据库包含您的交易隐私信息**

### 🛡️ 隐私保护
- 所有交易数据仅存储在本地
- 不会上传到任何服务器
- 重装系统前请备份重要数据

## 🚀 使用场景

### 1. 策略回测
```bash
# 运行完整回测分析
npm run backtest

# 输出示例：
# 阈值  信号数  胜率    平均收益  总收益
# 5%    156     68.2%   12.5%     89.3%
# 10%   89      74.1%   18.7%     76.8%
# 15%   34      82.4%   25.3%     45.2%
```

### 2. 交易复盘
查看具体交易的战场情况：
```sql
SELECT 
  team,
  entry_home_score || ':' || entry_away_score as entry_score,
  exit_home_score || ':' || exit_away_score as exit_score,
  entry_espn_prob,
  entry_price,
  exit_price,
  pnl,
  exit_reason
FROM paper_orders 
WHERE status = 'CLOSED'
ORDER BY pnl DESC
LIMIT 10;
```

### 3. 策略优化
基于历史数据调整参数：
- 最佳利润空间阈值
- 最佳买入时机（比分差异）
- 最佳离场策略

## 🔧 维护命令

```bash
# 查看数据库状态
npm run init-db

# 完全重置数据库（会删除所有数据）
npm run reset-db

# 备份数据库
cp server/data/polysniper.db backup/polysniper_$(date +%Y%m%d).db
```

---

**📞 技术支持**: 如有数据库相关问题，请查看日志或提交 Issue
