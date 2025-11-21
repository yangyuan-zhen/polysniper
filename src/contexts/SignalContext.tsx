import { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { TradingSignal } from '../services/strategy';

interface SignalContextType {
  allSignals: TradingSignal[];
  topSignal: TradingSignal | null;
  updateSignals: (matchId: string, signals: TradingSignal[]) => void;
}

// 创建提示音
const createBeep = (frequency: number, duration: number, volume: number = 0.3) => {
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();
  
  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);
  
  oscillator.frequency.value = frequency;
  oscillator.type = 'sine';
  
  gainNode.gain.setValueAtTime(volume, audioContext.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);
  
  oscillator.start(audioContext.currentTime);
  oscillator.stop(audioContext.currentTime + duration);
};

const SignalContext = createContext<SignalContextType | undefined>(undefined);

export function SignalProvider({ children }: { children: ReactNode }) {
  const [signalsByMatch, setSignalsByMatch] = useState<Map<string, TradingSignal[]>>(new Map());
  const previousTopSignalRef = useRef<TradingSignal | null>(null);

  const updateSignals = useCallback((matchId: string, signals: TradingSignal[]) => {
    setSignalsByMatch(prev => {
      const next = new Map(prev);
      if (signals.length === 0) {
        next.delete(matchId);
      } else {
        next.set(matchId, signals);
      }
      return next;
    });
  }, []);

  // 计算所有信号
  const allSignals: TradingSignal[] = Array.from(signalsByMatch.values()).flat();

  // 找出最强信号（优先 STRONG_BUY，然后按置信度排序）
  const topSignal = allSignals.length > 0
    ? allSignals.reduce((best, current) => {
        // 优先级：STRONG_BUY > BUY > STRONG_SELL > SELL
        const priority = {
          STRONG_BUY: 4,
          BUY: 3,
          STRONG_SELL: 2,
          SELL: 1,
          NEUTRAL: 0,
        };

        const bestPriority = priority[best.type];
        const currentPriority = priority[current.type];

        if (currentPriority > bestPriority) return current;
        if (currentPriority < bestPriority) return best;

        // 同等优先级，比较置信度
        return current.confidence > best.confidence ? current : best;
      })
    : null;

  // 检测新的强信号并播放提示音
  useEffect(() => {
    if (!topSignal) {
      previousTopSignalRef.current = null;
      return;
    }

    const previous = previousTopSignalRef.current;
    
    // 检查是否是新的强信号
    const isNewStrongSignal = 
      (topSignal.type === 'STRONG_BUY' || topSignal.type === 'STRONG_SELL') &&
      (!previous || 
       previous.matchId !== topSignal.matchId || 
       previous.team !== topSignal.team ||
       previous.type !== topSignal.type);

    if (isNewStrongSignal) {
      // 播放提示音
      try {
        if (topSignal.type === 'STRONG_BUY') {
          // 买入信号：双音（叮叮）
          createBeep(800, 0.15);
          setTimeout(() => createBeep(800, 0.15), 150);
        } else {
          // 卖出信号：单音（叮）
          createBeep(600, 0.2);
        }
        console.log(`🔔 ${topSignal.type === 'STRONG_BUY' ? '强买入' : '强卖出'}信号: ${topSignal.team}`);
      } catch (e) {
        // 静默失败（浏览器可能不支持 AudioContext）
      }
    }

    previousTopSignalRef.current = topSignal;
  }, [topSignal]);

  return (
    <SignalContext.Provider value={{ allSignals, topSignal, updateSignals }}>
      {children}
    </SignalContext.Provider>
  );
}

export function useSignals() {
  const context = useContext(SignalContext);
  if (!context) {
    throw new Error('useSignals must be used within SignalProvider');
  }
  return context;
}
