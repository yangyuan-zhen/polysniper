import { X, TrendingUp, TrendingDown, Activity, AlertCircle } from 'lucide-react';
import type { UnifiedMatch } from '../types/backend';

interface MatchDetailModalProps {
  match: UnifiedMatch | null;
  isOpen: boolean;
  onClose: () => void;
}

export function MatchDetailModal({ match, isOpen, onClose }: MatchDetailModalProps) {
  if (!isOpen || !match) return null;

  const { homeTeam, awayTeam, espn, status, statusStr } = match;

  // 格式化概率
  const formatProb = (prob: number) => `${(prob * 100).toFixed(1)}%`;

  // 计算胜率变化
  const homeWinProbChange = espn.homeWinProb - espn.pregameHomeWinProb;
  const awayWinProbChange = espn.awayWinProb - espn.pregameAwayWinProb;

  return (
    <>
      {/* Overlay */}
      <div 
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div 
          className="bg-surface rounded-2xl border border-white/10 shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto pointer-events-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="sticky top-0 bg-surface/95 backdrop-blur-sm border-b border-white/10 p-6 flex items-center justify-between z-10">
            <div>
              <h2 className="text-2xl font-bold text-white mb-1">
                {homeTeam.name} vs {awayTeam.name}
              </h2>
              <div className="flex items-center gap-3 text-sm">
                <span className={`px-2 py-1 rounded text-xs font-bold ${
                  status === 'LIVE' ? 'bg-green-500/20 text-green-400' :
                  status === 'PRE' ? 'bg-blue-500/20 text-blue-400' :
                  'bg-gray-500/20 text-gray-400'
                }`}>
                  {statusStr}
                </span>
                <span className="text-gray-400">
                  {homeTeam.score} - {awayTeam.score}
                </span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-lg transition-all"
            >
              <X className="w-6 h-6 text-gray-400" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            {/* 胜率变化趋势 */}
            {match.dataCompleteness.hasESPNData && (homeWinProbChange !== 0 || awayWinProbChange !== 0) && (
              <div className="space-y-3">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Activity className="w-5 h-5 text-blue-400" />
                  胜率变化趋势
                </h3>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 rounded-xl p-4 border border-blue-500/20">
                    <div className="text-sm text-gray-400 mb-2">{homeTeam.name}</div>
                    <div className="flex items-baseline gap-2 mb-2">
                      <span className="text-2xl font-black text-blue-400">{formatProb(espn.homeWinProb)}</span>
                      {homeWinProbChange !== 0 && (
                        <div className={`flex items-center gap-1 text-sm font-bold ${
                          homeWinProbChange > 0 ? 'text-green-400' : 'text-red-400'
                        }`}>
                          {homeWinProbChange > 0 ? (
                            <TrendingUp className="w-4 h-4" />
                          ) : (
                            <TrendingDown className="w-4 h-4" />
                          )}
                          <span>{homeWinProbChange > 0 ? '+' : ''}{formatProb(homeWinProbChange)}</span>
                        </div>
                      )}
                    </div>
                    <div className="text-xs text-gray-500">
                      赛前: {formatProb(espn.pregameHomeWinProb)}
                    </div>
                  </div>

                  <div className="bg-gradient-to-br from-cyan-500/10 to-cyan-600/5 rounded-xl p-4 border border-cyan-500/20">
                    <div className="text-sm text-gray-400 mb-2">{awayTeam.name}</div>
                    <div className="flex items-baseline gap-2 mb-2">
                      <span className="text-2xl font-black text-cyan-400">{formatProb(espn.awayWinProb)}</span>
                      {awayWinProbChange !== 0 && (
                        <div className={`flex items-center gap-1 text-sm font-bold ${
                          awayWinProbChange > 0 ? 'text-green-400' : 'text-red-400'
                        }`}>
                          {awayWinProbChange > 0 ? (
                            <TrendingUp className="w-4 h-4" />
                          ) : (
                            <TrendingDown className="w-4 h-4" />
                          )}
                          <span>{awayWinProbChange > 0 ? '+' : ''}{formatProb(awayWinProbChange)}</span>
                        </div>
                      )}
                    </div>
                    <div className="text-xs text-gray-500">
                      赛前: {formatProb(espn.pregameAwayWinProb)}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 伤病名单 */}
            {espn.injuries && espn.injuries.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-orange-400" />
                  伤病名单
                </h3>

                <div className="space-y-2">
                  {espn.injuries.map((injury: any, index: number) => (
                    <div 
                      key={index}
                      className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-3"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="font-bold text-white mb-1">{injury.athlete?.displayName || '未知球员'}</div>
                          <div className="text-sm text-gray-400">
                            {injury.athlete?.position?.abbreviation && (
                              <span className="mr-2">位置: {injury.athlete.position.abbreviation}</span>
                            )}
                            {injury.team?.displayName && (
                              <span>球队: {injury.team.displayName}</span>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className={`px-2 py-1 rounded text-xs font-bold ${
                            injury.status === 'Out' ? 'bg-red-500/20 text-red-400' :
                            injury.status === 'Questionable' ? 'bg-yellow-500/20 text-yellow-400' :
                            injury.status === 'Probable' ? 'bg-green-500/20 text-green-400' :
                            'bg-gray-500/20 text-gray-400'
                          }`}>
                            {injury.status || '未知'}
                          </div>
                        </div>
                      </div>
                      {injury.details?.type && (
                        <div className="text-sm text-orange-300 mt-2">
                          伤病: {injury.details.type}
                        </div>
                      )}
                      {injury.details?.detail && (
                        <div className="text-xs text-gray-500 mt-1">
                          {injury.details.detail}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 无伤病信息 */}
            {(!espn.injuries || espn.injuries.length === 0) && match.dataCompleteness.hasESPNData && (
              <div className="space-y-4">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-green-400" />
                  伤病名单
                </h3>
                <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4 text-center">
                  <div className="text-green-400 font-semibold">✓ 暂无伤病报告</div>
                  <div className="text-sm text-gray-400 mt-1">两队主力球员状态良好</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
