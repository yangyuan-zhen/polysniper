import { createClient, RedisClientType } from 'redis';
import { config } from '../config';
import { logger } from './logger';

class CacheService {
  private client: RedisClientType | null = null;
  private memoryCache: Map<string, { data: any; expiry: number }> = new Map();
  private useRedis: boolean = false;

  async initialize() {
    if (config.redis.enabled) {
      try {
        this.client = createClient({ url: config.redis.url });
        
        this.client.on('error', (err) => {
          logger.error('Redis 连接错误:', err);
          this.useRedis = false;
        });

        this.client.on('connect', () => {
          logger.info('连接到 Redis');
          this.useRedis = true;
        });

        await this.client.connect();
      } catch (error) {
        logger.error('连接 Redis 失败，退回到内存缓存:', error);
        this.useRedis = false;
      }
    } else {
      logger.info('Redis 已禁用，使用内存缓存');
      this.useRedis = false;
    }

    // 内存缓存清理定时器（每分钟清理过期数据）
    setInterval(() => this.cleanMemoryCache(), 60000);
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      if (this.useRedis && this.client) {
        const data = await this.client.get(key);
        return data ? JSON.parse(data) : null;
      } else {
        // 使用内存缓存
        const cached = this.memoryCache.get(key);
        if (cached && cached.expiry > Date.now()) {
          return cached.data;
        }
        return null;
      }
    } catch (error) {
      logger.error(`缓存获取错误，键为 ${key}:`, error);
      return null;
    }
  }

  async set(key: string, value: any, ttlSeconds?: number): Promise<void> {
    try {
      if (this.useRedis && this.client) {
        const serialized = JSON.stringify(value);
        if (ttlSeconds) {
          await this.client.setEx(key, ttlSeconds, serialized);
        } else {
          await this.client.set(key, serialized);
        }
      } else {
        // 使用内存缓存
        const expiry = ttlSeconds 
          ? Date.now() + ttlSeconds * 1000 
          : Date.now() + 3600000; // 默认1小时
        this.memoryCache.set(key, { data: value, expiry });
      }
    } catch (error) {
      logger.error(`缓存设置错误，键为 ${key}:`, error);
    }
  }

  async del(key: string): Promise<void> {
    try {
      if (this.useRedis && this.client) {
        await this.client.del(key);
      } else {
        this.memoryCache.delete(key);
      }
    } catch (error) {
      logger.error(`缓存删除错误，键为 ${key}:`, error);
    }
  }

  async clear(): Promise<void> {
    try {
      if (this.useRedis && this.client) {
        await this.client.flushAll();
      } else {
        this.memoryCache.clear();
      }
      logger.info('缓存已清除');
    } catch (error) {
      logger.error('缓存清除错误:', error);
    }
  }

  private cleanMemoryCache(): void {
    const now = Date.now();
    for (const [key, value] of this.memoryCache.entries()) {
      if (value.expiry <= now) {
        this.memoryCache.delete(key);
      }
    }
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      logger.info('Redis 客户端已断开连接');
    }
  }
}

export const cache = new CacheService();
