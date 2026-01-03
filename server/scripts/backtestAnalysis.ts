#!/usr/bin/env ts-node

import { databaseService } from '../src/services/databaseService';
import { logger } from '../src/utils/logger';

/**
 * 回测分析脚本
 * 用途：验证不同阈值下的策略收益率
 */
class BacktestAnalysis {
  
  /**
   * 运行回测分析
   */
  async runAnalysis(): Promise<void> {
    console.log('🔍 开始回测分析...\n');

    await databaseService.initialize();

    // 获取所有历史数据
    const snapshots = await databaseService.getBacktestData();
    console.log(`📊 加载了 ${snapshots.length} 条历史数据\n`);

    if (snapshots.length === 0) {
      console.log('❌ 没有历史数据，请先运行系统收集数据');
      return;
    }

    // 测试不同阈值
    const thresholds = [0.05, 0.08, 0.10, 0.12, 0.15, 0.20]; // 5%, 8%, 10%, 12%, 15%, 20%
    
    console.log('🎯 测试不同利润空间阈值的策略表现:\n');
    console.log('阈值\t信号数\t胜率\t平均收益\t总收益\t最大回撤');
    console.log('----\t----\t----\t--------\t------\t--------');

    for (const threshold of thresholds) {
      const result = await this.simulateStrategy(snapshots, threshold);
      console.log(`${(threshold * 100).toFixed(0)}%\t${result.totalSignals}\t${result.winRate.toFixed(1)}%\t${result.avgReturn.toFixed(2)}%\t${result.totalReturn.toFixed(2)}%\t${result.maxDrawdown.toFixed(2)}%`);
    }

    console.log('\n📈 按比分差异分析最佳买入时机:\n');
    await this.analyzeByScoreDiff(snapshots);

    console.log('\n🎲 Paper Trading 实盘分析:\n');
    await this.analyzePaperTrading();

    await databaseService.close();
  }

  /**
   * 模拟策略执行
   */
  private async simulateStrategy(snapshots: any[], threshold: number): Promise<{
    totalSignals: number;
    winRate: number;
    avgReturn: number;
    totalReturn: number;
    maxDrawdown: number;
  }> {
    let balance = 1000;
    let totalSignals = 0;
    let winningTrades = 0;
    let returns: number[] = [];
    let maxBalance = balance;
    let maxDrawdown = 0;

    // 按比赛分组
    const matchGroups = new Map<string, any[]>();
    snapshots.forEach(snapshot => {
      if (!matchGroups.has(snapshot.match_id)) {
        matchGroups.set(snapshot.match_id, []);
      }
      matchGroups.get(snapshot.match_id)!.push(snapshot);
    });

    // 对每场比赛进行模拟
    for (const [matchId, matchSnapshots] of matchGroups) {
      // 按时间排序
      matchSnapshots.sort((a, b) => a.timestamp - b.timestamp);
      
      let position: { side: 'home' | 'away', entryPrice: number, quantity: number } | null = null;

      for (let i = 0; i < matchSnapshots.length; i++) {
        const snapshot = matchSnapshots[i];
        
        // 跳过没有完整数据的快照
        if (!snapshot.espn_home_win_prob || !snapshot.poly_home_price) continue;

        // 检查买入信号
        if (!position) {
          // 主队信号
          const homeEdge = snapshot.espn_home_win_prob - (snapshot.poly_home_best_ask || snapshot.poly_home_price);
          if (homeEdge >= threshold) {
            const positionSize = balance * 0.1; // 10% 仓位
            const entryPrice = snapshot.poly_home_best_ask || snapshot.poly_home_price;
            position = {
              side: 'home',
              entryPrice,
              quantity: positionSize / entryPrice
            };
            totalSignals++;
          } else {
            // 客队信号
            const awayEdge = snapshot.espn_away_win_prob - (snapshot.poly_away_best_ask || snapshot.poly_away_price);
            if (awayEdge >= threshold) {
              const positionSize = balance * 0.1; // 10% 仓位
              const entryPrice = snapshot.poly_away_best_ask || snapshot.poly_away_price;
              position = {
                side: 'away',
                entryPrice,
                quantity: positionSize / entryPrice
              };
              totalSignals++;
            }
          }
        }

        // 检查卖出信号（如果有持仓）
        if (position) {
          const currentPrice = position.side === 'home' 
            ? (snapshot.poly_home_best_bid || snapshot.poly_home_price)
            : (snapshot.poly_away_best_bid || snapshot.poly_away_price);
          
          const currentEspnProb = position.side === 'home' 
            ? snapshot.espn_home_win_prob 
            : snapshot.espn_away_win_prob;

          let shouldSell = false;
          
          // 获利了结：25% 收益
          const returnPct = (currentPrice - position.entryPrice) / position.entryPrice;
          if (returnPct >= 0.25) {
            shouldSell = true;
          }
          
          // 逻辑证伪：当前价格 >= ESPN 胜率
          if (currentPrice >= currentEspnProb) {
            shouldSell = true;
          }
          
          // 硬止损：价格 <= 0.15 或损失 >= 50%
          if (currentPrice <= 0.15 || returnPct <= -0.5) {
            shouldSell = true;
          }

          // 比赛结束强制平仓
          if (snapshot.match_status === 'FINAL') {
            shouldSell = true;
          }

          if (shouldSell) {
            const revenue = position.quantity * currentPrice;
            const cost = position.quantity * position.entryPrice;
            const pnl = revenue - cost;
            const pnlPct = pnl / cost;
            
            balance += pnl;
            returns.push(pnlPct);
            
            if (pnl > 0) winningTrades++;
            
            // 更新最大回撤
            if (balance > maxBalance) {
              maxBalance = balance;
            }
            const drawdown = (maxBalance - balance) / maxBalance;
            if (drawdown > maxDrawdown) {
              maxDrawdown = drawdown;
            }
            
            position = null;
          }
        }
      }
    }

    const winRate = totalSignals > 0 ? (winningTrades / totalSignals) * 100 : 0;
    const avgReturn = returns.length > 0 ? (returns.reduce((sum, r) => sum + r, 0) / returns.length) * 100 : 0;
    const totalReturn = ((balance - 1000) / 1000) * 100;

    return {
      totalSignals,
      winRate,
      avgReturn,
      totalReturn,
      maxDrawdown: maxDrawdown * 100
    };
  }

