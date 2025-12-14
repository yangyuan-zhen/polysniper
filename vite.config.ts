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
        secure: false, // 禁用 SSL 验证以避免 TLS 连接问题
        timeout: 15000, // 15秒超时
        configure: (proxy) => {
          proxy.on('error', (err, _req, res) => {
            console.log('Polymarket proxy error:', err.message);
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
            proxyReq.setTimeout(15000, () => {
              console.log('[Polymarket Proxy] Request timeout');
              proxyReq.destroy();
            });
          });
        },
      },
      '/api/clob': {
        target: 'https://clob.polymarket.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/clob/, ''),
        agent: agent,
        secure: false, // 禁用 SSL 验证以避免 TLS 连接问题
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
      // WebSocket 代理 - 用于实时价格订阅
      '/ws-poly': {
        target: 'wss://ws-subscriptions-clob.polymarket.com',
        changeOrigin: true,
        ws: true, // 启用 WebSocket 代理
        rewrite: (path) => path.replace(/^\/ws-poly/, '/ws'),
        agent: agent,
        secure: false,
        configure: (proxy) => {
          proxy.on('error', (err) => {
            console.log('[WebSocket Proxy Error]:', err.message);
          });
          proxy.on('proxyReqWs', (_proxyReq) => {
            console.log('[WebSocket Proxy] 转发连接到 Polymarket');
          });
          proxy.on('open', () => {
            console.log('[WebSocket Proxy] 连接已建立');
          });
          proxy.on('close', () => {
            console.log('[WebSocket Proxy] 连接已关闭');
          });
        },
      },
    },
  },
})
