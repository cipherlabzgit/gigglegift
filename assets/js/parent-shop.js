/**
 * Parent shopping helpers for Sensory.
 * Age labels come only from catalog text or optional API age fields.
 */
(function (window) {
  'use strict';

  var WHATSAPP_NUMBER = '94707660110';

  var AGE_BANDS = [
    { id: 'all', label: 'All Ages', min: 0, max: 216 },
    { id: '0-12m', label: '0–12 Months', min: 0, max: 12 },
    { id: '1-2y', label: '1–2 Years', min: 12, max: 36 },
    { id: '3-5y', label: '3–5 Years', min: 36, max: 72 },
    { id: '6y', label: '6+ Years', min: 72, max: 216 }
  ];

  var GIFT_BANDS = [
    { id: 'any', label: 'Any Budget', min: 0, max: Number.POSITIVE_INFINITY },
    { id: 'under2k', label: 'Under LKR 2,000', min: 0, max: 2000 },
    { id: '2to5k', label: 'LKR 2,000–5,000', min: 2000, max: 5000 },
    { id: 'over5k', label: 'LKR 5,000+', min: 5000, max: Number.POSITIVE_INFINITY }
  ];

  var CHILD_KEY = 'sensory_child_profile';
  var state = { age: 'all', gift: 'any' };

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function catalogText(product) {
    return [
      product && product.suitableAge,
      product && product.ageRange,
      product && product.name,
      product && product.categoryName,
      product && product.category,
      product && product.description
    ].filter(Boolean).join(' ');
  }

  function getPrice(product) {
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

  function monthsFromApi(product) {
    var from = Number(product && (product.ageFromMonths || product.minAgeMonths));
    var to = Number(product && (product.ageToMonths || product.maxAgeMonths));
    if (Number.isFinite(from) || Number.isFinite(to)) {
      return {
        min: Number.isFinite(from) ? from : 0,
        max: Number.isFinite(to) ? to : 216,
        label: formatAgeRange(Number.isFinite(from) ? from : 0, Number.isFinite(to) ? to : 216)
      };
    }
    return null;
  }

  function formatAgeRange(minMonths, maxMonths) {
    function pretty(months) {
      if (months < 12) {
        return months + ' mo';
      }
      var years = Math.round(months / 12);
      return years + (years === 1 ? ' yr' : ' yrs');
    }
    if (minMonths === maxMonths) {
      return pretty(minMonths);
    }
    return pretty(minMonths) + '–' + pretty(maxMonths);
  }

  function monthsFromText(text) {
    var source = String(text || '');
    var range = source.match(/(\d+)\s*(months?|mos?|mo)\s*[-–to]+\s*(\d+)\s*(months?|mos?|mo)/i);
    if (range) {
      return { min: Number(range[1]), max: Number(range[3]), label: range[1] + '–' + range[3] + ' months' };
    }
    range = source.match(/(\d+)\s*(years?|yrs?|yr)\s*[-–to]+\s*(\d+)\s*(years?|yrs?|yr)/i);
    if (range) {
      return { min: Number(range[1]) * 12, max: Number(range[3]) * 12, label: range[1] + '–' + range[3] + ' years' };
    }
    var plus = source.match(/(\d+)\s*\+\s*(years?|yrs?|yr)/i);
    if (plus) {
      return { min: Number(plus[1]) * 12, max: 216, label: plus[1] + '+ years' };
    }
    var lower = source.toLowerCase();
    if (/\b(newborn|infant|0-3|0–3|0-6|0–6)\b/.test(lower)) {
      return { min: 0, max: 12, label: '0–12 months' };
    }
    if (/\btoddler\b/.test(lower)) {
      return { min: 12, max: 36, label: '1–2 years' };
    }
    if (/\b(preschool|pre-school|pre school)\b/.test(lower)) {
      return { min: 36, max: 72, label: '3–5 years' };
    }
    return null;
  }

  function getAgeInfo(product) {
    return monthsFromApi(product) || monthsFromText(catalogText(product));
  }

  function getAgeLabel(product) {
    var info = getAgeInfo(product);
    return info ? info.label : '';
  }

  function rangesOverlap(aMin, aMax, bMin, bMax) {
    return aMin < bMax && bMin < aMax;
  }

  function matchesAge(product, bandId) {
    if (!bandId) {
      return true;
    }
    var band = AGE_BANDS.find(function (item) { return item.id === bandId; });
    if (!band) {
      return bandId === 'all';
    }
    if (band.matchAll || band.id === 'all') {
      return true;
    }
    var info = getAgeInfo(product);
    if (!info) {
      return false;
    }
    return rangesOverlap(info.min, info.max, band.min, band.max);
  }

  function matchesGift(product, bandId) {
    if (!bandId) {
      return true;
    }
    var band = GIFT_BANDS.find(function (item) { return item.id === bandId; });
    if (!band) {
      return bandId === 'any';
    }
    if (band.matchAll || band.id === 'any') {
      return true;
    }
    var price = getPrice(product);
    return price >= band.min && price < band.max;
  }

  function filterProducts(products, options) {
    var age = (options && options.age) || state.age;
    var gift = (options && options.gift) || state.gift;
    return (products || []).filter(function (product) {
      return matchesAge(product, age) && matchesGift(product, gift);
    });
  }

  function formatMoney(price) {
    if (typeof window.formatPrice === 'function') {
      return window.formatPrice(price);
    }
    var amount = Number(price);
    if (!Number.isFinite(amount) || amount <= 0) {
      return '';
    }
    return 'LKR ' + amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  function productPageLink(product) {
    if (!product || product.id == null) {
      return window.location.origin + '/shop';
    }
    return window.location.origin + '/product?id=' + encodeURIComponent(product.id);
  }

  function whatsappUrl(message) {
    return 'https://wa.me/' + WHATSAPP_NUMBER + '?text=' + encodeURIComponent(message);
  }

  function buildProductWhatsApp(product) {
    var lines = [
      'Hi Giggles & Gifts, I would like to order this item:',
      'Product: ' + (product && product.name ? product.name : 'Product'),
      product && (product.code || product.sku) ? 'Code: ' + (product.code || product.sku) : '',
      formatMoney(getPrice(product)) ? 'Price: ' + formatMoney(getPrice(product)) : '',
      'Link: ' + productPageLink(product)
    ].filter(Boolean);
    return whatsappUrl(lines.join('\n'));
  }

  function getChildProfile() {
    try {
      var raw = localStorage.getItem(CHILD_KEY);
      var profile = raw ? JSON.parse(raw) : null;
      if (!profile || typeof profile !== 'object') {
        return null;
      }
      return {
        name: String(profile.name || '').trim(),
        ageBand: AGE_BANDS.some(function (band) { return band.id === profile.ageBand; }) ? profile.ageBand : 'all'
      };
    } catch (err) {
      return null;
    }
  }

  function saveChildProfile(profile) {
    var next = {
      name: String(profile && profile.name ? profile.name : '').trim(),
      ageBand: profile && profile.ageBand ? profile.ageBand : 'all'
    };
    localStorage.setItem(CHILD_KEY, JSON.stringify(next));
    if (next.ageBand && next.ageBand !== 'all') {
      state.age = next.ageBand;
    }
    notifyChange();
    return next;
  }

  function applyChildAge() {
    var profile = getChildProfile();
    if (profile && profile.ageBand && profile.ageBand !== 'all') {
      state.age = profile.ageBand;
    }
    return profile;
  }

  function childGreeting() {
    var profile = getChildProfile();
    if (!profile || !profile.name) {
      return '';
    }
    var band = AGE_BANDS.find(function (item) { return item.id === profile.ageBand; });
    if (band && band.id !== 'all') {
      return 'Picks for ' + profile.name + ' · ' + band.label;
    }
    return 'Picks for ' + profile.name;
  }

  function buildRestockWhatsApp(product) {
    var lines = [
      'Hi Giggles & Gifts, please tell me when this is back in stock:',
      'Product: ' + (product && product.name ? product.name : 'Product'),
      product && (product.code || product.sku) ? 'Code: ' + (product.code || product.sku) : '',
      'Link: ' + productPageLink(product)
    ].filter(Boolean);
    return whatsappUrl(lines.join('\n'));
  }

  function deliveryHtml() {
    return (
      '<div class="sm-delivery">' +
        '<h6>Delivery</h6>' +
        '<ul>' +
          '<li>Packed from Sri Lanka</li>' +
          '<li>Colombo and nearby areas are usually dispatched first</li>' +
          '<li>Islandwide delivery — we confirm timing on WhatsApp after you order</li>' +
        '</ul>' +
      '</div>'
    );
  }

  function buildGiftWhatsApp(ageId, giftId) {
    var age = AGE_BANDS.find(function (item) { return item.id === ageId; });
    var gift = GIFT_BANDS.find(function (item) { return item.id === giftId; });
    var lines = [
      'Hi Giggles & Gifts, I am looking for a gift.',
      age && age.id !== 'all' ? 'Child age: ' + age.label : 'Child age: please suggest',
      gift && gift.id !== 'any' ? 'Budget: ' + gift.label : 'Budget: flexible',
      'Please recommend from your collection.'
    ];
    return whatsappUrl(lines.join('\n'));
  }

  function ageChipHtml(product) {
    var label = getAgeLabel(product);
    if (!label) {
      return '';
    }
    return '<span class="sm-age-chip">' + escapeHtml(label) + '</span>';
  }

  function parentFacts(product) {
    var facts = [];
    var age = getAgeLabel(product);
    var category = (product && (product.categoryName || product.category)) || '';
    var unit = (product && product.unitOfMeasureName) || '';
    var text = String((product && product.description) || '').toLowerCase();
    if (age) {
      facts.push({ label: 'Best for', value: age });
    }
    if (category) {
      facts.push({ label: 'Type', value: category });
    }
    if (unit) {
      facts.push({ label: 'Pack / unit', value: unit });
    }
    if (/\b(wash|wipe|clean|care|machine)\b/.test(text)) {
      facts.push({ label: 'Care', value: 'See product description for care notes' });
    }
    return facts;
  }

  function parentFactsHtml(product) {
    var facts = parentFacts(product);
    var rows = facts.map(function (fact) {
      return '<li><strong>' + escapeHtml(fact.label) + '</strong><span>' + escapeHtml(fact.value) + '</span></li>';
    }).join('');
    return (
      '<div class="sm-parent-facts">' +
        '<h6>For parents</h6>' +
        (rows ? '<ul>' + rows + '</ul>' : '<p>Ask us on WhatsApp if you need help choosing the right age or gift.</p>') +
        '<a class="sm-wa-btn" href="' + buildProductWhatsApp(product) + '" target="_blank" rel="noopener">' +
          '<i class="fa fa-whatsapp"></i> Ask about this item' +
        '</a>' +
      '</div>'
    );
  }

  function renderChipGroup(container, items, selectedId, kind) {
    if (!container) {
      return;
    }
    container.innerHTML = items.map(function (item) {
      var active = item.id === selectedId ? ' is-active' : '';
      return '<button type="button" class="sm-parent-chip' + active + '" data-kind="' + kind + '" data-id="' + item.id + '">' +
        escapeHtml(item.label) +
      '</button>';
    }).join('');
  }

  function fillChildAgeSelect() {
    var select = document.getElementById('child-age');
    if (!select) {
      return;
    }
    var current = select.value || 'all';
    select.innerHTML = AGE_BANDS.map(function (band) {
      var label = band.id === 'all' ? 'Not set' : band.label;
      return '<option value="' + escapeHtml(band.id) + '">' + escapeHtml(label) + '</option>';
    }).join('');
    if (AGE_BANDS.some(function (band) { return band.id === current; })) {
      select.value = current;
    }
  }

  function mapApiBand(row) {
    var maxRaw = row.maxValue != null ? row.maxValue : row.MaxValue;
    var max = maxRaw == null || maxRaw === '' ? Number.POSITIVE_INFINITY : Number(maxRaw);
    var minRaw = row.minValue != null ? row.minValue : row.MinValue;
    return {
      id: String(row.code || row.Code || ''),
      label: String(row.label || row.Label || ''),
      min: Number(minRaw) || 0,
      max: Number.isFinite(max) ? max : Number.POSITIVE_INFINITY,
      matchAll: row.matchAll === true || row.MatchAll === true
    };
  }

  function replaceBands(target, next) {
    if (!next.length) {
      return false;
    }
    target.splice(0, target.length);
    next.forEach(function (item) { target.push(item); });
    return true;
  }

  function ensureSelected(list, current, fallbackId) {
    if (list.some(function (band) { return band.id === current; })) {
      return current;
    }
    var matchAll = list.find(function (band) { return band.matchAll; });
    return (matchAll && matchAll.id) || fallbackId || (list[0] && list[0].id) || current;
  }

  async function loadShopFilters() {
    try {
      var base = window.API_CONFIG && window.API_CONFIG.BASE_URL ? window.API_CONFIG.BASE_URL : '/api';
      var response = await fetch(base + '/inventory/shop-filters?activeOnly=true', {
        method: 'GET',
        headers: { Accept: 'application/json' }
      });
      if (!response.ok) {
        return;
      }
      var data = await response.json();
      var rows = (data && (data.data || data.Data)) || [];
      if (!Array.isArray(rows) || !rows.length) {
        return;
      }
      var age = rows.filter(function (row) {
        return String(row.kind || row.Kind) === 'Age';
      }).map(mapApiBand).filter(function (band) { return band.id && band.label; });
      var gift = rows.filter(function (row) {
        return String(row.kind || row.Kind) === 'Gift';
      }).map(mapApiBand).filter(function (band) { return band.id && band.label; });
      var changed = false;
      if (replaceBands(AGE_BANDS, age)) {
        state.age = ensureSelected(AGE_BANDS, state.age, 'all');
        changed = true;
      }
      if (replaceBands(GIFT_BANDS, gift)) {
        state.gift = ensureSelected(GIFT_BANDS, state.gift, 'any');
        changed = true;
      }
      if (changed) {
        notifyChange();
      }
    } catch (err) {
      // Keep the built-in bands when the API is unavailable.
    }
  }

  function syncBars() {
    fillChildAgeSelect();
    document.querySelectorAll('[data-parent="age"]').forEach(function (node) {
      renderChipGroup(node, AGE_BANDS, state.age, 'age');
    });
    document.querySelectorAll('[data-parent="gift"]').forEach(function (node) {
      renderChipGroup(node, GIFT_BANDS, state.gift, 'gift');
    });
    document.querySelectorAll('[data-parent-wa="gift"]').forEach(function (node) {
      node.setAttribute('href', buildGiftWhatsApp(state.age, state.gift));
    });
  }

  function notifyChange() {
    syncBars();
    if (typeof window.onParentShopChange === 'function') {
      window.onParentShopChange(state);
    }
    document.dispatchEvent(new CustomEvent('sensory:parent-filter', { detail: state }));
  }

  function bind() {
    applyChildAge();
    syncBars();
    document.addEventListener('click', function (event) {
      var chip = event.target.closest('.sm-parent-chip');
      if (!chip) {
        return;
      }
      var kind = chip.getAttribute('data-kind');
      var id = chip.getAttribute('data-id');
      if (kind === 'age') {
        state.age = id;
      }
      if (kind === 'gift') {
        state.gift = id;
      }
      notifyChange();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bind);
  } else {
    bind();
  }

  window.SensoryParent = {
    AGE_BANDS: AGE_BANDS,
    GIFT_BANDS: GIFT_BANDS,
    state: state,
    getAgeLabel: getAgeLabel,
    getAgeInfo: getAgeInfo,
    matchesAge: matchesAge,
    matchesGift: matchesGift,
    filterProducts: filterProducts,
    getPrice: getPrice,
    buildProductWhatsApp: buildProductWhatsApp,
    buildGiftWhatsApp: buildGiftWhatsApp,
    ageChipHtml: ageChipHtml,
    parentFactsHtml: parentFactsHtml,
    deliveryHtml: deliveryHtml,
    buildRestockWhatsApp: buildRestockWhatsApp,
    getChildProfile: getChildProfile,
    saveChildProfile: saveChildProfile,
    applyChildAge: applyChildAge,
    childGreeting: childGreeting,
    syncBars: syncBars
  };

  loadShopFilters();
})(window);
