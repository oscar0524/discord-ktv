import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  root: __dirname,
  plugins: [react()],
  resolve: {
    alias: {
      // 讓 web 也能 import 共用型別
      '@discord-ktv/shared-types': path.resolve(
        __dirname,
        '../../libs/shared-types/src/index.ts'
      ),
    },
  },
  css: {
    preprocessorOptions: {
      scss: {
        // 使用 Sass modern API,避免 legacy JS API 的 deprecation 警告
        api: 'modern-compiler',
      },
    },
  },
  server: {
    port: Number(process.env.WEB_PORT ?? 4200),
    host: true,
  },
  build: {
    outDir: path.resolve(__dirname, '../../dist/apps/web'),
    emptyOutDir: true,
  },
});
