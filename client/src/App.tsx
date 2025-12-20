import { useState, useEffect, useMemo } from 'react';
import { Header } from './components/Header';
import { MatchCard } from './components/MatchCard';
import { MatchDetailModal } from './components/MatchDetailModal';
import { StrategySignalCard } from './components/StrategySignalCard';
import { SignalLog } from './components/SignalLog';
import { ColorGuide } from './components/ColorGuide';
import { websocketService } from './services/websocket';
import { fetchMatches } from './services/api';
import type { UnifiedMatch } from './types/backend';
import { useSignals } from './contexts/SignalContext';
import { Info, X } from 'lucide-react';

type FilterType = 'all' | 'signals' | 'live';

function App() {
  const [matches, setMatches] = useState<UnifiedMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [filter, setFilter] = useState<FilterType>('all');
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState<UnifiedMatch | null>(null);
  const { allSignals, topSignal } = useSignals();

  // 筛选和排序
  const filteredAndSortedMatches = useMemo(() => {
    let filtered = [...matches];

    // 应用筛选
    if (filter === 'signals') {
      filtered = filtered.filter(m => m.signals.length > 0);
    } else if (filter === 'live') {
      filtered = filtered.filter(m => m.status === 'LIVE');
    }

    // 按开始时间排序（从早到晚）
    return filtered.sort((a, b) => {
      const timeA = a.startTime ? new Date(a.startTime).getTime() : 0;
      const timeB = b.startTime ? new Date(b.startTime).getTime() : 0;
      return timeA - timeB;
    });
  }, [matches, allSignals, filter]);

  // 按日期分组(使用中国时区 UTC+8)
  const groupedMatches = useMemo(() => {
    const groups: { date: string; displayDate: string; matches: UnifiedMatch[] }[] = [];
    const dateMap = new Map<string, UnifiedMatch[]>();

    // 辅助函数:将时间戳转换为中国时区的日期字符串 (YYYY-MM-DD)
    const toChinaDateKey = (timestamp: string | number): string => {
      const date = new Date(timestamp);
      const formatter = new Intl.DateTimeFormat('zh-CN', {
        timeZone: 'Asia/Shanghai',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      });
      const parts = formatter.formatToParts(date);
      const year = parts.find(p => p.type === 'year')?.value || '';
      const month = parts.find(p => p.type === 'month')?.value || '';
      const day = parts.find(p => p.type === 'day')?.value || '';
      return `${year}-${month}-${day}`;
    };

    // 获取中国当前日期
    const getChinaToday = (): string => {
      return toChinaDateKey(Date.now());
    };

    filteredAndSortedMatches.forEach(match => {
      if (!match.startTime) return;
      
      // 使用中国时区进行分组
      const dateKey = toChinaDateKey(match.startTime);
      
      if (!dateMap.has(dateKey)) {
        dateMap.set(dateKey, []);
      }
      dateMap.get(dateKey)!.push(match);
    });

    // 转换为数组并排序
    const chinaToday = getChinaToday();
    const chinaTomorrow = (() => {
      const today = new Date(chinaToday);
      today.setDate(today.getDate() + 1);
      return today.toISOString().split('T')[0];
    })();

    dateMap.forEach((matches, dateKey) => {
      let displayDate = '';
      if (dateKey === chinaToday) {
        displayDate = '今天';
      } else if (dateKey === chinaTomorrow) {
        displayDate = '明天';
      } else {
        // 使用中国时区获取星期几
        const [year, month, day] = dateKey.split('-').map(Number);
        const date = new Date(year, month - 1, day);
        const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
        const weekday = weekdays[date.getDay()];
        displayDate = `${month}月${day}日 ${weekday}`;
      }
      
      groups.push({
        date: dateKey,
        displayDate: `${displayDate} (${dateKey})`,
        matches
      });
    });

    // 按日期排序
    return groups.sort((a, b) => a.date.localeCompare(b.date));
  }, [filteredAndSortedMatches]);

  // 统计数据
  const stats = useMemo(() => {
    const liveCount = matches.filter(m => m.status === 'LIVE').length;
    const withSignals = matches.filter(m => m.signals.length > 0).length;
    const allSignalsFlat = matches.flatMap(m => m.signals);
    const buySignals = allSignalsFlat.filter(s => s.type === 'BUY_HOME' || s.type === 'BUY_AWAY').length;
    const sellSignals = allSignalsFlat.filter(s => s.type === 'SELL_HOME' || s.type === 'SELL_AWAY').length;
    
    return {
      total: matches.length,
      live: liveCount,
      withSignals,
      buySignals,
      sellSignals,
    };
  }, [matches]);

  useEffect(() => {
    console.log('[App] 🚀 初始化 WebSocket 连接...');

    // 连接 WebSocket (使用 Vite 代理,不指定完整 URL)
    // 在开发环境下,Vite 会自动代理到 localhost:3000
    websocketService.connect();

    // 监听原生连接状态变化
    websocketService.onConnect(() => {
      console.log('[App] ✅ WebSocket 已连接');
      setConnected(true);
      // 连接成功后立即订阅
      websocketService.subscribe();
    });

    websocketService.onDisconnect(() => {
      console.log('[App] ❌ WebSocket 已断开');
      setConnected(false);
    });

    // 检查初始连接状态（防止监听器注册前已经连接）
    if (websocketService.isConnected()) {
      console.log('[App] 🔗 WebSocket 已经处于连接状态');
      setConnected(true);
      websocketService.subscribe();
    }

    // 监听比赛数据更新
    websocketService.onMatchesUpdate((data) => {
      console.log(`[App] 📊 收到比赛更新 (${data.type}):`, data.data.length, '场比赛');
      setMatches(data.data);
      setLoading(false);
    });

    // 监听套利信号告警
    websocketService.onSignalAlert((data) => {
      console.log(`[App] 🚨 套利信号告警 - ${data.matchId}:`, data.signals.length, '个信号');
      // 可以在这里添加通知逻辑
    });

    // 清理
    return () => {
      console.log('[App] 🔌 断开 WebSocket 连接');
      websocketService.disconnect();
    };
  }, []);

  const handleRefresh = async () => {
    setLoading(true);
    try {
      console.log('[App] 🔄 手动刷新比赛数据...');
      const data = await fetchMatches();
      setMatches(data);
    } catch (error) {
      console.error('[App] ❌ 刷新失败:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-white/5 bg-surface/50 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-[1920px] mx-auto px-6 py-4">
          <Header />
        </div>
      </div>

      {/* Stats & Filter Bar */}
      <div className="border-b border-white/5 bg-surface/30 backdrop-blur-sm sticky top-[72px] z-30">
        <div className="max-w-[1920px] mx-auto px-6 py-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            {/* Stats */}
            <div className="flex items-center gap-8">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-blue-400" />
                <span className="text-gray-400 text-sm">监控</span>
                <span className="text-white font-bold text-lg">{stats.total}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                <span className="text-gray-400 text-sm">进行中</span>
                <span className="text-green-400 font-bold text-lg">{stats.live}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-yellow-400" />
                <span className="text-gray-400 text-sm">有信号</span>
                <span className="text-yellow-400 font-bold text-lg">{stats.withSignals}</span>
              </div>
              <div className="h-6 w-px bg-white/10" />
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-gray-500">买入</span>
                  <span className="text-green-400 font-bold">{stats.buySignals}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-gray-500">卖出</span>
                  <span className="text-red-400 font-bold">{stats.sellSignals}</span>
                </div>
              </div>
            </div>

            {/* Filters & Actions */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 bg-white/5 rounded-lg p-1">
                <button
                  onClick={() => setFilter('all')}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                    filter === 'all' 
                      ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/20' 
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  全部 <span className="ml-1 opacity-60">{matches.length}</span>
                </button>
                <button
                  onClick={() => setFilter('signals')}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                    filter === 'signals' 
                      ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/20' 
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  有信号 <span className="ml-1 opacity-60">{stats.withSignals}</span>
                </button>
                <button
                  onClick={() => setFilter('live')}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                    filter === 'live' 
                      ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/20' 
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  进行中 <span className="ml-1 opacity-60">{stats.live}</span>
                </button>
              </div>
              
              <div className="h-8 w-px bg-white/10" />
              
              <button
                onClick={() => setIsGuideOpen(true)}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600/10 hover:bg-purple-600/20 text-purple-400 rounded-lg text-sm font-medium transition-all border border-purple-500/20"
              >
                <Info className="w-4 h-4" />
                <span>策略说明</span>
              </button>
              
              <div className="flex items-center gap-2 px-3 py-2 bg-white/5 rounded-lg">
                <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-400' : 'bg-red-400'}`} />
                <span className="text-xs text-gray-400">
                  {connected ? '已连接' : '未连接'}
                </span>
              </div>
              
              <button
                onClick={handleRefresh}
                disabled={loading}
                className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-lg text-sm font-medium transition-all disabled:opacity-50"
              >
                {loading ? '刷新中...' : '🔄'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-[1920px] mx-auto px-6 py-6">
        {/* Matches Grid - Grouped by Date */}
        <div className="mb-6 space-y-8">
          {loading ? (
            <div className="text-center text-gray-500 py-20">
              <div className="inline-block w-8 h-8 border-4 border-purple-500/20 border-t-purple-500 rounded-full animate-spin mb-4" />
              <div>加载比赛数据中...</div>
            </div>
          ) : groupedMatches.length > 0 ? (
            groupedMatches.map(group => (
              <div key={group.date} className="space-y-4">
                {/* Date Header */}
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-3 bg-gradient-to-r from-purple-600/20 to-blue-600/20 border border-purple-500/30 rounded-lg px-6 py-3">
                    <div className="text-2xl">📅</div>
                    <div>
                      <div className="text-lg font-bold text-white">{group.displayDate}</div>
                      <div className="text-xs text-gray-400">共 {group.matches.length} 场比赛</div>
                    </div>
                  </div>
                  <div className="flex-1 h-px bg-gradient-to-r from-purple-500/30 to-transparent" />
                </div>
                
                {/* Matches Grid */}
                <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                  {group.matches.map((match) => (
                    <MatchCard 
                      key={match.id} 
                      match={match} 
                      onClick={(match) => setSelectedMatch(match)}
                    />
                  ))}
                </div>
              </div>
            ))
          ) : (
            <div className="text-center text-gray-500 py-20">
              <div className="text-4xl mb-4">🏀</div>
              <div className="text-lg">
                {filter !== 'all' ? '没有符合筛选条件的比赛' : '今日暂无比赛'}
              </div>
            </div>
          )}
        </div>

        {/* Bottom Section - Strategy Signal & Log */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            <StrategySignalCard signal={topSignal} />
          </div>
          
          <div className="lg:col-span-2">
            <SignalLog />
          </div>
        </div>
      </div>

      {/* Right Drawer - Strategy Guide */}
      <div className={`fixed inset-y-0 right-0 w-[480px] bg-surface border-l border-white/10 transform transition-transform duration-300 z-50 overflow-y-auto ${
        isGuideOpen ? 'translate-x-0' : 'translate-x-full'
      }`}>
        <div className="sticky top-0 bg-surface/95 backdrop-blur-sm border-b border-white/10 p-6 flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <Info className="w-6 h-6 text-purple-400" />
            <h2 className="text-xl font-bold text-white">策略说明</h2>
          </div>
          <button
            onClick={() => setIsGuideOpen(false)}
            className="p-2 hover:bg-white/10 rounded-lg transition-all"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>
        <div className="p-6">
          <ColorGuide isExpanded={true} onToggle={() => {}} />
        </div>
      </div>

      {/* Overlay */}
      {isGuideOpen && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 transition-opacity"
          onClick={() => setIsGuideOpen(false)}
        />
      )}

      {/* Match Detail Modal */}
      <MatchDetailModal 
        match={selectedMatch}
        isOpen={selectedMatch !== null}
        onClose={() => setSelectedMatch(null)}
      />
    </div>
  );
}

export default App;
