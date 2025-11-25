/**
 * 全局请求队列服务
 * 限制并发请求数量，避免浏览器/代理服务器过载
 */

type QueuedRequest<T> = {
  fn: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (error: any) => void;
};

class RequestQueue {
  private queue: QueuedRequest<any>[] = [];
  private activeRequests = 0;
  private maxConcurrent = 3; // 最多3个并发请求
  private requestDelay = 200; // 每个请求之间延迟200ms

  /**
   * 将请求加入队列
   */
  async enqueue<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push({ fn, resolve, reject });
      this.processQueue();
    });
  }

  /**
   * 处理队列中的请求
   */
  private async processQueue() {
    if (this.activeRequests >= this.maxConcurrent || this.queue.length === 0) {
      return;
    }

    const request = this.queue.shift();
    if (!request) return;

    this.activeRequests++;

    try {
      // 添加延迟，避免请求过于密集
      await new Promise(resolve => setTimeout(resolve, this.requestDelay));
      
      const result = await request.fn();
      request.resolve(result);
    } catch (error) {
      request.reject(error);
    } finally {
      this.activeRequests--;
      this.processQueue(); // 处理下一个请求
    }
  }

  /**
   * 获取队列状态
   */
  getStatus() {
    return {
      queueLength: this.queue.length,
      activeRequests: this.activeRequests,
      maxConcurrent: this.maxConcurrent
    };
  }

  /**
   * 设置最大并发数
   */
  setMaxConcurrent(max: number) {
    this.maxConcurrent = max;
  }
}

// 全局单例
export const requestQueue = new RequestQueue();

/**
 * 包装fetch请求，自动加入队列
 */
export async function queuedFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  return requestQueue.enqueue(() => fetch(input, init));
}
