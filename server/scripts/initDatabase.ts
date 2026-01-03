#!/usr/bin/env ts-node

import { databaseService } from '../src/services/databaseService';
import { logger } from '../src/utils/logger';
import fs from 'fs';
import path from 'path';

/**
 * 数据库初始化脚本
 * 用途：为新用户创建干净的 SQLite 数据库
 * 
 * 运行方式：
 * npm run init-db
 * 或者在 npm run dev 时自动运行
 */
class DatabaseInitializer {
  
  async initialize(): Promise<void> {
    console.log('🗄️  初始化 SQLite 数据库...\n');

    try {
      // 确保 data 目录存在
      const dataDir = path.join(__dirname, '../data');
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
        console.log('📁 创建 data 目录');
      }

      // 检查数据库是否已存在
      const dbPath = path.join(dataDir, 'polysniper.db');
      const dbExists = fs.existsSync(dbPath);
      
      if (dbExists) {
        console.log('✅ 数据库已存在，跳过初始化');
        console.log(`📍 数据库位置: ${dbPath}`);
        
        // 显示数据库统计信息
        await this.showDatabaseStats();
        return;
      }

      // 初始化数据库服务
      await databaseService.initialize();
      
      console.log('✅ SQLite 数据库初始化完成！');
      console.log(`📍 数据库位置: ${dbPath}`);
      console.log('\n📋 创建的表：');
      console.log('  - market_snapshots     (行情回测数据)');
      console.log('  - paper_accounts       (Paper Trading 账户)');
      console.log('  - paper_orders         (交易订单记录)');
      console.log('  - paper_positions      (当前持仓)');
      
      console.log('\n🎯 使用方法：');
      console.log('  - npm run dev          (启动开发服务器)');
      console.log('  - npm run backtest     (运行回测分析)');
      
      console.log('\n⚠️  重要提醒：');
      console.log('  - 数据库文件已添加到 .gitignore');
      console.log('  - 请勿将 .db 文件提交到 Git');
      console.log('  - 数据库包含您的交易隐私信息');

    } catch (error) {
      console.error('❌ 数据库初始化失败:', error);
      process.exit(1);
    } finally {
      await databaseService.close();
    }
  }

  /**
   * 显示数据库统计信息
   */
  private async showDatabaseStats(): Promise<void> {
    try {
      await databaseService.initialize();
      
      // 获取 Paper Trading 账户信息
      try {
        const account = await databaseService.getPaperAccount();
        console.log('\n💰 Paper Trading 账户状态：');
        console.log(`  - 当前余额: $${account.current_balance.toFixed(2)}`);
        console.log(`  - 总交易数: ${account.total_trades}`);
        console.log(`  - 当前持仓: ${account.positions.length}`);
        console.log(`  - 未平仓订单: ${account.openOrders.length}`);
        console.log(`  - 已平仓订单: ${account.closedOrders.length}`);
      } catch (error) {
        console.log('\n💰 Paper Trading: 暂无账户数据');
      }

      // 获取市场快照统计
      try {
        const snapshots = await databaseService.getBacktestData();
        console.log(`\n📊 历史数据: ${snapshots.length} 条市场快照`);
        
        if (snapshots.length > 0) {
          const latest = snapshots[snapshots.length - 1];
          const oldest = snapshots[0];
          const latestDate = new Date(latest.timestamp).toLocaleString();
          const oldestDate = new Date(oldest.timestamp).toLocaleString();
          console.log(`  - 最早记录: ${oldestDate}`);
          console.log(`  - 最新记录: ${latestDate}`);
        }
      } catch (error) {
        console.log('\n📊 历史数据: 暂无回测数据');
      }

    } catch (error) {
      console.log('⚠️  无法读取数据库统计信息');
    }
  }

  /**
   * 重置数据库（危险操作）
   */
  async reset(): Promise<void> {
    console.log('⚠️  重置数据库...');
    
    const dataDir = path.join(__dirname, '../data');
    const dbPath = path.join(dataDir, 'polysniper.db');
    
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
      console.log('🗑️  已删除现有数据库');
    }
    
    await this.initialize();
    console.log('✅ 数据库重置完成');
  }
}

// 命令行参数处理
const args = process.argv.slice(2);
const initializer = new DatabaseInitializer();

if (args.includes('--reset')) {
  initializer.reset().catch(console.error);
} else {
  initializer.initialize().catch(console.error);
}

export { DatabaseInitializer };
