import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // GitHub Pages: https://<user>.github.io/green-api-test/
  base: '/green-api-test/',
  plugins: [react()],
})
