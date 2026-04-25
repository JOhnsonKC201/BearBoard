import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          // framer-motion is only imported from lazy routes (Profile,
          // Leaderboard, NewPostModal). Let Rollup split it into a shared
          // chunk pulled in on-demand rather than preloaded at app start.
        },
      },
    },
  },
})
