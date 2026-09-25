/**
 * API Service for fetching data
 */

// Fetch all categories
async function fetchCategories() {
  try {
    const headers = getAuthHeaders();
    const response = await fetch(API_CONFIG.BASE_URL + '/inventory/categories?pageNumber=1&pageSize=1000', {
      method: 'GET',
      headers: headers
    });

    if (!response.ok) {
      throw new Error('Network response was not ok');
    }

    const data = await response.json();
    
    if (data.success && data.data && data.data.items) {
      const activeCategories = data.data.items.filter(category => category && category.isActive !== false);

      // Sort by name alphabetically
      const sortedCategories = activeCategories.sort((a, b) => {
        return (a.name || '').localeCompare(b.name || '');
      });

      window.categoryNameById = window.categoryNameById || new Map();
      sortedCategories.forEach(function (c) {
        if (c && c.id != null) {
          window.categoryNameById.set(String(c.id), String(c.name || '').trim());
        }
      });
      
      return sortedCategories;
    } else {
      throw new Error('Invalid response format');
    }
  } catch (error) {
    // Error fetching categories
    return [];
  }
}

function isShopVisibleProduct(product) {
  if (!product || product.isActive === false) {
    return false;
  }
  const sellingPrice = Number(product.sellingPrice);
  return Number.isFinite(sellingPrice) && sellingPrice > 0;
}

async function hydrateProductsList(items, options) {
  if (!Array.isArray(items) || !items.length) {
    return items || [];
  }
  if (typeof window.hydrateProductImages !== 'function') {
    return items;
  }
  return Promise.all(items.map(function (product) {
    return window.hydrateProductImages(product, options);
  }));
}

function normalizeShopProduct(product) {
  return {
    ...product,
    imageURL: product.imageUrl || product.imageURL || null,
    unitPrice: product.unitPrice || product.sellingPrice || 0,
    offerPrice: product.offerPrice ?? product.OfferPrice ?? null,
    offerDiscountAmount: product.offerDiscountAmount ?? product.OfferDiscountAmount ?? null,
    offerBadgeText: product.offerBadgeText ?? product.OfferBadgeText ?? null,
    offerBannerId: product.offerBannerId ?? product.OfferBannerId ?? null
  };
}

function getBaseProductPrice(product) {
  var selling = Number(product && (product.sellingPrice ?? product.SellingPrice));
  if (Number.isFinite(selling) && selling > 0) {
    return selling;
  }
  var unit = Number(product && (product.unitPrice ?? product.UnitPrice));
  return Number.isFinite(unit) && unit > 0 ? unit : 0;
}

function getEffectivePrice(product) {
  var offer = Number(product && (product.offerPrice ?? product.OfferPrice));
  if (Number.isFinite(offer) && offer > 0) {
    return offer;
  }
  return getBaseProductPrice(product);
}

function getOriginalProductPrice(product) {
  return getBaseProductPrice(product);
}

function hasProductOffer(product) {
  var offer = Number(product && (product.offerPrice ?? product.OfferPrice));
  var base = getBaseProductPrice(product);
  return Number.isFinite(offer) && offer > 0 && base > offer;
}