  /**
   * 按比分差异分析
   */
  private async analyzeByScoreDiff(snapshots: any[]): Promise<void> {
    const scoreDiffGroups = new Map<string, { signals: number, wins: number, totalReturn: number }>();
    
    // 模拟交易并按比分差异分组
    snapshots.forEach(snapshot => {
      if (!snapshot.espn_home_win_prob || !snapshot.poly_home_price) return;
      
      const scoreDiff = snapshot.home_score - snapshot.away_score;
      let range: string;
      
      if (scoreDiff >= 10) range = '领先10+';
      else if (scoreDiff >= 5) range = '领先5-9';
      else if (scoreDiff >= 0) range = '领先0-4';
      else if (scoreDiff >= -4) range = '落后0-4';
      else if (scoreDiff >= -9) range = '落后5-9';
      else range = '落后10+';
      
      if (!scoreDiffGroups.has(range)) {
        scoreDiffGroups.set(range, { signals: 0, wins: 0, totalReturn: 0 });
      }
      
      const homeEdge = snapshot.espn_home_win_prob - snapshot.poly_home_price;
      if (homeEdge >= 0.10) { // 10% 阈值
        const group = scoreDiffGroups.get(range)!;
        group.signals++;
        
        // 简单模拟：如果最终主队获胜则算赢
        // 这里简化处理，实际应该根据后续数据判断
        const finalSnapshot = snapshots
          .filter(s => s.match_id === snapshot.match_id && s.match_status === 'FINAL')
          .pop();
        
        if (finalSnapshot && finalSnapshot.home_score > finalSnapshot.away_score) {
          group.wins++;
          group.totalReturn += 0.2; // 假设平均收益 20%
        } else {
          group.totalReturn -= 0.1; // 假设平均损失 10%
        }
      }
    });

    console.log('比分差异\t信号数\t胜率\t平均收益');
    console.log('--------\t------\t----\t--------');
    
    for (const [range, data] of scoreDiffGroups) {
      const winRate = data.signals > 0 ? (data.wins / data.signals) * 100 : 0;
      const avgReturn = data.signals > 0 ? (data.totalReturn / data.signals) * 100 : 0;
      console.log(`${range}\t${data.signals}\t${winRate.toFixed(1)}%\t${avgReturn.toFixed(1)}%`);
    }
  }

  /**
   * 分析 Paper Trading 实盘数据
   */
  private async analyzePaperTrading(): Promise<void> {
    try {
      const analysis = await databaseService.getTradeAnalysis();
      
      console.log(`总交易次数: ${analysis.totalTrades}`);
      console.log(`获胜交易: ${analysis.winningTrades}`);
      console.log(`失败交易: ${analysis.losingTrades}`);
      console.log(`胜率: ${analysis.winRate.toFixed(1)}%`);
      console.log(`平均盈利: $${analysis.avgWin.toFixed(2)}`);
      console.log(`平均亏损: $${analysis.avgLoss.toFixed(2)}`);
      
      if (analysis.bestTrade) {
        console.log(`最佳交易: ${analysis.bestTrade.team} +$${analysis.bestTrade.pnl.toFixed(2)} (${analysis.bestTrade.pnl_percent.toFixed(1)}%)`);
      }
      
      if (analysis.worstTrade) {
        console.log(`最差交易: ${analysis.worstTrade.team} $${analysis.worstTrade.pnl.toFixed(2)} (${analysis.worstTrade.pnl_percent.toFixed(1)}%)`);
      }

      if (analysis.profitByScoreDiff.length > 0) {
        console.log('\n📊 按比分差异分析:');
        console.log('比分范围\t交易数\t胜率\t平均盈亏');
        console.log('--------\t------\t----\t--------');
        analysis.profitByScoreDiff.forEach(row => {
          const winRate = row.trades > 0 ? (row.wins / row.trades) * 100 : 0;
          console.log(`${row.score_range}\t${row.trades}\t${winRate.toFixed(1)}%\t$${row.avg_pnl.toFixed(2)}`);
        });
      }

      if (analysis.profitByEdge.length > 0) {
        console.log('\n📊 按利润空间分析:');
        console.log('利润空间\t交易数\t胜率\t平均盈亏');
        console.log('--------\t------\t----\t--------');
        analysis.profitByEdge.forEach(row => {
          const winRate = row.trades > 0 ? (row.wins / row.trades) * 100 : 0;
          console.log(`${row.edge_range}\t${row.trades}\t${winRate.toFixed(1)}%\t$${row.avg_pnl.toFixed(2)}`);
        });
      }
    } catch (error) {
      console.log('Paper Trading 数据分析失败:', error);
    }
  }
}

// 运行分析
if (require.main === module) {
  const analysis = new BacktestAnalysis();
  analysis.runAnalysis().catch(console.error);
}

export { BacktestAnalysis };
