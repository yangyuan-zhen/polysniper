import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 检测是否在 Docker 构建环境中
// Docker 中：shared 类型被复制到 src/shared-types
// 本地开发：shared 类型在 ../shared/types
const dockerSharedPath = path.resolve(__dirname, 'src/shared-types/index.ts')
const localSharedPath = path.resolve(__dirname, '../shared/types/index.ts')
const sharedTypesPath = fs.existsSync(dockerSharedPath) ? dockerSharedPath : localSharedPath

console.log('[Vite Config] Using shared types from:', sharedTypesPath)

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@shared/types': sharedTypesPath,
    },
  },
  server: {
    port: 5173,
    fs: {
      allow: ['..'],
    },
    proxy: {
      // 代理后端 API 请求
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      // 代理 Socket.IO WebSocket 连接
      '/socket.io': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        ws: true,
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
