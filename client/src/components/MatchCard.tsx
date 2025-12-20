import type { UnifiedMatch } from '../types/backend';
import { TrendingUp, TrendingDown, AlertCircle } from 'lucide-react';

interface MatchCardProps {
  match: UnifiedMatch;
  onClick?: (match: UnifiedMatch) => void;
}

export function MatchCard({ match, onClick }: MatchCardProps) {
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

  // 判断是否有信号
  const hasSignals = signals.length > 0;
  
  // 获取卡片边框样式
  const getCardBorderStyle = () => {
    if (hasSignals) {
      return 'border-purple-500/40 shadow-lg shadow-purple-500/10';
    }
    if (status === 'LIVE') {
      return 'border-green-500/20';
    }
    return 'border-white/5';
  };

  // 格式化开始时间
  const formatStartTime = () => {
    if (!match.startTime) return '';
    const date = new Date(match.startTime);
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div 
      className={`bg-surface rounded-xl border-2 hover:border-white/20 transition-all overflow-hidden cursor-pointer ${
        getCardBorderStyle()
      } ${hasSignals ? 'animate-pulse-slow' : ''}`}
      onClick={() => onClick?.(match)}
    >
      {/* Header - Status, Time & Signals */}
      <div className="bg-white/5 px-4 py-2 flex items-center justify-between border-b border-white/5">
        <div className="flex items-center gap-2">
          <span className={`px-2 py-0.5 rounded text-xs font-bold ${getStatusStyle()}`}>
            {statusStr}
          </span>
          {status === 'PRE' && match.startTime && (
            <span className="text-xs text-gray-400">
              {formatStartTime()}
            </span>
          )}
        </div>
        
        {hasSignals && (
          <div className="flex items-center gap-1.5 px-2 py-0.5 bg-yellow-500/20 rounded border border-yellow-500/30">
            <AlertCircle className="w-3 h-3 text-yellow-400" />
            <span className="text-xs font-bold text-yellow-400">{signals.length}</span>
          </div>
        )}
      </div>

      <div className="p-4">
        {/* Teams & Scores */}
        <div className="space-y-3 mb-4">
          {/* 主队 */}
          <div className="flex items-center justify-between">
            <span className="text-white font-bold text-base truncate">{homeTeam.name}</span>
            <span className="text-3xl font-black text-white ml-2">{homeTeam.score}</span>
          </div>

          {/* 客队 */}
          <div className="flex items-center justify-between">
            <span className="text-white font-bold text-base truncate">{awayTeam.name}</span>
            <span className="text-3xl font-black text-white ml-2">{awayTeam.score}</span>
          </div>
        </div>

        {/* ESPN 胜率 - 主要显示 */}
        {dataCompleteness.hasESPNData && (
          <div className="mb-3">
            <div className="bg-gradient-to-r from-blue-500/10 to-cyan-500/10 rounded-lg p-3 border border-blue-500/20">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-blue-300">ESPN 数据</span>
                {espn.injuries && espn.injuries.length > 0 && (
                  <span className="text-xs text-orange-400 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {espn.injuries.length} 人伤病
                  </span>
                )}
              </div>
              
              {espn.homeWinProb > 0 && espn.awayWinProb > 0 ? (
                <>
                  {/* 胜率进度条 */}
                  <div className="h-10 bg-gray-800/50 rounded-full overflow-hidden flex mb-2">
                    <div 
                      className="bg-gradient-to-r from-blue-500 to-blue-400 flex items-center justify-center text-sm font-bold text-white transition-all"
                      style={{ width: `${espn.homeWinProb * 100}%` }}
                    >
                      {espn.homeWinProb > 0.15 && formatProb(espn.homeWinProb)}
                    </div>
                    <div 
                      className="bg-gradient-to-r from-cyan-400 to-cyan-500 flex items-center justify-center text-sm font-bold text-white transition-all"
                      style={{ width: `${espn.awayWinProb * 100}%` }}
                    >
                      {espn.awayWinProb > 0.15 && formatProb(espn.awayWinProb)}
                    </div>
                  </div>

                  {/* 数值显示 */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="text-center">
                      <div className="text-gray-400">{homeTeam.name.split(' ').pop()}</div>
                      <div className="text-blue-400 font-bold">{formatProb(espn.homeWinProb)}</div>
                    </div>
                    <div className="text-center">
                      <div className="text-gray-400">{awayTeam.name.split(' ').pop()}</div>
                      <div className="text-cyan-400 font-bold">{formatProb(espn.awayWinProb)}</div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-xs text-gray-400 text-center py-2">
                  {espn.injuries && espn.injuries.length > 0 ? '点击查看伤病详情' : '暂无胜率数据'}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Polymarket 价格 */}
        <div className="mb-3">
          {dataCompleteness.hasPolyData ? (
            <div className="bg-gradient-to-r from-purple-500/10 to-blue-500/10 rounded-lg p-2.5 border border-purple-500/20">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-semibold text-purple-300">Polymarket</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="text-center">
                  <div className="text-xs text-gray-400 mb-0.5">{homeTeam.name.split(' ').pop()}</div>
                  <div className="text-lg font-black text-white">{formatPrice(poly.homePrice)}</div>
                </div>
                <div className="text-center">
                  <div className="text-xs text-gray-400 mb-0.5">{awayTeam.name.split(' ').pop()}</div>
                  <div className="text-lg font-black text-white">{formatPrice(poly.awayPrice)}</div>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-orange-500/10 rounded-lg p-2.5 border border-orange-500/20">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-orange-400" />
                <span className="text-xs text-orange-300">暂无 Polymarket 数据</span>
              </div>
            </div>
          )}
        </div>

        {/* 数据缺失提示 */}
        {!dataCompleteness.hasESPNData && (
          <div className="bg-gray-500/10 rounded-lg p-2.5 border border-gray-500/20 mb-3">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-gray-400" />
              <span className="text-xs text-gray-400">暂无 ESPN 数据</span>
            </div>
          </div>
        )}

        {/* 套利信号 - 突出显示 */}
        {topSignal && (
          <div className={`rounded-lg p-3 border-2 ${
            topSignal.type.includes('BUY') 
              ? 'bg-gradient-to-br from-green-500/20 to-green-600/10 border-green-500/50' 
              : 'bg-gradient-to-br from-red-500/20 to-red-600/10 border-red-500/50'
          }`}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                {topSignal.type.includes('BUY') ? (
                  <TrendingUp className="w-5 h-5 text-green-400" />
                ) : (
                  <TrendingDown className="w-5 h-5 text-red-400" />
                )}
                <span className={`text-sm font-black uppercase ${
                  topSignal.type.includes('BUY') ? 'text-green-400' : 'text-red-400'
                }`}>
                  {topSignal.type.replace('_', ' ')}
                </span>
              </div>
              <div className="flex flex-col items-end">
                <span className="text-xs text-gray-400">置信度</span>
                <span className="text-sm font-bold text-white">
                  {(topSignal.confidence * 100).toFixed(0)}%
                </span>
              </div>
            </div>
            <div className="text-xs text-gray-300 leading-relaxed mb-1">{topSignal.reason}</div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-400">预期收益</span>
              <span className={`font-bold ${
                topSignal.type.includes('BUY') ? 'text-green-400' : 'text-red-400'
              }`}>
                +{topSignal.edge.toFixed(2)}%
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Footer - Data Status & Update Time */}
      <div className="bg-white/5 px-4 py-2 flex items-center justify-between border-t border-white/5">
        <div className="flex items-center gap-2 text-xs">
          <div className="flex items-center gap-1">
            <span className={`w-1.5 h-1.5 rounded-full ${dataCompleteness.hasPolyData ? 'bg-green-400' : 'bg-gray-600'}`} title="Polymarket" />
            <span className="text-gray-500">P</span>
          </div>
          <div className="flex items-center gap-1">
            <span className={`w-1.5 h-1.5 rounded-full ${dataCompleteness.hasESPNData ? 'bg-green-400' : 'bg-gray-600'}`} title="ESPN" />
            <span className="text-gray-500">E</span>
          </div>
          <div className="flex items-center gap-1">
            <span className={`w-1.5 h-1.5 rounded-full ${dataCompleteness.hasHupuData ? 'bg-green-400' : 'bg-gray-600'}`} title="虎扑" />
            <span className="text-gray-500">H</span>
          </div>
        </div>
        <span className="text-xs text-gray-500">
          更新 {new Date(match.lastUpdate).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
    </div>
  );
}
