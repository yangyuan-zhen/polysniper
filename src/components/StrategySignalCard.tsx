import { Zap, TrendingUp, Target, Shield } from 'lucide-react';
import type { TradingSignal } from '../services/strategy';

interface StrategySignalCardProps {
  signal: TradingSignal | null;
}

export function StrategySignalCard({ signal }: StrategySignalCardProps) {
  if (!signal) {
    return (
      <div className="bg-surface rounded-2xl p-6 border border-white/5 relative overflow-hidden">
        <div className="flex items-center gap-2 text-gray-400 font-bold text-sm tracking-wide mb-6">
          <TrendingUp className="w-4 h-4" />
          策略信号
        </div>
        <div className="text-center py-12">
          <div className="text-5xl mb-3">🔍</div>
          <p className="text-gray-500 text-sm">等待信号中...</p>
          <p className="text-gray-600 text-xs mt-2">系统正在监控所有比赛</p>
        </div>
      </div>
    );
  }

  const isBuy = signal.type === 'STRONG_BUY' || signal.type === 'BUY';
  const isSell = signal.type === 'SELL' || signal.type === 'STRONG_SELL';
  const isStrong = signal.type === 'STRONG_BUY' || signal.type === 'STRONG_SELL';

  const bgClass = isBuy ? 'bg-green-500/10' : isSell ? 'bg-red-500/10' : 'bg-gray-500/10';
  const borderClass = isBuy ? 'border-green-500/30' : isSell ? 'border-red-500/30' : 'border-gray-500/30';
  const textClass = isBuy ? 'text-green-500' : isSell ? 'text-red-500' : 'text-gray-500';

  return (
    <div className={`bg-surface rounded-2xl p-6 border ${borderClass} ${bgClass} relative overflow-hidden ${isStrong ? 'shadow-[0_0_30px_-10px_rgba(34,197,94,0.3)]' : ''}`}>
      {/* Header */}
      <div className="flex justify-between items-start mb-6 relative z-10">
        <div className={`flex items-center gap-2 ${textClass} font-bold text-sm tracking-wide`}>
          <Zap className={`w-4 h-4 ${isStrong ? 'fill-current animate-pulse' : ''}`} />
          策略信号
        </div>
        {isStrong && (
          <div className="px-2 py-0.5 rounded-full bg-yellow-500/20 border border-yellow-500/30">
            <span className="text-[10px] font-bold text-yellow-500 tracking-wider">高置信度</span>
          </div>
        )}
      </div>

      {/* Main Signal */}
      <div className="mb-6 relative z-10">
        <h2 className={`text-4xl font-bold ${textClass} mb-2 tracking-tight`}>
          {isBuy ? '买入' : isSell ? '卖出' : '观望'} {signal.team}
        </h2>
        <p className="text-gray-400 text-base font-medium">{signal.reason}</p>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-black/20 rounded-lg p-3">
          <div className="text-xs text-gray-500 font-bold mb-1">当前价格</div>
          <div className={`text-2xl font-bold ${textClass}`}>
            {(signal.price * 100).toFixed(1)}¢
          </div>
        </div>
        <div className="bg-black/20 rounded-lg p-3">
          <div className="text-xs text-gray-500 font-bold mb-1">分差</div>
          <div className="text-2xl font-bold text-white">
            {signal.scoreDiff > 0 ? '+' : ''}{signal.scoreDiff}
          </div>
        </div>
      </div>

      {/* Divider */}
      <div className="h-px w-full bg-white/10 mb-4" />

      {/* Trading Plan */}
      {isBuy && signal.targetPrice && (
        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-gray-400">
              <Target className="w-3.5 h-3.5" />
              <span>目标价位</span>
            </div>
            <span className="text-green-400 font-mono font-bold">
              {(signal.targetPrice * 100).toFixed(0)}¢
            </span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-gray-400">
              <Shield className="w-3.5 h-3.5" />
              <span>止损线</span>
            </div>
            <span className="text-red-400 font-mono font-bold">
              {signal.stopLoss ? (signal.stopLoss * 100).toFixed(0) : '15'}¢
            </span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-gray-400">
              <span>置信度</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-16 h-2 bg-white/10 rounded-full overflow-hidden">
                <div 
                  className={`h-full ${isBuy ? 'bg-green-500' : 'bg-red-500'}`}
                  style={{ width: `${signal.confidence}%` }}
                />
              </div>
              <span className="text-white font-mono font-bold text-xs">
                {signal.confidence}%
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Status Info */}
      <div className="mt-4 pt-4 border-t border-white/5">
        <div className="text-xs text-gray-500">
          {signal.timeRemaining && (signal.timeRemaining === '00:00' || signal.timeRemaining === '0:00') 
            ? `${signal.quarter}结束` 
            : `${signal.quarter} • ${signal.timeRemaining || '进行中'}`}
        </div>
      </div>
    </div>
  );
}
