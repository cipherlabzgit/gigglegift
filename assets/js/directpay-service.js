/**
 * DirectPay.lk Payment Service
 * Handles payment processing through DirectPay payment gateway
 * 
 * Documentation: https://doc.directpay.lk/
 * NPM Package: https://www.npmjs.com/package/directpay-ipg-js
 * 
 * Integration uses DirectPay IPG v3 SDK with:
 * - Base64 encoded payload
 * - HMAC-SHA256 signature
 */

const DirectPayService = (function() {
  'use strict';

  let isSDKLoaded = false;
  let sdkLoadPromise = null;
  let cryptoJsLoaded = false;

  /**
   * Load CryptoJS library for HMAC-SHA256 signature generation
   * @returns {Promise} Resolves when CryptoJS is loaded
   */
  function loadCryptoJS() {
    if (cryptoJsLoaded || typeof CryptoJS !== 'undefined') {
      cryptoJsLoaded = true;
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/crypto-js/4.1.1/crypto-js.min.js';
      script.async = true;

      script.onload = function() {
        cryptoJsLoaded = true;
        console.log('[DirectPay] CryptoJS loaded successfully');
        resolve();
      };

      script.onerror = function() {
        console.error('[DirectPay] Failed to load CryptoJS');
        reject(new Error('Failed to load CryptoJS'));
      };

      document.head.appendChild(script);
    });
  }

  /**
   * Load the DirectPay SDK dynamically
   * @returns {Promise} Resolves when SDK is loaded
   */
  function loadSDK() {
    if (isSDKLoaded && typeof DirectPayIpg !== 'undefined') {
      return Promise.resolve();
    }

    if (sdkLoadPromise) {
      return sdkLoadPromise;
    }

    sdkLoadPromise = new Promise((resolve, reject) => {
      const config = DIRECTPAY_CONFIG.getConfig();
      const script = document.createElement('script');
      script.src = config.cdnUrl;
      script.async = true;

      script.onload = function() {
        isSDKLoaded = true;
        console.log('[DirectPay] SDK loaded successfully from:', config.cdnUrl);
        resolve();
      };

      script.onerror = function() {
        console.error('[DirectPay] Failed to load SDK from:', config.cdnUrl);
        sdkLoadPromise = null;
        reject(new Error('Failed to load DirectPay SDK'));
      };

      document.head.appendChild(script);
    });

    return sdkLoadPromise;
  }

  /**
   * Generate a unique order ID for the transaction
   * @param {string} prefix - Optional prefix for the order ID
   * @returns {string} Unique order ID
   */
  function generateOrderId(prefix = 'ORD') {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `${prefix}${timestamp}${random}`;
  }

  /**
   * Format amount for DirectPay (2 decimal places)
   * @param {number} amount - The amount to format
   * @returns {string} Formatted amount
   */
  function formatAmount(amount) {
    return parseFloat(amount).toFixed(2);
  }

  /**
   * Format phone for DirectPay IPG (E.164-style +94…)
   * @param {string} phone - Raw phone from checkout
   * @returns {string}
   */
  function formatPhoneForDirectPay(phone) {
    if (!phone) return '';
    var digits = String(phone).replace(/\D/g, '');
    if (digits.indexOf('94') === 0 && digits.length >= 11) {
      return '+' + digits;
    }
    if (digits.charAt(0) === '0') {
      digits = digits.slice(1);
    }
    if (digits.length === 9) {
      return '+94' + digits;
    }
    return phone.trim();
  }

  /**
   * Create base64 encoded payload
   * @param {Object} payloadData - The payment data
   * @returns {string} Base64 encoded payload
   */
  function createEncodedPayload(payloadData) {
    const jsonString = JSON.stringify(payloadData);
    // Use CryptoJS for consistent base64 encoding
    const encoded = CryptoJS.enc.Base64.stringify(CryptoJS.enc.Utf8.parse(jsonString));
    return encoded;
  }

  /**
   * Generate HMAC-SHA256 signature
   * @param {string} encodedPayload - Base64 encoded payload
   * @param {string} secretKey - Secret key for signing
   * @returns {string} HMAC-SHA256 signature (hex)
   */
  function generateSignature(encodedPayload, secretKey) {
    const signature = CryptoJS.HmacSHA256(encodedPayload, secretKey);
    return signature.toString(CryptoJS.enc.Hex);
  }

  /**
   * Initialize a one-time payment
   * @param {Object} options - Payment options
   * @param {string} options.containerId - ID of the container element for the payment form
   * @param {number} options.amount - Payment amount
   * @param {string} options.orderId - Unique order ID (optional, will generate if not provided)
   * @param {string} options.firstName - Customer first name
   * @param {string} options.lastName - Customer last name
   * @param {string} options.email - Customer email address
   * @param {string} options.phone - Customer phone number
   * @param {string} options.logoUrl - Optional merchant logo URL (must be HTTPS)
   * @param {string} options.responseUrl - Server-side webhook URL for payment confirmation
   * @param {string} options.returnUrl - URL to redirect after payment
   * @param {Function} options.onSuccess - Callback for successful payment
   * @param {Function} options.onError - Callback for payment error
   * @param {boolean} options.usePopup - Use popup mode (default: false, uses container)
   * @returns {Promise} Resolves when payment is initialized
   */
  async function initOneTimePayment(options) {
    try {
      // Load dependencies
      await loadCryptoJS();
      await loadSDK();

      // Validate required options
      if (!options.containerId && !options.usePopup) {
        throw new Error('Container ID is required for inline checkout');
      }
      if (!options.amount || options.amount <= 0) {
        throw new Error('Valid amount is required');
      }
      if (!options.email) {
        throw new Error('Customer email is required');
      }

      const config = DIRECTPAY_CONFIG.getConfig();
      const orderId = options.orderId || generateOrderId();
      const formattedAmount = formatAmount(options.amount);

      // Live integration requires merchant credentials to be configured.
      if (!config.merchantId || !config.secretKey) {
        throw new Error('DirectPay live credentials are missing. Please configure merchantId and secretKey in directpay-config.js');
      }

      // Create payload object (customer fields prefill IPG — checkout already collected them)
      const payload = {
        merchant_id: config.merchantId,
        amount: formattedAmount,
        type: 'ONE_TIME',
        order_id: orderId,
        currency: DIRECTPAY_CONFIG.currency,
        first_name: options.firstName || '',
        last_name: options.lastName || '',
        email: options.email,
        phone: formatPhoneForDirectPay(options.phone || ''),
        logo: options.logoUrl || ''
      };

      // Add optional URLs
      if (options.responseUrl) {
        payload.response_url = options.responseUrl;
      }
      if (options.returnUrl) {
        payload.return_url = options.returnUrl;
      }

      console.log('[DirectPay] Payment payload:', payload);

      // Create encoded payload and signature
      const encodedPayload = createEncodedPayload(payload);
      const signature = generateSignature(encodedPayload, config.secretKey);

      console.log('[DirectPay] Initializing payment:', {
        merchantId: config.merchantId,
        amount: formattedAmount,
        orderId: orderId,
        currency: DIRECTPAY_CONFIG.currency,
        stage: config.stage,
        isSandbox: DIRECTPAY_CONFIG.isSandbox()
      });

      // Check if DirectPayIpg is available
      if (typeof DirectPayIpg === 'undefined') {
        throw new Error('DirectPay SDK not properly loaded');
      }

      // Initialize DirectPay IPG
      const dpConfig = {
        signature: signature,
        dataString: encodedPayload,
        stage: config.stage,
        container: options.containerId || 'card_container'
      };

      console.log('[DirectPay] SDK config:', dpConfig);

      const dp = new DirectPayIpg.Init(dpConfig);

      // Choose checkout method
      const checkoutPromise = options.usePopup 
        ? dp.doInAppCheckout() 
        : dp.doInContainerCheckout();

      checkoutPromise
        .then(function(result) {
          console.log('[DirectPay] Payment Response:', result);
          console.log('[DirectPay] Payment Response (stringified):', JSON.stringify(result, null, 2));
          handlePaymentResponse(result, orderId, options.onSuccess, options.onError);
        })
        .catch(function(error) {
          console.error('[DirectPay] Payment Error:', error);
          console.error('[DirectPay] Payment Error (stringified):', JSON.stringify(error, null, 2));
          
          // Extract more detailed error information
          let errorMessage = 'Payment failed. Please try again.';
          let errorStatus = 'FAILED';
          
          if (error) {
            if (typeof error === 'string') {
              errorMessage = error;
            } else if (error.message) {
              errorMessage = error.message;
            } else if (error.description) {
              errorMessage = error.description;
            } else if (error.error_description) {
              errorMessage = error.error_description;
            } else if (error.responseMessage) {
              errorMessage = error.responseMessage;
            }
            
            if (error.status) {
              errorStatus = error.status;
            } else if (error.code) {
              errorStatus = error.code;
            }
          }
          
          if (options.onError) {
            options.onError({
              success: false,
              error: error,
              status: errorStatus,
              message: errorMessage,
              orderId: orderId,
              rawResponse: error
            });
          }
        });

      return {
        success: true,
        orderId: orderId,
        message: 'Payment form initialized'
      };

    } catch (error) {
      console.error('[DirectPay] Initialization error:', error);
      if (options.onError) {
        options.onError({
          success: false,
          error: error,
          message: error.message || 'Failed to initialize payment',
          orderId: options.orderId || null
        });
      }
      throw error;
    }
  }

  /**
   * Initialize payment with popup mode
   * @param {Object} options - Same options as initOneTimePayment
   * @returns {Promise} Resolves when payment is initialized
   */
  async function initPopupPayment(options) {
    return initOneTimePayment({ ...options, usePopup: true });
  }

  /**
   * Handle payment response from DirectPay
   * @param {Object} result - Payment result from DirectPay
   * @param {string} orderId - Order ID
   * @param {Function} onSuccess - Success callback
   * @param {Function} onError - Error callback
   */
  function handlePaymentResponse(result, orderId, onSuccess, onError) {
    console.log('[DirectPay] Processing response:', result);
    console.log('[DirectPay] Response type:', typeof result);
    console.log('[DirectPay] Response keys:', result ? Object.keys(result) : 'null');
    console.log('[DirectPay] Response stringified:', JSON.stringify(result, null, 2));

    if (!result) {
      console.error('[DirectPay] Null or undefined response received');
      if (onError) {
        onError({
          success: false,
          status: 'ERROR',
          orderId: orderId,
          message: 'No response received from payment gateway. Please try again.',
          rawResponse: null
        });
      }
      return;
    }

    // DirectPay IPG V3 SDK client response format per documentation:
    //   { status: 200, card: {...}, transaction: { id, status, amount, ... } }
    // Payment confirmation (webhook) format:
    //   { status: "SUCCESS", transaction_id: "...", order_id: "...", transaction: {...} }
    // Legacy flat format:
    //   { status: "SUCCESS", transaction_id: "...", amount: "..." }

    var txn = result.transaction || result.data?.transaction || {};
    var txnStatus = txn.status || result.status;
    var txnId = txn.id || result.transaction_id || result.transactionId
              || result.data?.transaction_id || result.data?.transactionId || null;
    var txnAmount = txn.amount || result.amount || result.data?.amount || null;
    var txnMessage = txn.message || txn.description || result.message || result.description || '';
    var cardNumber = result.card?.number || result.card_mask || null;

    // Determine success: status 200 (SDK), or "SUCCESS" string, or explicit boolean
    var isSuccess = (
      txnStatus === 'SUCCESS' ||
      result.status === 200 ||
      result.status === '200' ||
      result.success === true
    );

    // Determine failure explicitly
    var isFailed = (
      txnStatus === 'FAILED' || txnStatus === 'CANCELLED' ||
      result.status === 'FAILED' || result.status === 'CANCELLED'
    );

    if (isSuccess && !isFailed) {
      var paymentData = {
        success: true,
        transactionId: txnId,
        status: 'SUCCESS',
        orderId: orderId,
        amount: txnAmount,
        currency: txn.currency || result.currency || DIRECTPAY_CONFIG.currency,
        message: txnMessage || 'Payment successful',
        cardNumber: cardNumber,
        rawResponse: result
      };

      console.log('[DirectPay] Payment successful:', paymentData);
      storePaymentResult(paymentData);

      if (onSuccess) {
        onSuccess(paymentData);
      }
    } else {
      var errorData = {
        success: false,
        status: txnStatus || result.status || 'UNKNOWN',
        orderId: orderId,
        message: txnMessage || 'Payment ' + (txnStatus === 'CANCELLED' ? 'cancelled' : 'failed'),
        rawResponse: result
      };

      console.log('[DirectPay] Payment failed:', errorData);

      if (onError) {
        onError(errorData);
      }
    }
  }

  /**
   * Store payment result for order processing
   * @param {Object} paymentResult - The payment result to store
   */
  function storePaymentResult(paymentResult) {
    try {
      sessionStorage.setItem('directpay_payment_result', JSON.stringify(paymentResult));
    } catch (e) {
      console.warn('[DirectPay] Could not store payment result:', e);
    }
  }

  /**
   * Get stored payment result
   * @returns {Object|null} The stored payment result or null
   */
  function getStoredPaymentResult() {
    try {
      const stored = sessionStorage.getItem('directpay_payment_result');
      return stored ? JSON.parse(stored) : null;
    } catch (e) {
      console.warn('[DirectPay] Could not retrieve payment result:', e);
      return null;
    }
  }

  /**
   * Clear stored payment result
   */
  function clearStoredPaymentResult() {
    try {
      sessionStorage.removeItem('directpay_payment_result');
    } catch (e) {
      console.warn('[DirectPay] Could not clear payment result:', e);
    }
  }

  // Public API
  return {
    loadSDK: loadSDK,
    loadCryptoJS: loadCryptoJS,
    initOneTimePayment: initOneTimePayment,
    initPopupPayment: initPopupPayment,
    generateOrderId: generateOrderId,
    formatAmount: formatAmount,
    formatPhoneForDirectPay: formatPhoneForDirectPay,
    createEncodedPayload: createEncodedPayload,
    generateSignature: generateSignature,
    storePaymentResult: storePaymentResult,
    getStoredPaymentResult: getStoredPaymentResult,
    clearStoredPaymentResult: clearStoredPaymentResult,
    
    // Expose test cards info for sandbox testing
    getTestCards: function() {
      return DIRECTPAY_CONFIG.isSandbox() ? DIRECTPAY_TEST_CARDS : null;
    },
    
    // Check if sandbox mode
    isSandbox: function() {
      return DIRECTPAY_CONFIG.isSandbox();
    },
    
    // Get merchant ID
    getMerchantId: function() {
      return DIRECTPAY_CONFIG.getMerchantId();
    }
  };

})();

// Make service globally accessible
window.DirectPayService = DirectPayService;
