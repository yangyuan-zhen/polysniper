#!/usr/bin/env ts-node

import sqlite3 from 'sqlite3';
import path from 'path';

/**
 * 查看市场快照数据
 */
async function viewSnapshots() {
  console.log('📊 查询市场快照数据...\n');

  const dbPath = path.join(__dirname, '../data/polysniper.db');
  const db = new sqlite3.Database(dbPath);

  try {
    // 获取最近的快照
    const snapshots: any[] = await new Promise((resolve, reject) => {
      db.all(`
        SELECT 
          id,
          match_id,
          home_team,
          away_team,
          home_score,
          away_score,
          match_status,
          quarter,
          espn_home_win_prob,
          espn_away_win_prob,
          poly_home_price,
          poly_away_price,
          arbitrage_signals,
          timestamp
        FROM market_snapshots
        ORDER BY timestamp DESC
        LIMIT 20
      `, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    console.log(`📈 最近 ${snapshots.length} 条快照：\n`);

    snapshots.forEach((snap, index) => {
      const time = new Date(snap.timestamp).toLocaleString('zh-CN');
      const signals = snap.arbitrage_signals ? JSON.parse(snap.arbitrage_signals) : [];
      
      console.log(`─────────────────────────────────────────`);
      console.log(`#${index + 1} | ${time}`);
      console.log(`🏀 ${snap.home_team} vs ${snap.away_team}`);
      console.log(`   比分: ${snap.home_score}-${snap.away_score} | 状态: ${snap.match_status} | ${snap.quarter || ''}`);
      console.log(`   ESPN: 主 ${(snap.espn_home_win_prob * 100).toFixed(1)}% vs 客 ${(snap.espn_away_win_prob * 100).toFixed(1)}%`);
      console.log(`   Poly: 主 $${snap.poly_home_price?.toFixed(2) || 'N/A'} vs 客 $${snap.poly_away_price?.toFixed(2) || 'N/A'}`);
      
      if (signals.length > 0) {
        console.log(`   🎯 套利信号: ${signals.length} 个`);
        signals.forEach((sig: any) => {
          console.log(`      - ${sig.team}: Edge ${(sig.edge * 100).toFixed(2)}%, EV+ $${sig.evPlus.toFixed(2)}`);
        });
      } else {
        console.log(`   ⚪ 无套利信号`);
      }
    });

    console.log(`─────────────────────────────────────────\n`);

    // 统计信息
    const stats: any = await new Promise((resolve, reject) => {
      db.get(`
        SELECT 
          COUNT(*) as total,
          COUNT(DISTINCT match_id) as unique_matches,
          MIN(timestamp) as earliest,
          MAX(timestamp) as latest
        FROM market_snapshots
      `, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    console.log('📊 统计信息:');
    console.log(`   总快照数: ${stats.total}`);
    console.log(`   独立比赛: ${stats.unique_matches}`);
    console.log(`   最早记录: ${new Date(stats.earliest).toLocaleString('zh-CN')}`);
    console.log(`   最新记录: ${new Date(stats.latest).toLocaleString('zh-CN')}\n`);

    // 套利信号统计
    const signalStats: any[] = await new Promise((resolve, reject) => {
      db.all(`
        SELECT 
          match_id,
          home_team,
          away_team,
          arbitrage_signals,
          COUNT(*) as snapshot_count
        FROM market_snapshots
        WHERE arbitrage_signals != '[]' AND arbitrage_signals IS NOT NULL
        GROUP BY match_id
        ORDER BY snapshot_count DESC
        LIMIT 5
      `, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    if (signalStats.length > 0) {
      console.log('🎯 套利信号最多的比赛:');
      signalStats.forEach((stat, i) => {
        console.log(`   ${i + 1}. ${stat.home_team} vs ${stat.away_team}: ${stat.snapshot_count} 次信号`);
      });
    }

  } catch (error) {
    console.error('❌ 查询失败:', error);
  } finally {
    db.close();
  }
}

viewSnapshots();
