import dotenv from 'dotenv';

dotenv.config();

export const config = {
  // 服务配置
  port: parseInt(process.env.PORT || '3000', 10), // 恢复原始端口
  nodeEnv: process.env.NODE_ENV || 'development',
  
  // Polymarket API
  polymarket: {
    // Gamma Markets API - 用于获取市场数据（公开，无需认证）
    gammaApiUrl: process.env.POLYMARKET_GAMMA_API_URL || 'https://gamma-api.polymarket.com',
    // CLOB API - 用于交易（需要认证，目前不使用）
    clobApiUrl: process.env.POLYMARKET_CLOB_API_URL || 'https://clob.polymarket.com',
    // WebSocket - 实时价格推送（CLOB 订单簿）
    wsUrl: process.env.POLYMARKET_WS_URL || 'wss://ws-subscriptions-clob.polymarket.com/ws/market',
    // WebSocket 启用开关
    wsEnabled: true, // 启用 WebSocket 连接获取实时价格
    // WebSocket 代理设置（从环境变量读取，默认不使用代理）
    wsProxy: process.env.POLYMARKET_WS_PROXY || 'none',
    // API Key - 仅交易时需要
    apiKey: process.env.POLYMARKET_API_KEY || '',
  },
  
  // ESPN API
  espn: {
    apiUrl: 'http://site.api.espn.com/apis/site/v2/sports/basketball/nba',
    updateInterval: 10000, // 10秒更新一次
  },
  
  // Redis配置
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    enabled: process.env.REDIS_ENABLED === 'true',
  },
  
  // CORS配置
  cors: {
    origin: process.env.CORS_ORIGIN || ['http://localhost:5173', 'http://127.0.0.1:5173'],
    credentials: true,
  },
  
  // 缓存配置（秒）
  cache: {
    ttl: {
      live: parseInt(process.env.CACHE_TTL_LIVE || '45', 10),
      upcoming: parseInt(process.env.CACHE_TTL_UPCOMING || '120', 10),
      ended: parseInt(process.env.CACHE_TTL_ENDED || '86400', 10),
    },
  },
  
  // 限流配置
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10),
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
  },
  
  // 日志配置
  log: {
    level: process.env.LOG_LEVEL || 'info',
  },
};
