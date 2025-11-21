import { ScrollText, TrendingUp, TrendingDown } from 'lucide-react';
import { useSignals } from '../contexts/SignalContext';
import { formatSignal } from '../services/strategy';

export function SignalLog() {
  const { allSignals } = useSignals();

  // 按时间倒序排列
  const sortedSignals = [...allSignals].sort((a, b) => b.timestamp - a.timestamp);

  return (
    <div className="bg-surface rounded-2xl p-6 border border-white/5 h-full flex flex-col max-h-[400px]">
      <div className="flex items-center gap-2 text-gray-400 font-semibold text-sm tracking-wide mb-6">
        <ScrollText className="w-4 h-4" />
        交易信号日志
        {allSignals.length > 0 && (
          <span className="ml-auto text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full">
            {allSignals.length} 个信号
          </span>
        )}
      </div>

      {sortedSignals.length === 0 ? (
        <div className="flex-1 flex items-center justify-center py-12">
          <div className="text-center">
            <div className="text-5xl mb-3">🔍</div>
            <p className="text-gray-500 text-sm">暂无交易信号</p>
            <p className="text-gray-600 text-xs mt-2">等待市场出现套利机会...</p>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto space-y-3 pr-2">
          {sortedSignals.map((signal, i) => {
            const isBuy = signal.type === 'STRONG_BUY' || signal.type === 'BUY';
            const isSell = signal.type === 'SELL' || signal.type === 'STRONG_SELL';
            const isStrong = signal.type === 'STRONG_BUY' || signal.type === 'STRONG_SELL';

            const bgClass = isBuy 
              ? 'bg-green-500/10 border-green-500/20' 
              : isSell 
                ? 'bg-red-500/10 border-red-500/20' 
                : 'bg-gray-500/10 border-gray-500/20';
            
            const textClass = isBuy 
              ? 'text-green-400' 
              : isSell 
                ? 'text-red-400' 
                : 'text-gray-400';

            return (
              <div 
                key={`${signal.matchId}-${signal.team}-${i}`}
                className={`p-4 rounded-xl border ${bgClass} hover:border-opacity-50 transition-all group`}
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-2">
                    {isBuy ? (
                      <TrendingUp className={`w-4 h-4 ${textClass}`} />
                    ) : isSell ? (
                      <TrendingDown className={`w-4 h-4 ${textClass}`} />
                    ) : (
                      <div className={`w-2 h-2 rounded-full ${isBuy ? 'bg-green-500' : 'bg-red-500'}`} />
                    )}
                    <div className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${bgClass} ${textClass}`}>
                      {signal.type.replace('_', ' ')}
                      {isStrong && ' 🔥'}
                    </div>
                  </div>
                  <div className="text-[10px] text-gray-600 font-mono">
                    {signal.timeRemaining && (signal.timeRemaining === '00:00' || signal.timeRemaining === '0:00')
                      ? `${signal.quarter}结束 • ${new Date(signal.timestamp).toLocaleTimeString('zh-CN', { hour12: false })}`
                      : `${signal.quarter} • ${new Date(signal.timestamp).toLocaleTimeString('zh-CN', { hour12: false })}`}
                  </div>
                </div>
                <div className="text-sm text-gray-300 font-medium group-hover:text-white transition-colors mb-2">
                  {formatSignal(signal)}
                </div>
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-4 text-gray-500">
                    <span>价格: <span className={textClass}>{(signal.price * 100).toFixed(1)}¢</span></span>
                    <span>分差: <span className="text-white">{signal.scoreDiff > 0 ? '+' : ''}{signal.scoreDiff}</span></span>
                  </div>
                  {signal.targetPrice && (
                    <div className="text-gray-500">
                      目标: <span className="text-green-400">{(signal.targetPrice * 100).toFixed(0)}¢</span>
                    </div>
                  )}
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden">
                    <div 
                      className={`h-full ${isBuy ? 'bg-green-500' : 'bg-red-500'}`}
                      style={{ width: `${signal.confidence}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-gray-500 font-mono">
                    {signal.confidence}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