function escapePriceHtml(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderPriceHtml(product) {
  var effective = getEffectivePrice(product);
  var original = getOriginalProductPrice(product);
  if (!hasProductOffer(product)) {
    return formatPrice(effective);
  }
  var badge = product.offerBadgeText || product.OfferBadgeText || '';
  var badgeHtml = badge ? '<span class="sm-offer-badge">' + escapePriceHtml(badge) + '</span>' : '';
  return badgeHtml +
    '<span class="sm-price-old">' + formatPrice(original) + '</span>' +
    '<span class="sm-price-offer">' + formatPrice(effective) + '</span>';
}

async function fetchProductPage(pageNumber, pageSize, categoryId = null, keyword = '') {
  const queryParams = new URLSearchParams({
    pageNumber: pageNumber.toString(),
    pageSize: pageSize.toString()
  });

  if (keyword && keyword.trim() !== '') {
    queryParams.append('keyword', keyword.trim());
  }
  if (categoryId) {
    queryParams.append('categoryId', categoryId.toString());
  }

  const response = await fetch(API_CONFIG.BASE_URL + '/inventory/products?' + queryParams.toString(), {
    method: 'GET',
    headers: getAuthHeaders()
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Network response was not ok: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  if (!data.success || !data.data || !data.data.items) {
    throw new Error('Invalid response format');
  }

  return {
    items: data.data.items,
    totalCount: Number(data.data.totalCount) || data.data.items.length
  };
}

// Homepage most-selling products (featured + sales data from backend)
async function fetchMostSellingProducts(limit = 8, categoryId = null) {
  try {
    const queryParams = new URLSearchParams({
      limit: String(limit)
    });
    if (categoryId) {
      queryParams.append('categoryId', String(categoryId));
    }

    const response = await fetch(
      API_CONFIG.BASE_URL + '/inventory/products/most-selling?' + queryParams.toString(),
      {
        method: 'GET',
        headers: getAuthHeaders()
      }
    );

    if (!response.ok) {
      throw new Error('Network response was not ok');
    }

    const data = await response.json();
    if (!data.success || !Array.isArray(data.data)) {
      throw new Error('Invalid response format');
    }

    const normalizedItems = data.data.filter(isShopVisibleProduct).map(normalizeShopProduct);
    return await hydrateProductsList(normalizedItems);
  } catch (error) {
    return [];
  }
}

// Fetch products
async function fetchProducts(skipCount = 0, maxResultCount = 8, categoryId = null, keyword = '') {
  try {
    const pageNumber = Math.floor(skipCount / maxResultCount) + 1;
    const page = await fetchProductPage(pageNumber, maxResultCount, categoryId, keyword);
    const normalizedItems = page.items.filter(isShopVisibleProduct).map(normalizeShopProduct);

    return {
      items: normalizedItems,
      totalCount: normalizedItems.length
    };
  } catch (error) {
    return {
      items: [],
      totalCount: 0
    };
  }
}

let allProductsCache = null;
let allProductsCachePromise = null;

// Page through every product so sidebar counts are not limited to the first API page
async function fetchAllProducts(categoryId = null, keyword = '') {
  const useCache = !categoryId && !(keyword && String(keyword).trim());
  if (useCache && allProductsCache) {
    return { items: allProductsCache, totalCount: allProductsCache.length };
  }
  if (useCache && allProductsCachePromise) {
    const items = await allProductsCachePromise;
    return { items: items, totalCount: items.length };
  }

  const loadAll = (async function() {
    const pageSize = 500;
    let pageNumber = 1;
    let rawItems = [];
    let totalCount = Infinity;

    while (rawItems.length < totalCount) {
      const page = await fetchProductPage(pageNumber, pageSize, categoryId, keyword);
      rawItems = rawItems.concat(page.items || []);
      totalCount = page.totalCount;
      if (!page.items || page.items.length < pageSize) {
        break;
      }
      pageNumber += 1;
    }

    return rawItems.filter(isShopVisibleProduct).map(normalizeShopProduct);
  })();

  if (useCache) {
    allProductsCachePromise = loadAll;
  }

  try {
    const normalizedItems = await loadAll;
    if (useCache) {
      allProductsCache = normalizedItems;
    }
    return {
      items: normalizedItems,
      totalCount: normalizedItems.length
    };
  } catch (error) {
    return {
      items: [],
      totalCount: 0
    };
  } finally {
    if (useCache) {
      allProductsCachePromise = null;
    }
  }
}

// Format price with LKR currency
function formatPrice(price) {
  if (price === null || price === undefined || price === 0) {
    return 'LKR 0.00';
  }
  return 'LKR ' + parseFloat(price).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

// Fetch single product by ID
async function fetchProductById(productId) {
  try {
    var product = await fetchProductByIdRaw(productId);
    if (product) {
      return product;
    }
    const result = await fetchAllProducts();
    if (!result || !result.items || !result.items.length) {
      return null;
    }
    return result.items.find(function (item) {
      return String(item.id) === String(productId);
    }) || null;
  } catch (error) {
    return null;
  }
}

// Fetch stock levels for products (no auth required - public endpoint)
async function fetchStockLevels(pageNumber = 1, pageSize = 1000) {
  try {
    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };

    var allItems = [];
    var currentPage = pageNumber;

    while (true) {
      var response = await fetch(
        `${API_CONFIG.BASE_URL}/inventory/stock-levels?pageNumber=${currentPage}&pageSize=${pageSize}`,
        { method: 'GET', headers: headers }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch stock levels');
      }

      var data = await response.json();

      if (data.success && data.data && data.data.items && data.data.items.length > 0) {
        allItems = allItems.concat(data.data.items);
        var totalCount = data.data.totalCount || 0;
        if (allItems.length >= totalCount || data.data.items.length < pageSize) {
          break;
        }
        currentPage++;
      } else {
        break;
      }
    }

    return allItems;
  } catch (error) {
    // Error fetching stock levels
    return [];
  }
}

// Get stock level for a specific product
async function getProductStockLevel(productId) {
  try {
    const stockLevels = await fetchStockLevels();
    
    // Sum up stock across all warehouses for this product
    const productStock = stockLevels
      .filter(sl => sl.productId === productId)
      .reduce((total, sl) => total + (sl.availableQuantity || 0), 0);
    
    return productStock;
  } catch (error) {
    // Error getting product stock level
    return 0;
  }
}

// Cache for stock levels (to avoid multiple API calls)
let stockLevelCache = null;
let stockLevelCacheTime = 0;
const STOCK_CACHE_DURATION = 60000; // 1 minute cache

// Get cached stock levels or fetch new ones
async function getCachedStockLevels() {
  const now = Date.now();
  
  if (stockLevelCache && (now - stockLevelCacheTime) < STOCK_CACHE_DURATION) {
    return stockLevelCache;
  }
  
  stockLevelCache = await fetchStockLevels();
  stockLevelCacheTime = now;
  
  return stockLevelCache;
}

// Get stock map (productId -> availableQuantity)
async function getStockMap() {
  const stockLevels = await getCachedStockLevels();
  const stockMap = new Map();
  
  stockLevels.forEach(sl => {
    // Store with both number and string keys to handle type mismatches
    const productId = sl.productId;
    const quantity = sl.availableQuantity || 0;
    
    // Add to existing quantity (sum across warehouses)
    const currentNum = stockMap.get(Number(productId)) || 0;
    stockMap.set(Number(productId), currentNum + quantity);
    
    // Also set string version
    const currentStr = stockMap.get(String(productId)) || 0;
    stockMap.set(String(productId), currentStr + quantity);
  });
  
  return stockMap;
}

// Clear stock cache (call after cart operations that affect stock)
function clearStockCache() {
  stockLevelCache = null;
  stockLevelCacheTime = 0;
}

// Register new customer
async function registerCustomer(customerData) {
  try {
    // Map customer data to Identity Service RegisterRequest format
    const registerData = {
      firstName: customerData.firstName,
      lastName: customerData.lastName,
      email: customerData.email || customerData.emailAddress,
      password: customerData.password
    };

    const response = await fetch(API_CONFIG.BASE_URL + '/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(registerData)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.message || errorData.error?.message || 'Registration failed';
      throw new Error(errorMessage);
    }

    const data = await response.json();
    
    if (data.success && data.data) {
      return {
        success: true,
        user: data.data,
        message: data.message || 'Registration successful!'
      };
    } else {
      throw new Error(data.message || data.error?.message || 'Invalid response format');
    }
  } catch (error) {
    // Error registering customer
    return {
      success: false,
      message: error.message || 'Registration failed. Please try again.'
    };
  }
}

// Login customer
async function loginCustomer(email, password) {
  try {
    const loginData = {
      email: email,
      password: password
    };

    const response = await fetch(API_CONFIG.BASE_URL + '/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(loginData)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.message || errorData.error?.message || 'Login failed';
      throw new Error(errorMessage);
    }

    const data = await response.json();
    
    if (data.success && data.data) {
      const loginResponse = data.data;
      return {
        success: true,
        user: loginResponse.user,
        token: loginResponse.token,
        refreshToken: loginResponse.refreshToken,
        expiresAt: loginResponse.expiresAt, // expiresAt from response.data.expiresAt
        data: loginResponse, // Include full data object for access to expiresAt
        message: data.message || 'Login successful!'
      };
    } else {
      throw new Error(data.message || data.error?.message || 'Invalid response format');
    }
  } catch (error) {
    // Error logging in
    return {
      success: false,
      message: error.message || 'Login failed. Please check your credentials and try again.'
    };
  }
}

// Get current logged-in user
function getCurrentUser() {
  try {
    // Check sessionStorage first (for active session)
    const userData = sessionStorage.getItem('loggedInUser');
    if (userData) {
      return JSON.parse(userData);
    }
    // Fallback to localStorage for backward compatibility (optional)
    const localUserData = localStorage.getItem('loggedInUser');
    return localUserData ? JSON.parse(localUserData) : null;
  } catch (error) {
    // Error getting current user
    return null;
  }
}

// Get authentication token
function getAuthToken() {
  try {
    // Check sessionStorage first (for active session)
    const token = sessionStorage.getItem('authToken');
    if (token) {
      return token;
    }
    // Fallback to localStorage for backward compatibility (optional)
    return localStorage.getItem('authToken') || null;
  } catch (error) {
    // Error getting auth token
    return null;
  }
}

// Save logged-in user and token to sessionStorage (expires when browser closes)
function saveCurrentUser(userData, token, refreshToken) {
  try {
    // Store in sessionStorage (expires when browser closes)
    sessionStorage.setItem('loggedInUser', JSON.stringify(userData));
    if (token) {
      sessionStorage.setItem('authToken', token);
    }
    if (refreshToken) {
      sessionStorage.setItem('refreshToken', refreshToken);
    }
    
    // Also store expiresAt if provided in userData
    if (userData && userData.expiresAt) {
      sessionStorage.setItem('tokenExpiresAt', userData.expiresAt);
    }
  } catch (error) {
    // Error saving user data
  }
}

// Logout user - clear both sessionStorage and localStorage
function logoutUser() {
  try {
    // Clear sessionStorage
    sessionStorage.removeItem('loggedInUser');
    sessionStorage.removeItem('authToken');
    sessionStorage.removeItem('refreshToken');
    sessionStorage.removeItem('tokenExpiresAt');
    
    // Also clear localStorage for cleanup
    localStorage.removeItem('loggedInUser');
    localStorage.removeItem('authToken');
    localStorage.removeItem('refreshToken');
    
    // Clear user-specific cart data if needed
    // Note: You may want to keep the cart for guest users
  } catch (error) {
    // Error during logout
  }
}

// Check if user session is valid (token exists in sessionStorage)
function isUserLoggedIn() {
  try {
    const token = sessionStorage.getItem('authToken');
    const user = sessionStorage.getItem('loggedInUser');
    return !!(token && user);
  } catch (error) {
    return false;
  }
}

// Refresh the auth token using the stored refresh token
async function refreshAuthToken() {
  try {
    const refreshToken = sessionStorage.getItem('refreshToken') || localStorage.getItem('refreshToken');
    if (!refreshToken) {
      return false;
    }

    const response = await fetch(API_CONFIG.BASE_URL + '/auth/refresh', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({ refreshToken: refreshToken })
    });

    if (!response.ok) {
      return false;
    }

    const data = await response.json();

    if (data.success && data.data) {
      const loginResponse = data.data;
      if (loginResponse.token) {
        sessionStorage.setItem('authToken', loginResponse.token);
      }
      if (loginResponse.refreshToken) {
        sessionStorage.setItem('refreshToken', loginResponse.refreshToken);
      }
      if (loginResponse.expiresAt) {
        sessionStorage.setItem('tokenExpiresAt', loginResponse.expiresAt);
      }
      return true;
    }

    return false;
  } catch (error) {
    return false;
  }
}

function normalizeWebsiteBanner(banner) {
  if (!banner || typeof banner !== 'object') {
    return null;
  }
  var productIds = banner.productIds || banner.ProductIds || [];
  if (!Array.isArray(productIds)) {
    productIds = [];
  }
  return {
    id: banner.id != null ? banner.id : banner.Id,
    type: banner.type || banner.Type || 'Hero',
    title: banner.title || banner.Title || '',
    subtitle: banner.subtitle || banner.Subtitle || '',
    buttonText: banner.buttonText || banner.ButtonText || 'Shop now',
    imageUrl: banner.imageUrl || banner.ImageUrl || banner.imageURL || banner.ImageURL || '',
    linkUrl: banner.linkUrl || banner.LinkUrl || banner.linkURL || 'shop',
    sortOrder: banner.sortOrder != null ? banner.sortOrder : (banner.SortOrder != null ? banner.SortOrder : 0),
    isActive: banner.isActive != null ? banner.isActive : banner.IsActive,
    startDate: banner.startDate || banner.StartDate || null,
    endDate: banner.endDate || banner.EndDate || null,
    discountType: banner.discountType || banner.DiscountType || null,
    discountValue: banner.discountValue != null ? banner.discountValue : banner.DiscountValue,
    badgeText: banner.badgeText || banner.BadgeText || null,
    productIds: productIds.map(function (id) { return Number(id); }).filter(function (id) { return id > 0; })
  };
}

function isBannerCurrentlyActive(banner) {
  if (!banner || banner.isActive === false) {
    return false;
  }
  var now = Date.now();
  if (banner.startDate && new Date(banner.startDate).getTime() > now) {
    return false;
  }
  if (banner.endDate && new Date(banner.endDate).getTime() < now) {
    return false;
  }
  return true;
}

async function fetchBanners(type) {
  const items = await requestBanners(type, true);
  if (items.length > 0) {
    return items;
  }

  const fallback = await requestBanners(type, false);
  if (!fallback.length) {
    return [];
  }

  return fallback.filter(isBannerCurrentlyActive);
}

/** Offer banners for promo; falls back to Hero banners when no offers exist. */
async function fetchPromoBanners() {
  var offers = await fetchBanners('Offer');
  if (offers.length > 0) {
    return offers;
  }
  return await fetchBanners('Hero');
}

async function requestBanners(type, activeOnly) {
  try {
    const queryParams = new URLSearchParams({
      pageNumber: '1',
      pageSize: '50',
      activeOnly: activeOnly ? 'true' : 'false'
    });
    if (type) {
      queryParams.append('type', type);
    }

    const headers = getAuthHeaders();
    const response = await fetch(API_CONFIG.BASE_URL + '/inventory/banners?' + queryParams.toString(), {
      method: 'GET',
      headers: headers
    });

    if (!response.ok) {
      throw new Error('Network response was not ok');
    }

    const data = await response.json();
    if (data.success && data.data && data.data.items) {
      return data.data.items
        .map(normalizeWebsiteBanner)
        .filter(Boolean);
    }
    return [];
  } catch (error) {
    return [];
  }
}

/** Full catalog from API without shop visibility filter (used for offer banners). */
async function fetchAllProductsRaw() {
  const pageSize = 500;
  let pageNumber = 1;
  let rawItems = [];
  let totalCount = Infinity;

  while (rawItems.length < totalCount) {
    const page = await fetchProductPage(pageNumber, pageSize, null, '');
    rawItems = rawItems.concat(page.items || []);
    totalCount = page.totalCount;
    if (!page.items || page.items.length < pageSize) {
      break;
    }
    pageNumber += 1;
  }

  return rawItems.map(normalizeShopProduct);
}

async function fetchProductByIdRaw(productId) {
  try {
    const response = await fetch(
      API_CONFIG.BASE_URL + '/inventory/products/' + encodeURIComponent(productId),
      { method: 'GET', headers: getAuthHeaders() }
    );
    if (!response.ok) {
      return null;
    }
    const data = await response.json();
    if (data.success && data.data) {
      var normalized = normalizeShopProduct(data.data);
      if (typeof window.hydrateProductImages === 'function') {
        return window.hydrateProductImages(normalized);
      }
      return normalized;
    }
    return null;
  } catch (_) {
    return null;
  }
}

/** Load products assigned to an offer — includes items without selling price or web visibility. */
async function fetchOfferProducts(productIds) {
  var ids = (Array.isArray(productIds) ? productIds : [])
    .map(function (id) { return Number(id); })
    .filter(function (id) { return id > 0; });
  if (!ids.length) {
    return [];
  }

  var rawCatalog = [];
  try {
    rawCatalog = await fetchAllProductsRaw();
  } catch (_) {
    rawCatalog = [];
  }

  var byId = new Map();
  rawCatalog.forEach(function (product) {
    if (product && product.id != null) {
      byId.set(String(product.id), product);
    }
  });

  var results = [];
  for (var i = 0; i < ids.length; i++) {
    var id = ids[i];
    var product = byId.get(String(id));
    if (!product && typeof fetchProductByIdRaw === 'function') {
      product = await fetchProductByIdRaw(id);
    }
    if (product) {
      results.push(product);
    }
  }
  return results;
}

async function fetchProductsByIds(productIds) {
  return fetchOfferProducts(productIds);
}

async function fetchBannerById(bannerId) {
  if (bannerId == null || String(bannerId).trim() === '') {
    return null;
  }
  try {
    const headers = getAuthHeaders();
    const response = await fetch(API_CONFIG.BASE_URL + '/inventory/banners/' + encodeURIComponent(bannerId), {
      method: 'GET',
      headers: headers
    });
    if (!response.ok) {
      throw new Error('Network response was not ok');
    }
    const data = await response.json();
    if (data.success && data.data) {
      return normalizeWebsiteBanner(data.data);
    }
    return null;
  } catch (error) {
    return null;
  }
}

// Get headers with authentication token
function getAuthHeaders() {
  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  };
  
  const token = getAuthToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  return headers;
}

// Make functions globally accessible
window.fetchCategories = fetchCategories;
window.fetchBanners = fetchBanners;
window.fetchPromoBanners = fetchPromoBanners;
window.fetchBannerById = fetchBannerById;
window.fetchProductsByIds = fetchProductsByIds;
window.fetchOfferProducts = fetchOfferProducts;
window.normalizeWebsiteBanner = normalizeWebsiteBanner;
window.fetchProducts = fetchProducts;
window.fetchAllProducts = fetchAllProducts;
window.fetchMostSellingProducts = fetchMostSellingProducts;
window.fetchProductById = fetchProductById;
window.formatPrice = formatPrice;
window.getEffectivePrice = getEffectivePrice;
window.getOriginalProductPrice = getOriginalProductPrice;
window.hasProductOffer = hasProductOffer;
window.renderPriceHtml = renderPriceHtml;
window.registerCustomer = registerCustomer;
window.loginCustomer = loginCustomer;
window.getCurrentUser = getCurrentUser;
window.getAuthToken = getAuthToken;
window.saveCurrentUser = saveCurrentUser;
window.logoutUser = logoutUser;
window.getAuthHeaders = getAuthHeaders;
window.isUserLoggedIn = isUserLoggedIn;
window.refreshAuthToken = refreshAuthToken;
window.fetchStockLevels = fetchStockLevels;
window.getProductStockLevel = getProductStockLevel;
window.getStockMap = getStockMap;
window.getCachedStockLevels = getCachedStockLevels;
window.clearStockCache = clearStockCache;

