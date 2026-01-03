// =============================================================================
// 后端专用类型定义
// =============================================================================
// 这个文件引用共享类型，并添加后端特有的类型定义

// 导入所有共享类型
export * from '@shared/types';

// =============================================================================
// 后端特有类型（不与前端共享）
// =============================================================================

/** 服务器配置 */
export interface ServerConfig {
  port: number;
  host: string;
  cors: {
    origin: string[];
    credentials: boolean;
  };
  rateLimit: {
    windowMs: number;
    max: number;
  };
}

/** ESPN API 响应的原始数据结构 */
export interface ESPNRawResponse {
  events: Array<{
    id: string;
    name: string;
    shortName: string;
    date: string;
    competitions: Array<{
      id: string;
      competitors: Array<{
        id: string;
        team: {
          id: string;
          name: string;
          displayName: string;
          abbreviation: string;
          logo: string;
        };
        score: number;
        homeAway: 'home' | 'away';
      }>;
      status: {
        type: {
          id: string;
          name: string;
          state: string;
          completed: boolean;
          description: string;
          detail: string;
          shortDetail: string;
        };
        period: number;
        clock: number;
        displayClock: string;
      };
      odds?: Array<{
        provider: {
          name: string;
          priority: number;
        };
        details: Array<{
          odds: number;
          type: string;
        }>;
      }>;
    }>;
  }>;
}

/** Polymarket Gamma API 原始响应 */
export interface PolymarketRawResponse {
  events: Array<{
    id: string;
    title: string;
    description: string;
    start_date: string;
    end_date?: string;
    active: boolean;
    closed: boolean;
    liquidity: number;
    volume: number;
    outcome_tokens: Array<{
      outcome: string;
      price: number;
      token_id: string;
      shares: number;
      volume: number;
    }>;
  }>;
}

/** 数据源状态 */
export interface DataSourceStatus {
  espn: {
    connected: boolean;
    lastUpdate: number;
    error?: string;
  };
  polymarket: {
    connected: boolean;
    lastUpdate: number;
    error?: string;
  };
}

/** 服务器健康状态 */
export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: number;
  uptime: number;
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  dataSources: DataSourceStatus;
  activeConnections: number;
}

/** 统计信息 */
export interface ServerStats {
  totalMatches: number;
  liveMatches: number;
  matchesWithSignals: number;
  totalSignals: number;
  avgConfidence: string;
  dataCompleteness: {
    withPolyData: number;
    withESPNData: number;
  };
}

/** 缓存统计 */
export interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
  keys: number;
  memoryUsage: number;
}

/** 日志级别 */
export enum LogLevel {
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  DEBUG = 'debug',
}

/** 日志条目 */
export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: number;
  context?: any;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

/** 环境变量配置 */
export interface EnvConfig {
  NODE_ENV: 'development' | 'production' | 'test';
  PORT: number;
  ESPN_API_URL: string;
  POLYMARKET_API_URL: string;
  REDIS_URL?: string;
  REDIS_HOST?: string;
  REDIS_PORT?: number;
  LOG_LEVEL: LogLevel;
  CORS_ORIGIN: string[];
  RATE_LIMIT_WINDOW_MS: number;
  RATE_LIMIT_MAX_REQUESTS: number;
}

// =============================================================================
// 类型守卫和工具函数
// =============================================================================

/** 检查是否为有效的环境变量配置 */
export function isValidEnvConfig(config: Partial<EnvConfig>): config is EnvConfig {
  return (
    typeof config.NODE_ENV === 'string' &&
    typeof config.PORT === 'number' &&
    typeof config.ESPN_API_URL === 'string' &&
    typeof config.POLYMARKET_API_URL === 'string' &&
    typeof config.LOG_LEVEL === 'string'
  );
}

/** 创建默认的服务器配置 */
export function createDefaultServerConfig(): ServerConfig {
  return {
    port: 3000,
    host: '0.0.0.0',
    cors: {
      origin: ['http://localhost:5173', 'http://localhost:3000'],
      credentials: true,
    },
    rateLimit: {
      windowMs: 15 * 60 * 1000, // 15 分钟
      max: 100, // 限制每个 IP 100 次请求
    },
  };
}

/** 格式化内存大小 */
export function formatMemorySize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  
  return `${size.toFixed(2)} ${units[unitIndex]}`;
}

/** 计算运行时间 */
export function formatUptime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  if (hours > 0) {
    return `${hours}h ${minutes}m ${secs}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  } else {
    return `${secs}s`;
  }
}
