import { logger } from '../utils/logger';
import { databaseService } from './databaseService';
import {
  Order,
  OrderType,
  OrderStatus,
  Position,
  AccountStatus,
  ArbitrageSignal,
  SignalType,
} from '../../../shared/types/index';

/**
 * Paper Trading 模拟交易服务
 * 核心功能：
 * 1. 管理虚拟资金池
 * 2. 记录持仓和订单
 * 3. 自动执行买卖操作
 * 4. 实时计算盈亏
 */
class PaperTradingService {
  private initialBalance: number = 1000; // 初始资金 1000 USDC
  private balance: number = 1000;        // 可用余额
  private orders: Map<string, Order> = new Map(); // 所有订单（内存缓存）
  private positions: Map<string, Position> = new Map(); // 当前持仓（内存缓存）
  private orderIdCounter: number = 1;
  private accountId: number | null = null; // SQLite 账户 ID
  private initialized: boolean = false;

  /**
   * 初始化 Paper Trading 服务（从数据库加载状态）
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // 初始化或获取账户
      this.accountId = await databaseService.initializePaperAccount(this.initialBalance);
      
      // 从数据库加载账户状态
      const account = await databaseService.getPaperAccount();
      this.balance = account.current_balance;
      this.initialBalance = account.initial_balance;
      
      // 加载持仓到内存
      this.positions.clear();
      for (const pos of account.positions) {
        const key = `${pos.match_id}-${pos.token_id}`;
        this.positions.set(key, {
          matchId: pos.match_id,
          team: pos.team,
          tokenId: pos.token_id,
          quantity: pos.quantity,
          avgCost: pos.avg_cost,
          currentPrice: pos.current_price,
          unrealizedPnl: pos.unrealized_pnl,
          unrealizedPnlPercent: pos.unrealized_pnl_percent,
        });
      }

      // 加载订单到内存
      this.orders.clear();
      for (const order of [...account.openOrders, ...account.closedOrders]) {
        this.orders.set(order.id, {
          id: order.id,
          matchId: order.match_id,
          type: order.order_type as OrderType,
          status: order.status as OrderStatus,
          team: order.team,
          tokenId: order.token_id,
          quantity: order.quantity,
          entryPrice: order.entry_price,
          exitPrice: order.exit_price,
          currentPrice: order.current_price,
          pnl: order.pnl,
          pnlPercent: order.pnl_percent,
          reason: order.reason,
          confidence: order.confidence,
          timestamp: new Date(order.created_at).getTime(),
          closeTimestamp: order.closed_at ? new Date(order.closed_at).getTime() : undefined,
        });
        
        // 更新订单计数器
        const orderNum = parseInt(order.id.replace('ORD', ''));
        if (orderNum >= this.orderIdCounter) {
          this.orderIdCounter = orderNum + 1;
        }
      }

      this.initialized = true;
      logger.info(`🤖 Paper Trading 服务已初始化 - 账户ID: ${this.accountId}, 余额: $${this.balance.toFixed(2)}, 持仓: ${this.positions.size}, 订单: ${this.orders.size}`);
    } catch (error) {
      logger.error('Paper Trading 初始化失败:', error);
      throw error;
    }
  }

  /**
   * 确保服务已初始化
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  /**
   * 根据套利信号执行模拟交易（支持无风险套利：同时买入主客队）
   */
  async executeSignal(
    signal: ArbitrageSignal,
    matchId: string,
    homeTeam: string,
    awayTeam: string,
    homeTokenId: string,
    awayTokenId: string,
    homeBestAsk: number | null | undefined,  // 买入价
    awayBestAsk: number | null | undefined,  // 买入价
    homeMidPrice: number,  // 中间价（备用）
    awayMidPrice: number,   // 中间价（备用）
    // 新增：战场情况参数
    homeScore: number = 0,
    awayScore: number = 0,
    matchStatus: string = 'PRE',
    quarter?: string,
    timeRemaining?: string,
    espnHomeProb?: number,
    espnAwayProb?: number
  ): Promise<Order | null> {
    try {
      await this.ensureInitialized();

      // 🔒 检测是否为无风险套利信号（通过 signal.details 中的 arbitrageMargin）
      const isArbitrage = signal.details?.arbitrageMargin !== undefined && signal.details.arbitrageMargin > 0;

      if (isArbitrage) {
        // 🎯 无风险套利：同时买入主队和客队
        logger.info(`🔒 [Paper Trading] 检测到无风险套利机会！`);
        logger.info(`   套利空间: ${(signal.details.arbitrageMargin! * 100).toFixed(2)}%`);
        logger.info(`   主队 ${homeTeam}: $${(homeBestAsk || homeMidPrice).toFixed(4)}`);
        logger.info(`   客队 ${awayTeam}: $${(awayBestAsk || awayMidPrice).toFixed(4)}`);

        const homePrice = homeBestAsk || homeMidPrice;
        const awayPrice = awayBestAsk || awayMidPrice;

        // 计算等额投入（每边投入50%资金的5%，即总共10%仓位）
        const totalPositionSize = this.balance * 0.10; // 总仓位10%
        const homeInvestment = totalPositionSize / 2; // 主队投入50%
        const awayInvestment = totalPositionSize / 2; // 客队投入50%

        const homeQuantity = homeInvestment / homePrice;
        const awayQuantity = awayInvestment / awayPrice;

        const totalCost = homeInvestment + awayInvestment;

        // 检查余额
        if (totalCost > this.balance) {
          logger.warn(`[Paper Trading] 余额不足: 需要 $${totalCost.toFixed(2)}, 可用 $${this.balance.toFixed(2)}`);
          return null;
        }

        // 检查是否已有持仓
        const homePositionKey = `${matchId}-${homeTokenId}`;
        const awayPositionKey = `${matchId}-${awayTokenId}`;
        if (this.positions.has(homePositionKey) || this.positions.has(awayPositionKey)) {
          logger.debug(`[Paper Trading] 已有持仓，跳过套利`);
          return null;
        }

        // 扣除余额
        this.balance -= totalCost;

        // 买入主队
        const homeOrder: Order = {
          id: `ORD${String(this.orderIdCounter++).padStart(6, '0')}`,
          matchId,
          type: OrderType.BUY,
          status: OrderStatus.FILLED,
          team: homeTeam,
          tokenId: homeTokenId,
          quantity: homeQuantity,
          entryPrice: homePrice,
          currentPrice: homePrice,
          pnl: 0,
          pnlPercent: 0,
          reason: `🔒 套利-主队: ${signal.reason}`,
          confidence: signal.confidence,
          timestamp: Date.now(),
        };

        this.orders.set(homeOrder.id, homeOrder);
        this.positions.set(homePositionKey, {
          matchId,
          team: homeTeam,
          tokenId: homeTokenId,
          quantity: homeQuantity,
          avgCost: homePrice,
          currentPrice: homePrice,
          unrealizedPnl: 0,
          unrealizedPnlPercent: 0,
        });

        // 买入客队
        const awayOrder: Order = {
          id: `ORD${String(this.orderIdCounter++).padStart(6, '0')}`,
          matchId,
          type: OrderType.BUY,
          status: OrderStatus.FILLED,
          team: awayTeam,
          tokenId: awayTokenId,
          quantity: awayQuantity,
          entryPrice: awayPrice,
          currentPrice: awayPrice,
          pnl: 0,
          pnlPercent: 0,
          reason: `🔒 套利-客队: ${signal.reason}`,
          confidence: signal.confidence,
          timestamp: Date.now(),
        };

        this.orders.set(awayOrder.id, awayOrder);
        this.positions.set(awayPositionKey, {
          matchId,
          team: awayTeam,
          tokenId: awayTokenId,
          quantity: awayQuantity,
          avgCost: awayPrice,
          currentPrice: awayPrice,
          unrealizedPnl: 0,
          unrealizedPnlPercent: 0,
        });

        // 保存到数据库（主队）
        await databaseService.savePaperOrder({
          id: homeOrder.id,
          matchId,
          team: homeTeam,
          tokenId: homeTokenId,
          orderType: 'BUY',
          status: 'FILLED',
          quantity: homeQuantity,
          entryPrice: homePrice,
          currentPrice: homePrice,
          pnl: 0,
          pnlPercent: 0,
          confidence: signal.confidence,
          reason: homeOrder.reason,
          entryHomeScore: homeScore,
          entryAwayScore: awayScore,
          entryScoreDiff: homeScore - awayScore,
          entryEspnProb: espnHomeProb,
          entryPolyPrice: homePrice,
          entryMatchStatus: matchStatus,
          entryQuarter: quarter,
          entryTimeRemaining: timeRemaining,
        });

        await databaseService.savePaperPosition({
          matchId,
          team: homeTeam,
          tokenId: homeTokenId,
          quantity: homeQuantity,
          avgCost: homePrice,
          currentPrice: homePrice,
          unrealizedPnl: 0,
          unrealizedPnlPercent: 0,
        });

        // 保存到数据库（客队）
        await databaseService.savePaperOrder({
          id: awayOrder.id,
          matchId,
          team: awayTeam,
          tokenId: awayTokenId,
          orderType: 'BUY',
          status: 'FILLED',
          quantity: awayQuantity,
          entryPrice: awayPrice,
          currentPrice: awayPrice,
          pnl: 0,
          pnlPercent: 0,
          confidence: signal.confidence,
          reason: awayOrder.reason,
          entryHomeScore: homeScore,
          entryAwayScore: awayScore,
          entryScoreDiff: awayScore - homeScore,
          entryEspnProb: espnAwayProb,
          entryPolyPrice: awayPrice,
          entryMatchStatus: matchStatus,
          entryQuarter: quarter,
          entryTimeRemaining: timeRemaining,
        });

        await databaseService.savePaperPosition({
          matchId,
          team: awayTeam,
          tokenId: awayTokenId,
          quantity: awayQuantity,
          avgCost: awayPrice,
          currentPrice: awayPrice,
          unrealizedPnl: 0,
          unrealizedPnlPercent: 0,
        });

        // 更新账户余额
        await databaseService.updateAccountBalance(this.balance);

        logger.info(`✅ [Paper Trading] 套利买入完成！`);
        logger.info(`   主队 ${homeTeam}: x${homeQuantity.toFixed(2)} @$${homePrice.toFixed(4)} = $${homeInvestment.toFixed(2)}`);
        logger.info(`   客队 ${awayTeam}: x${awayQuantity.toFixed(2)} @$${awayPrice.toFixed(4)} = $${awayInvestment.toFixed(2)}`);
        logger.info(`   总成本: $${totalCost.toFixed(2)}, 余额: $${this.balance.toFixed(2)}`);

        return homeOrder; // 返回主队订单作为代表
      } else {
        // 📈 传统单边套利：只买入一边
        let team: string;
        let tokenId: string;
        let price: number;
        let espnProb: number | undefined;

        if (signal.type === SignalType.BUY_HOME) {
          team = homeTeam;
          tokenId = homeTokenId;
          price = homeBestAsk || homeMidPrice;
          espnProb = espnHomeProb;
        } else if (signal.type === SignalType.BUY_AWAY) {
          team = awayTeam;
          tokenId = awayTokenId;
          price = awayBestAsk || awayMidPrice;
          espnProb = espnAwayProb;
        } else {
          return null;
        }

        // 计算买入数量：使用固定仓位（如 10% 资金）
        const positionSize = this.balance * 0.10; // 10% 仓位
        const quantity = positionSize / price;

        // 检查余额
        const cost = quantity * price;
        if (cost > this.balance) {
          logger.warn(`[Paper Trading] 余额不足: 需要 $${cost.toFixed(2)}, 可用 $${this.balance.toFixed(2)}`);
          return null;
        }

        // 检查是否已有该持仓
        const positionKey = `${matchId}-${tokenId}`;
        if (this.positions.has(positionKey)) {
          logger.debug(`[Paper Trading] 已有持仓，跳过: ${team}`);
          return null;
        }

        // 创建订单
        const order: Order = {
          id: `ORD${String(this.orderIdCounter++).padStart(6, '0')}`,
          matchId,
          type: OrderType.BUY,
          status: OrderStatus.FILLED,
          team,
          tokenId,
          quantity,
          entryPrice: price,
          currentPrice: price,
          pnl: 0,
          pnlPercent: 0,
          reason: signal.reason,
          confidence: signal.confidence,
          timestamp: Date.now(),
        };

        // 计算比分差异
        const scoreDiff = signal.type === SignalType.BUY_HOME 
          ? homeScore - awayScore 
          : awayScore - homeScore;

        // 扣除余额
        this.balance -= cost;

        // 记录订单到内存
        this.orders.set(order.id, order);

        // 创建持仓到内存
        const position: Position = {
          matchId,
          team,
          tokenId,
          quantity,
          avgCost: price,
          currentPrice: price,
          unrealizedPnl: 0,
          unrealizedPnlPercent: 0,
        };
        this.positions.set(positionKey, position);

        // 💾 保存到数据库（包含战场情况）
        await databaseService.savePaperOrder({
          id: order.id,
          matchId,
          team,
          tokenId,
          orderType: 'BUY',
          status: 'FILLED',
          quantity,
          entryPrice: price,
          currentPrice: price,
          pnl: 0,
          pnlPercent: 0,
          confidence: signal.confidence,
          reason: signal.reason,
          // 买入时的战场情况
          entryHomeScore: homeScore,
          entryAwayScore: awayScore,
          entryScoreDiff: scoreDiff,
          entryEspnProb: espnProb,
          entryPolyPrice: price,
          entryMatchStatus: matchStatus,
          entryQuarter: quarter,
          entryTimeRemaining: timeRemaining,
        });

        // 保存持仓到数据库
        await databaseService.savePaperPosition({
          matchId,
          team,
          tokenId,
          quantity,
          avgCost: price,
          currentPrice: price,
          unrealizedPnl: 0,
          unrealizedPnlPercent: 0,
        });

        // 更新账户余额
        await databaseService.updateAccountBalance(this.balance);

        logger.info(`✅ [Paper Trading] 买入 ${team} x${quantity.toFixed(2)} @$${price.toFixed(4)} (成本: $${cost.toFixed(2)})`);
        logger.info(`   📊 战场情况: ${homeTeam} ${homeScore}:${awayScore} ${awayTeam}, ESPN胜率: ${espnProb ? (espnProb * 100).toFixed(1) + '%' : 'N/A'}`);
        logger.info(`   订单ID: ${order.id}, 置信度: ${(signal.confidence * 100).toFixed(1)}%, 余额: $${this.balance.toFixed(2)}`);

        return order;
      }
    } catch (error) {
      logger.error('[Paper Trading] 执行交易失败:', error);
      return null;
    }
  }

