import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, '../shared'),
      '@shared/types': path.resolve(__dirname, '../shared/types'),
    },
  },
  server: {
    port: 5173,
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
