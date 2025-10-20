import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Route ALL `react-native` imports to the web implementation
      'react-native': 'react-native-web',
      // Helps when some libs import Platform directly
      'react-native/Libraries/Utilities/Platform': 'react-native-web/dist/exports/Platform',
      '@': path.resolve(__dirname, './src'),
    },
    extensions: ['.web.tsx', '.web.ts', '.tsx', '.ts', '.jsx', '.js'],
  },
  optimizeDeps: {
    // Make esbuild prebundle RNW (faster/dev-friendlier)
    include: ['react-native-web'],
    esbuildOptions: {
      // Some packages assume `global` exists
      define: { global: 'globalThis' },
    },
  },
});
