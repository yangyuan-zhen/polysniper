import { logger } from '../utils/logger';
import {
  Order,
  OrderType,
  OrderStatus,
  Position,
  AccountStatus,
  ArbitrageSignal,
  SignalType,
} from '../types';

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
  private orders: Map<string, Order> = new Map(); // 所有订单
  private positions: Map<string, Position> = new Map(); // 当前持仓 (key: matchId-tokenId)
  private orderIdCounter: number = 1;

  /**
   * 根据套利信号执行模拟交易
   */
  executeSignal(
    signal: ArbitrageSignal,
    matchId: string,
    homeTeam: string,
    awayTeam: string,
    homeTokenId: string,
    awayTokenId: string,
    homeBestAsk: number | null | undefined,  // 买入价
    awayBestAsk: number | null | undefined,  // 买入价
    homeMidPrice: number,  // 中间价（备用）
    awayMidPrice: number   // 中间价（备用）
  ): Order | null {
    try {
      // 确定买入哪一方
      let team: string;
      let tokenId: string;
      let price: number;

      if (signal.type === SignalType.BUY_HOME) {
        team = homeTeam;
        tokenId = homeTokenId;
        // 使用 Ask 价格（买入时支付的价格），如果没有则用中间价
        price = homeBestAsk || homeMidPrice;
      } else if (signal.type === SignalType.BUY_AWAY) {
        team = awayTeam;
        tokenId = awayTokenId;
        // 使用 Ask 价格（买入时支付的价格），如果没有则用中间价
        price = awayBestAsk || awayMidPrice;
      } else {
        // 暂不支持 SELL 信号（需要先有持仓）
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

      // 扣除余额
      this.balance -= cost;

      // 记录订单
      this.orders.set(order.id, order);

      // 创建持仓
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

      logger.info(`✅ [Paper Trading] 买入 ${team} x${quantity.toFixed(2)} @$${price.toFixed(4)} (Ask价，成本: $${cost.toFixed(2)})`);
      logger.info(`   订单ID: ${order.id}, 置信度: ${(signal.confidence * 100).toFixed(1)}%, 余额: $${this.balance.toFixed(2)}`);

      return order;
    } catch (error) {
      logger.error('[Paper Trading] 执行交易失败:', error);
      return null;
    }
  }

  /**
   * 更新持仓价格（实时计算浮盈浮亏）
   */
  updatePositionPrice(matchId: string, homeTokenId: string, awayTokenId: string, homePrice: number, awayPrice: number): void {
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
        }
      }
    }
  }

  /**
   * 平仓（比赛结束时自动平仓）
   */
  closePosition(matchId: string, tokenId: string, exitPrice: number): Order | null {
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

    logger.info(`🔒 [Paper Trading] 平仓 ${position.team} @$${exitPrice.toFixed(4)}`);
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
