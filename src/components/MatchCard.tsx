import { useEffect, useState, useMemo, useRef } from 'react';
import type { Match } from '../services/api';
import { searchPolymarketMatch, normalizeMarketData, getEnglishTeamName } from '../services/polymarket';
import { analyzeMatch } from '../services/strategy';
import { useSignals } from '../contexts/SignalContext';
import { getTeamInjuries, getGameWinProbability, getESPNTeamName } from '../services/espn';
import type { TeamInjuries, WinProbability } from '../types';
import { TeamInfoModal } from './TeamInfoModal';

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
        // console.log(`[API更新] ${homeTeamName}: ${homePrice}¢`);
        
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
          const signals = analyzeMatch(
            match,
            { 
              homePrice, 
              awayPrice, 
              homeRawPrice, 
              awayRawPrice,
              espnHomeWinProb: winProb?.homeWinPercentage // 传递ESPN胜率
            }
          );
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
        setWinProb(prob);
      }
    };

    // 初始加载（比赛进行中时强制刷新，否则使用缓存）
    const isLive = matchStatus !== 'COMPLETED' && matchStatus !== 'NOTSTARTED' && matchStatus !== 'SCHEDULED';
    fetchPolyData(isLive); // 比赛进行中强制刷新以获取最新价格
    fetchWinProb(); // 获取胜率

    // 清除旧的定时器
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    // 比赛进行中：每20秒轮询；未开始/已结束：每30秒
    const pollInterval = isLive ? 20000 : 30000;
    intervalRef.current = setInterval(() => {
      if (matchStatus !== 'COMPLETED') {
        fetchPolyData(true);
        fetchWinProb(); // 同时更新胜率
      }
    }, pollInterval);

    return () => {
      mounted = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [homeTeamName, awayTeamName, matchStatus, updateSignals, match]);

  // 当比分更新时，重新计算信号
  useEffect(() => {
    if (polyData.loaded) {
      if (matchStatus === 'COMPLETED') {
        // 比赛结束，立即清除信号
        updateSignals(match.matchId, []);
      } else if (matchStatus !== 'NOTSTARTED') {
        // 比赛进行中，计算信号
        const signals = analyzeMatch(
          match,
          { 
            homePrice: polyData.homePrice, 
            awayPrice: polyData.awayPrice, 
            homeRawPrice: polyData.homeRawPrice, 
            awayRawPrice: polyData.awayRawPrice,
            espnHomeWinProb: winProb?.homeWinPercentage // 传递ESPN胜率
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
        <div className="text-xs font-medium text-gray-500 tracking-wide uppercase">
          {statusText}
        </div>
      </div>

      {/* Teams & Scores - Enlarged */}
      <div className="flex justify-between items-center mb-5">
        {/* Away Team */}
        <div className="text-center flex-1">
          <div className={`text-sm font-bold mb-2 ${currentSignal?.team === awayTeamName ? 'text-yellow-400' : 'text-white'}`}>
            {awayTeamName}
          </div>
          <div className="text-4xl font-black text-white tracking-tighter">{awayScore ?? '-'}</div>
        </div>

        {/* VS & Score Diff */}
        <div className="px-6 text-center">
          <div className="text-xs text-gray-600 mb-1">VS</div>
          <div className={`text-2xl font-black ${scoreDiff > 0 ? 'text-green-400' : scoreDiff < 0 ? 'text-red-400' : 'text-gray-500'}`}>
            {formattedDiff}
          </div>
          <div className="text-[10px] text-gray-600 mt-1">分差</div>
        </div>

        {/* Home Team */}
        <div className="text-center flex-1">
          <div className={`text-sm font-bold mb-2 ${currentSignal?.team === homeTeamName ? 'text-yellow-400' : 'text-white'}`}>
            {homeTeamName}
          </div>
          <div className="text-4xl font-black text-white tracking-tighter">{homeScore ?? '-'}</div>
        </div>
      </div>

      {/* ESPN Win Probability Bar */}
      {winProb && matchStatus !== 'COMPLETED' && (
        <div className="mb-4 bg-white/5 rounded-lg p-3">
          <div className="text-[10px] text-gray-500 text-center mb-2">ESPN 胜率预测</div>
          <div className="flex items-center gap-2">
            {/* 左边：客队 */}
            <div className="text-xs font-mono text-blue-400 w-12 text-right">
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
            <div className="text-xs font-mono text-red-400 w-12">
              {(winProb.homeWinPercentage * 100).toFixed(0)}%
            </div>
          </div>
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
            <div className="text-xs text-gray-500 mb-1">{awayTeamName}</div>
            <div className={`text-3xl font-black font-mono ${
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
            <div className="text-xs text-gray-500 mb-1">{homeTeamName}</div>
            <div className={`text-3xl font-black font-mono ${
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
