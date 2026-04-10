import { readFileSync } from 'fs'
import { resolve } from 'path'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const APPS_SCRIPT_DEPLOYMENT = env.VITE_APPS_SCRIPT_DEPLOYMENT
    || readFileSync(resolve(process.cwd(), '../appscript/deployment-id.txt'), 'utf-8').trim();
  const APPS_SCRIPT_PROD_URL = `https://script.google.com/macros/s/${APPS_SCRIPT_DEPLOYMENT}/exec`;

  return {
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
  }
})
