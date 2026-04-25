export const APPS_SCRIPT_URL = import.meta.env.DEV
  ? '/apps-script-proxy'
  : __APPS_SCRIPT_PROD_URL__;

export const OAUTH_CLIENT_ID = import.meta.env.VITE_OAUTH_CLIENT_ID as string ?? '';
