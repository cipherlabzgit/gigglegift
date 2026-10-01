/**
 * API Configuration
 * Always call /api on the shop's own host so the browser does not make a
 * cross-origin request (the live gateway does not allow gigglesngifts.lk).
 * Local: server.local.js proxies /api to the local API Gateway.
 * Production: vercel.json proxies /api to https://sensoryapigateway.openskylabz.com
 */
const API_CONFIG = {
  BASE_URL: '/api'
};

// Make it globally accessible
window.API_CONFIG = API_CONFIG;
