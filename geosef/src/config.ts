export const APPS_SCRIPT_URL = import.meta.env.DEV
  ? '/apps-script-proxy'
  : __APPS_SCRIPT_PROD_URL__;
