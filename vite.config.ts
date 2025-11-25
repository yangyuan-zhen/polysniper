import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import tailwindcss from '@tailwindcss/vite'
import { HttpsProxyAgent } from 'https-proxy-agent'

// Clash 代理配置
const proxyUrl = 'http://127.0.0.1:7890'
const agent = new HttpsProxyAgent(proxyUrl)

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api/hupu': {
        target: 'https://games.mobileapi.hupu.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/hupu/, ''),
      },
      '/api/polymarket': {
        target: 'https://gamma-api.polymarket.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/polymarket/, ''),
        agent: agent,
        configure: (proxy) => {
          proxy.on('error', (err) => {
            console.log('Polymarket proxy error:', err.message);
          });
        },
      },
      '/api/clob': {
        target: 'https://clob.polymarket.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/clob/, ''),
        agent: agent,
        timeout: 10000, // 10秒超时
        configure: (proxy) => {
          proxy.on('error', (err, _req, res) => {
            console.log('[CLOB Proxy Error]:', err.message);
            // 返回空响应而不是让请求挂起
            if (res && typeof res !== 'object') return;
            const response = res as any;
            if (response.headersSent) return;
            try {
              response.writeHead(500, { 'Content-Type': 'application/json' });
              response.end(JSON.stringify({ error: 'Proxy error', message: err.message }));
            } catch (e) {
              // 忽略写入失败
            }
          });
          proxy.on('proxyReq', (proxyReq) => {
            // 添加超时处理
            proxyReq.setTimeout(10000, () => {
              console.log('[CLOB Proxy] Request timeout');
              proxyReq.destroy();
            });
          });
        },
      },
      // WebSocket代理 - 已禁用，不需要
      // WebSocket协议不受CORS限制，前端代码直接连接 Polymarket
      // wss://ws-subscriptions-clob.polymarket.com/ws/market
    },
  },
})
