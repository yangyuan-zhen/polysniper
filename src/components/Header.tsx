import { Clock, Activity } from 'lucide-react';
import { useState, useEffect } from 'react';

export function Header() {
  const [currentTime, setCurrentTime] = useState(new Date().toLocaleTimeString('zh-CN', { hour12: false }));

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString('zh-CN', { hour12: false }));
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  return (
    <header className="flex items-center justify-between py-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shadow-lg shadow-blue-500/20">
          <Activity className="text-white w-6 h-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight leading-none">Poly<span className="text-blue-500">Sniper</span></h1>
          <p className="text-xs text-gray-500 font-medium tracking-wider">套利监控系统</p>
        </div>
      </div>

      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2 text-gray-400 text-sm font-medium">
          <Clock className="w-4 h-4" />
          <span>实时更新: <span className="text-gray-200 font-mono">{currentTime}</span></span>
        </div>
        <div className="px-3 py-1 rounded-full bg-green-500/10 border border-green-500/20 flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-xs font-bold text-green-500 tracking-wide">实时数据</span>
        </div>
      </div>
    </header>
  );
}
