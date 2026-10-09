(function($) {
  
  "use strict";

  // Global Toast Notification Function
  window.showToast = function(message, type = 'success') {
    // Remove existing toasts
    $('.toast-notification').remove();
    
    const icon = type === 'success' ? '<i class="ion-checkmark-circled"></i>' : 
                 type === 'error' ? '<i class="ion-close-circled"></i>' : 
                 '<i class="ion-information-circled"></i>';
    const toast = $(`
      <div class="toast-notification ${type}">
        <span class="toast-icon">${icon}</span>
        <span class="toast-message">${message}</span>
        <span class="toast-close">&times;</span>
      </div>
    `);
    
    $('body').append(toast);
    
    // Auto hide after 3 seconds
    setTimeout(function() {
      toast.addClass('hide');
      setTimeout(function() {
        toast.remove();
      }, 300);
    }, 3000);
    
    // Close on click
    toast.find('.toast-close').on('click', function() {
      toast.addClass('hide');
      setTimeout(function() {
        toast.remove();
      }, 300);
    });
  };

  // Preloader
  function stylePreloader() {
    $('body').addClass('preloader-deactive');
  }

  // Background Image
  $('[data-bg-img]').each(function() {
    $(this).css('background-image', 'url(' + $(this).data("bg-img") + ')');
  });

  // Off Canvas JS - use delegation so menu icon works on all pages (e.g. shop?category=25) even if DOM is updated later
  var canvasWrapper = $(".off-canvas-wrapper");
  $(document).off('click.btn-menu').on('click.btn-menu', '.btn-menu', function(e) {
    e.preventDefault();
    e.stopPropagation();
    $(".off-canvas-wrapper").addClass('active');
  });
  $(document).off('click.offcanvas-close').on('click.offcanvas-close', '.off-canvas-wrapper .close-action .btn-close, .off-canvas-wrapper .off-canvas-overlay', function() {
    $(".off-canvas-wrapper").removeClass('active');
  });

  // Build main navigation: Home and Shop only
  (function initMainNav() {
    var $menu = $('#main-nav-menu');
    if (!$menu.length) return;

    function buildNav() {
      $menu.html(
        '<li><a class="ml--2" href="/">Home</a></li>' +
        '<li><a href="shop">Shop</a></li>'
      );
      var path = (window.location.pathname || '').toLowerCase();
      $menu.find('li').removeClass('active');
      var isHome = path === '/' || path.indexOf('index') !== -1;
      var isProduct = path.indexOf('shop') !== -1 && !path.match(/shop-(cart|checkout|wishlist|compare)/);
      if (isProduct) {
        $menu.find('a[href="shop"]').parent('li').addClass('active');
      } else if (isHome) {
        $menu.find('a[href="/"]').parent('li').addClass('active');
      }
      if (typeof window.updateNavScrollButtons === 'function') {
        setTimeout(window.updateNavScrollButtons, 50);
      }
      var $navArea = $menu.closest('.header-navigation-area');
      if ($navArea.length) $navArea.scrollLeft(0);
    }

    function initSlicknav() {
      var $menu = $('.main-menu');
      var $target = $('.res-mobile-menu');
      if (!$menu.length || !$target.length) return;
      // If Slicknav was already inited, remove it so we can create a fresh one (e.g. after categories load)
      if ($menu.data('plugin_slicknav')) {
        $target.empty();
        $menu.removeData('plugin_slicknav');
      }
      $menu.slicknav({
        appendTo: '.res-mobile-menu',
        closeOnClick: true,
        removeClasses: true,
        closedSymbol: '<i class="fa fa-angle-down"></i>',
        openedSymbol: '<i class="fa fa-angle-up"></i>'
      });
    }

    buildNav();
    initSlicknav();
  })();

  // Search Box JS
  var searchwrapper = $(".search-box-wrapper");
  $(".btn-search-menu").on('click', function() {
    searchwrapper.addClass('show');
    $("#search-input").focus();
  });
  $(".search-close").on('click', function() {
    searchwrapper.removeClass('show');
  });

  // Global Search Functionality - Handle all search forms
  function handleSearch(searchTerm) {
    if (searchTerm && searchTerm.trim() !== '') {
      // Redirect to shop page with search query parameter (keep search term in input)
      window.location.href = 'shop?search=' + encodeURIComponent(searchTerm.trim());
    }
  }

  // Clear search functionality
  function clearSearch() {
    // Clear all search inputs
    $('#search').val('');
    $('#search-input').val('');
    // If on shop page, reload without search parameter
    if (window.location.pathname.includes('shop')) {
      window.location.href = 'shop';
    }
  }

  // Handle header search form
  $('.header-search-box form').on('submit', function(e) {
    e.preventDefault();
    var searchTerm = $(this).find('#search').val();
    handleSearch(searchTerm);
  });

  // Handle search modal form
  $('.search-box-form-wrap form').on('submit', function(e) {
    e.preventDefault();
    var searchTerm = $(this).find('#search-input').val();
    handleSearch(searchTerm);
    searchwrapper.removeClass('show');
  });

  // Handle search button clicks
  $('.btn-src, .search-button').on('click', function(e) {
    e.preventDefault();
    var form = $(this).closest('form');
    var searchInput = form.find('#search, #search-input');
    var searchTerm = searchInput.val();
    handleSearch(searchTerm);
    if (searchwrapper.hasClass('show')) {
      searchwrapper.removeClass('show');
    }
  });

  // Product Quick View JS
  var quickViewModal = $(".product-quick-view-modal");
  $(".btn-close, .canvas-overlay").on('click', function() {
    quickViewModal.removeClass('active');
    
    // Remove fix class from both html and body
    $('html, body').removeClass('fix');
    
    // Restore scroll position
    const scrollPosition = $('html').data('scroll-position') || $('body').data('scroll-position') || 0;
    
    // Use requestAnimationFrame to ensure DOM updates before scrolling
    requestAnimationFrame(function() {
      window.scrollTo(0, scrollPosition);
      $('html, body').removeData('scroll-position');
    });
  });

  // Format price with LKR currency
  function formatPrice(price) {
    if (price === null || price === undefined || price === 0) {
      return 'LKR 0.00';
    }
    return 'LKR ' + parseFloat(price).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  // Load and render sidebar cart items
  function loadSidebarCart() {
    if (typeof CartService === 'undefined') {
      return;
    }
    
    const cart = CartService.getCart();
    const sidebarItemsContainer = $('#sidebar-cart-items');
    const sidebarSubtotalEl = $('#sidebar-cart-subtotal');
    
    if (!sidebarItemsContainer.length) {
      return; // Sidebar cart not on this page
    }
    
    sidebarItemsContainer.empty();
    
    if (cart.length === 0) {
      sidebarItemsContainer.html('<li class="text-center" style="padding: 20px;">Your cart is empty.</li>');
      if (sidebarSubtotalEl.length) {
        sidebarSubtotalEl.text('LKR 0.00');
      }
      return;
    }
    
    let subtotal = 0;
    
    cart.forEach((item) => {
      const itemTotal = (item.price || 0) * (item.quantity || 1);
      subtotal += itemTotal;
      
      const itemHtml = `
        <li class="cart-item">
          <div class="cart-img">
            <a href="shop.html">
              <img src="${item.imageURL || item.imageUrl || 'https://www.holoimage.net/images/no-image.jpg'}" alt="${item.name || 'Product'}">
            </a>
          </div>
          <div class="cart-content">
            <h5>
              <a href="shop.html">${item.name || 'Product'}</a>
            </h5>
            <span class="cart-price">${formatPrice(item.price || 0)} × ${item.quantity || 1}</span>
            <div class="cart-item-close">
              <a href="javascript:void(0);" class="remove-sidebar-item" data-product-id="${item.id}">
                <i class="pe-7s-close"></i>
              </a>
            </div>
          </div>
        </li>
      `;
      
      sidebarItemsContainer.append(itemHtml);
    });
    
    if (sidebarSubtotalEl.length) {
      sidebarSubtotalEl.text(formatPrice(subtotal));
    }
  }
  
  // Handle remove item from sidebar cart
  $(document).on('click', '.remove-sidebar-item', function(e) {
    e.preventDefault();
    if (typeof CartService !== 'undefined') {
      const productId = $(this).data('product-id');
      CartService.removeFromCart(productId);
      loadSidebarCart();
      CartService.updateCartCount();
      
      // If on cart page, trigger cart reload
      if ($('#cart-items-container').length) {
        // Trigger custom event to reload cart page
        $(document).trigger('cartUpdated');
        // Fallback: reload after a short delay if event handler doesn't exist
        setTimeout(function() {
          if ($('#cart-items-container').html().includes(productId)) {
            location.reload();
          }
        }, 100);
      }
    }
  });

  // Sidebar Cart JS - Navigate to cart page instead of opening sidebar
  var sidebarCartModal = $(".sidebar-cart-modal");
  $(".cart-icon").on('click', function(e) {
    e.preventDefault();
    window.location.href = '/shop-cart';
  });
  $(".sidebar-cart-content .cart-close").on('click', function() {
    sidebarCartModal.removeClass('sidebar-cart-active');
    $(".sidebar-cart-overlay").removeClass('show');
  });

  // Checkout Toggle Active
  $('.checkout-coupon-active').on('click', function(e) {
    e.preventDefault();
    $('.checkout-coupon-content').slideToggle(1000);
  });

  // Swipper JS

  // Home Slider (multi-slide with pagination)
  var homeSwiper = null;

  function escapeHomeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function initHomeSlider() {
    if (typeof Swiper === 'undefined' || !$('.home-slider-container').length) {
      return;
    }

    if (homeSwiper && typeof homeSwiper.destroy === 'function') {
      homeSwiper.destroy(true, true);
      homeSwiper = null;
    }

    var slideCount = $('.home-slider-container .swiper-slide').length;
    homeSwiper = new Swiper('.home-slider-container', {
      slidesPerView: 1,
      loop: slideCount > 1,
      spaceBetween: 0,
      autoplay: slideCount > 1 ? {
        delay: 5000,
        disableOnInteraction: false,
      } : false,
      pagination: {
        el: '.home-slider-container .swiper-pagination',
        clickable: true,
      },
      navigation: {
        nextEl: '.home-slider-container .swiper-button-next',
        prevEl: '.home-slider-container .swiper-button-prev',
      }
    });
  }

  function buildOfferChip(text) {
    if (!text) return '';
    return '<span class="sensory-offer-chip">' + escapeHomeHtml(text) + '</span>';
  }

  function buildHeroSlide(banner) {
    var imageUrl = banner.imageUrl || '/assets/img/new/slide4.jpeg';
    var title = escapeHomeHtml(banner.title || 'Special offer');
    var linkUrl = escapeHomeHtml(banner.linkUrl || 'shop');
    var chip = buildOfferChip(banner.subtitle || banner.title);

    return `
      <div class="swiper-slide">
        <a class="sensory-hero-link" href="${linkUrl}">
          <img src="${imageUrl}" alt="${title}">
          ${chip}
        </a>
      </div>
    `;
  }

  function buildOfferCard(banner) {
    var imageUrl = banner.imageUrl || '/assets/img/new/121.jpg';
    var title = escapeHomeHtml(banner.title || 'Special offer');
    var linkUrl = escapeHomeHtml(banner.linkUrl || 'shop');
    var chip = buildOfferChip(banner.subtitle || banner.title);
    return '<a class="sensory-offer-card" href="' + linkUrl + '"><img src="' + imageUrl + '" alt="' + title + '">' + chip + '</a>';
  }

  function renderOfferBanners(offerBanners) {
    var $grid = $('#offer-banners');
    if (!$grid.length || !offerBanners.length) {
      return;
    }
    $grid.html(offerBanners.map(buildOfferCard).join(''));
  }

  function formatBannerDiscountChip(banner) {
    if (banner.badgeText || banner.BadgeText) {
      return String(banner.badgeText || banner.BadgeText);
    }
    var discountType = banner.discountType || banner.DiscountType || '';
    var discountValue = Number(banner.discountValue ?? banner.DiscountValue);
    if (!discountType || !Number.isFinite(discountValue) || discountValue <= 0) {
      return '';
    }
    if (String(discountType).toLowerCase() === 'percentage') {
      return discountValue + '% OFF';
    }
    return 'LKR ' + discountValue.toFixed(2) + ' OFF';
  }

  function buildPromoBanner(banner) {
    if (typeof window.normalizeWebsiteBanner === 'function') {
      banner = window.normalizeWebsiteBanner(banner) || banner;
    }
    var imageUrl = banner.imageUrl || banner.imageURL || '';
    var title = escapeHomeHtml(banner.title || '');
    var subtitle = escapeHomeHtml(banner.subtitle || '');
    var discountChip = formatBannerDiscountChip(banner);
    var bannerType = String(banner.type || banner.Type || '').toLowerCase();
    var productIds = Array.isArray(banner.productIds) ? banner.productIds : [];
    var linkUrl = banner.linkUrl || banner.linkURL || 'shop';
    if (bannerType === 'offer' && productIds.length > 0 && banner.id != null) {
      linkUrl = 'shop?offerBanner=' + encodeURIComponent(banner.id);
    } else if (productIds.length > 0 && banner.id != null) {
      linkUrl = 'shop?offerBanner=' + encodeURIComponent(banner.id);
    }
    linkUrl = escapeHomeHtml(linkUrl);
    var buttonText = escapeHomeHtml(banner.buttonText || banner.ButtonText || 'Shop now');
    var imageHtml = imageUrl
      ? '<img src="' + escapeHomeHtml(imageUrl) + '" alt="' + (title || 'Giggles & Gifts offer') + '">'
      : '';
    var copyHtml = (title || subtitle)
      ? '<div class="sm-promo-banner-copy">' +
          (title ? '<h3>' + title + '</h3>' : '') +
          (subtitle ? '<p>' + subtitle + '</p>' : '') +
          '<span>' + buttonText + '</span>' +
        '</div>'
      : '';
    var chipHtml = discountChip
      ? '<span class="sm-offer-badge sm-promo-offer-badge">' + escapeHomeHtml(discountChip) + '</span>'
      : '';
    return '<a class="sm-promo-banner" href="' + linkUrl + '">' + chipHtml + imageHtml + copyHtml + '</a>';
  }

  function renderPromoBanners(banners) {
    var $slot = $('#promo-banners');
    if (!$slot.length || !banners || !banners.length) {
      return false;
    }
    var usable = banners.filter(function (banner) {
      return banner && (banner.imageUrl || banner.imageURL || banner.title);
    });
    if (!usable.length) {
      return false;
    }
    $slot.html(usable.slice(0, 3).map(buildPromoBanner).join(''));
    $('#sm-promo-fallback').hide();
    return true;
  }

  function applyHomeHeroBanner(heroBanners) {
    if (!heroBanners || !heroBanners.length) {
      return;
    }
    var banner = heroBanners[0];
    if (typeof window.normalizeWebsiteBanner === 'function') {
      banner = window.normalizeWebsiteBanner(banner) || banner;
    }
    var imageUrl = banner.imageUrl || banner.imageURL || '';
    var $heroImg = $('.sm-hero-circle img').first();
    if (imageUrl && $heroImg.length) {
      $heroImg.attr('src', imageUrl).attr('alt', banner.title || 'Giggles & Gifts');
    }
    var productIds = Array.isArray(banner.productIds) ? banner.productIds : [];
    var heroLink = banner.linkUrl || 'shop';
    if (productIds.length > 0 && banner.id != null) {
      heroLink = 'shop?offerBanner=' + encodeURIComponent(banner.id);
    }
    var $heroBtn = $('.sm-hero-actions .sm-btn-hero').first();
    if ($heroBtn.length && heroLink) {
      $heroBtn.attr('href', heroLink);
    }
  }

  async function loadWebsiteBanners() {
    var heroContainer = $('#hero-banners');

    if (typeof fetchBanners !== 'function') {
      initHomeSlider();
      return;
    }

    initHomeSlider();

    try {
      var heroBanners = await fetchBanners('Hero');
      if (heroContainer.length && heroBanners && heroBanners.length > 0) {
        heroContainer.html(heroBanners.map(buildHeroSlide).join(''));
        initHomeSlider();
      }
      applyHomeHeroBanner(heroBanners);
    } catch (error) {
      // Keep the static hero slides
    }

    try {
      var promoBanners = typeof fetchPromoBanners === 'function'
        ? await fetchPromoBanners()
        : await fetchBanners('Offer');
      if (promoBanners && promoBanners.length) {
        if ($('#promo-banners').length) {
          renderPromoBanners(promoBanners);
        }
        var offerOnly = promoBanners.filter(function (banner) {
          return String(banner.type || '').toLowerCase() === 'offer';
        });
        if ($('#offer-banners').length && offerOnly.length) {
          renderOfferBanners(offerOnly);
        }
      }
    } catch (error) {
      // Keep the static promo if banners cannot be loaded
    }
  }

  function triggerHomeSliderContentAnimation() {
    var $container = $('.home-slider-container');
    $container.find('.home-slider-overlay-content').removeClass('slide-content-animate');
    setTimeout(function() {
      $container.find('.swiper-slide-active .home-slider-overlay-content').addClass('slide-content-animate');
    }, 10);
  }

  // Gallery Trends Slider
  var swiper = new Swiper('.product-category1-slider-container', {
    slidesPerView: 3,
    slidesPerGroup: 1,
    loop: true,
    spaceBetween : 30,
    breakpoints: {
      1500:{
          slidesPerView : 3
      },

      992:{
          slidesPerView : 3
      },

      768:{
          slidesPerView : 2
      },

      625:{
          slidesPerView : 2,
          spaceBetween : 15,
      },

      0:{
          slidesPerView : 1
      }
    }
  });

  // Category Slider
  var swiper = new Swiper('.category-slider-container', {
    slidesPerView : 6,
    loop: true,
    loopedSlides: 5,
    loopAdditionalSlides: 2,
    speed: 1000,
    spaceBetween : 30,
    autoplay: {
      delay: 3000,
      disableOnInteraction: false,
      pauseOnMouseEnter: false,
      stopOnLastSlide: false,
    },
    allowTouchMove: true,
    watchSlidesProgress: true,
    watchSlidesVisibility: true,
    breakpoints: {
      1200:{
          slidesPerView : 6,
          spaceBetween : 30
      },

      992:{
          slidesPerView : 4,
          spaceBetween : 30
      },

      768:{
          slidesPerView : 3,
          spaceBetween : 30

      },

      576:{
          slidesPerView : 3,
          spaceBetween : 30
      },

      380:{
          slidesPerView : 2,
          spaceBetween : 30
      },

      0:{
          slidesPerView : 2,
          spaceBetween : 30
      }
    }
  });

  // Swipper JS
  var swiper = new Swiper('.product4-slider-container', {
    slidesPerView: 4,
    loop: true,
    spaceBetween : 30,
    autoplay: {
      delay: 4000,
    },
    navigation: {
      nextEl: '.product4-slider-container .swiper-button-next',
      prevEl: '.product4-slider-container .swiper-button-prev',
    },
    breakpoints: {
      1200:{
          slidesPerView : 4
      },

      992:{
          slidesPerView : 3
      },

      768:{
          slidesPerView : 2

      },

      576:{
          slidesPerView : 2
      },

      0:{
          slidesPerView : 1
      }
    }
  });

  var ProductNav = new Swiper('.single-product-nav-slider', {
    spaceBetween: 11,
    slidesPerView: 3,
    freeMode: true,
    navigation: {
      nextEl: '.single-product-nav-slider .swiper-button-next',
      prevEl: '.single-product-nav-slider .swiper-button-prev',
    },
  });

  var ProductThumb = new Swiper('.single-product-thumb-slider', {
    freeMode: true,
    effect: 'fade',
    fadeEffect: {
      crossFade: true,
    },
    thumbs: {
      swiper: ProductNav
    }
  });

  // Gallery Trends Slider
  var swiper = new Swiper('.testimonial-slider-container', {
    slidesPerView: 3,
    slidesPerGroup: 1,
    loop: true,
    spaceBetween : 40,
    breakpoints: {
      1500:{
          slidesPerView : 3,
          spaceBetween : 40
      },

      992:{
          slidesPerView : 3,
          spaceBetween : 30
      },

      768:{
          slidesPerView : 2,
          spaceBetween : 30
      },

      620:{
          slidesPerView : 2,
          spaceBetween : 15,
      },

      0:{
          slidesPerView : 1
      }
    }
  });

  $('.product-tab1-slider').slick({
    dots: false,
    speed: 300,
    slidesToShow: 4,
    slidesToScroll: 1,
    arrows: true,
    responsive: [
      {
        breakpoint: 1024,
        settings: {
          slidesToShow: 3,
          slidesToScroll: 3,
          infinite: true,
          dots: true
        }
      },
      {
        breakpoint: 768,
        settings: {
          slidesToShow: 2,
          slidesToScroll: 2
        }
      },
      {
        breakpoint: 520,
        settings: {
          slidesToShow: 1,
          slidesToScroll: 1
        }
      }
    ]
  });

  $('.testimonial-slider').slick({
    dots: false,
    infinite: true,
    speed: 300,
    slidesToShow: 3,
    slidesToScroll: 1,
    arrows: false,
    responsive: [
      {
        breakpoint: 992,
        settings: {
          slidesToShow: 2,
          slidesToScroll: 2,
          infinite: true
        }
      },
      {
        breakpoint: 576,
        settings: {
          slidesToShow: 1,
          slidesToScroll: 1
        }
      }
    ]
  });

  // Fancybox Js
  $('.lightbox-image').fancybox();
  // Isotope and data filter
  function isotopePortfolio() {
    var $grid = $('.masonry-grid').isotope({
      itemSelector: '.masonry-item',
      masonry: {
        columnWidth: 1
      }
    })
    // Isotope Masonry
    var $gridMasonry = $('.masonry-style').isotope({
      itemSelector: '.masonry-item'
    })
    // Isotope filter Menu
    $('.portfolio-filter-menu').on( 'click', 'button', function() {
      var filterValue = $(this).attr('data-filter');
      $grid.isotope({ filter: filterValue });
      $gridMasonry.isotope({ filter: filterValue });
      var filterMenuactive = $(".portfolio-filter-menu button");
      filterMenuactive.removeClass('active');
      $(this).addClass('active');
    });
  }
  
  // Images Zoom
  $('.zoom-hover').zoom();

  // Countdown JS
  var now = new Date();
  var day = now.getDate();
  var month = now.getMonth() + 1;
  var year = now.getFullYear() + 1;
  var nextyear = month + '/' + day + '/' + year + ' 07:07:07';

  $('.countdown-timer').countdown({
    date: '1/2/2022 23:59:59', // TODO Date format: 07/27/2017 17:00:00
    offset: +2, // TODO Your Timezone Offset
    day: 'Day',
    days: 'Days',
    hideOnComplete: true
  }, function (container) {
    // Countdown completed
  });

  //Shop review btn
  $(".review-write-btn").on('click', function() {
    $(".product-review-form").toggle('active');
  });

  // Product Qty
  var proQty = $(".pro-qty");
  proQty.append('<a href="#" class="inc qty-btn"><i class="fa fa-plus"></i></a>');
  proQty.append('<a href="#" class= "dec qty-btn"><i class="fa fa-minus"></i></a>');
  $('.qty-btn').on('click', function(e) {
    e.preventDefault();
    var $button = $(this);
    var $input = $button.parent().find('input');
    var oldValue = parseInt($input.val()) || 1;
    var maxStock = parseInt($input.attr('data-max-stock')) || parseInt($input.attr('max')) || 9999;
    var newVal = oldValue;
    
    if ($button.hasClass('inc')) {
      newVal = oldValue + 1;
      // Check max stock limit
      if (newVal > maxStock) {
        // Show warning if showToast function exists
        if (typeof showToast === 'function') {
          showToast('Maximum available quantity is ' + maxStock, 'warning');
        } else {
          alert('Maximum available quantity is ' + maxStock);
        }
        return; // Don't update the value
      }
    } else {
      // Don't allow decrementing below 1
      if (oldValue > 1) {
        newVal = oldValue - 1;
      } else {
        newVal = 1;
      }
    }
    $input.val(newVal);
  });

  // Product Qty Style 2
  var proQty2 = $(".pro-qty-style2");
  proQty2.append('<a href="#" class="inc qty-btn"><i class="fa fa-plus"></i></a>');
  proQty2.append('<a href="#" class= "dec qty-btn"><i class="fa fa-window-minimize"></i></a>');
  // Note: The click handler above already handles all .qty-btn elements with stock validation

  //Checkout Page Checkbox Accordion
  $("#create_pwd").on("change", function() {
    $(".account-create").slideToggle("100");
  });

  $("#ship_to_different").on("change", function() {
    $(".ship-to-different").slideToggle("100");
  });

  $('.checkout-toggle').on('click', function() {
    $('.open-toggle').slideToggle(1000);
  });

  var checked = $( '.sin-payment input:checked' )
  if(checked){
    $(checked).siblings( '.payment-box' ).slideDown(900);
  };
 $( '.sin-payment input' ).on('change', function() {
    $( '.payment-box' ).slideUp(900);
    $(this).siblings( '.payment-box' ).slideToggle(900);
  });

  //Tippy Tooltip JS
  tippy('.ht-tooltip', {
    inertia: true,
    animation: 'shift-away',
    arrow: true
  });

  // Scroll Top Hide Show
  var varWindow = $(window);
  varWindow.on('scroll', function(){
    if ($(this).scrollTop() > 250) {
      $('.scroll-to-top').fadeIn();
    } else {
      $('.scroll-to-top').fadeOut();
    }

    // Sticky Header
    if($('.sticky-header').length){
      var windowpos = $(this).scrollTop();
      if (windowpos >= 80) {
        $('.sticky-header').addClass('sticky');
      } else {
        $('.sticky-header').removeClass('sticky');
      }
    }
  });

  // Main nav scroll arrows (work always, not only when sticky)
  var navScrollStep = 180;
  function updateNavScrollButtons() {
    $('.header-area.sticky-header .header-nav-scroll-wrap').each(function() {
      var $wrap = $(this);
      var $nav = $wrap.find('.header-navigation-area');
      var $left = $wrap.find('.nav-scroll-left');
      var $right = $wrap.find('.nav-scroll-right');
      if (!$nav.length || !$nav[0]) return;
      var scrollLeft = $nav.scrollLeft();
      var maxScroll = $nav[0].scrollWidth - $nav[0].clientWidth;
      $left.prop('disabled', scrollLeft <= 0);
      $right.prop('disabled', maxScroll <= 0 || scrollLeft >= maxScroll - 1);
    });
  }
  $(document).on('click', '.header-area.sticky-header .nav-scroll-left', function() {
    var $nav = $(this).closest('.header-nav-scroll-wrap').find('.header-navigation-area');
    if ($nav.length) {
      $nav.scrollLeft($nav.scrollLeft() - navScrollStep);
      updateNavScrollButtons();
    }
  });
  $(document).on('click', '.header-area.sticky-header .nav-scroll-right', function() {
    var $nav = $(this).closest('.header-nav-scroll-wrap').find('.header-navigation-area');
    if ($nav.length) {
      $nav.scrollLeft($nav.scrollLeft() + navScrollStep);
      updateNavScrollButtons();
    }
  });
  $(document).on('scroll', '.header-area.sticky-header .header-navigation-area', updateNavScrollButtons);
  $(window).on('scroll resize', function() {
    setTimeout(updateNavScrollButtons, 50);
  });
  $(document).ready(function() {
    setTimeout(updateNavScrollButtons, 100);
  });
  window.updateNavScrollButtons = updateNavScrollButtons;

  // Ajax Contact Form JS
  var form = $('#contact-form');
  var formMessages = $('.form-message');

  $(form).submit(function(e) {
    e.preventDefault();
    var formData = form.serialize();
    $.ajax({
        type: 'POST',
        url: form.attr('action'),
        data: formData
    }).done(function(response) {
        // Make sure that the formMessages div has the 'success' class.
        $(formMessages).removeClass('alert alert-danger');
        $(formMessages).addClass('alert alert-success fade show');

        // Set the message text.
        formMessages.html("<button type='button' class='btn-close' data-bs-dismiss='alert'>&times;</button>");
        formMessages.append(response);

        // Clear the form.
        $('#contact-form input,#contact-form textarea').val('');
    }).fail(function(data) {
        // Make sure that the formMessages div has the 'error' class.
        $(formMessages).removeClass('alert alert-success');
        $(formMessages).addClass('alert alert-danger fade show');

        // Set the message text.
        if (data.responseText === '') {
            formMessages.html("<button type='button' class='btn-close' data-bs-dismiss='alert'>&times;</button>");
            formMessages.append(data.responseText);
        } else {
            $(formMessages).text('Oops! An error occurred and your message could not be sent.');
        }
    });
  });

  //Scroll To Top
  $('.scroll-to-top').on('click', function(){
    $('html, body').animate({scrollTop : 0},800);
    return false;
  });

  // Reveal Footer JS
  let revealId = $(".reveal-footer"),
    footerHeight = revealId.outerHeight(),
    windowWidth = $(window).width(),
    windowHeight = $(window).outerHeight(),
    leftFixedHeader = $("header.fixed-left"),
    leftFixedHeaderWidth = leftFixedHeader.innerWidth();

  if (windowWidth > 991 && windowHeight > footerHeight) {
    $(".site-wrapper-reveal").css({
      'margin-bottom': footerHeight + 'px'
    });
  }
  
  
/* ==========================================================================
   When document is loading, do
   ========================================================================== */
  
  // Render Categories
  function renderCategories(categories) {
    const container = $('#categories-container');
    if (!container.length || !categories || categories.length === 0) {
      return;
    }

    // Show up to 6 categories from the randomized list
    const displayCategories = categories.slice(0, 6);
    const styleClasses = ['thumb-style1', 'thumb-style2', 'thumb-style3'];
    const marginClasses = ['', 'mt-xs-25', 'mt-sm-25'];
    
    container.empty();
    
    displayCategories.forEach((category, index) => {
      const styleClass = styleClasses[index % 3];
      const marginClass = marginClasses[index % 3];
      // Get imageUrl from category data (check both imageUrl and imageURL for compatibility)
      const categoryImage = category.imageUrl || category.imageURL;
      
      // Build style attribute for background image only if imageUrl exists
      let backgroundStyle = '';
      if (categoryImage && categoryImage.trim() !== '') {
        backgroundStyle = `style="background-image: url('${categoryImage}'); background-size: cover; background-position: center; background-repeat: no-repeat;"`;
      }
      
      const categoryHtml = `
        <div class="col-sm-6 col-md-4">
          <div class="category-item ${marginClass}">
            <div class="thumb ${styleClass}" ${backgroundStyle}>
              <div class="content">
                <div class="contact-info">
                  <h2 class="title">${category.name}</h2>
                </div>
                <a class="btn-link" href="shop?category=${category.id}">Shop Now</a>
              </div>
            </div>
          </div>
        </div>
      `;
      container.append(categoryHtml);
    });
  }

  let categoryTabsScrollIntervalId = null;

  function renderCategoryTabs(categories) {
    const tabsContainer = $('#category-tabs');
    if (!tabsContainer.length) {
      return;
    }

    tabsContainer.empty();

    tabsContainer.append(`
      <li class="nav-item" role="presentation">
        <button class="nav-link active" id="all-items-tab" type="button" role="tab" aria-selected="true">All</button>
      </li>
    `);

    if (!categories || categories.length === 0) {
      initCategoryTabsScroll();
      return;
    }

    categories.forEach(function(category) {
      const tabId = 'category-' + category.id + '-tab';
      tabsContainer.append(
        '<li class="nav-item" role="presentation">' +
          '<button class="nav-link" id="' + tabId + '" type="button" role="tab" aria-selected="false" data-category-id="' + category.id + '">' +
            category.name +
          '</button>' +
        '</li>'
      );
    });

    initCategoryTabsScroll();
  }

  function scrollCategoryTabs(direction) {
    const scrollEl = document.getElementById('category-tabs-scroll');
    if (!scrollEl) return;
    const amount = Math.max(180, scrollEl.clientWidth * 0.6);
    scrollEl.scrollBy({ left: direction * amount, behavior: 'smooth' });
  }

  function initCategoryTabsScroll() {
    if (categoryTabsScrollIntervalId) {
      clearInterval(categoryTabsScrollIntervalId);
      categoryTabsScrollIntervalId = null;
    }

    const $wrap = $('.sm-category-tabs-wrap');
    const scrollEl = document.getElementById('category-tabs-scroll');
    if (!$wrap.length || !scrollEl) return;

    function updateScrollButtons() {
      const maxScroll = scrollEl.scrollWidth - scrollEl.clientWidth;
      $wrap.find('.sm-cat-scroll-left').prop('disabled', scrollEl.scrollLeft <= 4);
      $wrap.find('.sm-cat-scroll-right').prop('disabled', scrollEl.scrollLeft >= maxScroll - 4);
      $wrap.toggleClass('is-scrollable', maxScroll > 8);
    }

    updateScrollButtons();

    if (!scrollEl._smCatScrollBound) {
      scrollEl._smCatScrollBound = true;
      scrollEl.addEventListener('scroll', updateScrollButtons);
      window.addEventListener('resize', updateScrollButtons);
    }

    if (!$wrap.data('smCatScrollBound')) {
      $wrap.data('smCatScrollBound', true);

      $wrap.on('click', '.sm-cat-scroll-left', function() {
        scrollCategoryTabs(-1);
      });
      $wrap.on('click', '.sm-cat-scroll-right', function() {
        scrollCategoryTabs(1);
      });

      $wrap.on('mouseenter focusin', function() {
        if (categoryTabsScrollIntervalId) {
          clearInterval(categoryTabsScrollIntervalId);
          categoryTabsScrollIntervalId = null;
        }
      });

      $wrap.on('mouseleave', function() {
        startCategoryTabsAutoScroll();
      });
    }

    startCategoryTabsAutoScroll();
  }

  function startCategoryTabsAutoScroll() {
    const scrollEl = document.getElementById('category-tabs-scroll');
    const $wrap = $('.sm-category-tabs-wrap');
    if (!scrollEl || !$wrap.length || !$wrap.hasClass('is-scrollable')) {
      return;
    }

    if (categoryTabsScrollIntervalId) {
      clearInterval(categoryTabsScrollIntervalId);
    }

    categoryTabsScrollIntervalId = setInterval(function() {
      if ($wrap.is(':hover') || $wrap.find(':focus').length) {
        return;
      }

      const maxScroll = scrollEl.scrollWidth - scrollEl.clientWidth;
      if (maxScroll <= 8) return;

      const nextLeft = scrollEl.scrollLeft + 160;
      if (nextLeft >= maxScroll - 4) {
        scrollEl.scrollTo({ left: 0, behavior: 'smooth' });
      } else {
        scrollEl.scrollBy({ left: 160, behavior: 'smooth' });
      }
    }, 4500);
  }

  function getProductStockDetails(product, stockMap) {
    const resolvedStockMap = stockMap instanceof Map ? stockMap : new Map();
    const stockInfo = typeof window.resolveProductStock === 'function'
      ? window.resolveProductStock(product, resolvedStockMap)
      : {
          quantity: resolvedStockMap.get(product.id) || resolvedStockMap.get(String(product.id)) || resolvedStockMap.get(Number(product.id)) || 0,
          hasRecord: resolvedStockMap.has(product.id) || resolvedStockMap.has(String(product.id)) || resolvedStockMap.has(Number(product.id))
        };
    const hasRecord = stockInfo.hasRecord;
    const productStock = product && product.maxStock !== undefined && !hasRecord
      ? product.maxStock
      : stockInfo.quantity;
    const isOutOfStock = hasRecord && productStock <= 0;

    return {
      productStock: productStock,
      isOutOfStock: isOutOfStock,
      stockBadgeHtml: isOutOfStock
        ? '<span class="stock-badge out-of-stock">Out of Stock</span>'
        : (hasRecord && productStock > 0 && productStock <= 5 ? `<span class="stock-badge low-stock">Only ${productStock} left</span>` : '')
    };
  }

  // Render Products
  function renderProducts(products, containerId = '#products-container', stockMap = new Map()) {
    const container = $(containerId);
    if (!container.length || !products || products.length === 0) {
      container.html('<div class="col-12"><p class="text-center">No products found.</p></div>');
      return;
    }

    container.empty();
    
    if (!products || products.length === 0) {
      container.html('<div class="col-12"><p class="text-center">No products found.</p></div>');
      return;
    }
    
    const defaultImage = 'https://www.holoimage.net/images/no-image.jpg';
    
    products.forEach((product) => {
      const firstGallery = Array.isArray(product.images) && product.images.length
        ? (typeof product.images[0] === 'string' ? product.images[0] : (product.images[0].imageUrl || product.images[0].imageURL))
        : '';
      const productImage = [product.imageURL, product.imageUrl, firstGallery].find(function (url) {
        return url && String(url).trim() && !/no-image|holoimage\.net/i.test(String(url));
      }) || defaultImage;
      const productPrice = typeof getEffectivePrice === 'function' ? getEffectivePrice(product) : (product.sellingPrice > 0 ? product.sellingPrice : (product.unitPrice > 0 ? product.unitPrice : 0));
      const formattedPrice = typeof renderPriceHtml === 'function' ? renderPriceHtml(product) : formatPrice(productPrice);
      
      // Store product data for cart/wishlist and modal (include description and images)
      const productData = {
        id: product.id,
        name: product.name,
        imageURL: product.imageURL,
        imageUrl: product.imageUrl,
        images: product.images || [],
        imageUrls: product.imageUrls || [],
        sellingPrice: product.sellingPrice,
        unitPrice: product.unitPrice,
        maximumRetailPrice: product.maximumRetailPrice,
        offerPrice: product.offerPrice || null,
        offerBadgeText: product.offerBadgeText || null,
        offerBannerId: product.offerBannerId || null,
        description: product.description || '',
        categoryName: product.categoryName || '',
        categoryId: product.categoryId || null,
        sku: product.sku || product.SKU || '',
        code: product.code || '',
        unitOfMeasureName: product.unitOfMeasureName || '',
        maxStock: product.maxStock
      };
      const { isOutOfStock, stockBadgeHtml, productStock } = getProductStockDetails(product, stockMap);
      productData.maxStock = productStock;
      const productDataAttr = JSON.stringify(productData).replace(/'/g, '&#39;');
      
      const categoryLabel = product.categoryName || product.category || '';
      const ageChip = window.SensoryParent && typeof window.SensoryParent.ageChipHtml === 'function'
        ? window.SensoryParent.ageChipHtml(product)
        : '';
      const rawDesc = (product.description || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
      const shortDesc = rawDesc.length > 90 ? rawDesc.slice(0, 87) + '...' : rawDesc;
      const stockLimit = productStock > 0 ? productStock : 99;
      const cartActionHtml = isOutOfStock
        ? `<button type="button" class="sm-fav-add disabled" disabled>Add to Cart</button>`
        : `<div class="sm-fav-qty">
             <button type="button" class="sm-fav-qty-btn" data-dir="-1" aria-label="Decrease quantity">−</button>
             <input class="sm-fav-qty-input" type="text" value="1" inputmode="numeric" data-max-stock="${stockLimit}">
             <button type="button" class="sm-fav-qty-btn" data-dir="1" aria-label="Increase quantity">+</button>
           </div>
           <button type="button" class="sm-fav-add add-to-cart-btn" data-product='${productDataAttr}'>Add to Cart</button>`;

      const productHtml = `
        <div class="col-lg-4 col-md-6 col-sm-6">
          <article class="product-item sm-fav-card ${isOutOfStock ? 'out-of-stock-item' : ''}" data-product='${productDataAttr}'>
            <div class="product-thumb">
              ${stockBadgeHtml}
              <button type="button" class="sm-fav-wish add-to-wishlist-btn" data-product='${productDataAttr}' aria-label="Add to wishlist"><i class="ion-heart"></i></button>
              <img src="${productImage}" alt="${product.name}" onerror="this.onerror=null;this.src='https://www.holoimage.net/images/no-image.jpg';">
            </div>
            <div class="product-info">
              ${categoryLabel ? `<div class="sm-card-meta">${categoryLabel}</div>` : ''}
              ${ageChip}
              <h4 class="title"><a href="javascript:void(0)" class="quick-view-btn" data-product='${productDataAttr}'>${product.name}</a></h4>
              ${shortDesc ? `<p class="sm-card-desc">${shortDesc}</p>` : ''}
              <div class="sm-fav-buy">
                <span class="price">${formattedPrice}</span>
                ${cartActionHtml}
              </div>
            </div>
          </article>
        </div>
      `;
      
      container.append(productHtml);
    });
  }

  // Helper function to shuffle array (Fisher-Yates algorithm)
  function shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  function isSubcategory(category) {
    return category && category.parentCategoryId != null && String(category.parentCategoryId).trim() !== '';
  }

  const CATEGORY_ROTATION_INTERVAL_MS = 8000;
  let categoryRotationIntervalId = null;

  function renderRandomCategories(categories) {
    renderCategories(shuffleArray(categories));
  }

  function startCategoryRotation(categories) {
    if (categoryRotationIntervalId) {
      clearInterval(categoryRotationIntervalId);
      categoryRotationIntervalId = null;
    }

    if (!categories || categories.length <= 6 || !$('#categories-container').length) {
      return;
    }

    categoryRotationIntervalId = setInterval(() => {
      renderRandomCategories(categories);
    }, CATEGORY_ROTATION_INTERVAL_MS);
  }

  function productBelongsToCategory(product, categoryId) {
    if (!categoryId) return true;
    const cid = String(categoryId);
    if (String(product.categoryId || '') === cid) return true;
    if (product.parentCategoryId != null && product.parentCategoryId !== undefined &&
        String(product.parentCategoryId) === cid) return true;
    return false;
  }

  // Home "Most Selling Items" — featured picks + sales data from backend
  async function loadProducts(categoryId = null) {
    const container = $('#products-container');
    if (!container.length) return;

    container.html('<div class="col-12"><p class="text-center">Loading most selling items...</p></div>');

    try {
      let stockMap = new Map();
      try {
        if (typeof getStockMap === 'function') {
          stockMap = await getStockMap();
        }
      } catch (error) {
        stockMap = new Map();
      }

      var greeting = window.SensoryParent && typeof window.SensoryParent.childGreeting === 'function'
        ? window.SensoryParent.childGreeting()
        : '';
      $('.sm-fav-copy h2').text(greeting || 'Most Selling Items');

      const fetchLimit = 24;
      let products = typeof fetchMostSellingProducts === 'function'
        ? await fetchMostSellingProducts(fetchLimit, categoryId)
        : [];

      if (categoryId && products.length) {
        products = products.filter(function (product) {
          return productBelongsToCategory(product, categoryId);
        });
      }

      const parentFiltered = window.SensoryParent && typeof window.SensoryParent.filterProducts === 'function'
        ? window.SensoryParent.filterProducts(products)
        : products;

      const latestProducts = parentFiltered.slice(0, 8);

      window.homeProducts = latestProducts;
      window.shopStockMap = stockMap instanceof Map ? stockMap : new Map();

      if (latestProducts.length > 0) {
        renderProducts(latestProducts, '#products-container', stockMap);
        if (typeof WishlistService !== 'undefined' && typeof WishlistService.getWishlist === 'function') {
          try {
            const wishlist = await WishlistService.getWishlist();
            const wishIds = new Set((wishlist || []).map(function (item) {
              return String(item.productId != null ? item.productId : item.id);
            }));
            container.find('.sm-fav-wish').each(function () {
              const raw = this.getAttribute('data-product');
              if (!raw) return;
              try {
                const productData = JSON.parse(raw.replace(/&#39;/g, "'"));
                if (wishIds.has(String(productData.id))) {
                  $(this).addClass('is-favourited');
                }
              } catch (e) { /* ignore parse errors */ }
            });
          } catch (e) { /* ignore wishlist errors */ }
        }
      } else {
        container.html(
          '<div class="col-12"><p class="text-center sm-fav-empty">' +
          (categoryId ? 'No most selling items in this category yet.' : 'No most selling items yet.') +
          ' <a href="shop">Browse shop</a></p></div>'
        );
      }
    } catch (error) {
      container.html('<div class="col-12"><p class="text-center">Error loading most selling items. Please try again later.</p></div>');
    }
  }

  async function loadAboutCategorySlider() {
    const wrapper = $('#category-slider-wrapper');
    if (!wrapper.length || typeof fetchCategories !== 'function') {
      return;
    }

    try {
      const categories = await fetchCategories();
      const productResult = typeof fetchAllProducts === 'function'
        ? await fetchAllProducts(null, '')
        : { items: [] };
      const products = (productResult && productResult.items) || [];
      const visible = (categories || []).filter(function(category) {
        if (!isSubcategory(category)) return false;
        return products.some(function(product) {
          return String(product.categoryId || '') === String(category.id);
        });
      });

      wrapper.empty();
      if (!visible.length) {
        wrapper.html('<div class="swiper-slide"><p class="text-center">No categories with products yet.</p></div>');
        return;
      }

      visible.forEach(function(category) {
        const image = category.imageUrl || category.imageURL || '';
        const bg = image
          ? `style="background-image:url('${image}');background-size:cover;background-position:center;"`
          : '';
        wrapper.append(`
          <div class="swiper-slide">
            <a href="shop?category=${category.id}" class="category-item" style="display:block;text-align:center;">
              <div class="thumb" ${bg} style="min-height:140px;border-radius:16px;background-color:#fff4f8;${image ? 'background-image:url(\'' + image + '\');background-size:cover;background-position:center;' : ''}"></div>
              <h4 class="title" style="margin-top:12px;font-size:16px;">${category.name}</h4>
            </a>
          </div>
        `);
      });

      if (typeof Swiper !== 'undefined' && wrapper.closest('.category-slider-container').length) {
        new Swiper('.category-slider-container', {
          slidesPerView: 6,
          loop: visible.length > 6,
          spaceBetween: 24,
          autoplay: { delay: 3000, disableOnInteraction: false },
          breakpoints: {
            1200: { slidesPerView: 6 },
            992: { slidesPerView: 4 },
            768: { slidesPerView: 3 },
            0: { slidesPerView: 2 }
          }
        });
      }
    } catch (_) {
      wrapper.html('<div class="swiper-slide"><p class="text-center">Unable to load categories.</p></div>');
    }
  }

  // Load and render categories
  async function loadCategories() {
    try {
      const categories = await fetchCategories();
      if (categories && categories.length > 0) {
        const productResult = typeof fetchAllProducts === 'function'
          ? await fetchAllProducts(null, '')
          : { items: [] };
        const products = (productResult && productResult.items) || [];
        const subcategories = categories.filter(function(category) {
          if (!isSubcategory(category)) return false;
          if (!products.length) return true;
          return products.some(function(product) {
            return String(product.categoryId || '') === String(category.id);
          });
        });
        renderRandomCategories(subcategories);
        renderCategoryTabs(subcategories);
        startCategoryRotation(subcategories);
      }
    } catch (error) {
      // Error loading categories
    }
  }

  // Handle category tab clicks (home page only — shop page has its own handlers)
  $(document).on('click', '#category-tabs [data-category-id]', function(e) {
    e.preventDefault();
    const $this = $(this);
    const categoryId = $this.data('category-id');
    
    // Update active states
    $('#category-tabs .nav-link').removeClass('active');
    $this.addClass('active');
    $this.attr('aria-selected', 'true');
    $('#category-tabs .nav-link').not($this).attr('aria-selected', 'false');
    
    // Load products for this category
    loadProducts(categoryId);
  });

  // Handle "All Items" tab click
  $(document).on('click', '#all-items-tab', function(e) {
    e.preventDefault();
    const $this = $(this);
    
    // Update active states
    $('#category-tabs .nav-link').removeClass('active');
    $this.addClass('active');
    $this.attr('aria-selected', 'true');
    $('#category-tabs .nav-link').not($this).attr('aria-selected', 'false');
    
    // Load all products
    loadProducts(null);
  });

  // Load trending products (10 random products with images)
  async function loadTrendingProducts() {
    const container = $('#trending-products-container');
    if (!container.length) {
      return;
    }
    
    try {
      let stockMap = new Map();
      try {
        if (typeof getStockMap === 'function') {
          stockMap = await getStockMap();
        }
      } catch (error) {
        stockMap = new Map();
      }

      // Fetch products to get enough with images
      const result = typeof fetchAllProducts === 'function'
        ? await fetchAllProducts(null, '')
        : await fetchProducts(0, 100, null);
      
      if (result && result.items && result.items.length > 0) {
        // Use all products (no image filter - will use default image if needed)
        const defaultImage = 'https://www.holoimage.net/images/no-image.jpg';
        
        if (result.items.length === 0) {
          return;
        }
        
        // Shuffle and get 10 random products
        const shuffledProducts = shuffleArray(result.items);
        const randomProducts = shuffledProducts.slice(0, 10);
        
        // Render trending products in slider format
        container.empty();
        
        randomProducts.forEach((product) => {
          const productImage = (product.imageURL && product.imageURL.trim() !== '') ? product.imageURL : defaultImage;
          const productPrice = typeof getEffectivePrice === 'function' ? getEffectivePrice(product) : (product.sellingPrice > 0 ? product.sellingPrice : (product.unitPrice > 0 ? product.unitPrice : 0));
          const formattedPrice = typeof renderPriceHtml === 'function' ? renderPriceHtml(product) : formatPrice(productPrice);
          
          // Store product data for cart/wishlist and modal (include description and images)
          const productData = {
            id: product.id,
            name: product.name,
            imageURL: product.imageURL,
            imageUrl: product.imageUrl,
            images: product.images || [],
            imageUrls: product.imageUrls || [],
            sellingPrice: product.sellingPrice,
            unitPrice: product.unitPrice,
            maximumRetailPrice: product.maximumRetailPrice,
            offerPrice: product.offerPrice || null,
            offerBadgeText: product.offerBadgeText || null,
            offerBannerId: product.offerBannerId || null,
            description: product.description || '',
            categoryName: product.categoryName || '',
            categoryId: product.categoryId || null,
            sku: product.sku || product.SKU || '',
            code: product.code || '',
            unitOfMeasureName: product.unitOfMeasureName || ''
          };
          const productDataAttr = JSON.stringify(productData).replace(/'/g, '&#39;');
          const { isOutOfStock, stockBadgeHtml } = getProductStockDetails(product, stockMap);
          
          const slideItemHtml = `
            <div class="slide-item">
              <div class="product-item ${isOutOfStock ? 'out-of-stock-item' : ''}" data-product='${productDataAttr}'>
                <div class="product-thumb">
                  ${stockBadgeHtml}
                  <img src="${productImage}" alt="${product.name}" onerror="this.onerror=null;this.src='https://www.holoimage.net/images/no-image.jpg';">
                  <div class="product-action">
                    <a class="action-quick-view add-to-cart-btn" href="javascript:void(0)" data-product='${productDataAttr}'><i class="ion-ios-cart"></i></a>
                    <a class="action-quick-view quick-view-btn" href="javascript:void(0)" data-product='${productDataAttr}'><i class="ion-arrow-expand"></i></a>
                    <a class="action-quick-view add-to-wishlist-btn" href="javascript:void(0)" data-product='${productDataAttr}'><i class="ion-heart"></i></a>
                  </div>
                </div>
                <div class="product-info">
                  <div class="rating">
                    <span class="fa fa-star"></span>
                    <span class="fa fa-star"></span>
                    <span class="fa fa-star"></span>
                    <span class="fa fa-star"></span>
                    <span class="fa fa-star"></span>
                  </div>
                  <h4 class="title"><a href="javascript:void(0)" class="quick-view-btn" data-product='${productDataAttr}'>${product.name}</a></h4>
                  <div class="prices">
                    <span class="price">${formattedPrice}</span>
                  </div>
                </div>
              </div>
            </div>
          `;
          
          container.append(slideItemHtml);
        });
        
        // Reinitialize slider if needed
        if (typeof $ !== 'undefined' && $.fn.slick) {
          container.slick('unslick');
          container.slick({
            slidesToShow: 4,
            slidesToScroll: 1,
            autoplay: true,
            autoplaySpeed: 3000,
            arrows: true,
            dots: false,
            responsive: [
              {
                breakpoint: 992,
                settings: {
                  slidesToShow: 3
                }
              },
              {
                breakpoint: 768,
                settings: {
                  slidesToShow: 2
                }
              },
              {
                breakpoint: 576,
                settings: {
                  slidesToShow: 1
                }
              }
            ]
          });
        }
      }
    } catch (error) {
      // Error loading trending products
    }
  }

  $(document).on('click', '.sm-fav-qty-btn', function(e) {
    e.preventDefault();
    e.stopPropagation();
    const $input = $(this).siblings('.sm-fav-qty-input');
    const maxStock = parseInt($input.attr('data-max-stock'), 10) || 99;
    let value = parseInt($input.val(), 10) || 1;
    value += parseInt($(this).attr('data-dir'), 10) || 0;
    if (value < 1) value = 1;
    if (value > maxStock) value = maxStock;
    $input.val(value);
  });

  // Handle add to cart clicks
  $(document).on('click', '.add-to-cart-btn', function(e) {
    e.preventDefault();
    const $this = $(this);
    let productData = $this.data('product');
    
    // If data-product is a string, parse it
    if (typeof productData === 'string') {
      try {
        productData = JSON.parse(productData);
      } catch (e) {
        return;
      }
    }
    
    if (productData && typeof CartService !== 'undefined') {
      const qtyInput = $this.closest('.product-item, .pd-page, .pd-buybox').find('.sm-fav-qty-input, #modal-quantity').get(0)
        || document.getElementById('modal-quantity');
      if (qtyInput) {
        const selectedQty = parseInt(qtyInput.value, 10);
        if (selectedQty > 0) {
          productData.quantity = selectedQty;
        }
      }
      CartService.addToCart(productData);
      
      // Update sidebar cart if it exists
      loadSidebarCart();
      
      // Show feedback
      $this.find('i').addClass('added');
      setTimeout(() => {
        $this.find('i').removeClass('added');
      }, 1000);
    }
  });

  // Handle wishlist heart clicks (toggle add/remove) — fallback for pages without local handlers
  $(document).off('click.wishlistToggle', '.add-to-wishlist-btn').on('click.wishlistToggle', '.add-to-wishlist-btn', async function(e) {
    e.preventDefault();
    e.stopPropagation();
    const $this = $(this);
    let productData = $this.attr('data-product') || $this.data('product');
    
    // If data-product is a string, parse it
    if (typeof productData === 'string') {
      try {
        productData = JSON.parse(productData);
      } catch (err) {
        showToast('Could not update wishlist', 'error');
        return;
      }
    }
    
    if (productData && typeof WishlistService !== 'undefined') {
      // Disable button to prevent multiple clicks
      $this.prop('disabled', true);
      
      try {
        const toggle = typeof WishlistService.toggleWishlist === 'function'
          ? WishlistService.toggleWishlist
          : WishlistService.addToWishlist;
        const result = await toggle.call(WishlistService, productData);
        
        if (result.success) {
          if (result.removed) {
            $this.removeClass('is-favourited added');
            $this.find('i').removeClass('added');
            showToast(result.message || 'Removed from wishlist', 'success');
          } else {
            $this.addClass('is-favourited');
            $this.find('i').addClass('added');
            showToast(result.message || 'Product added to wishlist!', 'success');
            setTimeout(() => {
              $this.find('i').removeClass('added');
            }, 1000);
          }
        } else {
          showToast(result.message || 'Failed to update wishlist', 'error');
        }
      } catch (error) {
        showToast('An error occurred. Please try again.', 'error');
      } finally {
        // Re-enable button
        $this.prop('disabled', false);
      }
    }
  });

  varWindow.on('load', function() {
    isotopePortfolio();
    AOS.init({
      once: true,
    });
    stylePreloader();
    
    // Update cart count on page load
    if (typeof CartService !== 'undefined') {
      CartService.updateCartCount();
      // Load sidebar cart items
      loadSidebarCart();
    }
    
    // Update wishlist count on page load
    if (typeof WishlistService !== 'undefined') {
      WishlistService.updateWishlistCount().catch(err => {
        // Error updating wishlist count
      });
    }
    
    // Load categories and products after page loads
    if (typeof fetchCategories === 'function') {
      loadCategories();
      loadAboutCategorySlider();
    }
    
    if (typeof fetchProducts === 'function') {
      // Shop page has its own product loading logic in shop.html — skip here to avoid overwriting filtered results
      var isShopPage = window.location.pathname.indexOf('shop') !== -1 || document.querySelector('.page-shop-wrapper');
      if (!isShopPage) {
        loadProducts();
      }
      loadTrendingProducts();
    }

    window.reloadHomeMostSelling = function () {
      var homeContainer = document.getElementById('products-container');
      var isShopPage = window.location.pathname.indexOf('shop') !== -1 || document.querySelector('.page-shop-wrapper');
      if (!homeContainer || isShopPage || typeof loadProducts !== 'function') return;
      var activeTab = document.querySelector('#category-tabs .nav-link.active');
      var categoryId = activeTab && activeTab.getAttribute('data-category-id');
      loadProducts(categoryId || null);
    };
    window.reloadHomeFavourites = window.reloadHomeMostSelling;

    if ($('#hero-banners').length || $('#offer-banners').length || $('#promo-banners').length) {
      loadWebsiteBanners();
    } else {
      initHomeSlider();
    }

    window.onParentShopChange = function () {
      var homeContainer = document.getElementById('products-container');
      var isShopPage = window.location.pathname.indexOf('shop') !== -1 || document.querySelector('.page-shop-wrapper');
      if (homeContainer && !isShopPage && typeof loadProducts === 'function') {
        var activeTab = document.querySelector('#category-tabs .nav-link.active');
        var categoryId = activeTab && activeTab.getAttribute('data-category-id');
        loadProducts(categoryId || null);
      }
    };

    initSensoryReveal();
  });

  function initSensoryReveal() {
    var nodes = document.querySelectorAll('.sm-store .sm-reveal');
    if (!nodes.length) {
      return;
    }
    if (!('IntersectionObserver' in window) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      nodes.forEach(function (node) {
        node.classList.add('is-in');
      });
      return;
    }
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-in');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.16, rootMargin: '0px 0px -40px 0px' });
    nodes.forEach(function (node) {
      observer.observe(node);
    });
  }
  

})(window.jQuery);