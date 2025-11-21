/**
 * 请求节流器 - 防止过多并发请求
 */

interface QueuedRequest<T> {
  key: string;
  execute: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (error: any) => void;
}

class RequestThrottler {
  private queue: QueuedRequest<any>[] = [];
  private processing = false;
  private activeRequests = 0;
  private readonly maxConcurrent: number;
  private readonly delayBetweenBatches: number;
  private pendingRequests = new Map<string, Promise<any>>();

  constructor(maxConcurrent = 3, delayMs = 300) {
    this.maxConcurrent = maxConcurrent;
    this.delayBetweenBatches = delayMs;
  }

  /**
   * 队列化请求 - 防止重复请求和过载
   */
  async request<T>(key: string, execute: () => Promise<T>): Promise<T> {
    // 检查是否已有相同的pending请求
    if (this.pendingRequests.has(key)) {
      console.log(`[节流] 复用请求: ${key}`);
      return this.pendingRequests.get(key)!;
    }

    const promise = new Promise<T>((resolve, reject) => {
      this.queue.push({ key, execute, resolve, reject });
      this.processQueue();
    });

    this.pendingRequests.set(key, promise);
    
    // 请求完成后清理
    promise.finally(() => {
      this.pendingRequests.delete(key);
    });

    return promise;
  }

  private async processQueue() {
    if (this.processing) return;
    this.processing = true;

    while (this.queue.length > 0) {
      // 等待直到有空槽
      while (this.activeRequests >= this.maxConcurrent) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      // 取出下一批请求
      const batchSize = Math.min(
        this.maxConcurrent - this.activeRequests,
        this.queue.length
      );

      const batch = this.queue.splice(0, batchSize);

      // 并行执行批次
      batch.forEach(async (req) => {
        this.activeRequests++;
        try {
          const result = await req.execute();
          req.resolve(result);
        } catch (error) {
          req.reject(error);
        } finally {
          this.activeRequests--;
        }
      });

      // 批次间延迟
      if (this.queue.length > 0) {
        await new Promise(resolve => setTimeout(resolve, this.delayBetweenBatches));
      }
    }

    this.processing = false;
  }

  /**
   * 获取队列状态
   */
  getStats() {
    return {
      queued: this.queue.length,
      active: this.activeRequests,
      pending: this.pendingRequests.size,
    };
  }
}

// 全局实例
export const polymarketThrottler = new RequestThrottler(
  3,   // 最多3个并发
  300  // 批次间延迟300ms
);
