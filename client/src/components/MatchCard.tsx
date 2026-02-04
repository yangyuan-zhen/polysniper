import type { UnifiedMatch } from "../types/shared";
import {
  TrendingUp,
  TrendingDown,
  AlertCircle,
  DollarSign,
} from "lucide-react";

// ESPN 风格胜率条
function WinProbChart({
  homeTeam,
  awayTeam,
  espn,
}: {
  homeTeam: { name: string; score: number };
  awayTeam: { name: string; score: number };
  espn: {
    homeWinProb: number;
    awayWinProb: number;
    pregameHomeWinProb: number;
    pregameAwayWinProb: number;
  };
}) {
  const homeProb = espn.homeWinProb * 100;
  const awayProb = espn.awayWinProb * 100;

  return (
    <div className="bg-black/20 rounded-lg p-3 border border-white/5">
      {/* 顶部：队名和胜率 */}
      <div className="flex items-end justify-between mb-2">
        <div>
          <div className="text-[10px] text-gray-400 mb-0.5">
            {homeTeam.name.split(" ").pop()}
          </div>
          <div className="text-2xl font-black text-blue-400">
            {homeProb.toFixed(1)}%
          </div>
        </div>
        <div className="text-right">
          <div className="text-[10px] text-gray-400 mb-0.5">
            {awayTeam.name.split(" ").pop()}
          </div>
          <div className="text-2xl font-black text-red-400">
            {awayProb.toFixed(1)}%
          </div>
        </div>
      </div>

      {/* Win Probability Bar */}
      <div className="relative h-2 bg-gray-800 rounded-full overflow-hidden">
        <div
          className="absolute left-0 top-0 h-full bg-blue-500 transition-all duration-700 ease-out"
          style={{ width: `${homeProb}%` }}
        />
      </div>

      {/* 赛前胜率（小字） */}
      {espn.pregameHomeWinProb > 0 && (
        <div className="flex justify-between mt-1.5 text-[9px] text-gray-600">
          <span>赛前 {(espn.pregameHomeWinProb * 100).toFixed(0)}%</span>
          <span>赛前 {(espn.pregameAwayWinProb * 100).toFixed(0)}%</span>
        </div>
      )}
    </div>
  );
}

