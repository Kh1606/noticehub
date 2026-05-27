import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base must match the GitHub Pages subpath: https://<user>.github.io/noticehub/
export default defineConfig({
  base: '/noticehub/',
  plugins: [react()],
  server: {
    port: 5173,
    open: true,
  },
})