  /**
   * 更新持仓价格（实时计算浮盈浮亏）+ 混合离场策略
   */
  async updatePositionPrice(
    matchId: string, 
    homeTokenId: string, 
    awayTokenId: string, 
    homePrice: number, 
    awayPrice: number, 
    espnHomeProb?: number, 
    espnAwayProb?: number,
    // 新增：当前战场情况（用于离场记录）
    homeScore: number = 0,
    awayScore: number = 0,
    matchStatus: string = 'LIVE',
    quarter?: string,
    timeRemaining?: string
  ): Promise<void> {
    // 更新主队持仓
    const homePositionKey = `${matchId}-${homeTokenId}`;
    if (this.positions.has(homePositionKey)) {
      const position = this.positions.get(homePositionKey)!;
      position.currentPrice = homePrice;
      position.unrealizedPnl = (homePrice - position.avgCost) * position.quantity;
      position.unrealizedPnlPercent = ((homePrice - position.avgCost) / position.avgCost) * 100;

      // 更新对应订单的当前价格
      for (const order of this.orders.values()) {
        if (order.matchId === matchId && order.tokenId === homeTokenId && order.status === OrderStatus.FILLED) {
          order.currentPrice = homePrice;
          order.pnl = (homePrice - order.entryPrice) * order.quantity;
          order.pnlPercent = ((homePrice - order.entryPrice) / order.entryPrice) * 100;
          
          // 🎯 混合离场策略检查
          const sellSignal = this.checkExitConditions(order, homePrice, espnHomeProb);
          if (sellSignal) {
            logger.info(`🔔 触发卖出信号: ${sellSignal.reason}`);
            await this.closePosition(matchId, homeTokenId, homePrice, {
              homeScore,
              awayScore,
              matchStatus,
              quarter,
              timeRemaining,
              espnProb: espnHomeProb,
              exitReason: sellSignal.reason
            });
          }
          
          // 更新持仓到数据库
          await databaseService.savePaperPosition({
            matchId,
            team: position.team,
            tokenId: homeTokenId,
            quantity: position.quantity,
            avgCost: position.avgCost,
            currentPrice: homePrice,
            unrealizedPnl: position.unrealizedPnl,
            unrealizedPnlPercent: position.unrealizedPnlPercent,
          });
        }
      }
    }

    // 更新客队持仓
    const awayPositionKey = `${matchId}-${awayTokenId}`;
    if (this.positions.has(awayPositionKey)) {
      const position = this.positions.get(awayPositionKey)!;
      position.currentPrice = awayPrice;
      position.unrealizedPnl = (awayPrice - position.avgCost) * position.quantity;
      position.unrealizedPnlPercent = ((awayPrice - position.avgCost) / position.avgCost) * 100;

      // 更新对应订单的当前价格
      for (const order of this.orders.values()) {
        if (order.matchId === matchId && order.tokenId === awayTokenId && order.status === OrderStatus.FILLED) {
          order.currentPrice = awayPrice;
          order.pnl = (awayPrice - order.entryPrice) * order.quantity;
          order.pnlPercent = ((awayPrice - order.entryPrice) / order.entryPrice) * 100;
          
          // 🎯 混合离场策略检查
          const sellSignal = this.checkExitConditions(order, awayPrice, espnAwayProb);
          if (sellSignal) {
            logger.info(`🔔 触发卖出信号: ${sellSignal.reason}`);
            await this.closePosition(matchId, awayTokenId, awayPrice, {
              homeScore,
              awayScore,
              matchStatus,
              quarter,
              timeRemaining,
              espnProb: espnAwayProb,
              exitReason: sellSignal.reason
            });
          }
          
          // 更新持仓到数据库
          await databaseService.savePaperPosition({
            matchId,
            team: position.team,
            tokenId: awayTokenId,
            quantity: position.quantity,
            avgCost: position.avgCost,
            currentPrice: awayPrice,
            unrealizedPnl: position.unrealizedPnl,
            unrealizedPnlPercent: position.unrealizedPnlPercent,
          });
        }
      }
    }
  }

