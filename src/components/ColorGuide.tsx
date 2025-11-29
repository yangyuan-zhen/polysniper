import { Info, ChevronLeft, ChevronRight } from 'lucide-react';

interface ColorGuideProps {
  isExpanded: boolean;
  onToggle: () => void;
}

export function ColorGuide({ isExpanded, onToggle }: ColorGuideProps) {

  return (
    <div className="bg-surface rounded-2xl border border-white/5 transition-all duration-300 h-full">
      {isExpanded ? (
        <div className="p-6">
          <div 
            className="flex items-center justify-between cursor-pointer hover:opacity-80 transition-opacity"
            onClick={onToggle}
          >
            <div className="flex items-center gap-2">
              <Info className="w-5 h-5 text-purple-400" />
              <h3 className="text-lg font-bold text-white">颜色含义说明</h3>
            </div>
            <ChevronLeft 
              className="w-5 h-5 text-gray-400 transition-transform duration-200"
            />
          </div>
          <div className="space-y-4 mt-4">
            {/* 价格颜色 */}
            <div>
              <h4 className="text-sm font-semibold text-gray-400 mb-2">💰 价格颜色</h4>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-3">
                  <div className="w-16 h-8 bg-red-500/20 border border-red-500/30 rounded flex items-center justify-center">
                    <span className="text-red-400 font-bold">65¢+</span>
                  </div>
                  <span className="text-gray-300">高价 - 市场认为该队大概率赢</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-16 h-8 bg-green-500/20 border border-green-500/30 rounded flex items-center justify-center">
                    <span className="text-green-400 font-bold">≤45¢</span>
                  </div>
                  <span className="text-gray-300">低价 - 市场认为该队大概率输</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-16 h-8 bg-gray-500/20 border border-gray-500/30 rounded flex items-center justify-center">
                    <span className="text-gray-400 font-bold">中间</span>
                  </div>
                  <span className="text-gray-300">中性 - 双方势均力敌</span>
                </div>
              </div>
            </div>

            {/* 卡片边框 */}
            <div>
              <h4 className="text-sm font-semibold text-gray-400 mb-2">🎴 卡片边框</h4>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-3">
                  <div className="w-16 h-8 border-2 border-green-500/30 bg-green-500/5 rounded"></div>
                  <span className="text-gray-300">主队价格 ≥60¢</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-16 h-8 border-2 border-red-500/30 bg-red-500/5 rounded"></div>
                  <span className="text-gray-300">主队价格 ≤40¢</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-16 h-8 border-2 border-white/5 bg-surface rounded"></div>
                  <span className="text-gray-300">主队价格 40-60¢</span>
                </div>
              </div>
            </div>

            {/* 呼吸灯 */}
            <div>
              <h4 className="text-sm font-semibold text-gray-400 mb-2">✨ 呼吸灯效果</h4>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-3">
                  <div className="w-16 h-8 border-2 border-purple-500/50 bg-purple-500/10 rounded animate-pulse-slow"></div>
                  <span className="text-gray-300">有交易信号的比赛</span>
                </div>
              </div>
            </div>

            {/* 信号球队 */}
            <div>
              <h4 className="text-sm font-semibold text-gray-400 mb-2">⭐ 球队名高亮</h4>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-3">
                  <span className="text-yellow-400 font-bold">雷霆</span>
                  <span className="text-gray-300">该队有交易信号</span>
                </div>
              </div>
            </div>

            {/* ESPN胜率预测 */}
            <div>
              <h4 className="text-sm font-semibold text-gray-400 mb-2">📊 ESPN胜率预测</h4>
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex-1 h-3 bg-gray-800 rounded-full overflow-hidden flex">
                    <div className="bg-gradient-to-r from-blue-500 to-blue-400 w-[38%]"></div>
                    <div className="bg-gradient-to-r from-red-400 to-red-500 w-[62%]"></div>
                  </div>
                </div>
                <div className="text-xs text-gray-300 space-y-1">
                  <p>• 显示 ESPN 实时预测的两队胜率</p>
                  <p>• 蓝色：客队（左） | 红色：主队（右）</p>
                  <p>• 每 30 秒自动更新</p>
                </div>
              </div>
            </div>

            {/* 套利策略 */}
            <div className="mt-4 pt-4 border-t border-white/5">
              <h4 className="text-sm font-semibold text-purple-400 mb-3 flex items-center gap-2">
                <span>🎯</span>
                <span>套利策略机制</span>
              </h4>
              
              <div className="space-y-3 text-xs">
                {/* 价格错配套利 */}
                <div className="bg-yellow-500/10 border-2 border-yellow-500/30 rounded-lg p-3">
                  <div className="font-semibold text-yellow-400 mb-2 flex items-center gap-2">
                    <span>⚡</span>
                    <span>价格错配套利（新！）</span>
                  </div>
                  <div className="space-y-1.5 text-gray-300">
                    <div className="flex items-start gap-2">
                      <span className="text-yellow-500">•</span>
                      <span><span className="font-semibold">ESPN 胜率</span>远高于市场价格（偏差≥12%）</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-yellow-500">•</span>
                      <span>例：ESPN 65% vs 市场 45¢ → 偏差+20%</span>
                    </div>
                    <div className="mt-2 pt-2 border-t border-yellow-500/20 text-gray-400">
                      <span className="font-semibold text-yellow-400">逻辑：</span>市场价格未反映ESPN预测，存在套利机会。
                    </div>
                  </div>
                </div>

                {/* 买入信号 */}
                <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3">
                  <div className="font-semibold text-green-400 mb-2 flex items-center gap-2">
                    <span>🟢</span>
                    <span>买入信号（黄金进场点）</span>
                  </div>
                  <div className="space-y-1.5 text-gray-300">
                    <div className="flex items-start gap-2">
                      <span className="text-green-500">•</span>
                      <span><span className="font-semibold">价格区间：</span>35¢ - 45¢（被低估）</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-green-500">•</span>
                      <span><span className="font-semibold">比分状态：</span>落后 1-6 分（小分差）</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-green-500">•</span>
                      <span><span className="font-semibold">时间窗口：</span>第1-3节（还有时间）</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-green-500">•</span>
                      <span><span className="font-semibold">ESPN 支持：</span>胜率预测支持买入（加分）</span>
                    </div>
                    <div className="mt-2 pt-2 border-t border-green-500/20 text-gray-400">
                      <span className="font-semibold text-green-400">逻辑：</span>暂时落后导致价格下跌，但分差不大，比赛还有时间，ESPN预测支持，价格大概率反弹。
                    </div>
                  </div>
                </div>

                {/* 卖出信号 */}
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                  <div className="font-semibold text-red-400 mb-2 flex items-center gap-2">
                    <span>🔴</span>
                    <span>卖出信号（止盈）</span>
                  </div>
                  <div className="space-y-1.5 text-gray-300">
                    <div className="flex items-start gap-2">
                      <span className="text-red-500">•</span>
                      <span><span className="font-semibold">价格区间：</span>≥ 65¢（高估）</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-red-500">•</span>
                      <span><span className="font-semibold">比分状态：</span>大幅领先</span>
                    </div>
                    <div className="mt-2 pt-2 border-t border-red-500/20 text-gray-400">
                      <span className="font-semibold text-red-400">逻辑：</span>大幅领先导致价格过高，此时止盈锁定利润。
                    </div>
                  </div>
                </div>

                {/* 核心原理 */}
                <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-3">
                  <div className="font-semibold text-purple-400 mb-2">💡 核心原理</div>
                  <p className="text-gray-300 leading-relaxed">
                    利用<span className="text-purple-400 font-semibold">比分波动</span>导致的<span className="text-purple-400 font-semibold">价格波动</span>，
                    在低价买入，高价卖出。NBA比赛节奏快，比分经常反转，价格会在35¢-75¢之间波动，创造套利空间。
                  </p>
                </div>

                {/* 球队实力过滤 */}
                <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-3">
                  <div className="font-semibold text-orange-400 mb-2 flex items-center gap-2">
                    <span>⚠️</span>
                    <span>球队实力过滤</span>
                  </div>
                  <div className="space-y-2 text-gray-300 text-xs leading-relaxed">
                    <p>
                      <span className="font-semibold text-yellow-400">虽然策略只看【价格】和【分差】，但球队实力是盈利的关键！</span>
                    </p>
                    <div className="space-y-1.5 pl-3 border-l-2 border-yellow-500/30">
                      <div className="flex items-start gap-2">
                        <span className="text-yellow-500">✓</span>
                        <span><span className="font-semibold text-green-400">好信号：</span>强队暂时落后（有翻盘能力）</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="text-red-500">✗</span>
                        <span><span className="font-semibold text-red-400">差信号：</span>弱队暂时落后（很难翻盘）</span>
                      </div>
                    </div>
                    <p className="pt-2 border-t border-orange-500/20 text-gray-400">
                      <span className="font-semibold text-orange-400">建议：</span>
                      优先选择<span className="text-green-400">勇士、凯尔特人、雷霆</span>等强队的信号，
                      避开<span className="text-red-400">黄蜂、奇才、步行者</span>等弱队。
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div 
          className="flex flex-col items-center justify-center py-8 px-2 cursor-pointer hover:bg-white/5 transition-all h-full"
          onClick={onToggle}
        >
          <ChevronRight className="w-5 h-5 text-purple-400 mb-3" />
          <div className="flex flex-col items-center gap-2">
            <Info className="w-6 h-6 text-purple-400" />
            <div className="writing-mode-vertical text-sm font-bold text-white whitespace-nowrap">
              颜色说明
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