// 博彩公司赔率面板
function OddsPanel({
  homeTeam,
  awayTeam,
  odds,
}: {
  homeTeam: { name: string };
  awayTeam: { name: string };
  odds: {
    averageHomeProb?: number;
    averageAwayProb?: number;
    sources?: Array<{
      bookmaker: string;
      homeProb: number;
      awayProb: number;
      homeOdds: number;
      awayOdds: number;
    }>;
  };
}) {
  if (!odds.averageHomeProb || !odds.averageAwayProb) return null;

  const homeProb = odds.averageHomeProb * 100;
  const awayProb = odds.averageAwayProb * 100;
  const sources = odds.sources || [];

  // 美式赔率转小数赔率
  const americanToDecimal = (americanOdds: number): number => {
    if (americanOdds > 0) {
      return americanOdds / 100 + 1;
    } else {
      return 100 / Math.abs(americanOdds) + 1;
    }
  };

  return (
    <div className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 rounded-lg p-3 border border-amber-500/20">
      <div className="flex items-center gap-2 mb-2">
        <DollarSign className="w-4 h-4 text-amber-400" />
        <span className="text-xs font-semibold text-amber-300">
          博彩公司赔率
        </span>
        {sources.length > 0 && (
          <span className="text-[10px] text-gray-400">
            ({sources.map((s) => s.bookmaker).join(", ")})
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        {/* 主队赔率 */}
        <div className="bg-black/20 rounded-lg p-2 border border-white/10">
          <div className="text-[10px] text-gray-400 text-center mb-1">
            {homeTeam.name.split(" ").pop()}
          </div>
          <div className="text-center">
            <span className="text-lg font-black text-amber-400">
              {homeProb.toFixed(1)}%
            </span>
          </div>
          {sources.length > 0 && sources[0].homeOdds && (
            <div className="text-center text-[10px] text-gray-500 mt-0.5">
              赔率 {americanToDecimal(sources[0].homeOdds).toFixed(2)}
            </div>
          )}
        </div>

        {/* 客队赔率 */}
        <div className="bg-black/20 rounded-lg p-2 border border-white/10">
          <div className="text-[10px] text-gray-400 text-center mb-1">
            {awayTeam.name.split(" ").pop()}
          </div>
          <div className="text-center">
            <span className="text-lg font-black text-amber-400">
              {awayProb.toFixed(1)}%
            </span>
          </div>
          {sources.length > 0 && sources[0].awayOdds && (
            <div className="text-center text-[10px] text-gray-500 mt-0.5">
              赔率 {americanToDecimal(sources[0].awayOdds).toFixed(2)}
            </div>
          )}
        </div>
      </div>
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
    odds,
    signals,
    dataCompleteness,
  } = match;

  // 调试：打印组件渲染
  console.log(`[MatchCard] 🎨 渲染 ${homeTeam.name} vs ${awayTeam.name}`, {
    homePrice: poly?.homePrice,
    awayPrice: poly?.awayPrice,
    lastUpdate: new Date(match.lastUpdate).toLocaleTimeString(),
  });

  // 获取比赛状态样式
  const getStatusStyle = () => {
    switch (status) {
      case "LIVE":
        return "bg-green-500/20 text-green-400 border-green-500/30";
      case "PRE":
        return "bg-blue-500/20 text-blue-400 border-blue-500/30";
      case "FINAL":
        return "bg-gray-500/20 text-gray-400 border-gray-500/30";
      default:
        return "bg-gray-500/20 text-gray-400 border-gray-500/30";
    }
  };

  // 获取最强信号
  const topSignal =
    signals.length > 0
      ? signals.reduce((prev, current) =>
          prev.confidence > current.confidence ? prev : current,
        )
      : null;

  // 格式化价格
  const formatPrice = (price: number) => `$${price.toFixed(2)}`;

  // 判断是否有信号
  const hasSignals = signals.length > 0;

  // 获取卡片边框样式
  const getCardBorderStyle = () => {
    if (hasSignals) {
      return "border-purple-500/40 shadow-lg shadow-purple-500/10";
    }
    if (status === "LIVE") {
      return "border-green-500/20";
    }
    return "border-white/5";
  };

  // 格式化开始时间
  const formatStartTime = () => {
    if (!match.startTime) return "";
    const date = new Date(match.startTime);
    return date.toLocaleTimeString("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div
      className={`bg-surface rounded-xl border-2 transition-all overflow-hidden ${getCardBorderStyle()} ${hasSignals ? "animate-pulse-slow" : ""}`}
    >
      {/* Header - Status, Time & Signals */}
      <div className="bg-white/5 px-4 py-2 flex items-center justify-between border-b border-white/5">
        <div className="flex items-center gap-2">
          <span
            className={`px-2 py-0.5 rounded text-xs font-bold ${getStatusStyle()}`}
          >
            {statusStr}
          </span>
          {status === "PRE" && match.startTime && (
            <span className="text-xs text-gray-400">{formatStartTime()}</span>
          )}
        </div>

        {hasSignals && (
          <div className="flex items-center gap-1.5 px-2 py-0.5 bg-yellow-500/20 rounded border border-yellow-500/30">
            <AlertCircle className="w-3 h-3 text-yellow-400" />
            <span className="text-xs font-bold text-yellow-400">
              {signals.length}
            </span>
          </div>
        )}
      </div>

      <div className="p-4">
        {/* Teams & Scores */}
        <div className="space-y-3 mb-4">
          {/* 主队 */}
          <div className="flex items-center justify-between">
            <span className="text-white font-bold text-base truncate">
              {homeTeam.name}
            </span>
            <span className="text-3xl font-black text-white ml-2">
              {homeTeam.score}
            </span>
          </div>

          {/* 客队 */}
          <div className="flex items-center justify-between">
            <span className="text-white font-bold text-base truncate">
              {awayTeam.name}
            </span>
            <span className="text-3xl font-black text-white ml-2">
              {awayTeam.score}
            </span>
          </div>
        </div>

        {/* ESPN 胜率曲线图 */}
        {dataCompleteness.hasESPNData &&
          espn.homeWinProb > 0 &&
          espn.awayWinProb > 0 && (
            <div className="mb-3">
              <WinProbChart
                homeTeam={homeTeam}
                awayTeam={awayTeam}
                espn={espn}
              />
            </div>
          )}

        {/* 博彩公司赔率 */}
        {dataCompleteness.hasOddsData && odds && (
          <div className="mb-3">
            <OddsPanel homeTeam={homeTeam} awayTeam={awayTeam} odds={odds} />
          </div>
        )}

        {/* Polymarket 价格 - Bid/Ask 显示 */}
        <div className="mb-3">
          {/* 已结束的比赛不显示价格（因为数据可能陈旧） */}
          {status === "FINAL" ? (
            <div className="bg-gray-500/10 rounded-lg p-2.5 border border-gray-500/20">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-gray-400" />
                <span className="text-xs text-gray-400">
                  比赛已结束，Polymarket 数据不再更新
                </span>
              </div>
            </div>
          ) : dataCompleteness.hasPolyData ? (
            <div className="bg-gradient-to-r from-purple-500/10 to-blue-500/10 rounded-lg p-3 border border-purple-500/20">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-purple-300">
                  Polymarket 交易价格
                </span>
                <span className="text-xs text-gray-400">Bid / Ask</span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* 主队价格 */}
                <div className="space-y-1">
                  <div className="text-xs text-gray-400 text-center font-medium">
                    {homeTeam.name.split(" ").pop()}
                  </div>
                  <div className="bg-black/20 rounded-lg p-2 border border-white/10">
                    <div className="flex justify-between items-center text-xs mb-1">
                      <span className="text-green-400 font-medium">买入</span>
                      <span className="text-red-400 font-medium">卖出</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-green-300 font-bold">
                        {poly.homeBestAsk
                          ? formatPrice(poly.homeBestAsk)
                          : "--"}
                      </span>
                      <span className="text-red-300 font-bold">
                        {poly.homeBestBid
                          ? formatPrice(poly.homeBestBid)
                          : "--"}
                      </span>
                    </div>
                    <div className="text-center mt-1 pt-1 border-t border-white/10">
                      <span className="text-xs text-gray-400">Mid: </span>
                      <span className="text-xs text-white font-medium">
                        {formatPrice(poly.homePrice)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 客队价格 */}
                <div className="space-y-1">
                  <div className="text-xs text-gray-400 text-center font-medium">
                    {awayTeam.name.split(" ").pop()}
                  </div>
                  <div className="bg-black/20 rounded-lg p-2 border border-white/10">
                    <div className="flex justify-between items-center text-xs mb-1">
                      <span className="text-green-400 font-medium">买入</span>
                      <span className="text-red-400 font-medium">卖出</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-green-300 font-bold">
                        {poly.awayBestAsk
                          ? formatPrice(poly.awayBestAsk)
                          : "--"}
                      </span>
                      <span className="text-red-300 font-bold">
                        {poly.awayBestBid
                          ? formatPrice(poly.awayBestBid)
                          : "--"}
                      </span>
                    </div>
                    <div className="text-center mt-1 pt-1 border-t border-white/10">
                      <span className="text-xs text-gray-400">Mid: </span>
                      <span className="text-xs text-white font-medium">
                        {formatPrice(poly.awayPrice)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-orange-500/10 rounded-lg p-2.5 border border-orange-500/20">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-orange-400" />
                <span className="text-xs text-orange-300">
                  暂无 Polymarket 数据
                </span>
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
          <div
            className={`rounded-lg p-3 border-2 ${
              topSignal.type.includes("BUY")
                ? "bg-gradient-to-br from-green-500/20 to-green-600/10 border-green-500/50"
                : "bg-gradient-to-br from-red-500/20 to-red-600/10 border-red-500/50"
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                {topSignal.type.includes("BUY") ? (
                  <TrendingUp className="w-5 h-5 text-green-400" />
                ) : (
                  <TrendingDown className="w-5 h-5 text-red-400" />
                )}
                <span
                  className={`text-sm font-black uppercase ${
                    topSignal.type.includes("BUY")
                      ? "text-green-400"
                      : "text-red-400"
                  }`}
                >
                  {topSignal.type.replace("_", " ")}
                </span>
              </div>
              <div className="flex flex-col items-end">
                <span className="text-xs text-gray-400">置信度</span>
                <span className="text-sm font-bold text-white">
                  {(topSignal.confidence * 100).toFixed(0)}%
                </span>
              </div>
            </div>
            <div className="text-xs text-gray-300 leading-relaxed mb-1">
              {topSignal.reason}
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-400">预期收益</span>
              <span
                className={`font-bold ${
                  topSignal.type.includes("BUY")
                    ? "text-green-400"
                    : "text-red-400"
                }`}
              >
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
            <span
              className={`w-1.5 h-1.5 rounded-full ${dataCompleteness.hasESPNData ? "bg-green-400" : "bg-gray-600"}`}
              title="ESPN"
            />
            <span className="text-gray-500">ESPN</span>
          </div>
          <div className="flex items-center gap-1">
            <span
              className={`w-1.5 h-1.5 rounded-full ${dataCompleteness.hasPolyData ? "bg-green-400" : "bg-gray-600"}`}
              title="Polymarket"
            />
            <span className="text-gray-500">Poly</span>
          </div>
        </div>
        <span className="text-xs text-gray-500">
          更新{" "}
          {new Date(match.lastUpdate).toLocaleTimeString("zh-CN", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      </div>
    </div>
  );
}
