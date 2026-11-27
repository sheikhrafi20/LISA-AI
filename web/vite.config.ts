import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    environment: 'jsdom',
    setupFiles: './src/test-setup.ts',
    globals: true,
    css: false,
    // Load three.js and its React wrappers through Vite so only one copy of three.js exists in tests.
    server: { deps: { inline: [/three/, /@react-three/, /troika/] } },
  },
})
