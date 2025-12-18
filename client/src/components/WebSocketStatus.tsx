/**
 * WebSocket 连接状态指示器
 */
import { useState, useEffect } from 'react';
import { polymarketWS } from '../services/polymarketWebSocket';
import { Activity, WifiOff, Wifi, AlertCircle } from 'lucide-react';

export function WebSocketStatus() {
  const [state, setState] = useState(polymarketWS.getConnectionState());
  const [stats, setStats] = useState(polymarketWS.getStats());

  useEffect(() => {
    // 监听状态变化
    const unsubscribe = polymarketWS.onStateChange((newState) => {
      setState(newState);
    });

    // 定期更新统计信息
    const interval = setInterval(() => {
      setStats(polymarketWS.getStats());
    }, 2000);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, []);

  const getStatusColor = () => {
    switch (state) {
      case 'connected':
        return 'text-green-500';
      case 'connecting':
        return 'text-yellow-500';
      case 'disconnected':
        return 'text-gray-500';
      case 'error':
        return 'text-red-500';
      default:
        return 'text-gray-500';
    }
  };

  const getStatusIcon = () => {
    switch (state) {
      case 'connected':
        return <Wifi className="w-4 h-4" />;
      case 'connecting':
        return <Activity className="w-4 h-4 animate-pulse" />;
      case 'disconnected':
        return <WifiOff className="w-4 h-4" />;
      case 'error':
        return <AlertCircle className="w-4 h-4" />;
      default:
        return <WifiOff className="w-4 h-4" />;
    }
  };

  const getStatusText = () => {
    switch (state) {
      case 'connected':
        return 'WebSocket 已连接';
      case 'connecting':
        return 'WebSocket 连接中...';
      case 'disconnected':
        return 'WebSocket 未连接';
      case 'error':
        return 'WebSocket 错误';
      default:
        return 'WebSocket 未知';
    }
  };

  return (
    <div className="flex items-center gap-2 text-sm">
      <div className={`flex items-center gap-1 ${getStatusColor()}`}>
        {getStatusIcon()}
        <span>{getStatusText()}</span>
      </div>
      
      {stats.subscriptions > 0 && (
        <span className="text-gray-400">
          ({stats.subscriptions} 订阅)
        </span>
      )}
      
      {state === 'connected' && stats.reconnectAttempts > 0 && (
        <span className="text-yellow-500 text-xs">
          (重连 {stats.reconnectAttempts} 次)
        </span>
      )}
    </div>
  );
}
