import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // pdf.js is big; it is only loaded on the app pages (see App.tsx)
  build: { chunkSizeWarningLimit: 1500 },
})
