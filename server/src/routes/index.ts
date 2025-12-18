import { Router } from 'express';
import { dataAggregator } from '../services/dataAggregator';
import { MatchStatus } from '../types';

const router = Router();

/**
 * 健康检查
 */
router.get('/health', (req, res) => {
  res.json({
    success: true,
    data: {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    },
  });
});

/**
 * 获取所有比赛
 * Query: status (live/pre/final), hasSignals (boolean)
 */
router.get('/api/matches', (req, res) => {
  try {
    const { status, hasSignals } = req.query;

    let matches = dataAggregator.getAllMatches();

    // 按状态筛选
    if (status) {
      const statusFilter = (status as string).toUpperCase() as MatchStatus;
      matches = dataAggregator.getMatchesByStatus(statusFilter);
    }

    // 只返回有套利信号的比赛
    if (hasSignals === 'true') {
      matches = matches.filter(m => m.signals.length > 0);
    }

    res.json({
      success: true,
      data: matches,
      timestamp: new Date().toISOString(),
      cached: false,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error.message,
      },
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * 获取单场比赛
 */
router.get('/api/matches/:id', (req, res) => {
  try {
    const { id } = req.params;
    const match = dataAggregator.getMatch(id);

    if (!match) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Match ${id} not found`,
        },
        timestamp: new Date().toISOString(),
      });
    }

    res.json({
      success: true,
      data: match,
      timestamp: new Date().toISOString(),
      cached: false,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error.message,
      },
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * 获取有套利信号的比赛
 */
router.get('/api/signals', (req, res) => {
  try {
    const matches = dataAggregator.getMatchesWithSignals();

    // 按置信度排序
    matches.sort((a, b) => {
      const aMaxConfidence = Math.max(...a.signals.map(s => s.confidence), 0);
      const bMaxConfidence = Math.max(...b.signals.map(s => s.confidence), 0);
      return bMaxConfidence - aMaxConfidence;
    });

    res.json({
      success: true,
      data: matches,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error.message,
      },
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * 获取统计信息
 */
router.get('/api/stats', (req, res) => {
  try {
    const allMatches = dataAggregator.getAllMatches();
    const liveMatches = dataAggregator.getMatchesByStatus(MatchStatus.LIVE);
    const matchesWithSignals = dataAggregator.getMatchesWithSignals();

    // 计算总信号数
    const totalSignals = allMatches.reduce((sum, m) => sum + m.signals.length, 0);

    // 计算平均置信度
    const allSignals = allMatches.flatMap(m => m.signals);
    const avgConfidence = allSignals.length > 0
      ? allSignals.reduce((sum, s) => sum + s.confidence, 0) / allSignals.length
      : 0;

    res.json({
      success: true,
      data: {
        totalMatches: allMatches.length,
        liveMatches: liveMatches.length,
        matchesWithSignals: matchesWithSignals.length,
        totalSignals,
        avgConfidence: avgConfidence.toFixed(3),
        dataCompleteness: {
          withPolyData: allMatches.filter(m => m.dataCompleteness.hasPolyData).length,
          withESPNData: allMatches.filter(m => m.dataCompleteness.hasESPNData).length,
          withHupuData: allMatches.filter(m => m.dataCompleteness.hasHupuData).length,
        },
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error.message,
      },
      timestamp: new Date().toISOString(),
    });
  }
});

export default router;
