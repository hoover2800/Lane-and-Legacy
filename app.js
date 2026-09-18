'use strict';

const CATEGORIES = [
  { id: 'home', title: 'Home & Life Organization', icon: 'house' },
  { id: 'education', title: 'Education & Teaching', icon: 'graduation-cap' },
  { id: 'wellness', title: 'Health & Wellness', icon: 'heart-pulse' },
  { id: 'finance', title: 'Finance & Budgeting', icon: 'dollar-sign' },
  { id: 'travel', title: 'Travel & Adventure', icon: 'plane' },
  { id: 'work', title: 'Work & Productivity', icon: 'users' },
  { id: 'hobbies', title: 'Hobbies & Special Interests', icon: 'palette' },
  { id: 'more', title: 'And More', icon: 'ellipsis' }
];
const SOCIAL = [
  { id: 'instagram', title: 'Instagram', icon: 'instagram' },
  { id: 'pinterest', title: 'Pinterest', icon: 'pinterest' },
  { id: 'tiktok', title: 'TikTok', icon: 'tiktok' },
  { id: 'facebook', title: 'Facebook', icon: 'facebook' },
  { id: 'youtube', title: 'YouTube', icon: 'youtube' }
];

function escapeHTML(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

// Destinations remain exactly as configured: no invented UTM values or tracking IDs.
function safeURL(value) {
  if (typeof value !== 'string' || !value || value === '#') return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}

function safeImage(value) {
  if (typeof value !== 'string' || value.includes('..') || !/^[a-z0-9 _./-]+\.(avif|webp|png|jpe?g)$/i.test(value) || value.startsWith('/')) return null;
  return encodeURI(value);
}

function selectProducts(products, options = {}) {
  const { featured = true, category = 'all', query = '', kind = null, selection = {}, now = Date.now() } = options;
  const needle = query.trim().toLocaleLowerCase();
  const result = products.filter(p => p.active === true && p.title && p.id)
    .filter(p => category === 'all' || p.category === category)
    .filter(p => !kind || (kind === 'digital' ? (p.formats?.includes('digital') || ['spreadsheet','template','calculator','toolkit','web_utility','free_tool','digital_tool'].includes(p.productType)) : kind === 'print' ? p.formats?.includes('print') : p.types?.includes(kind)))
    .filter(p => !needle || [p.title,p.subtitle,p.shortDescription,p.description,p.category].join(' ').toLocaleLowerCase().includes(needle))
    .sort((a,b) => (a.featuredPriority ?? Number.MAX_SAFE_INTEGER) - (b.featuredPriority ?? Number.MAX_SAFE_INTEGER) || a.title.localeCompare(b.title));
  if (!featured) return result;
  const limit = Math.max(1,Math.min(4,Number(selection.limit) || 4));
  // Missing artwork is acceptable in the catalog but never fills a featured slot.
  const available = result.filter(p => safeImage(p.image));
  let preferred = available.filter(p => p.featured === true);
  let fallback = available.filter(p => p.featured !== true);
  if (selection.mode === 'scheduled' && preferred.length) {
    const epoch = Date.parse(selection.epoch + 'T00:00:00Z');
    const days = Math.max(1,Number(selection.periodDays) || 7);
    const step = Number.isFinite(epoch) ? Math.max(0,Math.floor((Number(now)-epoch)/(days*86400000))) : 0;
    const offset = step % preferred.length;
    preferred = preferred.slice(offset).concat(preferred.slice(0,offset));
  } else if (selection.mode === 'performance') {
    const ranked = Array.isArray(selection.performanceRankedIds) ? selection.performanceRankedIds : [];
    const rank = p => { const i=ranked.indexOf(p.id); return i<0 ? Number.MAX_SAFE_INTEGER : i; };
    preferred.sort((a,b)=>rank(a)-rank(b));
    fallback.sort((a,b)=>rank(a)-rank(b));
  }
  return preferred.concat(fallback).slice(0,limit);
}

let outboundTracking = {};
function outboundAttributes(url, { platform, placement, productId = '', campaign = null, source = null, tracking = outboundTracking }) {
  let destination = safeURL(url);
  if (!destination) return '';
  const campaignValue = campaign || tracking.campaign || '';
  const sourceValue = source || tracking.source || '';
  // Explicit configuration only: no affiliate tags, invented campaigns or user identifiers.
  if (tracking.enabled === true && sourceValue && tracking.platforms?.includes(platform)) {
    const parsed = new URL(destination);
    parsed.searchParams.set('utm_source', sourceValue);
    parsed.searchParams.set('utm_medium', 'referral');
    if (campaignValue) parsed.searchParams.set('utm_campaign', campaignValue);
    parsed.searchParams.set('utm_content', [placement,productId].filter(Boolean).join(':'));
    destination = parsed.href;
  }
  return `href="${escapeHTML(destination)}" target="_blank" rel="noopener noreferrer" data-outbound="${escapeHTML(platform)}" data-placement="${escapeHTML(placement)}" data-product-id="${escapeHTML(productId)}" data-campaign="${escapeHTML(campaignValue)}" data-source="${escapeHTML(sourceValue)}"`;
}

function productCard(product, placement = 'product-card') {
  const image = safeImage(product.image);
  const buttons = [];
  for (const link of product.channelLinks ?? []) {
    const attributes=outboundAttributes(link.url,{platform:link.channel || 'digital',placement,productId:product.product_id || product.id,campaign:product.campaign,source:product.source});
    if(attributes)buttons.push(`<a class="etsy" ${attributes}>${escapeHTML(link.label || 'View digital tool')}</a>`);
  }
  for (const format of product.formats ?? []) {
    const digital = format === 'digital';
    if (!digital && format !== 'print') continue;
    const platform = digital ? 'etsy' : 'amazon';
    const url = digital ? product.etsyUrl : product.amazonUrl;
    const label = digital ? 'Digital on Etsy' : 'Book on Amazon';
    const attributes = outboundAttributes(url, { platform, placement, productId: product.product_id || product.id, campaign: product.campaign, source: product.source });
    buttons.push(attributes
      ? `<a class="${platform}" ${attributes} aria-label="${escapeHTML(label + ': ' + product.title)}">${label}</a>`
      : `<span class="unavailable" aria-disabled="true" aria-label="${escapeHTML(label + ': link not yet available for ' + product.title)}">${!digital && product.status === 'pending_publication' ? 'Awaiting Amazon publication' : (digital ? 'Digital' : 'Book') + ' link coming soon'}</span>`);
  }
  return `<article class="product-card" data-product-id="${escapeHTML(product.product_id || product.id)}">
    <div class="product-art">${image ? `<img src="${escapeHTML(image)}" alt="${escapeHTML(product.imageAlt || product.title + ' cover')}" loading="lazy" decoding="async" width="${Number(product.imageWidth) || 404}" height="${Number(product.imageHeight) || 522}">` : '<span>Cover preview coming soon</span>'}</div>
    <h3>${escapeHTML(product.title)}</h3><p>${escapeHTML(product.shortDescription)}</p>
    <div class="card-actions">${buttons.join('')}</div>
  </article>`;
}

async function readJSON(file) {
  const response = await fetch(file, { cache: 'no-cache' });
  if (!response.ok) throw new Error(`Could not load ${file}: ${response.status}`);
  return response.json();
}

let configurationPromise;
function configuration() {
  if (!configurationPromise) configurationPromise = readJSON('site-config.json').catch(()=>({}));
  return configurationPromise;
}

function initializeNavigation() {
  const menu = document.querySelector('.main-navigation');
  const toggle = document.querySelector('.menu-toggle');
  const closeMenu = () => {
    menu.classList.remove('open');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', 'Open navigation');
  };
  toggle.addEventListener('click', () => {
    const open = menu.classList.toggle('open');
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
  });
  menu.addEventListener('click', event => { if (event.target.closest('a,button')) closeMenu(); });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && menu.classList.contains('open')) { closeMenu(); toggle.focus(); }
  });
  document.querySelectorAll('[data-dialog]').forEach(button => {
    button.addEventListener('click', () => document.getElementById(button.dataset.dialog).showModal());
  });
  document.querySelectorAll('dialog').forEach(dialog => {
    dialog.querySelector('.dialog-close').addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', event => {
      if (event.target !== dialog) return;
      const rect = dialog.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
    });
    dialog.querySelectorAll('a[href^="#"]').forEach(link => link.addEventListener('click', () => dialog.close()));
  });
}

