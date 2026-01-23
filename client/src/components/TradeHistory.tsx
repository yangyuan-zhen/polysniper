import { useState, useEffect, useMemo } from 'react';
import { ArrowLeft, TrendingUp, DollarSign, Activity } from 'lucide-react';
import { format } from 'date-fns';
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';

interface Order {
  id: string;
  matchId: string;
  type: string;
  status: string;
  team: string;
  quantity: number;
  entryPrice: number;
  exitPrice?: number;
  pnl: number;
  pnlPercent: number;
  reason: string;
  timestamp: number;
  closeTimestamp?: number;
}

interface TradeHistoryProps {
  onClose: () => void;
}

export function TradeHistory({ onClose }: TradeHistoryProps) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [initialBalance, setInitialBalance] = useState(1000);
  const [loading, setLoading] = useState(true);

  // 计算盈亏曲线数据
  const pnlData = useMemo(() => {
    if (orders.length === 0) return [];

    // 按时间排序（旧 -> 新）
    const sortedOrders = [...orders]
      .filter(o => o.status === 'CLOSED' && o.closeTimestamp)
      .sort((a, b) => (a.closeTimestamp || 0) - (b.closeTimestamp || 0));

    let currentBalance = initialBalance;
    const data = [{
      time: sortedOrders.length > 0 ? (sortedOrders[0].closeTimestamp || 0) - 3600000 : Date.now(), // 起点
      equity: initialBalance,
      date: 'Start'
    }];

    sortedOrders.forEach(order => {
      if (order.pnl) {
        currentBalance += order.pnl;
        data.push({
          time: order.closeTimestamp || 0,
          equity: currentBalance,
          date: format(order.closeTimestamp || 0, 'MM-dd HH:mm')
        });
      }
    });

    // 如果没有平仓订单，至少显示当前余额
    if (data.length === 1) {
      data.push({
        time: Date.now(),
        equity: currentBalance,
        date: 'Now'
      });
    }

    return data;
  }, [orders, initialBalance]);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const response = await fetch('/api/papertrading');
        const result = await response.json();
        if (result.success) {
          // 设置初始余额 (如果有 initialBalance 则使用，否则通过 equity - totalPnl 计算)
          if (result.data.initialBalance) {
            setInitialBalance(result.data.initialBalance);
          } else if (result.data.equity !== undefined && result.data.totalPnl !== undefined) {
            setInitialBalance(result.data.equity - result.data.totalPnl);
          }
          
          // 合并开仓和平仓订单，按时间倒序排列
          const allOrders = [
            ...result.data.openOrders,
            ...result.data.closedOrders
          ].sort((a, b) => b.timestamp - a.timestamp);
          setOrders(allOrders);
        }
      } catch (error) {
        console.error('Failed to fetch trade history:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, []);

  return (
    <div className="fixed inset-0 bg-background z-50 overflow-y-auto">
      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button 
            onClick={onClose}
            className="p-2 hover:bg-white/5 rounded-full transition-colors"
          >
            <ArrowLeft className="w-6 h-6 text-gray-400" />
          </button>
          <h1 className="text-2xl font-bold text-white">交易历史</h1>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-surface border border-white/5 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-2">
              <Activity className="w-5 h-5 text-blue-400" />
              <span className="text-gray-400">总交易数</span>
            </div>
            <div className="text-3xl font-bold text-white">{orders.length}</div>
          </div>
          
          <div className="bg-surface border border-white/5 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-2">
              <TrendingUp className="w-5 h-5 text-green-400" />
              <span className="text-gray-400">盈利交易</span>
            </div>
            <div className="text-3xl font-bold text-green-400">
              {orders.filter(o => o.pnl > 0).length}
            </div>
          </div>

          <div className="bg-surface border border-white/5 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-2">
              <DollarSign className="w-5 h-5 text-purple-400" />
              <span className="text-gray-400">总盈亏</span>
            </div>
            <div className={`text-3xl font-bold ${
              orders.reduce((sum, o) => sum + o.pnl, 0) >= 0 ? 'text-green-400' : 'text-red-400'
            }`}>
              ${orders.reduce((sum, o) => sum + o.pnl, 0).toFixed(2)}
            </div>
          </div>
        </div>

        {/* PnL Chart */}
        <div className="bg-surface border border-white/5 rounded-xl p-6 mb-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold text-white">盈亏曲线</h2>
            <div className={`text-sm font-medium ${
              pnlData.length > 0 && pnlData[pnlData.length - 1].equity >= initialBalance 
                ? 'text-green-400' 
                : 'text-red-400'
            }`}>
              当前权益: ${pnlData.length > 0 ? pnlData[pnlData.length - 1].equity.toFixed(2) : initialBalance.toFixed(2)}
            </div>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={pnlData}>
                <defs>
                  <linearGradient id="colorEquity" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                <XAxis 
                  dataKey="date" 
                  stroke="#6b7280" 
                  tick={{ fill: '#6b7280', fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                  minTickGap={30}
                />
                <YAxis 
                  stroke="#6b7280" 
                  tick={{ fill: '#6b7280', fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                  domain={['auto', 'auto']}
                  tickFormatter={(value) => `$${value}`}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#1f2937', 
                    borderColor: '#374151',
                    borderRadius: '0.5rem',
                    color: '#fff'
                  }}
                  itemStyle={{ color: '#fff' }}
                  formatter={(value: number | undefined) => [value ? `$${value.toFixed(2)}` : '$0.00', '权益']}
                />
                <Area 
                  type="monotone" 
                  dataKey="equity" 
                  stroke="#8b5cf6" 
                  strokeWidth={2}
                  fillOpacity={1} 
                  fill="url(#colorEquity)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Orders List */}
        <div className="bg-surface border border-white/5 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-white/5 bg-white/5">
                  <th className="px-6 py-4 text-sm font-medium text-gray-400">时间</th>
                  <th className="px-6 py-4 text-sm font-medium text-gray-400">球队</th>
                  <th className="px-6 py-4 text-sm font-medium text-gray-400">类型</th>
                  <th className="px-6 py-4 text-sm font-medium text-gray-400">价格</th>
                  <th className="px-6 py-4 text-sm font-medium text-gray-400">数量</th>
                  <th className="px-6 py-4 text-sm font-medium text-gray-400">盈亏</th>
                  <th className="px-6 py-4 text-sm font-medium text-gray-400">状态</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-gray-400">
                      加载中...
                    </td>
                  </tr>
                ) : orders.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-gray-400">
                      暂无交易记录
                    </td>
                  </tr>
                ) : (
                  orders.map((order) => (
                    <tr key={order.id} className="hover:bg-white/5 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-white text-sm">
                            {format(order.timestamp, 'MM-dd HH:mm')}
                          </span>
                          {order.closeTimestamp && (
                            <span className="text-xs text-gray-500">
                              平仓: {format(order.closeTimestamp, 'HH:mm')}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-white font-medium">{order.team}</span>
                        <div className="text-xs text-gray-500 truncate max-w-[200px]">
                          {order.reason}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          order.type === 'BUY' 
                            ? 'bg-green-500/10 text-green-400' 
                            : 'bg-red-500/10 text-red-400'
                        }`}>
                          {order.type === 'BUY' ? '买入' : '卖出'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-white">${order.entryPrice.toFixed(3)}</span>
                          {order.exitPrice && (
                            <span className="text-xs text-gray-500">
                              → ${order.exitPrice.toFixed(3)}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-gray-300">
                        {order.quantity.toFixed(2)}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`font-medium ${
                          order.pnl >= 0 ? 'text-green-400' : 'text-red-400'
                        }`}>
                          {order.pnl >= 0 ? '+' : ''}${order.pnl.toFixed(2)}
                        </span>
                        <div className={`text-xs ${
                          order.pnlPercent >= 0 ? 'text-green-500/70' : 'text-red-500/70'
                        }`}>
                          {order.pnlPercent.toFixed(2)}%
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          order.status === 'FILLED' 
                            ? 'bg-blue-500/10 text-blue-400' 
                            : 'bg-gray-500/10 text-gray-400'
                        }`}>
                          {order.status === 'FILLED' ? '持仓中' : '已平仓'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
