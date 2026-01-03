import type { UnifiedMatch } from '@shared/types';
import { TrendingUp, TrendingDown, AlertCircle } from 'lucide-react';
import { useState, useRef } from 'react';

// ESPN 风格的胜率曲线图组件
function WinProbChart({ homeTeam, awayTeam, espn }: { 
  homeTeam: { name: string; score: number }; 
  awayTeam: { name: string; score: number }; 
  espn: { homeWinProb: number; awayWinProb: number; pregameHomeWinProb: number; pregameAwayWinProb: number } 
}) {
  const [hoverX, setHoverX] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  
  // 创建简化的历史数据点（赛前 -> 当前）
  const homePoints = [
    espn.pregameHomeWinProb,
    espn.homeWinProb
  ];
  
  const awayPoints = [
    espn.pregameAwayWinProb,
    espn.awayWinProb
  ];

  const width = 280;
  const height = 120;
  const paddingLeft = 35;
  const paddingRight = 10;
  const paddingTop = 10;
  const paddingBottom = 25;

  // 生成 SVG 路径
  const generatePath = (points: number[]) => {
    const chartWidth = width - paddingLeft - paddingRight;
    const chartHeight = height - paddingTop - paddingBottom;
    const step = chartWidth / (points.length - 1);
    return points
      .map((point, index) => {
        const x = paddingLeft + index * step;
        const y = paddingTop + chartHeight - (point * chartHeight);
        return index === 0 ? `M ${x} ${y}` : `L ${x} ${y}`;
      })
      .join(' ');
  };

  const homePath = generatePath(homePoints);
  const awayPath = generatePath(awayPoints);
  
  // 鼠标移动处理
  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    if (x >= paddingLeft && x <= width - paddingRight) {
      setHoverX(x);
    }
  };
  
  // 计算悬停位置的胜率
  const getHoverProb = (x: number) => {
    const chartWidth = width - paddingLeft - paddingRight;
    const ratio = (x - paddingLeft) / chartWidth;
    const index = Math.min(Math.max(ratio, 0), 1);
    
    const homeProb = homePoints[0] + (homePoints[1] - homePoints[0]) * index;
    const awayProb = awayPoints[0] + (awayPoints[1] - awayPoints[0]) * index;
    
    return { homeProb, awayProb };
  };

  return (
    <div className="bg-black/20 rounded-lg p-3 border border-white/5">
      {/* 标题栏 */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="text-xs font-bold text-white">{homeTeam.name.split(' ').pop()}</div>
          <div className="text-lg font-black text-blue-400">{(espn.homeWinProb * 100).toFixed(1)}%</div>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-lg font-black text-red-400">{(espn.awayWinProb * 100).toFixed(1)}%</div>
          <div className="text-xs font-bold text-white">{awayTeam.name.split(' ').pop()}</div>
        </div>
      </div>

      {/* SVG 曲线图 */}
      <svg 
        ref={svgRef}
        width={width} 
        height={height} 
        className="w-full"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoverX(null)}
      >
        <defs>
          <linearGradient id="homeGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="awayGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#ef4444" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#ef4444" stopOpacity="0" />
          </linearGradient>
        </defs>
        
        {/* Y轴坐标 */}
        <text x={5} y={paddingTop + 5} fontSize="10" fill="#6b7280" textAnchor="start">100</text>
        <text x={5} y={paddingTop + (height - paddingTop - paddingBottom) / 2 + 5} fontSize="10" fill="#6b7280" textAnchor="start">50</text>
        <text x={5} y={height - paddingBottom + 5} fontSize="10" fill="#6b7280" textAnchor="start">0</text>
        
        {/* X轴坐标 */}
        <text x={paddingLeft} y={height - 5} fontSize="10" fill="#6b7280" textAnchor="start">赛前</text>
        <text x={width - paddingRight} y={height - 5} fontSize="10" fill="#6b7280" textAnchor="end">当前</text>
        
        {/* 参考线 - 50% */}
        <line 
          x1={paddingLeft} 
          y1={paddingTop + (height - paddingTop - paddingBottom) / 2} 
          x2={width - paddingRight} 
          y2={paddingTop + (height - paddingTop - paddingBottom) / 2}
          stroke="#374151" 
          strokeWidth="1" 
          strokeDasharray="2,2" 
        />
        
        {/* 主队区域 */}
        <path
          d={`${homePath} L ${width - paddingRight} ${height - paddingBottom} L ${paddingLeft} ${height - paddingBottom} Z`}
          fill="url(#homeGradient)"
        />
        
        {/* 客队区域 */}
        <path
          d={`${awayPath} L ${width - paddingRight} ${height - paddingBottom} L ${paddingLeft} ${height - paddingBottom} Z`}
          fill="url(#awayGradient)"
        />
        
        {/* 主队线 */}
        <path
          d={homePath}
          stroke="#3b82f6"
          strokeWidth="2"
          fill="none"
        />
        
        {/* 客队线 */}
        <path
          d={awayPath}
          stroke="#ef4444"
          strokeWidth="2"
          fill="none"
        />
        
        {/* 悬停时的垂直线 */}
        {hoverX !== null && (
          <>
            <line
              x1={hoverX}
              y1={paddingTop}
              x2={hoverX}
              y2={height - paddingBottom}
              stroke="#9ca3af"
              strokeWidth="1"
              strokeDasharray="4,4"
            />
            {(() => {
              const { homeProb, awayProb } = getHoverProb(hoverX);
              const chartHeight = height - paddingTop - paddingBottom;
              return (
                <>
                  {/* 主队悬停点 */}
                  <circle
                    cx={hoverX}
                    cy={paddingTop + chartHeight - (homeProb * chartHeight)}
                    r="4"
                    fill="#3b82f6"
                    stroke="white"
                    strokeWidth="2"
                  />
                  {/* 客队悬停点 */}
                  <circle
                    cx={hoverX}
                    cy={paddingTop + chartHeight - (awayProb * chartHeight)}
                    r="4"
                    fill="#ef4444"
                    stroke="white"
                    strokeWidth="2"
                  />
                  {/* Tooltip */}
                  <g>
                    <rect
                      x={hoverX < width / 2 ? hoverX + 10 : hoverX - 110}
                      y={paddingTop + 10}
                      width="100"
                      height="45"
                      fill="rgba(0, 0, 0, 0.9)"
                      rx="4"
                    />
                    <text
                      x={hoverX < width / 2 ? hoverX + 60 : hoverX - 60}
                      y={paddingTop + 25}
                      fontSize="11"
                      fill="#3b82f6"
                      textAnchor="middle"
                      fontWeight="bold"
                    >
                      {homeTeam.name.split(' ').pop()}: {(homeProb * 100).toFixed(1)}%
                    </text>
                    <text
                      x={hoverX < width / 2 ? hoverX + 60 : hoverX - 60}
                      y={paddingTop + 42}
                      fontSize="11"
                      fill="#ef4444"
                      textAnchor="middle"
                      fontWeight="bold"
                    >
                      {awayTeam.name.split(' ').pop()}: {(awayProb * 100).toFixed(1)}%
                    </text>
                  </g>
                </>
              );
            })()}
          </>
        )}
        
        {/* 当前点 */}
        <circle
          cx={width - paddingRight}
          cy={paddingTop + (height - paddingTop - paddingBottom) - (espn.homeWinProb * (height - paddingTop - paddingBottom))}
          r="3"
          fill="#3b82f6"
        />
        <circle
          cx={width - paddingRight}
          cy={paddingTop + (height - paddingTop - paddingBottom) - (espn.awayWinProb * (height - paddingTop - paddingBottom))}
          r="3"
          fill="#ef4444"
        />
      </svg>
    </div>
  );
}

