import sqlite3 from 'sqlite3';
import { logger } from '../utils/logger';
import path from 'path';

/**
 * SQLite 数据库服务
 * 用途 A: 行情回测数据存储
 * 用途 B: Paper Trading 持久化
 */
class DatabaseService {
  private db: sqlite3.Database | null = null;
  private dbPath: string;

  constructor() {
    // 数据库文件存放在 server/data/ 目录
    this.dbPath = path.join(__dirname, '../../data/polysniper.db');
  }

  /**
   * 初始化数据库连接和表结构
   */
  async initialize(): Promise<void> {
    return new Promise((resolve, reject) => {
      // 确保 data 目录存在
      const fs = require('fs');
      const dataDir = path.dirname(this.dbPath);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }

      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          logger.error('SQLite 数据库连接失败:', err);
          reject(err);
          return;
        }
        
        logger.info(`📊 SQLite 数据库已连接: ${this.dbPath}`);
        this.createTables().then(resolve).catch(reject);
      });
    });
  }

  /**
   * 创建所有必要的表
   */
  private async createTables(): Promise<void> {
    const tables = [
      // 用途 A: 行情回测数据表
      `CREATE TABLE IF NOT EXISTS market_snapshots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp INTEGER NOT NULL,
        match_id TEXT NOT NULL,
        home_team TEXT NOT NULL,
        away_team TEXT NOT NULL,
        home_score INTEGER NOT NULL,
        away_score INTEGER NOT NULL,
        match_status TEXT NOT NULL,
        quarter TEXT,
        time_remaining TEXT,
        -- ESPN 数据
        espn_home_win_prob REAL,
        espn_away_win_prob REAL,
        espn_pregame_home_win_prob REAL,
        espn_pregame_away_win_prob REAL,
        -- Polymarket 数据
        poly_home_price REAL,
        poly_away_price REAL,
        poly_home_best_bid REAL,
        poly_home_best_ask REAL,
        poly_away_best_bid REAL,
        poly_away_best_ask REAL,
        poly_home_volume REAL,
        poly_away_volume REAL,
        -- 套利信号
        arbitrage_signals TEXT, -- JSON 格式存储信号数组
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,

      // 用途 B: Paper Trading 账户表
      `CREATE TABLE IF NOT EXISTS paper_accounts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        initial_balance REAL NOT NULL,
        current_balance REAL NOT NULL,
        total_trades INTEGER DEFAULT 0,
        winning_trades INTEGER DEFAULT 0,
        total_pnl REAL DEFAULT 0,
        total_pnl_percent REAL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,

      // Paper Trading 订单表
      `CREATE TABLE IF NOT EXISTS paper_orders (
        id TEXT PRIMARY KEY,
        account_id INTEGER NOT NULL,
        match_id TEXT NOT NULL,
        team TEXT NOT NULL,
        token_id TEXT NOT NULL,
        order_type TEXT NOT NULL, -- 'BUY' | 'SELL'
        status TEXT NOT NULL, -- 'FILLED' | 'CLOSED'
        quantity REAL NOT NULL,
        entry_price REAL NOT NULL,
        exit_price REAL,
        current_price REAL NOT NULL,
        pnl REAL DEFAULT 0,
        pnl_percent REAL DEFAULT 0,
        confidence REAL NOT NULL,
        reason TEXT NOT NULL,
        -- 买入时的战场情况
        entry_home_score INTEGER,
        entry_away_score INTEGER,
        entry_score_diff INTEGER,
        entry_espn_prob REAL,
        entry_poly_price REAL,
        entry_match_status TEXT,
        entry_quarter TEXT,
        entry_time_remaining TEXT,
        -- 卖出时的战场情况
        exit_home_score INTEGER,
        exit_away_score INTEGER,
        exit_score_diff INTEGER,
        exit_espn_prob REAL,
        exit_poly_price REAL,
        exit_match_status TEXT,
        exit_quarter TEXT,
        exit_time_remaining TEXT,
        exit_reason TEXT, -- 离场原因：获利了结/逻辑证伪/硬止损
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        closed_at DATETIME,
        FOREIGN KEY (account_id) REFERENCES paper_accounts (id)
      )`,

      // Paper Trading 持仓表
      `CREATE TABLE IF NOT EXISTS paper_positions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        account_id INTEGER NOT NULL,
        match_id TEXT NOT NULL,
        team TEXT NOT NULL,
        token_id TEXT NOT NULL,
        quantity REAL NOT NULL,
        avg_cost REAL NOT NULL,
        current_price REAL NOT NULL,
        unrealized_pnl REAL DEFAULT 0,
        unrealized_pnl_percent REAL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (account_id) REFERENCES paper_accounts (id),
        UNIQUE(account_id, match_id, token_id)
      )`
    ];

    for (const sql of tables) {
      await this.runQuery(sql);
    }

    logger.info('✅ 数据库表结构初始化完成');
  }

  /**
   * 执行 SQL 查询
   */
  private runQuery(sql: string, params: any[] = []): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('数据库未连接'));
        return;
      }

      this.db.run(sql, params, function(err) {
        if (err) {
          logger.error('SQL 执行失败:', err);
          reject(err);
        } else {
          resolve({ lastID: this.lastID, changes: this.changes });
        }
      });
    });
  }

  /**
   * 查询数据
   */
  private queryAll(sql: string, params: any[] = []): Promise<any[]> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('数据库未连接'));
        return;
      }

      this.db.all(sql, params, (err, rows) => {
        if (err) {
          logger.error('SQL 查询失败:', err);
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  /**
   * 查询单条数据
   */
  private queryOne(sql: string, params: any[] = []): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('数据库未连接'));
        return;
      }

      this.db.get(sql, params, (err, row) => {
        if (err) {
          logger.error('SQL 查询失败:', err);
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  // ==================== 用途 A: 行情回测数据 ====================

  /**
   * 保存市场快照（每3秒调用一次）
   */
  async saveMarketSnapshot(data: {
    matchId: string;
    homeTeam: string;
    awayTeam: string;
    homeScore: number;
    awayScore: number;
    matchStatus: string;
    quarter?: string;
    timeRemaining?: string;
    espnHomeWinProb?: number;
    espnAwayWinProb?: number;
    espnPregameHomeWinProb?: number;
    espnPregameAwayWinProb?: number;
    polyHomePrice?: number;
    polyAwayPrice?: number;
    polyHomeBestBid?: number;
    polyHomeBestAsk?: number;
    polyAwayBestBid?: number;
    polyAwayBestAsk?: number;
    polyHomeVolume?: number;
    polyAwayVolume?: number;
    arbitrageSignals?: any[];
  }): Promise<void> {
    const sql = `
      INSERT INTO market_snapshots (
        timestamp, match_id, home_team, away_team, home_score, away_score,
        match_status, quarter, time_remaining,
        espn_home_win_prob, espn_away_win_prob, espn_pregame_home_win_prob, espn_pregame_away_win_prob,
        poly_home_price, poly_away_price, poly_home_best_bid, poly_home_best_ask,
        poly_away_best_bid, poly_away_best_ask, poly_home_volume, poly_away_volume,
        arbitrage_signals
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const params = [
      Date.now(),
      data.matchId,
      data.homeTeam,
      data.awayTeam,
      data.homeScore,
      data.awayScore,
      data.matchStatus,
      data.quarter,
      data.timeRemaining,
      data.espnHomeWinProb,
      data.espnAwayWinProb,
      data.espnPregameHomeWinProb,
      data.espnPregameAwayWinProb,
      data.polyHomePrice,
      data.polyAwayPrice,
      data.polyHomeBestBid,
      data.polyHomeBestAsk,
      data.polyAwayBestBid,
      data.polyAwayBestAsk,
      data.polyHomeVolume,
      data.polyAwayVolume,
      data.arbitrageSignals ? JSON.stringify(data.arbitrageSignals) : null
    ];

    await this.runQuery(sql, params);
  }

  /**
   * 获取回测数据（用于策略验证）
   */
  async getBacktestData(options: {
    startDate?: Date;
    endDate?: Date;
    matchId?: string;
    minEdge?: number;
  } = {}): Promise<any[]> {
    let sql = `
      SELECT * FROM market_snapshots 
      WHERE 1=1
    `;
    const params: any[] = [];

    if (options.startDate) {
      sql += ` AND timestamp >= ?`;
      params.push(options.startDate.getTime());
    }

    if (options.endDate) {
      sql += ` AND timestamp <= ?`;
      params.push(options.endDate.getTime());
    }

    if (options.matchId) {
      sql += ` AND match_id = ?`;
      params.push(options.matchId);
    }

    sql += ` ORDER BY timestamp ASC`;

    return await this.queryAll(sql, params);
  }

  // ==================== 用途 B: Paper Trading 持久化 ====================

  /**
   * 初始化 Paper Trading 账户
   */
  async initializePaperAccount(initialBalance: number = 1000): Promise<number> {
    // 检查是否已有账户
    const existing = await this.queryOne('SELECT * FROM paper_accounts ORDER BY id DESC LIMIT 1');
    
    if (existing) {
      logger.info(`📊 Paper Trading 账户已存在 (ID: ${existing.id}), 余额: $${existing.current_balance}`);
      return existing.id;
    }

    const sql = `
      INSERT INTO paper_accounts (initial_balance, current_balance)
      VALUES (?, ?)
    `;
    
    const result = await this.runQuery(sql, [initialBalance, initialBalance]);
    logger.info(`🆕 Paper Trading 账户已创建 (ID: ${result.lastID}), 初始余额: $${initialBalance}`);
    
    return result.lastID;
  }

  /**
   * 获取 Paper Trading 账户状态
   */
  async getPaperAccount(): Promise<any> {
    const account = await this.queryOne('SELECT * FROM paper_accounts ORDER BY id DESC LIMIT 1');
    if (!account) {
      throw new Error('Paper Trading 账户不存在');
    }

    // 获取持仓
    const positions = await this.queryAll('SELECT * FROM paper_positions WHERE account_id = ?', [account.id]);
    
    // 获取未平仓订单
    const openOrders = await this.queryAll('SELECT * FROM paper_orders WHERE account_id = ? AND status = "FILLED"', [account.id]);
    
    // 获取已平仓订单
    const closedOrders = await this.queryAll('SELECT * FROM paper_orders WHERE account_id = ? AND status = "CLOSED"', [account.id]);

    return {
      ...account,
      positions,
      openOrders,
      closedOrders
    };
  }

  /**
   * 保存 Paper Trading 订单
   */
  async savePaperOrder(order: {
    id: string;
    matchId: string;
    team: string;
    tokenId: string;
    orderType: 'BUY' | 'SELL';
    status: 'FILLED' | 'CLOSED';
    quantity: number;
    entryPrice: number;
    exitPrice?: number;
    currentPrice: number;
    pnl: number;
    pnlPercent: number;
    confidence: number;
    reason: string;
    // 买入时战场情况
    entryHomeScore?: number;
    entryAwayScore?: number;
    entryScoreDiff?: number;
    entryEspnProb?: number;
    entryPolyPrice?: number;
    entryMatchStatus?: string;
    entryQuarter?: string;
    entryTimeRemaining?: string;
    // 卖出时战场情况
    exitHomeScore?: number;
    exitAwayScore?: number;
    exitScoreDiff?: number;
    exitEspnProb?: number;
    exitPolyPrice?: number;
    exitMatchStatus?: string;
    exitQuarter?: string;
    exitTimeRemaining?: string;
    exitReason?: string;
  }): Promise<void> {
    const account = await this.queryOne('SELECT * FROM paper_accounts ORDER BY id DESC LIMIT 1');
    if (!account) {
      throw new Error('Paper Trading 账户不存在');
    }

    const sql = `
      INSERT OR REPLACE INTO paper_orders (
        id, account_id, match_id, team, token_id, order_type, status,
        quantity, entry_price, exit_price, current_price, pnl, pnl_percent,
        confidence, reason,
        entry_home_score, entry_away_score, entry_score_diff, entry_espn_prob, entry_poly_price,
        entry_match_status, entry_quarter, entry_time_remaining,
        exit_home_score, exit_away_score, exit_score_diff, exit_espn_prob, exit_poly_price,
        exit_match_status, exit_quarter, exit_time_remaining, exit_reason,
        closed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const params = [
      order.id, account.id, order.matchId, order.team, order.tokenId, order.orderType, order.status,
      order.quantity, order.entryPrice, order.exitPrice, order.currentPrice, order.pnl, order.pnlPercent,
      order.confidence, order.reason,
      order.entryHomeScore, order.entryAwayScore, order.entryScoreDiff, order.entryEspnProb, order.entryPolyPrice,
      order.entryMatchStatus, order.entryQuarter, order.entryTimeRemaining,
      order.exitHomeScore, order.exitAwayScore, order.exitScoreDiff, order.exitEspnProb, order.exitPolyPrice,
      order.exitMatchStatus, order.exitQuarter, order.exitTimeRemaining, order.exitReason,
      order.status === 'CLOSED' ? new Date().toISOString() : null
    ];

    await this.runQuery(sql, params);
  }

  /**
   * 更新账户余额
   */
  async updateAccountBalance(balance: number, totalTrades?: number, winningTrades?: number, totalPnl?: number, totalPnlPercent?: number): Promise<void> {
    const account = await this.queryOne('SELECT * FROM paper_accounts ORDER BY id DESC LIMIT 1');
    if (!account) {
      throw new Error('Paper Trading 账户不存在');
    }

    const sql = `
      UPDATE paper_accounts 
      SET current_balance = ?, total_trades = ?, winning_trades = ?, total_pnl = ?, total_pnl_percent = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;

    await this.runQuery(sql, [
      balance,
      totalTrades ?? account.total_trades,
      winningTrades ?? account.winning_trades,
      totalPnl ?? account.total_pnl,
      totalPnlPercent ?? account.total_pnl_percent,
      account.id
    ]);
  }

  /**
   * 保存/更新持仓
   */
  async savePaperPosition(position: {
    matchId: string;
    team: string;
    tokenId: string;
    quantity: number;
    avgCost: number;
    currentPrice: number;
    unrealizedPnl: number;
    unrealizedPnlPercent: number;
  }): Promise<void> {
    const account = await this.queryOne('SELECT * FROM paper_accounts ORDER BY id DESC LIMIT 1');
    if (!account) {
      throw new Error('Paper Trading 账户不存在');
    }

    const sql = `
      INSERT OR REPLACE INTO paper_positions (
        account_id, match_id, team, token_id, quantity, avg_cost, current_price,
        unrealized_pnl, unrealized_pnl_percent, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `;

    await this.runQuery(sql, [
      account.id, position.matchId, position.team, position.tokenId,
      position.quantity, position.avgCost, position.currentPrice,
      position.unrealizedPnl, position.unrealizedPnlPercent
    ]);
  }

  /**
   * 删除持仓（平仓时）
   */
  async deletePaperPosition(matchId: string, tokenId: string): Promise<void> {
    const account = await this.queryOne('SELECT * FROM paper_accounts ORDER BY id DESC LIMIT 1');
    if (!account) {
      throw new Error('Paper Trading 账户不存在');
    }

    await this.runQuery('DELETE FROM paper_positions WHERE account_id = ? AND match_id = ? AND token_id = ?', [
      account.id, matchId, tokenId
    ]);
  }

  /**
   * 获取交易分析数据
   */
  async getTradeAnalysis(): Promise<{
    totalTrades: number;
    winningTrades: number;
    losingTrades: number;
    winRate: number;
    avgWin: number;
    avgLoss: number;
    bestTrade: any;
    worstTrade: any;
    profitByScoreDiff: any[];
    profitByEdge: any[];
  }> {
    const account = await this.queryOne('SELECT * FROM paper_accounts ORDER BY id DESC LIMIT 1');
    if (!account) {
      throw new Error('Paper Trading 账户不存在');
    }

    const closedOrders = await this.queryAll('SELECT * FROM paper_orders WHERE account_id = ? AND status = "CLOSED"', [account.id]);
    
    const totalTrades = closedOrders.length;
    const winningTrades = closedOrders.filter(order => order.pnl > 0).length;
    const losingTrades = totalTrades - winningTrades;
    const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;
    
    const wins = closedOrders.filter(order => order.pnl > 0);
    const losses = closedOrders.filter(order => order.pnl <= 0);
    
    const avgWin = wins.length > 0 ? wins.reduce((sum, order) => sum + order.pnl, 0) / wins.length : 0;
    const avgLoss = losses.length > 0 ? losses.reduce((sum, order) => sum + order.pnl, 0) / losses.length : 0;
    
    const bestTrade = closedOrders.reduce((best, order) => order.pnl > (best?.pnl || -Infinity) ? order : best, null);
    const worstTrade = closedOrders.reduce((worst, order) => order.pnl < (worst?.pnl || Infinity) ? order : worst, null);

    // 按比分差异分析盈利情况
    const profitByScoreDiff = await this.queryAll(`
      SELECT 
        CASE 
          WHEN entry_score_diff >= 10 THEN '领先10+'
          WHEN entry_score_diff >= 5 THEN '领先5-9'
          WHEN entry_score_diff >= 0 THEN '领先0-4'
          WHEN entry_score_diff >= -4 THEN '落后0-4'
          WHEN entry_score_diff >= -9 THEN '落后5-9'
          ELSE '落后10+'
        END as score_range,
        COUNT(*) as trades,
        AVG(pnl) as avg_pnl,
        SUM(CASE WHEN pnl > 0 THEN 1 ELSE 0 END) as wins
      FROM paper_orders 
      WHERE account_id = ? AND status = 'CLOSED' AND entry_score_diff IS NOT NULL
      GROUP BY score_range
      ORDER BY avg_pnl DESC
    `, [account.id]);

    // 按利润空间分析
    const profitByEdge = await this.queryAll(`
      SELECT 
        CASE 
          WHEN (entry_espn_prob - entry_poly_price) >= 0.20 THEN '20%+'
          WHEN (entry_espn_prob - entry_poly_price) >= 0.15 THEN '15-19%'
          WHEN (entry_espn_prob - entry_poly_price) >= 0.10 THEN '10-14%'
          ELSE '<10%'
        END as edge_range,
        COUNT(*) as trades,
        AVG(pnl) as avg_pnl,
        SUM(CASE WHEN pnl > 0 THEN 1 ELSE 0 END) as wins
      FROM paper_orders 
      WHERE account_id = ? AND status = 'CLOSED' AND entry_espn_prob IS NOT NULL AND entry_poly_price IS NOT NULL
      GROUP BY edge_range
      ORDER BY avg_pnl DESC
    `, [account.id]);

    return {
      totalTrades,
      winningTrades,
      losingTrades,
      winRate,
      avgWin,
      avgLoss,
      bestTrade,
      worstTrade,
      profitByScoreDiff,
      profitByEdge
    };
  }

  /**
   * 关闭数据库连接
   */
  async close(): Promise<void> {
    return new Promise((resolve) => {
      if (this.db) {
        this.db.close((err) => {
          if (err) {
            logger.error('关闭数据库失败:', err);
          } else {
            logger.info('📊 SQLite 数据库连接已关闭');
          }
          resolve();
        });
      } else {
        resolve();
      }
    });
  }
}

export const databaseService = new DatabaseService();
