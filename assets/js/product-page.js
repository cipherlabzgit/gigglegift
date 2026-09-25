/**
 * Full product page: /product?id=
 */
(function (window, $) {
  'use strict';

  function queryProductId() {
    return new URLSearchParams(window.location.search).get('id');
  }

  function showStatus(title, message) {
    $('#product-page-root').html(
      '<div class="pd-page-status">' +
        '<h2>' + title + '</h2>' +
        '<p>' + message + '</p>' +
        '<a href="shop">Back to products</a>' +
      '</div>'
    );
  }

  function bindQuantityControls() {
    $(document).on('click', '.pd-page .qty-btn', function (e) {
      e.preventDefault();
      var $button = $(this);
      var $input = $button.closest('.pd-qty').find('input');
      var oldValue = parseInt($input.val(), 10) || 1;
      var maxStock = parseInt($input.attr('data-max-stock'), 10) || 9999;

      if ($button.hasClass('inc')) {
        if (oldValue + 1 <= maxStock) {
          $input.val(oldValue + 1);
        } else if (typeof window.showToast === 'function') {
          window.showToast('Maximum available quantity is ' + maxStock, 'warning');
        }
      } else if ($button.hasClass('dec')) {
        $input.val(oldValue > 1 ? oldValue - 1 : 1);
      }
    });

    $(document).on('change blur', '.pd-page #modal-quantity', function () {
      var $input = $(this);
      var maxStock = parseInt($input.attr('data-max-stock'), 10) || 9999;
      var value = parseInt($input.val(), 10) || 1;
      if (value < 1) {
        value = 1;
      }
      if (value > maxStock) {
        value = maxStock;
        if (typeof window.showToast === 'function') {
          window.showToast('Maximum available quantity is ' + maxStock, 'warning');
        }
      }
      $input.val(value);
    });
  }

  async function boot() {
    bindQuantityControls();

    var productId = queryProductId();
    if (!productId) {
      showStatus('Product not found', 'Choose an item from the shop to see its details.');
      return;
    }

    $('#product-page-root').html('<div class="pd-page-status"><h2>Loading product</h2><p>Please wait a moment.</p></div>');

    try {
      if (typeof window.getStockMap === 'function') {
        window.shopStockMap = await window.getStockMap();
      }
    } catch (error) {
      window.shopStockMap = new Map();
    }

    var product = null;
    try {
      if (typeof window.fetchProductById === 'function') {
        product = await window.fetchProductById(productId);
      }
      if (!product && typeof window.fetchAllProducts === 'function') {
        var catalog = await window.fetchAllProducts();
        window.allShopProducts = (catalog && catalog.items) || [];
        product = window.allShopProducts.find(function (item) {
          return String(item.id) === String(productId);
        }) || null;
      } else if (typeof window.fetchAllProducts === 'function') {
        var all = await window.fetchAllProducts();
        window.allShopProducts = (all && all.items) || [];
      }
    } catch (error) {
      product = null;
    }

    if (!product) {
      showStatus('Product not found', 'This item is no longer available or the link is invalid.');
      return;
    }

    if (window.SensoryProductModal && typeof window.SensoryProductModal.render === 'function') {
      window.SensoryProductModal.render(product);
    }
  }

  $(boot);
})(window, jQuery);