interface MatchCardProps {
  match: UnifiedMatch;
}

export function MatchCard({ match }: MatchCardProps) {
  const {
    homeTeam,
    awayTeam,
    status,
    statusStr,
    poly,
    espn,
    signals,
    dataCompleteness,
  } = match;

  // 调试：打印组件渲染
  console.log(`[MatchCard] 🎨 渲染 ${homeTeam.name} vs ${awayTeam.name}`, {
    homePrice: poly?.homePrice,
    awayPrice: poly?.awayPrice,
    lastUpdate: new Date(match.lastUpdate).toLocaleTimeString()
  });

  // 获取比赛状态样式
  const getStatusStyle = () => {
    switch (status) {
      case 'LIVE':
        return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'PRE':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'FINAL':
        return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
      default:
        return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  // 获取最强信号
  const topSignal = signals.length > 0
    ? signals.reduce((prev, current) => (prev.confidence > current.confidence ? prev : current))
    : null;

  // 格式化价格
  const formatPrice = (price: number) => `$${price.toFixed(2)}`;

  // 判断是否有信号
  const hasSignals = signals.length > 0;
  
  // 获取卡片边框样式
  const getCardBorderStyle = () => {
    if (hasSignals) {
      return 'border-purple-500/40 shadow-lg shadow-purple-500/10';
    }
    if (status === 'LIVE') {
      return 'border-green-500/20';
    }
    return 'border-white/5';
  };

  // 格式化开始时间
  const formatStartTime = () => {
    if (!match.startTime) return '';
    const date = new Date(match.startTime);
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div 
      className={`bg-surface rounded-xl border-2 transition-all overflow-hidden ${
        getCardBorderStyle()
      } ${hasSignals ? 'animate-pulse-slow' : ''}`}
    >
      {/* Header - Status, Time & Signals */}
      <div className="bg-white/5 px-4 py-2 flex items-center justify-between border-b border-white/5">
        <div className="flex items-center gap-2">
          <span className={`px-2 py-0.5 rounded text-xs font-bold ${getStatusStyle()}`}>
            {statusStr}
          </span>
          {status === 'PRE' && match.startTime && (
            <span className="text-xs text-gray-400">
              {formatStartTime()}
            </span>
          )}
        </div>
        
        {hasSignals && (
          <div className="flex items-center gap-1.5 px-2 py-0.5 bg-yellow-500/20 rounded border border-yellow-500/30">
            <AlertCircle className="w-3 h-3 text-yellow-400" />
            <span className="text-xs font-bold text-yellow-400">{signals.length}</span>
          </div>
        )}
      </div>

      <div className="p-4">
        {/* Teams & Scores */}
        <div className="space-y-3 mb-4">
          {/* 主队 */}
          <div className="flex items-center justify-between">
            <span className="text-white font-bold text-base truncate">{homeTeam.name}</span>
            <span className="text-3xl font-black text-white ml-2">{homeTeam.score}</span>
          </div>

          {/* 客队 */}
          <div className="flex items-center justify-between">
            <span className="text-white font-bold text-base truncate">{awayTeam.name}</span>
            <span className="text-3xl font-black text-white ml-2">{awayTeam.score}</span>
          </div>
        </div>

        {/* ESPN 胜率曲线图 */}
        {dataCompleteness.hasESPNData && espn.homeWinProb > 0 && espn.awayWinProb > 0 && (
          <div className="mb-3">
            <WinProbChart 
              homeTeam={homeTeam}
              awayTeam={awayTeam}
              espn={espn}
            />
          </div>
        )}

        {/* Polymarket 价格 - Bid/Ask 显示 */}
        <div className="mb-3">
          {dataCompleteness.hasPolyData ? (
            <div className="bg-gradient-to-r from-purple-500/10 to-blue-500/10 rounded-lg p-3 border border-purple-500/20">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-purple-300">Polymarket 交易价格</span>
                <span className="text-xs text-gray-400">Bid / Ask</span>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                {/* 主队价格 */}
                <div className="space-y-1">
                  <div className="text-xs text-gray-400 text-center font-medium">
                    {homeTeam.name.split(' ').pop()}
                  </div>
                  <div className="bg-black/20 rounded-lg p-2 border border-white/10">
                    <div className="flex justify-between items-center text-xs mb-1">
                      <span className="text-green-400 font-medium">买入</span>
                      <span className="text-red-400 font-medium">卖出</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-green-300 font-bold">
                        {poly.homeBestAsk ? formatPrice(poly.homeBestAsk) : '--'}
                      </span>
                      <span className="text-red-300 font-bold">
                        {poly.homeBestBid ? formatPrice(poly.homeBestBid) : '--'}
                      </span>
                    </div>
                    <div className="text-center mt-1 pt-1 border-t border-white/10">
                      <span className="text-xs text-gray-400">Mid: </span>
                      <span className="text-xs text-white font-medium">{formatPrice(poly.homePrice)}</span>
                    </div>
                  </div>
                </div>

                {/* 客队价格 */}
                <div className="space-y-1">
                  <div className="text-xs text-gray-400 text-center font-medium">
                    {awayTeam.name.split(' ').pop()}
                  </div>
                  <div className="bg-black/20 rounded-lg p-2 border border-white/10">
                    <div className="flex justify-between items-center text-xs mb-1">
                      <span className="text-green-400 font-medium">买入</span>
                      <span className="text-red-400 font-medium">卖出</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-green-300 font-bold">
                        {poly.awayBestAsk ? formatPrice(poly.awayBestAsk) : '--'}
                      </span>
                      <span className="text-red-300 font-bold">
                        {poly.awayBestBid ? formatPrice(poly.awayBestBid) : '--'}
                      </span>
                    </div>
                    <div className="text-center mt-1 pt-1 border-t border-white/10">
                      <span className="text-xs text-gray-400">Mid: </span>
                      <span className="text-xs text-white font-medium">{formatPrice(poly.awayPrice)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 价差信息 */}
              <div className="mt-2 pt-2 border-t border-white/10">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-gray-400">主队价差:</span>
                  <span className="text-yellow-300 font-medium">
                    {poly.homeBestAsk && poly.homeBestBid 
                      ? `${((poly.homeBestAsk - poly.homeBestBid) * 100).toFixed(1)}¢`
                      : '--'
                    }
                  </span>
                  <span className="text-gray-400">客队价差:</span>
                  <span className="text-yellow-300 font-medium">
                    {poly.awayBestAsk && poly.awayBestBid 
                      ? `${((poly.awayBestAsk - poly.awayBestBid) * 100).toFixed(1)}¢`
                      : '--'
                    }
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-orange-500/10 rounded-lg p-2.5 border border-orange-500/20">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-orange-400" />
                <span className="text-xs text-orange-300">暂无 Polymarket 数据</span>
              </div>
            </div>
          )}
        </div>

        {/* 数据缺失提示 */}
        {!dataCompleteness.hasESPNData && (
          <div className="bg-gray-500/10 rounded-lg p-2.5 border border-gray-500/20 mb-3">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-gray-400" />
              <span className="text-xs text-gray-400">暂无 ESPN 数据</span>
            </div>
          </div>
        )}

        {/* 套利信号 - 突出显示 */}
        {topSignal && (
          <div className={`rounded-lg p-3 border-2 ${
            topSignal.type.includes('BUY') 
              ? 'bg-gradient-to-br from-green-500/20 to-green-600/10 border-green-500/50' 
              : 'bg-gradient-to-br from-red-500/20 to-red-600/10 border-red-500/50'
          }`}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                {topSignal.type.includes('BUY') ? (
                  <TrendingUp className="w-5 h-5 text-green-400" />
                ) : (
                  <TrendingDown className="w-5 h-5 text-red-400" />
                )}
                <span className={`text-sm font-black uppercase ${
                  topSignal.type.includes('BUY') ? 'text-green-400' : 'text-red-400'
                }`}>
                  {topSignal.type.replace('_', ' ')}
                </span>
              </div>
              <div className="flex flex-col items-end">
                <span className="text-xs text-gray-400">置信度</span>
                <span className="text-sm font-bold text-white">
                  {(topSignal.confidence * 100).toFixed(0)}%
                </span>
              </div>
            </div>
            <div className="text-xs text-gray-300 leading-relaxed mb-1">{topSignal.reason}</div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-400">预期收益</span>
              <span className={`font-bold ${
                topSignal.type.includes('BUY') ? 'text-green-400' : 'text-red-400'
              }`}>
                +{topSignal.edge.toFixed(2)}%
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Footer - Data Status & Update Time */}
      <div className="bg-white/5 px-4 py-2 flex items-center justify-between border-t border-white/5">
        <div className="flex items-center gap-2 text-xs">
          <div className="flex items-center gap-1">
            <span className={`w-1.5 h-1.5 rounded-full ${dataCompleteness.hasESPNData ? 'bg-green-400' : 'bg-gray-600'}`} title="ESPN" />
            <span className="text-gray-500">ESPN</span>
          </div>
          <div className="flex items-center gap-1">
            <span className={`w-1.5 h-1.5 rounded-full ${dataCompleteness.hasPolyData ? 'bg-green-400' : 'bg-gray-600'}`} title="Polymarket" />
            <span className="text-gray-500">Poly</span>
          </div>
        </div>
        <span className="text-xs text-gray-500">
          更新 {new Date(match.lastUpdate).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
    </div>
  );
}
