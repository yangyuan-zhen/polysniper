import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import { fileURLToPath } from 'url'

import fs from 'fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 动态解析 shared 目录：优先使用 Docker 构建时复制进来的本地目录
const localSharedPath = path.resolve(__dirname, './src/shared')
const siblingSharedPath = path.resolve(__dirname, '../shared/types')
const sharedPath = fs.existsSync(localSharedPath) ? localSharedPath : siblingSharedPath

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@shared/types': path.resolve(sharedPath, 'index.ts'),
    },
    preserveSymlinks: true,
  },
  server: {
    port: 5173,
    fs: {
      allow: ['..'],
    },
    proxy: {
      // 代理后端 API 请求
      '/api': {
        target: 'http://localhost:3000', // 恢复原始端口
        changeOrigin: true,
      },
      // 代理 Socket.IO WebSocket 连接
      '/socket.io': {
        target: 'http://localhost:3000', // 恢复原始端口
        changeOrigin: true,
        ws: true, // 启用 WebSocket 代理
      },
    },
  },
  optimizeDeps: {
    exclude: ['@shared/types'],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom'],
          'vendor-ui': ['lucide-react', 'clsx', 'tailwind-merge'],
          'vendor-charts': ['recharts'],
        },
      },
    },
  },
})
