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
              <h3 className="text-lg font-bold text-white">策略说明</h3>
            </div>
            <ChevronLeft 
              className="w-5 h-5 text-gray-400 transition-transform duration-200"
            />
          </div>
          <div className="space-y-4 mt-4">
            
            {/* 核心策略 */}
            <div className="bg-gradient-to-br from-purple-500/20 to-blue-500/10 border-2 border-purple-500/40 rounded-lg p-4">
              <div className="font-semibold text-purple-300 mb-3 flex items-center gap-2">
                <span>🎯</span>
                <span>ESPN 胜率 vs Polymarket 价格</span>
              </div>
              <div className="space-y-2 text-sm text-gray-300">
                <div className="bg-black/30 rounded p-3">
                  <p className="text-center text-base text-white font-mono mb-2">
                    套利边际 = <span className="text-blue-400">ESPN 胜率</span> - <span className="text-purple-400">Poly 价格</span>
                  </p>
                  <p className="text-center text-yellow-300 text-sm">
                    当边际 ≥ <span className="font-bold">5%</span> 时触发买入
                  </p>
                </div>
                <div className="space-y-1.5 text-xs">
                  <p>• <span className="text-green-400">只在比赛进行中</span> (LIVE) 触发</p>
                  <p>• <span className="text-blue-400">单边买入</span>：只买有优势的那一边</p>
                  <p>• <span className="text-yellow-300">每笔投入</span>：账户余额的 10%</p>
                </div>
              </div>
            </div>

            {/* 实战示例 */}
            <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
              <div className="font-semibold text-green-400 mb-2 flex items-center gap-2">
                <span>📈</span>
                <span>实战示例</span>
              </div>
              <div className="bg-black/30 rounded p-3 space-y-2 text-sm text-gray-300">
                <p><span className="text-blue-400">●</span> ESPN 预测凯尔特人胜率：<span className="text-blue-300 font-bold">62%</span></p>
                <p><span className="text-purple-400">●</span> Polymarket 凯尔特人价格：<span className="text-purple-300 font-bold">$0.54</span></p>
                <p className="text-yellow-300 font-semibold">→ 边际：62% - 54% = 8% ≥ 5% ✅</p>
                <p className="text-green-300">→ 买入凯尔特人 @$0.54</p>
              </div>
            </div>

            {/* 核心逻辑 */}
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
              <div className="font-semibold text-yellow-400 mb-2 flex items-center gap-2">
                <span>💡</span>
                <span>为什么有效？</span>
              </div>
              <div className="space-y-2 text-sm text-gray-300">
                <p>ESPN 使用专业算法实时计算胜率，考虑了：</p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-black/30 rounded p-2">📊 实时比分</div>
                  <div className="bg-black/30 rounded p-2">⏱️ 剩余时间</div>
                  <div className="bg-black/30 rounded p-2">📈 球队实力</div>
                  <div className="bg-black/30 rounded p-2">🏠 主场优势</div>
                </div>
                <p className="text-yellow-200 text-xs mt-2">
                  而 Polymarket 价格由散户情绪驱动，容易对短期波动过度反应
                </p>
              </div>
            </div>

            {/* 信号颜色 */}
            <div className="border-t border-white/10 pt-4">
              <h4 className="text-sm font-semibold text-gray-400 mb-3">⭐ 界面说明</h4>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-3">
                  <div className="w-16 h-8 border-2 border-purple-500/50 bg-purple-500/10 rounded animate-pulse"></div>
                  <span className="text-gray-300">有套利信号的比赛</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-yellow-400 font-bold px-2">雷霆</span>
                  <span className="text-gray-300">该队为买入目标</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-3 bg-gray-800 rounded-full overflow-hidden flex max-w-[120px]">
                    <div className="bg-gradient-to-r from-blue-500 to-blue-400 w-[40%]"></div>
                    <div className="bg-gradient-to-r from-red-400 to-red-500 w-[60%]"></div>
                  </div>
                  <span className="text-gray-300">ESPN 胜率进度条</span>
                </div>
              </div>
            </div>

            {/* 离场策略 */}
            <div className="border-t border-white/10 pt-4">
              <h4 className="text-sm font-semibold text-gray-400 mb-3">🚪 离场策略</h4>
              <div className="space-y-2 text-xs text-gray-300">
                <div className="flex items-center gap-2">
                  <span className="text-green-400">💰</span>
                  <span>获利了结：盈利 ≥25% 时自动平仓</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-yellow-400">📉</span>
                  <span>逻辑证伪：市场价 ≥ ESPN 胜率时平仓</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-red-400">🛑</span>
                  <span>硬止损：价格 ≤$0.15 或亏损 ≥50% 时平仓</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-blue-400">🏁</span>
                  <span>比赛结束时自动平仓</span>
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
              策略说明
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
