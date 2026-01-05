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
                <span>套利策略机制 - EV+</span>
              </h4>
              
              <div className="space-y-3 text-xs">
                {/* 核心理念 */}
                <div className="bg-gradient-to-br from-purple-500/20 to-blue-500/10 border-2 border-purple-500/40 rounded-lg p-3">
                  <div className="font-semibold text-purple-300 mb-2 flex items-center gap-2">
                    <span>💎</span>
                    <span>核心理念：赚"情绪溢价"</span>
                  </div>
                  <div className="space-y-1.5 text-gray-300 leading-relaxed">
                    <p className="text-yellow-300 font-semibold">我们赚的是散户对早期比分波动的过度反应</p>
                    <div className="bg-black/30 rounded p-2 space-y-1">
                      <p className="text-xs text-gray-400">场景：Q1，强队落后 10 分</p>
                      <p className="text-red-300">😱 散户："完了，今天输定了！" → 恐慌抛售</p>
                      <p className="text-blue-300">🤖 ESPN："只是方差，翻盘概率 65%" → 胜率坚挺</p>
                      <p className="text-green-300">💰 套利空间：真实价值 65¢，市场只要 40¢</p>
                    </div>
                  </div>
                </div>

                {/* EV+决策模型 */}
                <div className="bg-yellow-500/10 border-2 border-yellow-500/30 rounded-lg p-3">
                  <div className="font-semibold text-yellow-400 mb-2 flex items-center gap-2">
                    <span>🧮</span>
                    <span>EV+ 决策模型（做一道减法题）</span>
                  </div>
                  <div className="space-y-2 text-gray-300">
                    <div className="bg-black/30 rounded p-2">
                      <p className="text-center text-lg text-white font-mono">
                        利润空间 = <span className="text-blue-400">ESPN胜率</span> - <span className="text-purple-400">市场价格</span>
                      </p>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-yellow-500">•</span>
                      <span>如果 <span className="font-semibold text-yellow-300">利润空间 {'>'} 10%</span>，说明市场犯错了</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-yellow-500">•</span>
                      <span>例：ESPN 65% vs Ask 45¢ → 利润空间 20% ✅</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-yellow-500">•</span>
                      <span className="text-xs text-gray-400">（使用 Ask 卖价购买，模拟真实交易成本）</span>
                    </div>
                    <div className="mt-2 pt-2 border-t border-yellow-500/20 text-gray-400">
                      <span className="font-semibold text-yellow-400">触发条件：</span>比赛 LIVE 状态 + Q1-Q3 节次
                    </div>
                  </div>
                </div>

                {/* 铁律：只做前三节 */}
                <div className="bg-red-500/10 border-2 border-red-500/30 rounded-lg p-3">
                  <div className="font-semibold text-red-400 mb-2 flex items-center gap-2">
                    <span>⛔</span>
                    <span>铁律：只做前三节（Q1-Q3）</span>
                  </div>
                  <div className="space-y-2 text-gray-300">
                    <div className="flex items-start gap-2">
                      <span className="text-green-500">✓</span>
                      <span><span className="font-semibold text-green-400">前三节（投资逻辑）：</span>时间还长，数学模型准确度高</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-red-500">✗</span>
                      <span><span className="font-semibold text-red-400">第四节（赌博逻辑）：</span>一个神仙球决定生死，模型失效</span>
                    </div>
                    <div className="mt-2 pt-2 border-t border-red-500/20 text-gray-400">
                      <span className="font-semibold text-red-400">原理：</span>时间是我们最大的盟友。只在"时间充裕"时进场
                    </div>
                  </div>
                </div>

                {/* 时间就是金钱 */}
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
                  <div className="font-semibold text-blue-400 mb-2 flex items-center gap-2">
                    <span>⏰</span>
                    <span>时间就是金钱</span>
                  </div>
                  <div className="space-y-1.5 text-gray-300">
                    <div className="flex items-start gap-2">
                      <span className="text-blue-500">•</span>
                      <span><span className="font-semibold">Q1（最佳）：</span>36 分钟反转时间，置信度 +10%</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-blue-500">•</span>
                      <span><span className="font-semibold">Q2（良好）：</span>24 分钟反转时间，置信度 +5%</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-blue-500">•</span>
                      <span><span className="font-semibold">Q3（可接受）：</span>12 分钟反转时间，原始置信度</span>
                    </div>
                  </div>
                </div>

                {/* 实战案例 */}
                <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3">
                  <div className="font-semibold text-green-400 mb-2">📈 实战案例</div>
                  <div className="bg-black/30 rounded p-2 space-y-2 text-xs text-gray-300">
                    <p><span className="text-green-400">●</span> Q1 03:45，凯尔特人 vs 黄蜂</p>
                    <p><span className="text-red-400">●</span> 凯尔特人暂时落后 8 分</p>
                    <p><span className="text-blue-400">●</span> ESPN胜率：72%</p>
                    <p><span className="text-purple-400">●</span> 市场价格：58¢</p>
                    <p className="text-yellow-300 font-semibold">→ 利润空间：14% ✅ 满足条件！</p>
                    <p className="text-green-300">→ 操作：买入凯尔特人 @58¢</p>
                    <p className="text-gray-400">→ 逻辑：强队手感冰凉只是暂时的，时间充裕必然回暖</p>
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