  /**
   * 平仓（比赛结束时自动平仓）+ 记录离场战场情况
   */
  async closePosition(
    matchId: string, 
    tokenId: string, 
    exitPrice: number,
    exitContext?: {
      homeScore?: number;
      awayScore?: number;
      matchStatus?: string;
      quarter?: string;
      timeRemaining?: string;
      espnProb?: number;
      exitReason?: string;
    }
  ): Promise<Order | null> {
    const positionKey = `${matchId}-${tokenId}`;
    const position = this.positions.get(positionKey);

    if (!position) {
      return null;
    }

    // 找到对应的订单
    let order: Order | null = null;
    for (const o of this.orders.values()) {
      if (o.matchId === matchId && o.tokenId === tokenId && o.status === OrderStatus.FILLED) {
        order = o;
        break;
      }
    }

    if (!order) {
      return null;
    }

    // 计算盈亏
    const pnl = (exitPrice - order.entryPrice) * order.quantity;
    const pnlPercent = ((exitPrice - order.entryPrice) / order.entryPrice) * 100;

    // 更新订单状态
    order.status = OrderStatus.CLOSED;
    order.exitPrice = exitPrice;
    order.pnl = pnl;
    order.pnlPercent = pnlPercent;
    order.closeTimestamp = Date.now();

    // 回收资金
    const revenue = order.quantity * exitPrice;
    this.balance += revenue;

    // 移除持仓
    this.positions.delete(positionKey);

    // 💾 更新订单到数据库（使用 UPDATE 而非 INSERT OR REPLACE，保留进场数据）
    await databaseService.updatePaperOrderOnClose(order.id, {
      exitPrice: exitPrice,
      currentPrice: exitPrice,
      pnl: pnl,
      pnlPercent: pnlPercent,
      // 离场时的战场情况
      exitHomeScore: exitContext?.homeScore,
      exitAwayScore: exitContext?.awayScore,
      exitScoreDiff: exitContext?.homeScore !== undefined && exitContext?.awayScore !== undefined 
        ? exitContext.homeScore - exitContext.awayScore 
        : undefined,
      exitEspnProb: exitContext?.espnProb,
      exitPolyPrice: exitPrice,
      exitMatchStatus: exitContext?.matchStatus,
      exitQuarter: exitContext?.quarter,
      exitTimeRemaining: exitContext?.timeRemaining,
      exitReason: exitContext?.exitReason || '比赛结束自动平仓',
    });

    // 从数据库删除持仓
    await databaseService.deletePaperPosition(matchId, tokenId);

    // 更新账户余额
    await databaseService.updateAccountBalance(this.balance);

    logger.info(`🔒 [Paper Trading] 平仓 ${position.team} @$${exitPrice.toFixed(4)}`);
    if (exitContext?.exitReason) {
      logger.info(`   📊 离场原因: ${exitContext.exitReason}`);
    }
    if (exitContext?.homeScore !== undefined && exitContext?.awayScore !== undefined) {
      logger.info(`   📊 离场时比分: ${exitContext.homeScore}:${exitContext.awayScore}`);
    }
    logger.info(`   盈亏: $${pnl.toFixed(2)} (${pnlPercent > 0 ? '+' : ''}${pnlPercent.toFixed(2)}%), 余额: $${this.balance.toFixed(2)}`);

    return order;
  }

