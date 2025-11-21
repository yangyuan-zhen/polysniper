import { useState, useEffect, useMemo } from 'react';
import { Header } from './components/Header';
import { MatchCard } from './components/MatchCard';
import { StrategySignalCard } from './components/StrategySignalCard';
import { SignalLog } from './components/SignalLog';
import { ColorGuide } from './components/ColorGuide';
import { fetchDailyMatches } from './services/api';
import type { Match } from './services/api';
import { useSignals } from './contexts/SignalContext';
import { Filter } from 'lucide-react';

type FilterType = 'all' | 'signals' | 'live';

function App() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>('all');
  const { allSignals, topSignal } = useSignals();

  // 筛选（不排序，保持原始顺序）
  const filteredAndSortedMatches = useMemo(() => {
    let filtered = [...matches];

    // 应用筛选
    if (filter === 'signals') {
      const matchIdsWithSignals = new Set(allSignals.map(s => s.matchId));
      filtered = filtered.filter(m => matchIdsWithSignals.has(m.matchId));
    } else if (filter === 'live') {
      filtered = filtered.filter(m => m.matchStatus === 'INPROGRESS');
    }

    // 保持原始顺序（按比赛开始时间）
    return filtered;
  }, [matches, allSignals, filter]);

  // 统计数据
  const stats = useMemo(() => {
    const liveCount = matches.filter(m => m.matchStatus === 'INPROGRESS').length;
    const signalMatchIds = new Set(allSignals.map(s => s.matchId));
    const buySignals = allSignals.filter(s => s.type === 'STRONG_BUY' || s.type === 'BUY').length;
    const sellSignals = allSignals.filter(s => s.type === 'STRONG_SELL' || s.type === 'SELL').length;
    
    return {
      total: matches.length,
      live: liveCount,
      withSignals: signalMatchIds.size,
      buySignals,
      sellSignals,
    };
  }, [matches, allSignals]);

  useEffect(() => {
    const loadMatches = async () => {
      try {
        const data = await fetchDailyMatches();
        setMatches(data);
      } catch (error) {
        console.error('Failed to load matches', error);
      } finally {
        setLoading(false);
      }
    };

    // 初始加载
    loadMatches();

    // 每 10 秒自动刷新比赛数据（更快的比分更新）
    const interval = setInterval(() => {
      loadMatches();
    }, 10000); // 10 seconds

    return () => clearInterval(interval);
  }, []);

  const handleRefresh = async () => {
    setLoading(true);
    try {
      const data = await fetchDailyMatches();
      setMatches(data);
    } catch (error) {
      console.error('Failed to refresh matches', error);
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
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Color Guide - Left Side */}
          <div className="lg:col-span-4">
            <div className="sticky top-8">
              <ColorGuide />
            </div>
          </div>

          {/* Matches Grid - Right Side */}
          <div className="lg:col-span-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {loading ? (
                <div className="col-span-full text-center text-gray-500 py-12">加载比赛数据中...</div>
              ) : filteredAndSortedMatches.length > 0 ? (
                filteredAndSortedMatches.map((match) => (
                  <MatchCard key={match.matchId} match={match} />
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
