import { Activity, ChevronDown } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { useSignals } from '../contexts/SignalContext';
import { useMatch } from '../contexts/MatchContext';
import { useState, useEffect, useRef } from 'react';

interface PricePoint {
  time: string;
  price: number;
  timestamp: number;
}

export function PriceTrendChart() {
  const { allSignals } = useSignals();
  const { selectedMatch } = useMatch();
  const [priceHistoryMap, setPriceHistoryMap] = useState<Map<string, PricePoint[]>>(new Map());
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const lastPricesRef = useRef<Map<string, number>>(new Map());
  const dropdownRef = useRef<HTMLDivElement>(null);

  // 从选中比赛或所有信号中提取球队列表
  const availableTeams = selectedMatch 
    ? [selectedMatch.homeTeam, selectedMatch.awayTeam]
    : Array.from(new Set(allSignals.map(s => s.team))).sort();

  // 点击外部关闭下拉菜单
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };

    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showDropdown]);

  // 定时记录每个球队的价格（每2分钟一次）+ 价格剧烈变化时立即记录
  useEffect(() => {
    if (allSignals.length === 0) return;

    const recordPrices = (force = false) => {
      const now = new Date();
      const updates = new Map<string, PricePoint>();

      // 记录所有当前有信号的球队价格
      allSignals.forEach(signal => {
        const lastPrice = lastPricesRef.current.get(signal.team);
        const currentPrice = signal.price;
        
        // 如果是强制记录，或者价格变化超过5%，则记录
        const shouldRecord = force || !lastPrice || Math.abs(currentPrice - lastPrice) / lastPrice > 0.05;
        
        if (shouldRecord) {
          updates.set(signal.team, {
            time: now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
            price: currentPrice * 100,
            timestamp: now.getTime(),
          });
          lastPricesRef.current.set(signal.team, currentPrice);
        }
      });

      // 批量更新价格历史
      if (updates.size > 0) {
        setPriceHistoryMap(prev => {
          const next = new Map(prev);
          updates.forEach((point, team) => {
            const history = next.get(team) || [];
            const updated = [...history, point];
            // 保留最近 60 个数据点（2小时数据）
            next.set(team, updated.length > 60 ? updated.slice(-60) : updated);
          });
          return next;
        });
      }
    };

    // 立即记录一次
    recordPrices(true);

    // 每2分钟强制记录一次
    const interval = setInterval(() => recordPrices(true), 2 * 60 * 1000);

    // 监听价格变化（每30秒检查一次）
    const checkInterval = setInterval(() => recordPrices(false), 30 * 1000);

    return () => {
      clearInterval(interval);
      clearInterval(checkInterval);
    };
  }, [allSignals]);

  // 当选中比赛时，自动选择主队
  useEffect(() => {
    if (selectedMatch) {
      setSelectedTeam(selectedMatch.homeTeam);
    } else if (!selectedTeam && availableTeams.length > 0) {
      setSelectedTeam(availableTeams[0]);
    }
  }, [selectedMatch, availableTeams, selectedTeam]);

  const currentHistory = selectedTeam ? priceHistoryMap.get(selectedTeam) || [] : [];
  const currentSignal = selectedTeam ? allSignals.find(s => s.team === selectedTeam) : null;

  if (availableTeams.length === 0 || !selectedTeam) {
    return (
      <div className="bg-surface rounded-2xl p-6 border border-white/5 h-full flex flex-col">
        <div className="flex items-center gap-2 text-gray-400 font-semibold text-sm tracking-wide mb-6">
          <Activity className="w-4 h-4" />
          价格趋势
        </div>
        <div className="flex-1 w-full min-h-[200px] flex items-center justify-center">
          <div className="text-center">
            <div className="text-5xl mb-3">📊</div>
            <p className="text-gray-500 text-sm">点击比赛卡片查看价格趋势</p>
            <p className="text-gray-600 text-xs mt-2">选择一场比赛后即可切换查看主客队价格</p>
          </div>
        </div>
      </div>
    );
  }

  const isBuy = currentSignal && (currentSignal.type === 'STRONG_BUY' || currentSignal.type === 'BUY');
  const currentPrice = currentSignal ? currentSignal.price * 100 : 0;
  const targetPrice = currentSignal?.targetPrice ? currentSignal.targetPrice * 100 : 75;

  return (
    <div className="bg-surface rounded-2xl p-6 border border-white/5 h-full flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2 text-purple-400 font-semibold text-sm tracking-wide">
            <Activity className="w-4 h-4" />
            价格趋势
          </div>
          {selectedMatch && (
            <div className="text-xs text-gray-500">
              {selectedMatch.homeTeam} vs {selectedMatch.awayTeam}
            </div>
          )}
        </div>
        
        {/* Team Selector */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowDropdown(!showDropdown);
            }}
            className="flex items-center gap-2 px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-colors"
          >
            <span className="text-sm font-medium text-white">{selectedTeam}</span>
            <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${showDropdown ? 'rotate-180' : ''}`} />
          </button>
          
          {showDropdown && (
            <div className="absolute right-0 mt-2 w-48 bg-[#1a1d2d] border border-white/10 rounded-lg shadow-xl z-50 max-h-60 overflow-y-auto">
              {availableTeams.map(team => (
                <button
                  key={team}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedTeam(team);
                    setShowDropdown(false);
                  }}
                  className={`w-full px-4 py-2 text-left text-sm hover:bg-white/10 transition-colors first:rounded-t-lg last:rounded-b-lg ${
                    team === selectedTeam ? 'bg-white/5 text-white font-medium' : 'text-gray-400'
                  }`}
                >
                  {team}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Price Stats */}
      <div className="flex items-center gap-4 mb-4">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-blue-500" />
          <span className="text-xs text-gray-400">当前: {currentPrice.toFixed(1)}¢</span>
        </div>
        {isBuy && currentSignal?.targetPrice && (
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            <span className="text-xs text-gray-400">目标: {targetPrice.toFixed(0)}¢</span>
          </div>
        )}
        <div className="ml-auto text-xs text-gray-500">
          {currentHistory.length} 个数据点 • 最长2小时
        </div>
      </div>

      <div className="flex-1 w-full min-h-[200px]">
        {currentHistory.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-gray-500 text-sm">等待价格数据...</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={currentHistory}>
            <defs>
              <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.2} />
            <XAxis 
              dataKey="time" 
              axisLine={false} 
              tickLine={false} 
              tick={{ fill: '#6b7280', fontSize: 10 }}
              interval="preserveStartEnd"
            />
            <YAxis 
              domain={[0, 100]} 
              axisLine={false} 
              tickLine={false} 
              tick={{ fill: '#6b7280', fontSize: 10 }}
              tickFormatter={(value) => `${value}¢`}
            />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: '#1a1d2d', 
                borderColor: '#374151',
                borderRadius: '8px',
                fontSize: '12px'
              }}
              labelStyle={{ color: '#9ca3af' }}
              itemStyle={{ color: '#3b82f6' }}
              formatter={(value: number) => [`${value.toFixed(1)}¢`, '价格']}
            />
            <Area 
              type="monotone" 
              dataKey="price" 
              stroke="#3b82f6" 
              strokeWidth={2}
              fillOpacity={1} 
              fill="url(#colorPrice)" 
              animationDuration={300}
            />
          </AreaChart>
        </ResponsiveContainer>
        )}
      </div>

      {/* Target Price Line Indicator */}
      {isBuy && currentSignal?.targetPrice && currentHistory.length > 0 && (
        <div className="mt-4 pt-4 border-t border-white/5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-500">
              距离目标: <span className={currentPrice < targetPrice ? 'text-green-400' : 'text-gray-400'}>
                {(targetPrice - currentPrice).toFixed(1)}¢
              </span>
            </span>
            <span className="text-gray-500">
              潜在收益: <span className="text-green-400">
                {currentPrice > 0 ? ((targetPrice - currentPrice) / currentPrice * 100).toFixed(1) : '0.0'}%
              </span>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