async function initializeLinks() {
  try {
    const config = await configuration();
    outboundTracking = config.outboundTracking || {};
    for (const platform of ['etsy', 'amazon']) {
      const placeholder = document.getElementById(`${platform}-shop`);
      const attributes = outboundAttributes(config.shops?.[platform], { platform, placement: 'hero' });
      if (attributes) placeholder.outerHTML = `<a class="cta ${platform}" id="${platform}-shop" ${attributes}>${placeholder.innerHTML}</a>`;
    }
    document.getElementById('social-links').innerHTML = SOCIAL.map(social => {
      const attributes = outboundAttributes(config.social?.[social.id], { platform: social.id, placement: 'social-section' });
      return attributes
        ? `<a ${attributes} aria-label="Lane & Legacy on ${social.title} (opens in a new tab)"><i class="fa-brands fa-${social.icon}" aria-hidden="true"></i></a>`
        : `<span class="social-unavailable" aria-disabled="true" aria-label="${social.title} profile not yet linked"><i class="fa-brands fa-${social.icon}" aria-hidden="true"></i><small>Not linked yet</small></span>`;
    }).join('');
    const contactLinks = [{ platform: 'etsy', title: 'Visit our Etsy shop', url: config.shops?.etsy }, ...SOCIAL.filter(s => ['instagram', 'facebook'].includes(s.id)).map(s => ({ platform: s.id, title: s.title, url: config.social?.[s.id] }))];
    document.getElementById('contact-links').innerHTML = contactLinks.map(link => {
      const attributes = outboundAttributes(link.url, { platform: link.platform, placement: 'contact' });
      return attributes ? `<a ${attributes}>${link.title} <span aria-hidden="true">↗</span></a>` : '';
    }).join('');
  } catch {
    document.getElementById('social-links').textContent = 'Social links are temporarily unavailable.';
    document.getElementById('contact-links').textContent = 'Contact links are temporarily unavailable. Please try again later.';
  }
  // A local event seam for a future consent-aware analytics integration. No data is sent or stored.
  document.addEventListener('click', event => {
    const link = event.target.closest('a[data-outbound]');
    if (link) document.dispatchEvent(new CustomEvent('lane:outbound', { detail: {
      platform: link.dataset.outbound, placement: link.dataset.placement,
      productId: link.dataset.productId || null, campaign: link.dataset.campaign || null, source: link.dataset.source || null, destination: link.href
    } }));
  });
}

