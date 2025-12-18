import type { UnifiedMatch } from '../types/backend';
import { TrendingUp, TrendingDown, AlertCircle } from 'lucide-react';

interface MatchCardProps {
  match: UnifiedMatch;
}

export function MatchCard({ match }: MatchCardProps) {
  const {
    homeTeam,
    awayTeam,
    status,
    statusStr,
    poly,
    espn,
    signals,
    dataCompleteness,
  } = match;

  // 获取比赛状态样式
  const getStatusStyle = () => {
    switch (status) {
      case 'LIVE':
        return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'PRE':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'FINAL':
        return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
      default:
        return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  // 获取最强信号
  const topSignal = signals.length > 0
    ? signals.reduce((prev, current) => (prev.confidence > current.confidence ? prev : current))
    : null;

  // 格式化价格
  const formatPrice = (price: number) => `$${price.toFixed(2)}`;

  // 格式化概率
  const formatProb = (prob: number) => `${(prob * 100).toFixed(1)}%`;

  return (
    <div className="bg-surface rounded-2xl p-4 border border-white/5 hover:border-white/10 transition-all">
      {/* 比赛状态 */}
      <div className="flex items-center justify-between mb-3">
        <span className={`px-2 py-1 rounded-lg text-xs font-bold border ${getStatusStyle()}`}>
          {statusStr}
        </span>
        
        {signals.length > 0 && (
          <div className="flex items-center gap-1 text-xs text-yellow-400">
            <AlertCircle className="w-3 h-3" />
            <span>{signals.length} 信号</span>
          </div>
        )}
      </div>

      {/* 球队信息 */}
      <div className="space-y-2 mb-4">
        {/* 主队 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-white font-semibold">{homeTeam.name}</span>
          </div>
          <span className="text-2xl font-bold text-white">{homeTeam.score}</span>
        </div>

        {/* 客队 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-white font-semibold">{awayTeam.name}</span>
          </div>
          <span className="text-2xl font-bold text-white">{awayTeam.score}</span>
        </div>
      </div>

      {/* Polymarket 价格 */}
      {dataCompleteness.hasPolyData && (
        <div className="bg-white/5 rounded-lg p-3 mb-3">
          <div className="text-xs text-gray-400 mb-2">Polymarket 价格</div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="text-xs text-gray-500">{homeTeam.name}</div>
              <div className="text-lg font-bold text-white">{formatPrice(poly.homePrice)}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">{awayTeam.name}</div>
              <div className="text-lg font-bold text-white">{formatPrice(poly.awayPrice)}</div>
            </div>
          </div>
        </div>
      )}

      {/* ESPN 胜率 */}
      {dataCompleteness.hasESPNData && (
        <div className="bg-white/5 rounded-lg p-3 mb-3">
          <div className="text-xs text-gray-400 mb-2">ESPN 胜率</div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="text-xs text-gray-500">{homeTeam.name}</div>
              <div className="text-lg font-bold text-blue-400">{formatProb(espn.homeWinProb)}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">{awayTeam.name}</div>
              <div className="text-lg font-bold text-blue-400">{formatProb(espn.awayWinProb)}</div>
            </div>
          </div>
        </div>
      )}

      {/* 套利信号 */}
      {topSignal && (
        <div className={`rounded-lg p-3 border ${
          topSignal.type.includes('BUY') 
            ? 'bg-green-500/10 border-green-500/30' 
            : 'bg-red-500/10 border-red-500/30'
        }`}>
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              {topSignal.type.includes('BUY') ? (
                <TrendingUp className="w-4 h-4 text-green-400" />
              ) : (
                <TrendingDown className="w-4 h-4 text-red-400" />
              )}
              <span className={`text-sm font-bold ${
                topSignal.type.includes('BUY') ? 'text-green-400' : 'text-red-400'
              }`}>
                {topSignal.type.replace('_', ' ')}
              </span>
            </div>
            <span className="text-xs text-gray-400">
              置信度: {(topSignal.confidence * 100).toFixed(0)}%
            </span>
          </div>
          <div className="text-xs text-gray-400">{topSignal.reason}</div>
          <div className="text-xs text-gray-500 mt-1">
            预期收益: {topSignal.edge.toFixed(2)}%
          </div>
        </div>
      )}

      {/* 数据完整性指示 */}
      <div className="flex items-center gap-2 mt-3 text-xs">
        <span className={`w-2 h-2 rounded-full ${dataCompleteness.hasPolyData ? 'bg-green-400' : 'bg-gray-600'}`} title="Polymarket" />
        <span className={`w-2 h-2 rounded-full ${dataCompleteness.hasESPNData ? 'bg-green-400' : 'bg-gray-600'}`} title="ESPN" />
        <span className={`w-2 h-2 rounded-full ${dataCompleteness.hasHupuData ? 'bg-green-400' : 'bg-gray-600'}`} title="虎扑" />
        <span className="text-gray-500 ml-auto">
          {new Date(match.lastUpdate).toLocaleTimeString('zh-CN')}
        </span>
      </div>
    </div>
  );
}
