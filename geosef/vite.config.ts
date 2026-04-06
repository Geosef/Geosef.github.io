import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const APPS_SCRIPT_DEPLOYMENT = 'AKfycbylfb6lQUym8Abu4ryh_6aqy0KsqsuRKQOB3jWyS-W8BAqZLlreNr5IecIbpkAC5aQp';
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
