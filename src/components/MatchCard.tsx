import { useEffect, useState, useMemo, useRef } from 'react';
import type { Match } from '../services/api';
import { searchPolymarketMatch, normalizeMarketData, getEnglishTeamName /* subscribeToMarketPrices 暂时禁用 */ } from '../services/polymarket';
import { analyzeMatch } from '../services/strategy';
import { useSignals } from '../contexts/SignalContext';
import { getTeamInjuries, getGameWinProbability, getESPNTeamName } from '../services/espn';
import type { TeamInjuries, WinProbability } from '../types';
import { TeamInfoModal } from './TeamInfoModal';
import type { PriceData } from '../services/strategy';

interface MatchCardProps {
  match: Match;
}

export function MatchCard({ match }: MatchCardProps) {
  const {
    homeTeamName,
    awayTeamName,
    homeScore,
    awayScore,
    matchStatus,
    currentQuarter,
    costTime,
    matchTime,
  } = match;

  const { updateSignals, allSignals } = useSignals();

  const [polyData, setPolyData] = useState<{ 
    homePrice: string; 
    awayPrice: string; 
    homeRawPrice: number;
    awayRawPrice: number;
    type: 'bullish' | 'bearish' | 'neutral'; 
    loaded: boolean;
    lastUpdate?: number;
  }>({
    homePrice: '-',
    awayPrice: '-',
    homeRawPrice: 0,
    awayRawPrice: 0,
    type: 'neutral',
    loaded: false,
    lastUpdate: undefined
  });

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastPricesRef = useRef<{ home: string; away: string } | null>(null);
  const [homeInjuries, setHomeInjuries] = useState<TeamInjuries | null>(null);
  const [awayInjuries, setAwayInjuries] = useState<TeamInjuries | null>(null);
  const [winProb, setWinProb] = useState<WinProbability | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // 从 localStorage 恢复赛前胜率缓存（持久化）
  const getCachedPregameProb = (): number | null => {
    try {
      const key = `pregame_${homeTeamName}_${awayTeamName}`;
      const cached = localStorage.getItem(key);
      return cached ? parseFloat(cached) : null;
    } catch {
      return null;
    }
  };
  
  const setCachedPregameProb = (value: number) => {
    try {
      const key = `pregame_${homeTeamName}_${awayTeamName}`;
      localStorage.setItem(key, value.toString());
      console.log(`💾 Saved pregame to localStorage: ${(value * 100).toFixed(1)}%`);
    } catch (error) {
      console.warn('Failed to save to localStorage:', error);
    }
  };
  
  const pregameWinProbRef = useRef<number | null>(getCachedPregameProb()); // 从缓存恢复
  
  // 初始化时输出缓存恢复日志
  useEffect(() => {
    if (pregameWinProbRef.current !== null) {
      console.log(`🔄 Restored pregame from localStorage: ${homeTeamName} vs ${awayTeamName} = ${(pregameWinProbRef.current * 100).toFixed(1)}%`);
    }
  }, []); // 只运行一次

  // Handle card click to open modal
  const handleCardClick = async () => {
    setIsModalOpen(true);
    
    // Fetch injuries if not already loaded
    if (!homeInjuries) {
      const injuries = await getTeamInjuries(homeTeamName);
      if (injuries) setHomeInjuries(injuries);
    }
    if (!awayInjuries) {
      const injuries = await getTeamInjuries(awayTeamName);
      if (injuries) setAwayInjuries(injuries);
    }
  };

  useEffect(() => {
    let mounted = true;

    const fetchPolyData = async (forceRefresh = false) => {
      // 已结束的比赛不再更新价格
      if (matchStatus === 'COMPLETED') {
        return;
      }

      const market = await searchPolymarketMatch(homeTeamName, awayTeamName, forceRefresh);
      
      if (!market) {
        console.warn(`⚠️ 无法获取价格: ${homeTeamName} vs ${awayTeamName}`);
        console.warn(`   可能原因:`);
        console.warn(`   1. Polymarket上没有这场比赛的市场`);
        console.warn(`   2. 队伍名称翻译不匹配 (中文: ${homeTeamName}, ${awayTeamName})`);
        console.warn(`   3. 只有盘口/大小分市场，没有胜负盘`);
        return;
      }
      
      if (mounted && market) {
        const homeEn = getEnglishTeamName(homeTeamName);
        const awayEn = getEnglishTeamName(awayTeamName);
        const { homePrice, awayPrice, homeRawPrice, awayRawPrice } = normalizeMarketData(market, homeEn, awayEn);
        
        // 检查价格是否变化（避免重复更新）
        const pricesChanged = !lastPricesRef.current || 
          lastPricesRef.current.home !== homeRawPrice.toString() || 
          lastPricesRef.current.away !== awayRawPrice.toString();
        
        if (!pricesChanged && polyData.loaded) {
          // 价格没变，跳过更新
          return;
        }
        
        // 更新价格缓存
        lastPricesRef.current = { home: homeRawPrice.toString(), away: awayRawPrice.toString() };
        
        let type: 'bullish' | 'bearish' | 'neutral' = 'neutral';
        if (homeRawPrice >= 0.60) type = 'bullish';
        else if (homeRawPrice <= 0.40) type = 'bearish';
        
        const now = Date.now();
        
        setPolyData({
          homePrice,
          awayPrice,
          homeRawPrice,
          awayRawPrice,
          type,
          loaded: true,
          lastUpdate: now
        });
        
        // 计算并上报交易信号（比赛结束时清除信号）
        if (matchStatus === 'COMPLETED') {
          updateSignals(match.matchId, []);
        } else {
          // 构建完整的PriceData，包含市场深度信息和赛前胜率
          const priceData: PriceData = {
            homePrice,
            awayPrice,
            homeRawPrice,
            awayRawPrice,
            espnHomeWinProb: winProb?.homeWinPercentage, // 实时胜率
            espnPregameHomeWinProb: winProb?.pregameHomeWinPercentage // 赛前胜率（用于判断强队）
          };
          
          const signals = analyzeMatch(match, priceData);
          updateSignals(match.matchId, signals);
        }
      }
    };

    // 获取ESPN胜率（进行中和未开始的比赛）
    const fetchWinProb = async () => {
      // 跳过已结束的比赛
      if (matchStatus === 'COMPLETED') {
        return;
      }
      
      const homeEn = getESPNTeamName(homeTeamName);
      const awayEn = getESPNTeamName(awayTeamName);
      console.log(`🔍 Fetching win prob for: ${homeEn} vs ${awayEn} (Status: ${matchStatus})`);
      const prob = await getGameWinProbability(homeEn, awayEn);
      
      if (mounted && prob) {
        console.log(`✅ Got win prob: Home ${(prob.homeWinPercentage * 100).toFixed(1)}%`);
        console.log(`   isPregame: ${prob.isPregame}, pregameHomeWinPercentage: ${prob.pregameHomeWinPercentage}`);
        
        // 缓存赛前胜率（只要ESPN返回了就更新缓存，并持久化到 localStorage）
        if (prob.pregameHomeWinPercentage !== undefined) {
          // 只在值发生变化时才更新
          if (pregameWinProbRef.current !== prob.pregameHomeWinPercentage) {
            pregameWinProbRef.current = prob.pregameHomeWinPercentage;
            setCachedPregameProb(prob.pregameHomeWinPercentage); // 持久化
            console.log(`💾 Cached pregame win prob: ${(prob.pregameHomeWinPercentage * 100).toFixed(1)}%`);
          }
        }
        
        // 如果当前返回的数据没有赛前胜率，但我们之前缓存过，就使用缓存的
        const finalProb: WinProbability = {
          ...prob,
          pregameHomeWinPercentage: prob.pregameHomeWinPercentage ?? pregameWinProbRef.current ?? undefined
        };
        
        console.log(`   Final pregameHomeWinPercentage: ${finalProb.pregameHomeWinPercentage}`);
        console.log(`   Cache value: ${pregameWinProbRef.current}`);
        
        setWinProb(finalProb);
      }
    };

    // 初始加载（添加随机延迟，避免所有组件同时发起请求）
    const isLive = matchStatus !== 'COMPLETED' && matchStatus !== 'NOTSTARTED' && matchStatus !== 'SCHEDULED';
    
    // 随机延迟0-15秒，避免所有MatchCard同时请求导致 ERR_INSUFFICIENT_RESOURCES
    // 增加延迟范围，确保请求更加分散
    const initialDelay = Math.random() * 15000;
    
    const initialTimeout = setTimeout(() => {
      fetchPolyData(isLive); // 比赛进行中强制刷新以获取最新价格
      fetchWinProb(); // 获取胜率
    }, initialDelay);

    // 清除旧的定时器
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    // REST API轮询模式（WebSocket禁用时的主要更新方式）
    // - 比赛进行中：45秒更新一次（增加间隔，降低请求频率）
    // - 比赛未开始：120秒更新一次
    const pollInterval = isLive ? 45000 : 120000;
    
    // 轮询也添加独立的随机延迟（与初始延迟不同）
    const pollDelay = initialDelay + (Math.random() * 10000); // 额外加 0-10秒
    const pollTimeout = setTimeout(() => {
      intervalRef.current = setInterval(() => {
        if (matchStatus !== 'COMPLETED') {
          // 每次轮询时再加一个小的随机延迟，避免多个组件同步
          const jitter = Math.random() * 3000; // 0-3秒的抖动
          setTimeout(() => {
            fetchPolyData(true);
            fetchWinProb(); // 同时更新胜率
          }, jitter);
        }
      }, pollInterval);
    }, pollDelay);

    return () => {
      mounted = false;
      clearTimeout(initialTimeout); // 清除初始延迟
      clearTimeout(pollTimeout); // 清除轮询延迟
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [homeTeamName, awayTeamName, matchStatus, updateSignals, match]);

  // WebSocket已移除，仅使用REST API轮询

  // 当比分更新时，重新计算信号
  useEffect(() => {
    if (polyData.loaded) {
      if (matchStatus === 'COMPLETED') {
        // 比赛结束，立即清除信号
        updateSignals(match.matchId, []);
      } else if (matchStatus !== 'NOTSTARTED') {
        // 比赛进行中，计算信号（包含赛前胜率）
        const signals = analyzeMatch(
          match,
          { 
            homePrice: polyData.homePrice, 
            awayPrice: polyData.awayPrice, 
            homeRawPrice: polyData.homeRawPrice, 
            awayRawPrice: polyData.awayRawPrice,
            espnHomeWinProb: winProb?.homeWinPercentage, // 传递ESPN实时胜率
            espnPregameHomeWinProb: winProb?.pregameHomeWinPercentage // 传递ESPN赛前胜率（用于判断强队）
          }
        );
        updateSignals(match.matchId, signals);
      }
    }
  }, [homeScore, awayScore, currentQuarter, costTime, polyData, match, matchStatus, updateSignals, winProb]);

  const scoreDiff = homeScore - awayScore;
  const isCompleted = matchStatus === 'COMPLETED';
  const isNotStarted = matchStatus === 'NOTSTARTED' || matchStatus === 'SCHEDULED';
  
  const statusText = useMemo(() => {
    if (isCompleted) return '已结束 • Final';
    if (isNotStarted) {
      const date = new Date(matchTime);
      if (isNaN(date.getTime())) return '未开始';
      const time = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
      return `未开始 • ${time}`;
    }
    
    // Live - 从 frontEndMatchStatus 提取时间信息
    const quarterNum = currentQuarter || 0;
    
    // 优先使用 frontEndMatchStatus.desc
    if (match.frontEndMatchStatus?.desc) {
      const desc = match.frontEndMatchStatus.desc;
      
      // 格式1: "第二节 结束"
      if (desc.includes('结束')) {
        if (quarterNum === 1) return '第1节结束';
        if (quarterNum === 2) return '第2节结束 • 中场休息';
        if (quarterNum === 3) return '第3节结束';
        if (quarterNum === 4) return '第4节结束';
        return `第${quarterNum}节结束`;
      }
      
      // 格式2: "第二节 剩8:09"
      const remainingMatch = desc.match(/剩(\d+):(\d+)/);
      if (remainingMatch) {
        const remainingMinutes = parseInt(remainingMatch[1]);
        const remainingSeconds = parseInt(remainingMatch[2]);
        return `第${quarterNum}节 • 剩${remainingMinutes}:${remainingSeconds.toString().padStart(2, '0')}`;
      }
    }
    
    // 回退到 costTime
    const time = costTime || '';
    
    // 小节结束：明确显示00:00时才算
    if (time === '00:00' || time === '0:00') {
      if (quarterNum === 1) return '第1节结束';
      if (quarterNum === 2) return '第2节结束 • 中场休息';
      if (quarterNum === 3) return '第3节结束';
      if (quarterNum === 4) return '第4节结束';
      return `第${quarterNum}节结束`;
    }
    
    // 进行中：显示时间，如果时间为空显示LIVE
    return `第${quarterNum}节 • ${time || 'LIVE'}`;
  }, [matchStatus, currentQuarter, costTime, matchTime, match.frontEndMatchStatus, isCompleted, isNotStarted]);

  // Styles based on type
  const styleMap = {
    bullish: {
      border: 'border-green-500/20',
      bg: 'bg-green-500/5',
      badge: 'bg-green-500 text-white',
      badgeText: '高概率',
      text: 'text-green-500',
      button: 'bg-green-900/50 text-green-400 hover:bg-green-900/70',
      buttonText: '交易',
      diffColor: 'text-green-500'
    },
    bearish: {
      border: 'border-red-500/20',
      bg: 'bg-red-500/5',
      badge: 'bg-red-900/80 text-red-200',
      badgeText: '低概率',
      text: 'text-red-500',
      button: 'bg-red-500 text-white hover:bg-red-600',
      buttonText: '交易',
      diffColor: 'text-red-500'
    },
    neutral: {
      border: 'border-white/5',
      bg: 'bg-surface',
      badge: 'hidden',
      badgeText: '等待中',
      text: 'text-gray-400',
      button: 'hidden',
      buttonText: '',
      diffColor: 'text-gray-400'
    }
  };

  const activeStyle = isCompleted ? styleMap.neutral : (isNotStarted ? styleMap.neutral : styleMap[polyData.type]);

  const formattedDiff = scoreDiff > 0 ? `+${scoreDiff}` : `${scoreDiff}`;

  // 获取当前信号
  const currentSignal = allSignals.find(s => s.matchId === match.matchId);
  const hasSignal = currentSignal && (currentSignal.type === 'STRONG_BUY' || currentSignal.type === 'BUY' || currentSignal.type === 'STRONG_SELL' || currentSignal.type === 'SELL');

  return (
    <>
      <div 
        onClick={handleCardClick}
        className={`rounded-2xl p-5 border ${activeStyle.border} ${activeStyle.bg} relative overflow-hidden transition-all cursor-pointer hover:border-opacity-70 ${hasSignal ? 'animate-pulse-slow' : ''}`}
      >
      {/* Status - Top */}
      <div className="mb-4">
        <div className="text-sm font-medium text-gray-500 tracking-wide uppercase">
          {statusText}
        </div>
      </div>

      {/* Teams & Scores - Enlarged */}
      <div className="flex justify-between items-center mb-5">
        {/* Away Team */}
        <div className="text-center flex-1">
          <div className={`text-base font-bold mb-2 ${currentSignal?.team === awayTeamName ? 'text-yellow-400' : 'text-white'}`}>
            {awayTeamName}
          </div>
          <div className="text-5xl font-black text-white tracking-tighter">{awayScore ?? '-'}</div>
        </div>

        {/* VS & Score Diff */}
        <div className="px-6 text-center">
          <div className="text-sm text-gray-600 mb-1">VS</div>
          <div className={`text-3xl font-black ${scoreDiff > 0 ? 'text-green-400' : scoreDiff < 0 ? 'text-red-400' : 'text-gray-500'}`}>
            {formattedDiff}
          </div>
          <div className="text-xs text-gray-600 mt-1">分差</div>
        </div>

        {/* Home Team */}
        <div className="text-center flex-1">
          <div className={`text-base font-bold mb-2 ${currentSignal?.team === homeTeamName ? 'text-yellow-400' : 'text-white'}`}>
            {homeTeamName}
          </div>
          <div className="text-5xl font-black text-white tracking-tighter">{homeScore ?? '-'}</div>
        </div>
      </div>

      {/* ESPN Win Probability Bar */}
      {winProb && matchStatus !== 'COMPLETED' && (
        <div className="mb-4 bg-white/5 rounded-lg p-3">
          <div className="text-xs text-gray-500 text-center mb-2">
            ESPN 胜率 {winProb.isPregame ? '(赛前预测)' : '(实时)'}
          </div>
          <div className="flex items-center gap-2">
            {/* 左边：客队 */}
            <div className="text-sm font-mono text-blue-400 w-14 text-right">
              {((1 - winProb.homeWinPercentage) * 100).toFixed(0)}%
            </div>
            <div className="flex-1 h-3 bg-gray-800 rounded-full overflow-hidden flex">
              {/* 客队在左 */}
              <div 
                className="bg-gradient-to-r from-blue-500 to-blue-400 transition-all duration-500"
                style={{ width: `${(1 - winProb.homeWinPercentage) * 100}%` }}
              />
              {/* 主队在右 */}
              <div 
                className="bg-gradient-to-r from-red-400 to-red-500 transition-all duration-500"
                style={{ width: `${winProb.homeWinPercentage * 100}%` }}
              />
            </div>
            {/* 右边：主队 */}
            <div className="text-sm font-mono text-red-400 w-14">
              {(winProb.homeWinPercentage * 100).toFixed(0)}%
            </div>
          </div>
          
          {/* 赛前预测（比赛进行中时始终显示作为参考） */}
          {winProb.pregameHomeWinPercentage !== undefined && matchStatus !== 'NOTSTARTED' && matchStatus !== 'SCHEDULED' && (
            <div className="mt-2 pt-2 border-t border-gray-700/50">
              <div className="text-[9px] text-gray-500 text-center mb-1">赛前预测（用于判断强队）</div>
              <div className="flex justify-between items-center text-[10px] font-mono">
                <span className="text-blue-300">{awayTeamName} {((1 - winProb.pregameHomeWinPercentage) * 100).toFixed(0)}%</span>
                <span className="text-gray-600">vs</span>
                <span className="text-red-300">{homeTeamName} {(winProb.pregameHomeWinPercentage * 100).toFixed(0)}%</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Polymarket Prices - Highlighted */}
      <div className="bg-white/5 rounded-xl p-4 mb-4">
        <div className="text-center mb-2">
          {polyData.lastUpdate && (
            <div className="text-[9px] text-gray-600 mt-0.5">
              更新: {new Date(polyData.lastUpdate).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </div>
          )}
        </div>
        <div className="flex justify-around items-center">
          {/* Away Price */}
          <div className="text-center flex-1">
            <div className="text-sm text-gray-500 mb-1">{awayTeamName}</div>
            <div className={`text-4xl font-black font-mono ${
              polyData.awayRawPrice >= 0.65 ? 'text-red-400' : 
              polyData.awayRawPrice <= 0.45 ? 'text-green-400' : 
              'text-gray-300'
            }`}>
              {polyData.loaded ? `${polyData.awayPrice}¢` : '---'}
            </div>
          </div>

          <div className="text-gray-700 text-xl">|</div>

          {/* Home Price */}
          <div className="text-center flex-1">
            <div className="text-sm text-gray-500 mb-1">{homeTeamName}</div>
            <div className={`text-4xl font-black font-mono ${
              polyData.homeRawPrice >= 0.65 ? 'text-red-400' : 
              polyData.homeRawPrice <= 0.45 ? 'text-green-400' : 
              'text-gray-300'
            }`}>
              {polyData.loaded ? `${polyData.homePrice}¢` : '---'}
            </div>
          </div>
        </div>
      </div>

      </div>

      <TeamInfoModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        homeTeam={homeTeamName}
        awayTeam={awayTeamName}
        homeInjuries={homeInjuries}
        awayInjuries={awayInjuries}
      />
    </>
  );
}
