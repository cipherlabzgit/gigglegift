/**
 * Product detail popup styled like a full product page.
 */
(function (window, $) {
  'use strict';

  var quickViewImages = [];
  var quickViewCurrentIndex = 0;
  var eventsBound = false;

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatMoney(price) {
    if (typeof window.formatPrice === 'function') {
      return window.formatPrice(price);
    }
    var amount = Number(price);
    if (!Number.isFinite(amount) || amount <= 0) {
      return 'Price not available';
    }
    return 'LKR ' + amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  function getCatalog() {
    if (Array.isArray(window.allShopProducts) && window.allShopProducts.length) {
      return window.allShopProducts;
    }
    if (Array.isArray(window.homeProducts) && window.homeProducts.length) {
      return window.homeProducts;
    }
    return [];
  }

  function getStockMap() {
    return window.shopStockMap instanceof Map ? window.shopStockMap : new Map();
  }

  function getProductPrice(product) {
    if (typeof window.getEffectivePrice === 'function') {
      return window.getEffectivePrice(product);
    }
    var selling = Number(product && product.sellingPrice);
    if (Number.isFinite(selling) && selling > 0) {
      return selling;
    }
    var unit = Number(product && product.unitPrice);
    return Number.isFinite(unit) && unit > 0 ? unit : 0;
  }

  function isMissingImage(url) {
    return !url || /no-image|placeholder|holoimage\.net/i.test(String(url));
  }

  function productInitials(name) {
    return String(name || 'P').trim().split(/\s+/).slice(0, 2).map(function (word) {
      return word.charAt(0).toUpperCase();
    }).join('');
  }

  function getProductImages(product) {
    if (product && Array.isArray(product._resolvedImages) && product._resolvedImages.length) {
      return product._resolvedImages.slice();
    }
    var images = [];
    if (product && Array.isArray(product.images) && product.images.length) {
      images = product.images.map(function (img) {
        return typeof img === 'string' ? img : (img && (img.imageUrl || img.imageURL));
      }).filter(Boolean);
    } else if (product && Array.isArray(product.imageUrls) && product.imageUrls.length) {
      images = product.imageUrls.filter(Boolean);
    } else {
      var single = product && (product.imageUrl || product.imageURL);
      if (single) {
        images = [single];
      }
    }
    return images.filter(function (url) {
      return !isMissingImage(url);
    });
  }

  function formatDescription(text) {
    var raw = String(text || '').trim();
    if (!raw) {
      return 'No description available.';
    }
    return escapeHtml(raw).replace(/\r?\n/g, '<br>');
  }

  function extractFeatures(description) {
    return String(description || '').split(/\r?\n/).map(function (line) {
      var match = line.match(/^\s*[-*•]\s+(.+)$/);
      return match ? match[1].trim() : '';
    }).filter(Boolean);
  }

  function getHighlights(product) {
    var bullets = extractFeatures(product.description);
    if (bullets.length) {
      return bullets.slice(0, 6);
    }
    var raw = String(product.description || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    if (raw.indexOf('|') !== -1) {
      return raw.split('|').map(function (part) {
        return part.trim();
      }).filter(Boolean).slice(0, 6);
    }
    return [];
  }

  function resolveFullProduct(product) {
    if (!product || product.id == null) {
      return product || {};
    }
    var catalog = getCatalog();
    var full = catalog.find(function (item) {
      return String(item.id) === String(product.id);
    });
    if (!full) {
      return product;
    }
    var uiStock = product.maxStock;
    var merged = Object.assign({}, full, product);
    if (uiStock !== undefined) {
      merged.maxStock = uiStock;
    }
    return merged;
  }

  function getStockCount(product) {
    var stockMap = getStockMap();
    var fromMap = stockMap.get(product.id);
    if (fromMap === undefined) {
      fromMap = stockMap.get(String(product.id));
    }
    if (fromMap === undefined) {
      fromMap = stockMap.get(Number(product.id));
    }
    if (Number.isFinite(Number(fromMap))) {
      return Number(fromMap);
    }
    var fallback = Number(product.maxStock);
    return Number.isFinite(fallback) && fallback > 0 ? fallback : 0;
  }

  function getRelatedProducts(product, limit) {
    var catalog = getCatalog();
    var currentId = String(product.id);
    var sameCategory = catalog.filter(function (item) {
      return String(item.id) !== currentId && product.categoryId && item.categoryId === product.categoryId;
    });
    var extras = catalog.filter(function (item) {
      return String(item.id) !== currentId && sameCategory.indexOf(item) === -1;
    });
    return sameCategory.concat(extras).slice(0, limit);
  }

  function setStageImage(url) {
    var $stage = $('.pd-stage');
    var $img = $('#pd-main-image');
    if (!url || isMissingImage(url)) {
      $stage.addClass('is-empty');
      $img.addClass('is-missing').removeAttr('src');
      return;
    }
    $stage.removeClass('is-empty');
    $img.removeClass('is-missing').attr('src', url);
  }

  function showImageByIndex(targetIndex) {
    if (!quickViewImages.length) {
      setStageImage('');
      return;
    }
    var total = quickViewImages.length;
    quickViewCurrentIndex = ((targetIndex % total) + total) % total;
    setStageImage(quickViewImages[quickViewCurrentIndex]);
    $('#pd-thumbs .pd-thumb').removeClass('active');
    $('#pd-thumbs .pd-thumb[data-image-index="' + quickViewCurrentIndex + '"]').addClass('active');
  }

  function lockPageScroll() {
    var scrollPosition = window.pageYOffset || window.scrollY || 0;
    $('html, body').data('scroll-position', scrollPosition).addClass('fix');
  }

  function unlockPageScroll() {
    $('html, body').removeClass('fix');
    var scrollPosition = $('html').data('scroll-position') || $('body').data('scroll-position') || 0;
    requestAnimationFrame(function () {
      window.scrollTo(0, scrollPosition);
      $('html, body').removeData('scroll-position');
    });
  }

  function closeModal() {
    $('.product-quick-view-modal').removeClass('active');
    quickViewImages = [];
    quickViewCurrentIndex = 0;
    unlockPageScroll();
  }

  function productPageUrl(productId) {
    return 'product?id=' + encodeURIComponent(productId);
  }

  function renderSimilar(product) {
    var related = getRelatedProducts(product, 4);
    if (!related.length) {
      return '';
    }
    var cards = related.map(function (item) {
      var image = getProductImages(item)[0] || '';
      var code = item.code || item.sku || item.SKU || '';
      var imageHtml = image
        ? '<img src="' + escapeHtml(image) + '" alt="' + escapeHtml(item.name || 'Product') + '">'
        : '<span class="pd-similar-fallback">' + escapeHtml(productInitials(item.name)) + '</span>';
      return (
        '<a class="pd-similar-item" href="' + productPageUrl(item.id) + '">' +
          imageHtml +
          (code ? '<span class="pd-similar-code">' + escapeHtml(code) + '</span>' : '') +
          '<span class="pd-similar-name">' + escapeHtml(item.name || 'Product') + '</span>' +
          '<span class="pd-similar-price">' + escapeHtml(formatMoney(getProductPrice(item))) + '</span>' +
        '</a>'
      );
    }).join('');
    return (
      '<section class="pd-similar">' +
        '<h5>Similar Products</h5>' +
        '<div class="pd-similar-grid">' + cards + '</div>' +
      '</section>'
    );
  }

  function renderProductViewSafe(product) {
    return renderProductView(product).catch(function () {
      return renderProductView(Object.assign({}, product || {}, { _resolvedImages: undefined }));
    });
  }

  function openModal(product) {
    product = product || {};
    if ($('#product-page-root').length) {
      renderProductViewSafe(product);
      return;
    }
    if (product.id != null && product.id !== '') {
      window.location.href = productPageUrl(product.id);
      return;
    }
    renderProductViewSafe(product);
  }

  async function renderProductView(product) {
    product = resolveFullProduct(product || {});
    if (typeof window.hydrateProductImages === 'function') {
      product = await window.hydrateProductImages(product);
    }
    var productName = product.name || 'Product';
    var productPrice = getProductPrice(product);
    var formattedPrice = formatMoney(productPrice);
    var originalPrice = typeof window.getOriginalProductPrice === 'function'
      ? window.getOriginalProductPrice(product)
      : productPrice;
    var hasOffer = typeof window.hasProductOffer === 'function' && window.hasProductOffer(product);
    var mrp = Number(product.maximumRetailPrice);
    var hasMrpDiscount = !hasOffer && Number.isFinite(mrp) && mrp > productPrice && productPrice > 0;
    var savePercent = hasMrpDiscount ? Math.round(((mrp - productPrice) / mrp) * 100) : 0;
    var offerBadge = product.offerBadgeText || product.OfferBadgeText || '';
    var offerBadgeHtml = hasOffer && offerBadge
      ? '<span class="sm-offer-badge">' + escapeHtml(offerBadge) + '</span>'
      : '';
    var mrpHtml = hasOffer
      ? '<span class="sm-price-old">' + escapeHtml(formatMoney(originalPrice)) + '</span>'
      : (hasMrpDiscount
        ? '<span class="pd-mrp">' + escapeHtml(formatMoney(mrp)) + '</span>' +
          (savePercent > 0 ? '<span class="pd-save">Save ' + savePercent + '%</span>' : '')
        : '');
    var categoryName = product.categoryName || product.category || '';
    var productCode = product.code || product.sku || product.SKU || '';
    var productImages = getProductImages(product);
    var mainImage = productImages[0] || '';
    var unitName = product.unitOfMeasureName || '';
    var productStock = getStockCount(product);
    var hasStockRecord = getStockMap().has(product.id) || getStockMap().has(String(product.id)) || getStockMap().has(Number(product.id));
    var isOutOfStock = hasStockRecord && productStock <= 0;
    var highlights = getHighlights(product);
    var productForCart = Object.assign({}, product, { maxStock: productStock });
    var productDataAttr = JSON.stringify(productForCart).replace(/'/g, '&#39;');

    quickViewImages = productImages;
    quickViewCurrentIndex = 0;

    var thumbsHtml = productImages.map(function (imageUrl, index) {
      return (
        '<button type="button" class="pd-thumb' + (index === 0 ? ' active' : '') + '" data-image-index="' + index + '">' +
          '<img src="' + escapeHtml(imageUrl) + '" alt="' + escapeHtml(productName) + '">' +
        '</button>'
      );
    }).join('');

    var navHidden = productImages.length > 1 ? '' : ' hidden';
    var stageEmpty = !mainImage ? ' is-empty' : '';
    var highlightsHtml = highlights.length
      ? '<div class="pd-highlights"><h6>Highlights</h6><div class="pd-chips">' + highlights.map(function (item) {
          return '<span class="pd-chip">' + escapeHtml(item) + '</span>';
        }).join('') + '</div></div>'
      : '';

    var stockHtml = '';
    if (isOutOfStock) {
      stockHtml = '<div class="pd-stock is-out"><i class="ion-close-circled"></i> Out of stock</div>';
    } else if (productStock > 0 && productStock <= 5) {
      stockHtml = '<div class="pd-stock is-low"><i class="ion-alert-circled"></i> Only ' + productStock + ' left</div>';
    } else if (productStock > 0) {
      stockHtml = '<div class="pd-stock is-in"><i class="ion-checkmark-circled"></i> In stock · ' + productStock + ' available</div>';
    }

    var metaChips = [
      categoryName ? '<span class="pd-meta-chip">' + escapeHtml(categoryName) + '</span>' : '',
      productCode ? '<span class="pd-meta-chip is-code">Code ' + escapeHtml(productCode) + '</span>' : '',
      unitName ? '<span class="pd-meta-chip">' + escapeHtml(unitName) + '</span>' : ''
    ].filter(Boolean).join('');

    var actionHtml = (
      (isOutOfStock
        ? '<p class="pd-out-note">This item is currently unavailable.</p>'
        : (
          '<div class="pd-qty-row">' +
            '<div class="pro-qty pd-qty">' +
              '<a href="#" class="dec qty-btn" aria-label="Decrease quantity">−</a>' +
              '<input type="text" id="modal-quantity" title="Quantity" value="1" min="1" max="' + productStock + '" data-max-stock="' + productStock + '" />' +
              '<a href="#" class="inc qty-btn" aria-label="Increase quantity">+</a>' +
            '</div>' +
            '<button type="button" class="btn btn-theme add-to-cart-btn pd-cart-btn" data-product=\'' + productDataAttr + '\'>Add to My Cart</button>' +
          '</div>'
        )
      ) +
      '<div class="pd-tool-row">' +
        '<a class="pd-wishlist add-to-wishlist-btn" href="javascript:void(0)" data-product=\'' + productDataAttr + '\'><i class="ion-heart"></i> Add to Wishlist</a>' +
        '<a class="pd-mycart-link" href="shop-cart"><i class="ion-ios-cart"></i> View My Cart</a>' +
      '</div>'
    );

    var specRows = [
      { label: 'Type', value: categoryName },
      { label: 'SKU', value: product.sku || product.SKU },
      { label: 'Product code', value: product.code },
      { label: 'Unit', value: product.unitOfMeasureName },
      { label: 'Availability', value: isOutOfStock ? 'Out of stock' : (productStock > 0 ? 'In stock' : 'Available') }
    ].filter(function (row) {
      return row.value;
    });

    var specsHtml = specRows.length
      ? '<table class="pd-spec-table"><tbody>' + specRows.map(function (row) {
          return '<tr><th>' + escapeHtml(row.label) + '</th><td>' + escapeHtml(row.value) + '</td></tr>';
        }).join('') + '</tbody></table>'
      : '<p>No specifications available.</p>';

    var breadcrumb = (
      '<nav class="pd-breadcrumb">' +
        '<a href="/">Home</a>' +
        '<span>/</span><a href="shop">Shop</a>' +
        (categoryName ? '<span>/</span><span>' + escapeHtml(categoryName) + '</span>' : '') +
        '<span>/</span><strong>' + escapeHtml(productName) + '</strong>' +
      '</nav>'
    );

    var isPage = !!$('#product-page-root').length;
    var pageHtml =
      '<div class="pd-page' + (isPage ? ' is-page' : '') + '">' +
        '<div class="pd-head">' +
          breadcrumb +
          (isPage ? '<a class="pd-back" href="shop"><i class="ion-ios-arrow-left"></i> Back to products</a>' : '') +
        '</div>' +
        '<div class="pd-top">' +
          '<div class="pd-gallery-col">' +
            '<div class="pd-gallery">' +
              '<div class="pd-stage' + stageEmpty + '">' +
                '<div class="pd-placeholder">' +
                  '<span class="pd-placeholder-mark">' + escapeHtml(productInitials(productName)) + '</span>' +
                  '<span>Product photo coming soon</span>' +
                '</div>' +
                (mainImage
                  ? '<img id="pd-main-image" src="' + escapeHtml(mainImage) + '" alt="' + escapeHtml(productName) + '">'
                  : '<img id="pd-main-image" class="is-missing" alt="' + escapeHtml(productName) + '">') +
                '<button type="button" class="pd-nav pd-prev' + navHidden + '" id="pd-prev" aria-label="Previous image"><i class="ion-chevron-left"></i></button>' +
                '<button type="button" class="pd-nav pd-next' + navHidden + '" id="pd-next" aria-label="Next image"><i class="ion-chevron-right"></i></button>' +
              '</div>' +
              (thumbsHtml ? '<div class="pd-thumbs" id="pd-thumbs">' + thumbsHtml + '</div>' : '<div class="pd-thumbs" id="pd-thumbs" hidden></div>') +
            '</div>' +
            '<div class="pd-details">' +
              '<div class="pd-tabs" role="tablist">' +
                '<button type="button" class="pd-tab active" data-tab="features">Features</button>' +
                '<button type="button" class="pd-tab" data-tab="specs">Specifications</button>' +
                '<button type="button" class="pd-tab" data-tab="reviews">Reviews</button>' +
              '</div>' +
              '<div class="pd-panels">' +
                '<div class="pd-panel active" id="pd-panel-features">' +
                  '<p>' + formatDescription(product.description) + '</p>' +
                  (highlights.length ? '<ul>' + highlights.map(function (item) {
                    return '<li>' + escapeHtml(item) + '</li>';
                  }).join('') + '</ul>' : '') +
                '</div>' +
                '<div class="pd-panel" id="pd-panel-specs">' +
                  specsHtml +
                '</div>' +
                '<div class="pd-panel" id="pd-panel-reviews">' +
                  '<div class="pd-empty-review"><strong>No reviews yet</strong><p>Customer reviews will appear here when available.</p></div>' +
                '</div>' +
              '</div>' +
            '</div>' +
          '</div>' +
          '<div class="pd-buybox">' +
            (metaChips ? '<div class="pd-meta">' + metaChips + '</div>' : '') +
            '<h2 class="pd-title">' + escapeHtml(productName) + '</h2>' +
            offerBadgeHtml +
            '<div class="pd-price-row"><span class="pd-price' + (hasOffer ? ' sm-price-offer' : '') + '">' + escapeHtml(formattedPrice) + '</span>' + mrpHtml + '</div>' +
            stockHtml +
            highlightsHtml +
            (window.SensoryParent ? window.SensoryParent.deliveryHtml() : (
              '<div class="pd-notes">' +
                '<span class="pd-note"><i class="ion-android-car"></i> Islandwide delivery</span>' +
                '<span class="pd-note"><i class="ion-ios-location"></i> Kaduwela, Sri Lanka</span>' +
              '</div>'
            )) +
            (window.SensoryParent ? window.SensoryParent.parentFactsHtml(product) : '') +
            (isOutOfStock && window.SensoryParent
              ? '<a class="sm-wa-btn sm-wa-restock" href="' + window.SensoryParent.buildRestockWhatsApp(product) + '" target="_blank" rel="noopener"><i class="fa fa-whatsapp"></i> Tell me when it is back</a>'
              : '') +
            '<div class="pd-actions">' + actionHtml + '</div>' +
          '</div>' +
        '</div>' +
        renderSimilar(product) +
      '</div>';

    var $target = $('#product-page-root');
    if ($target.length) {
      $target.html(pageHtml);
    } else {
      $('.product-quick-view-content').html(pageHtml);
      lockPageScroll();
      $('.product-quick-view-modal').addClass('active');
    }

    $('#pd-main-image').off('error.pd').on('error.pd', function () {
      $('.pd-stage').addClass('is-empty');
      $(this).addClass('is-missing').removeAttr('src');
    });

    showImageByIndex(0);
    if (productName && productName !== 'Product') {
      document.title = productName + ' - Giggles & Gifts';
    }
  }

  function parseProductFromElement($el) {
    var productDataStr = $el.attr('data-product') || $el.closest('.product-item').attr('data-product') || $el.find('[data-product]').first().attr('data-product');
    if (!productDataStr) {
      return null;
    }
    try {
      return JSON.parse(productDataStr);
    } catch (error) {
      return null;
    }
  }

  function bindEvents() {
    if (eventsBound) {
      return;
    }
    eventsBound = true;

    $(document).on('click', '.product-item', function (e) {
      if ($(e.target).closest('.add-to-cart-btn, .add-to-wishlist-btn, .shop-card-cart-btn, .quick-view-btn, .sm-fav-qty, .sm-fav-wish').length) {
        return;
      }
      var product = parseProductFromElement($(this));
      if (!product) {
        return;
      }
      e.preventDefault();
      openModal(product);
    });

    $(document).on('click', '.pd-similar-item[data-product-id]', function (e) {
      var productId = $(this).attr('data-product-id');
      if (!productId) {
        return;
      }
      e.preventDefault();
      var full = getCatalog().find(function (item) {
        return String(item.id) === String(productId);
      });
      if (full) {
        openModal(full);
      } else {
        window.location.href = productPageUrl(productId);
      }
    });

    $(document).on('click', '.pd-tab', function () {
      var tab = $(this).attr('data-tab');
      $('.pd-tab').removeClass('active');
      $(this).addClass('active');
      $('.pd-panel').removeClass('active');
      $('#pd-panel-' + tab).addClass('active');
    });

    $(document).on('click', '#pd-thumbs .pd-thumb', function () {
      var newIndex = parseInt($(this).attr('data-image-index'), 10);
      if (!Number.isNaN(newIndex)) {
        showImageByIndex(newIndex);
      }
    });

    $(document).on('click', '#pd-prev', function (e) {
      e.preventDefault();
      if (quickViewImages.length > 1) {
        showImageByIndex(quickViewCurrentIndex - 1);
      }
    });

    $(document).on('click', '#pd-next', function (e) {
      e.preventDefault();
      if (quickViewImages.length > 1) {
        showImageByIndex(quickViewCurrentIndex + 1);
      }
    });

    $(document).on('click', '.product-quick-view-modal .btn-close, .product-quick-view-modal .canvas-overlay', function () {
      closeModal();
    });

    $(document).on('keydown', function (e) {
      if (!$('.product-quick-view-modal').hasClass('active')) {
        return;
      }
      if (e.key === 'Escape') {
        closeModal();
        return;
      }
      var activeTag = (document.activeElement && document.activeElement.tagName || '').toLowerCase();
      if (activeTag === 'input' || activeTag === 'textarea' || quickViewImages.length <= 1) {
        return;
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        showImageByIndex(quickViewCurrentIndex - 1);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        showImageByIndex(quickViewCurrentIndex + 1);
      }
    });
  }

  window.SensoryProductModal = {
    open: openModal,
    render: renderProductViewSafe,
    close: closeModal,
    bind: bindEvents,
    url: productPageUrl
  };

  $(bindEvents);
})(window, jQuery);
