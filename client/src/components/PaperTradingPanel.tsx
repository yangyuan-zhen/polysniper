import { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, Wallet, Activity } from 'lucide-react';

interface PaperTradingData {
  balance: number;
  equity: number;
  totalPnl: number;
  totalPnlPercent: number;
  totalTrades: number;
  winRate: number;
  positions: any[];
  openOrders: any[];
}

interface PaperTradingPanelProps {
  onClick?: () => void;
}

export function PaperTradingPanel({ onClick }: PaperTradingPanelProps) {
  const [data, setData] = useState<PaperTradingData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch('/api/papertrading');
        const result = await response.json();
        if (result.success) {
          setData(result.data);
        }
      } catch (error) {
        console.error('Failed to fetch paper trading data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    // 每30秒更新一次
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-gray-400 text-sm">
        <Wallet className="w-4 h-4 animate-pulse" />
        <span>加载中...</span>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  const isProfitable = data.totalPnl >= 0;

  return (
    <div 
      className="flex items-center gap-4 cursor-pointer hover:opacity-80 transition-opacity"
      onClick={onClick}
    >
      {/* 账户余额 */}
      <div className="flex items-center gap-2 bg-white/5 rounded-lg px-3 py-2 border border-white/10">
        <Wallet className="w-4 h-4 text-purple-400" />
        <div className="flex flex-col">
          <span className="text-xs text-gray-400">余额</span>
          <span className="text-sm font-bold text-white">
            ${data.balance.toFixed(2)}
          </span>
        </div>
      </div>

      {/* 总盈亏 */}
      <div className={`flex items-center gap-2 rounded-lg px-3 py-2 border ${
        isProfitable 
          ? 'bg-green-500/10 border-green-500/30' 
          : 'bg-red-500/10 border-red-500/30'
      }`}>
        {isProfitable ? (
          <TrendingUp className="w-4 h-4 text-green-400" />
        ) : (
          <TrendingDown className="w-4 h-4 text-red-400" />
        )}
        <div className="flex flex-col">
          <span className="text-xs text-gray-400">总盈亏</span>
          <span className={`text-sm font-bold ${
            isProfitable ? 'text-green-400' : 'text-red-400'
          }`}>
            {isProfitable ? '+' : ''}${data.totalPnl.toFixed(2)}
            <span className="text-xs ml-1">
              ({data.totalPnlPercent.toFixed(2)}%)
            </span>
          </span>
        </div>
      </div>

      {/* 交易统计 */}
      <div className="flex items-center gap-2 bg-white/5 rounded-lg px-3 py-2 border border-white/10">
        <Activity className="w-4 h-4 text-blue-400" />
        <div className="flex flex-col">
          <span className="text-xs text-gray-400">交易</span>
          <span className="text-sm font-bold text-white">
            {data.totalTrades} 笔
            {data.totalTrades > 0 && (
              <span className="text-xs ml-1 text-gray-400">
                ({(data.winRate * 100).toFixed(0)}% 胜率)
              </span>
            )}
          </span>
        </div>
      </div>

      {/* 持仓数量 */}
      {data.positions.length > 0 && (
        <div className="flex items-center gap-1 bg-yellow-500/10 rounded-lg px-2 py-1 border border-yellow-500/30">
          <span className="text-xs text-yellow-400 font-medium">
            {data.positions.length} 个持仓
          </span>
        </div>
      )}
    </div>
  );
}