async function initializeCatalog() {
  const target = document.getElementById('product-grid');
  const tools = document.getElementById('catalog-tools');
  const input = document.getElementById('product-search');
  const select = document.getElementById('category-select');
  const status = document.getElementById('catalog-status');
  const state = { featured: true, category: 'all', query: '', kind: null };
  let products = [];
  let loaded = false;
  let selection = {};
  // Capture the period at page initialization: browsing never reshuffles cards.
  const selectionTime = Date.now();
  document.getElementById('category-list').innerHTML = CATEGORIES.map(c => `<a href="#products" data-category="${c.id}"><span class="category-icon"><i class="fa-solid fa-${c.icon}" aria-hidden="true"></i></span><span>${escapeHTML(c.title)}</span></a>`).join('');
  select.innerHTML += CATEGORIES.map(c => `<option value="${c.id}">${escapeHTML(c.title)}</option>`).join('');
  const render = () => {
    if (!loaded) return;
    const selected = selectProducts(products, {...state, selection, now:selectionTime});
    target.innerHTML = selected.length ? selected.map(p=>productCard(p,state.featured ? 'featured-products' : 'catalog')).join('') : '<div class="empty-state"><h3>More practical tools are on the way.</h3><p>No products match this selection yet. Try another category or browse the full collection.</p><button type="button" class="text-link" id="empty-reset">Browse all products →</button></div>';
    if (!selected.length && state.kind === 'digital') {
      target.innerHTML = '<div class="empty-state"><h3>Digital products are on the way.</h3><p>Our Etsy products are awaiting publication. Verified listing links will appear here when available.</p><button type="button" class="text-link" id="empty-reset">Browse our books →</button></div>';
    }
    target.querySelectorAll('img').forEach(img => img.addEventListener('error', () => {
      const placeholder=document.createElement('span'); placeholder.textContent='Cover preview unavailable';
      img.replaceWith(placeholder);
    }, {once:true}));
    document.getElementById('empty-reset')?.addEventListener('click', () => openCatalog());
    const category = CATEGORIES.find(c => c.id === state.category);
    document.getElementById('products-heading').textContent = state.featured ? 'Featured Products' : state.kind ? ({ planner: 'Planners', workbook: 'Workbooks', tracker: 'Trackers', journal: 'Journals', digital: 'Etsy & Digital Products', print: 'Books & Workbooks' }[state.kind] || 'All Products') : category?.title || 'All Products';
    document.getElementById('products-description').textContent = state.featured ? 'Popular tools to help you plan, track and make progress.' : 'Thoughtful resources for your everyday life.';
    status.textContent = state.featured ? '' : `${selected.length} ${selected.length === 1 ? 'product' : 'products'}${state.query ? ' matching “' + state.query + '”' : ''}`;
    document.getElementById('view-all').textContent = state.featured ? 'View All Products →' : 'Back to Featured →';
    tools.hidden = state.featured;
    select.value = state.category;
    input.value = state.query;
    document.querySelectorAll('[data-category]').forEach(link => {
      if (link.dataset.category === state.category) link.setAttribute('aria-current', 'true');
      else link.removeAttribute('aria-current');
    });
  };
  const openCatalog = (category = 'all', kind = null) => {
    Object.assign(state, { featured: false, category, query: '', kind }); render();
  };
  document.getElementById('view-all').addEventListener('click', () => {
    Object.assign(state, { featured: !state.featured, category: 'all', query: '', kind: null }); render();
  });
  document.querySelectorAll('[data-catalog]').forEach(link => link.addEventListener('click', () => openCatalog()));
  document.querySelectorAll('[data-category]').forEach(link => link.addEventListener('click', () => openCatalog(link.dataset.category)));
  document.querySelectorAll('[data-kind]').forEach(link => link.addEventListener('click', () => openCatalog('all', link.dataset.kind)));
  document.querySelector('.search-toggle').addEventListener('click', () => {
    openCatalog(); document.getElementById('products').scrollIntoView(); input.focus({ preventScroll: true });
  });
  input.addEventListener('input', () => { state.query = input.value; render(); });
  select.addEventListener('change', () => { state.category = select.value; state.kind = null; render(); });
  document.getElementById('reset-filters').addEventListener('click', () => openCatalog());
  try {
    const [data,config] = await Promise.all([readJSON('products.json'),configuration()]);
    selection = config.featuredSelection || {};
    outboundTracking = config.outboundTracking || {};
    if (!Array.isArray(data.products)) throw new Error('Invalid product catalog');
    products = data.products; loaded = true; render();
  } catch {
    target.innerHTML = '<div class="empty-state"><h3>Our catalog is temporarily unavailable.</h3><p>Please refresh the page to try again. The shop links above are still available.</p></div>';
    status.textContent = 'Products could not be loaded.';
  } finally { target.setAttribute('aria-busy', 'false'); }
}

if (typeof document !== 'undefined') {
  initializeNavigation();
  initializeLinks();
  initializeCatalog();
}
if (typeof module !== 'undefined') module.exports = { safeURL, safeImage, escapeHTML, selectProducts, outboundAttributes, productCard };
