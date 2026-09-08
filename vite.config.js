import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// './' keeps asset paths relative so the built app works from any folder
// (GitHub Pages sub-path, Netlify root, a USB stick, whatever).
export default defineConfig({
  base: './',
  plugins: [react()]
})
