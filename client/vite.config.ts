import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import { fileURLToPath } from 'url'

import fs from 'fs'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      // 直接指向 node_modules 中的源码文件
      // 由于是 file: 协议安装的依赖，npm 会创建软链接，所以可以访问到源码
      '@shared/types': path.resolve(__dirname, 'node_modules/@polysniper/shared-types/types/index.ts'),
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
