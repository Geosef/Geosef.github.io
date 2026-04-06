import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const APPS_SCRIPT_DEPLOYMENT = 'AKfycbwOgxas12kd44P6tQrKdNbWM4-241xE2NAmXqCkGwHNVwHz_W8mO7aPLfIH2Wf3kgn1';
const APPS_SCRIPT_PROD_URL = `https://script.google.com/macros/s/${APPS_SCRIPT_DEPLOYMENT}/exec`;

export default defineConfig({
  plugins: [react()],
  define: {
    __APPS_SCRIPT_PROD_URL__: JSON.stringify(APPS_SCRIPT_PROD_URL),
  },
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
