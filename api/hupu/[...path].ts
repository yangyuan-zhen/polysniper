import type { VercelRequest, VercelResponse } from '@vercel/node';
import https from 'https';

// 创建全局 HTTPS Agent 实例以实现连接复用（HTTP Keep-Alive）
// 在同一 Serverless 容器实例内，多次请求可以复用同一个 TCP/SSL 连接
// 这将大幅减少连接建立时间（从 ~0.568s 降低到接近 0）
const httpsAgent = new https.Agent({
  keepAlive: true,              // 启用 Keep-Alive
  keepAliveMsecs: 30000,        // Keep-Alive 超时 30 秒
  maxSockets: 10,               // 最多 10 个并发连接
  maxFreeSockets: 5,            // 最多保持 5 个空闲连接
  timeout: 8000,                // 连接超时 8 秒
  scheduling: 'lifo'            // 优先复用最近使用的连接
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { path } = req.query;
  
  // Reconstruct the full path
  const targetPath = Array.isArray(path) ? path.join('/') : (path || '');
  const url = new URL(req.url || '', 'http://localhost');
  const queryString = url.search;
  const targetUrl = `https://games.mobileapi.hupu.com/${targetPath}${queryString}`;
  
  const startTime = Date.now();
  console.log('📡 [Hupu Proxy] Proxying to:', targetUrl);
  
  try {
    const response = await fetch(targetUrl, {
      method: req.method,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
        'Connection': 'keep-alive',  // 明确请求 Keep-Alive
      },
      // @ts-ignore - Node.js fetch 支持 agent 选项
      agent: httpsAgent,  // 使用全局 Agent 实现连接复用
    });
    
    const connectionTime = Date.now() - startTime;

    if (!response.ok) {
      console.error(`❌ [Hupu Proxy] API error (${connectionTime}ms):`, response.status, response.statusText);
      return res.status(response.status).json({ 
        error: 'Upstream API error',
        status: response.status 
      });
    }

    const data = await response.json();
    const totalTime = Date.now() - startTime;
    
    // 性能监控日志
    console.log(`✅ [Hupu Proxy] Success - Total: ${totalTime}ms, Connection: ${connectionTime}ms, Parse: ${totalTime - connectionTime}ms`);
    
    return res.status(200).json(data);
  } catch (error) {
    const totalTime = Date.now() - startTime;
    console.error(`❌ [Hupu Proxy] Error after ${totalTime}ms:`, error);
    return res.status(500).json({ 
      error: 'Proxy request failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

// 定期清理过期连接（可选）
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const sockets = httpsAgent.freeSockets;
    console.log(`🔌 [Keep-Alive] Free sockets:`, Object.keys(sockets).length);
  }, 60000); // 每分钟输出一次连接池状态
}