  /**
   * 获取账户状态
   */
  getAccountStatus(): AccountStatus {
    const openOrders = Array.from(this.orders.values()).filter(o => o.status === OrderStatus.FILLED);
    const closedOrders = Array.from(this.orders.values()).filter(o => o.status === OrderStatus.CLOSED);
    const positions = Array.from(this.positions.values());

    // 计算持仓市值
    const positionsValue = positions.reduce((sum, pos) => sum + pos.quantity * pos.currentPrice, 0);

    // 总权益 = 余额 + 持仓市值
    const equity = this.balance + positionsValue;

    // 计算总盈亏
    const totalPnl = equity - this.initialBalance;
    const totalPnlPercent = (totalPnl / this.initialBalance) * 100;

    // 计算胜率
    const winningTrades = closedOrders.filter(o => o.pnl > 0).length;
    const winRate = closedOrders.length > 0 ? (winningTrades / closedOrders.length) * 100 : 0;

    return {
      balance: this.balance,
      equity,
      positions,
      openOrders,
      closedOrders,
      totalTrades: this.orders.size,
      winRate,
      totalPnl,
      totalPnlPercent,
    };
  }

  /**
   * 🎯 混合离场策略检查
   * 包含三种触发条件：获利了结、逻辑证伪、硬止损
   */
  private checkExitConditions(order: Order, currentPrice: number, espnProb?: number): { reason: string } | null {
    const pnlPercent = ((currentPrice - order.entryPrice) / order.entryPrice) * 100;
    
    // 情形 A：获利了结 (Take Profit) - "见好就收"
    // 触发条件：当前价格达到目标收益率 +25% (20%-30%)
    if (pnlPercent >= 25) {
      return {
        reason: `💰 获利了结: ${pnlPercent.toFixed(1)}% >= 25% (成本 $${order.entryPrice.toFixed(4)} → 当前 $${currentPrice.toFixed(4)})`
      };
    }
    
    // 情形 B：逻辑证伪 (Edge Disappears) - "优势没了"
    // 触发条件：Polymarket 价格 >= ESPN 胜率
    if (espnProb && currentPrice >= espnProb) {
      return {
        reason: `📉 逻辑证伪: 市场价 ${(currentPrice * 100).toFixed(1)}% >= ESPN胜率 ${(espnProb * 100).toFixed(1)}% (套利逻辑消失)`
      };
    }
    
    // 情形 C：硬止损 (Hard Stop Loss) - "活下去"
    // 触发条件：价格跌破 0.15 或损失超过 -50%
    if (currentPrice <= 0.15 || pnlPercent <= -50) {
      return {
        reason: `🛑 硬止损: 价格 $${currentPrice.toFixed(4)} <= $0.15 或损失 ${pnlPercent.toFixed(1)}% <= -50% (保留火种)`
      };
    }
    
    return null; // 不满足卖出条件，继续持有
  }

  /**
   * 重置账户（用于测试）
   */
  reset(): void {
    this.balance = this.initialBalance;
    this.orders.clear();
    this.positions.clear();
    this.orderIdCounter = 1;
    logger.info('[Paper Trading] 账户已重置');
  }
}

export const paperTradingService = new PaperTradingService();
