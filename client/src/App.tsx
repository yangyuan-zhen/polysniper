import { useState, useEffect, useMemo } from 'react';
import { Header } from './components/Header';
import { MatchCard } from './components/MatchCard';
import { StrategySignalCard } from './components/StrategySignalCard';
import { SignalLog } from './components/SignalLog';
import { ColorGuide } from './components/ColorGuide';
import { websocketService } from './services/websocket';
import { fetchMatches } from './services/api';
import type { UnifiedMatch } from './types/backend';
import { useSignals } from './contexts/SignalContext';
import { Filter } from 'lucide-react';

type FilterType = 'all' | 'signals' | 'live';

function App() {
  const [matches, setMatches] = useState<UnifiedMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [filter, setFilter] = useState<FilterType>('all');
  const [isGuideExpanded, setIsGuideExpanded] = useState(true);
  const { allSignals, topSignal } = useSignals();

  // 筛选（不排序，保持原始顺序）
  const filteredAndSortedMatches = useMemo(() => {
    let filtered = [...matches];

    // 应用筛选
    if (filter === 'signals') {
      filtered = filtered.filter(m => m.signals.length > 0);
    } else if (filter === 'live') {
      filtered = filtered.filter(m => m.status === 'LIVE');
    }

    // 保持原始顺序（按比赛开始时间）
    return filtered;
  }, [matches, allSignals, filter]);

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

    // 连接 WebSocket
    websocketService.connect('http://localhost:3000');

    // 监听连接状态
    websocketService.onConnectionStatus((data) => {
      console.log('[App] 连接状态:', data.connected ? '已连接' : '已断开', '-', data.message);
      setConnected(data.connected);
    });

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

    // 订阅所有比赛
    setTimeout(() => {
      if (websocketService.isConnected()) {
        websocketService.subscribe();
      }
    }, 1000);

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
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-8xl mx-auto space-y-8">
        <Header />
        
        {/* Stats & Filter Bar */}
        <div className="bg-surface rounded-2xl p-4 border border-white/5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            {/* Stats */}
            <div className="flex items-center gap-6 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-gray-500">监控中:</span>
                <span className="text-white font-bold">{stats.total} 场</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-gray-500">进行中:</span>
                <span className="text-green-400 font-bold">{stats.live} 场</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-gray-500">买入机会:</span>
                <span className="text-green-400 font-bold">{stats.buySignals}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-gray-500">卖出机会:</span>
                <span className="text-red-400 font-bold">{stats.sellSignals}</span>
              </div>
            </div>

            {/* Filters & Actions */}
            <div className="flex items-center gap-3">
              <Filter className="w-4 h-4 text-gray-500" />
              <button
                onClick={() => setFilter('all')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  filter === 'all' 
                    ? 'bg-purple-600 text-white' 
                    : 'bg-white/5 text-gray-400 hover:bg-white/10'
                }`}
              >
                全部 ({matches.length})
              </button>
              <button
                onClick={() => setFilter('signals')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  filter === 'signals' 
                    ? 'bg-purple-600 text-white' 
                    : 'bg-white/5 text-gray-400 hover:bg-white/10'
                }`}
              >
                有信号 ({stats.withSignals})
              </button>
              <button
                onClick={() => setFilter('live')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  filter === 'live' 
                    ? 'bg-purple-600 text-white' 
                    : 'bg-white/5 text-gray-400 hover:bg-white/10'
                }`}
              >
                进行中 ({stats.live})
              </button>
              
              <div className="w-px h-6 bg-white/10" />
              
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-400' : 'bg-red-400'}`} />
                <span className="text-xs text-gray-500">
                  {connected ? 'WebSocket 已连接' : 'WebSocket 未连接'}
                </span>
              </div>
              
              <button
                onClick={handleRefresh}
                disabled={loading}
                className="px-4 py-1.5 bg-white/5 hover:bg-white/10 text-white rounded-lg text-sm font-medium transition-all disabled:opacity-50"
              >
                {loading ? '刷新中...' : '🔄 刷新'}
              </button>
            </div>
          </div>
        </div>
        
        {/* Main Content - Color Guide + Matches Grid */}
        <div className="flex gap-6">
          {/* Color Guide - Left Side */}
          <div className={`transition-all duration-300 flex-shrink-0 ${isGuideExpanded ? 'w-80' : 'w-16'}`}>
            <div className="sticky top-8">
              <ColorGuide isExpanded={isGuideExpanded} onToggle={() => setIsGuideExpanded(!isGuideExpanded)} />
            </div>
          </div>

          {/* Matches Grid - Right Side */}
          <div className="flex-1 transition-all duration-300">
            <div className={`grid gap-4 ${
              isGuideExpanded 
                ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3' 
                : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
            }`}>
              {loading ? (
                <div className="col-span-full text-center text-gray-500 py-12">加载比赛数据中...</div>
              ) : filteredAndSortedMatches.length > 0 ? (
                filteredAndSortedMatches.map((match) => (
                  <MatchCard key={match.id} match={match} />
                ))
              ) : (
                <div className="col-span-full text-center text-gray-500 py-12">
                  {filter !== 'all' ? '没有符合筛选条件的比赛' : '今日暂无比赛'}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Strategy Signal & Log Section (Below) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            <StrategySignalCard signal={topSignal} />
          </div>
          
          <div className="lg:col-span-2">
             <SignalLog />
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
