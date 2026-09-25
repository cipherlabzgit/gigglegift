/**
 * API Configuration
 * Local dev: relative /api (proxied by server.local.js to local API Gateway)
 * Production: Sensory API Gateway
 */
const isLocalHost =
  window.location.hostname === 'localhost' ||
  window.location.hostname === '127.0.0.1';

const API_CONFIG = {
  BASE_URL: isLocalHost
    ? '/api'
    : 'https://sensoryapigateway.openskylabz.com/api'
};

// Make it globally accessible
window.API_CONFIG = API_CONFIG;
