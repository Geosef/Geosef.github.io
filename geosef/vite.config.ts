import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const APPS_SCRIPT_DEPLOYMENT = 'AKfycbyN9DBo7X4ETzHnZD7m94SdUIjQqMXRKqVLxaQb7Ra4YuOnpPusIGKSlUcVzJ65knKL';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/apps-script-proxy': {
        target: `https://script.google.com/macros/s/${APPS_SCRIPT_DEPLOYMENT}`,
        changeOrigin: true,
        followRedirects: true,
        rewrite: (path) => path.replace('/apps-script-proxy', '/exec'),
      },
    },
  },
})
