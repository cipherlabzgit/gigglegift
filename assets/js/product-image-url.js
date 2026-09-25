/**
 * Resolve product image URLs for the public shop.
 * Private S3 objects are fetched via the anonymous Inventory presigned-url endpoint.
 */
(function (window) {
  'use strict';

  var cache = new Map();
  var inflight = new Map();
  var CACHE_TTL_MS = 90 * 60 * 1000;
  var LOCAL_PREFIX = '/api/inventory/uploads/files/';

  function isMissingPlaceholder(url) {
    return !url || /no-image|placeholder|holoimage\.net/i.test(String(url));
  }

  function isPrivateS3ProductUrl(url) {
    if (!url || !/^https?:\/\//i.test(url)) {
      return false;
    }
    try {
      var parsed = new URL(url);
      if (parsed.hostname.toLowerCase().indexOf('amazonaws.com') === -1) {
        return false;
      }
      return /\/products\//i.test(parsed.pathname);
    } catch (_) {
      return false;
    }
  }

  function isLocalUploadUrl(url) {
    return !!url && String(url).toLowerCase().indexOf(LOCAL_PREFIX) >= 0;
  }

  function resolveProductImageSrcSync(raw) {
    var url = String(raw || '').trim();
    if (!url || isMissingPlaceholder(url)) {
      return '';
    }
    if (/^https?:\/\//i.test(url)) {
      return url;
    }
    if (url.indexOf('//') === 0) {
      return 'https:' + url;
    }
    if (url.indexOf('/api/') === 0) {
      return url;
    }
    var base = (window.API_CONFIG && window.API_CONFIG.BASE_URL) || '/api';
    base = base.replace(/\/$/, '');
    if (url.indexOf('/') === 0) {
      return base + url;
    }
    return base + '/' + url;
  }

  function fetchPublicPresignedUrl(url) {
    var key = url;
    var cached = cache.get(key);
    if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
      return Promise.resolve(cached.url);
    }

    var pending = inflight.get(key);
    if (pending) {
      return pending;
    }

    pending = (async function () {
      try {
        var base = ((window.API_CONFIG && window.API_CONFIG.BASE_URL) || '/api').replace(/\/$/, '');
        var params = new URLSearchParams({ url: url, expiresSeconds: '7200' });
        var res = await fetch(base + '/inventory/products/public-image-url?' + params.toString(), {
          headers: { Accept: 'application/json' }
        });
        var json = await res.json();
        var signed = json && json.data && json.data.url;
        if (res.ok && signed) {
          cache.set(key, { url: signed, at: Date.now() });
          return signed;
        }
      } catch (_) {
        // fall through
      }
      return null;
    })();

    inflight.set(key, pending);
    return pending.finally(function () {
      inflight.delete(key);
    });
  }

  async function resolveProductImageSrcAsync(raw) {
    var url = String(raw || '').trim();
    if (!url || isMissingPlaceholder(url)) {
      return '';
    }
    if (isPrivateS3ProductUrl(url)) {
      var signed = await fetchPublicPresignedUrl(url);
      return signed || '';
    }
    return resolveProductImageSrcSync(url);
  }

  function collectProductImageCandidates(product) {
    var urls = [];
    function add(value) {
      if (!value || isMissingPlaceholder(value)) {
        return;
      }
      var normalized = String(value).trim();
      if (urls.indexOf(normalized) === -1) {
        urls.push(normalized);
      }
    }

    if (!product) {
      return urls;
    }

    add(product.imageUrl);
    add(product.imageURL);
    if (Array.isArray(product.imageUrls)) {
      product.imageUrls.forEach(add);
    }
    if (Array.isArray(product.images)) {
      product.images.forEach(function (img) {
        add(typeof img === 'string' ? img : (img && (img.imageUrl || img.imageURL)));
      });
    }

    urls.sort(function (a, b) {
      var aLocal = isLocalUploadUrl(a) ? 0 : 1;
      var bLocal = isLocalUploadUrl(b) ? 0 : 1;
      return aLocal - bLocal;
    });

    return urls;
  }

  async function resolveProductImages(product, options) {
    options = options || {};
    var candidates = collectProductImageCandidates(product);
    var resolved = [];
    for (var i = 0; i < candidates.length; i++) {
      var next = await resolveProductImageSrcAsync(candidates[i]);
      if (next && resolved.indexOf(next) === -1) {
        resolved.push(next);
      }
      if (options.primaryOnly && resolved.length) {
        break;
      }
    }
    return resolved;
  }

  async function hydrateProductImages(product, options) {
    if (!product) {
      return product;
    }
    var resolved = await resolveProductImages(product, options);
    var best = resolved[0] || '';
    return Object.assign({}, product, {
      imageURL: best || product.imageURL || product.imageUrl || null,
      imageUrl: best || product.imageUrl || product.imageURL || null,
      imageUrls: resolved.length ? resolved : (product.imageUrls || []),
      _resolvedImages: resolved
    });
  }

  window.resolveProductImageSrcSync = resolveProductImageSrcSync;
  window.resolveProductImageSrcAsync = resolveProductImageSrcAsync;
  window.resolveProductImages = resolveProductImages;
  window.hydrateProductImages = hydrateProductImages;
  window.collectProductImageCandidates = collectProductImageCandidates;
  window.isPrivateS3ProductUrl = isPrivateS3ProductUrl;
})(window);
