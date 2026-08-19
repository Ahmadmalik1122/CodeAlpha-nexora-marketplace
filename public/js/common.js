/* Nexora Marketplace — shared client library: API helper, auth state, chrome, UI utils. */
(function () {
  let CSRF = null;

  async function fetchCsrf() {
    try { const r = await fetch('/api/csrf-token'); const d = await r.json(); CSRF = d.csrfToken; }
    catch { CSRF = null; }
    return CSRF;
  }

  async function call(method, url, body) {
    const opts = { method, headers: {}, credentials: 'same-origin' };
    if (body !== undefined) {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    }
    if (method !== 'GET' && method !== 'HEAD') {
      if (!CSRF) await fetchCsrf();
      opts.headers['X-CSRF-Token'] = CSRF;
    }
    let res = await fetch(url, opts);
    // If CSRF expired, refresh once and retry.
    if (res.status === 403 && method !== 'GET') {
      await fetchCsrf();
      opts.headers['X-CSRF-Token'] = CSRF;
      res = await fetch(url, opts);
    }
    let data = null;
    const ct = res.headers.get('content-type') || '';
    if (ct.includes('application/json')) data = await res.json();
    if (!res.ok) {
      const msg = (data && (data.error || (data.errors && data.errors[0] && data.errors[0].msg))) || `Request failed (${res.status})`;
      const err = new Error(msg); err.status = res.status; err.data = data; throw err;
    }
    return data;
  }

  const API = {
    get: (u) => call('GET', u),
    post: (u, b) => call('POST', u, b),
    put: (u, b) => call('PUT', u, b),
    del: (u) => call('DELETE', u),
    raw: call,
    async upload(url, formData) {
      if (!CSRF) await fetchCsrf();
      const res = await fetch(url, { method: 'POST', headers: { 'X-CSRF-Token': CSRF }, body: formData, credentials: 'same-origin' });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error((data && data.error) || 'Upload failed');
      return data;
    },
  };

  // ---- UI utilities ----
  function money(n) { return 'Rs ' + Math.round(Number(n) || 0).toLocaleString('en-PK'); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function stars(avg, count) {
    const a = Math.round(Number(avg) || 0);
    let h = '<span class="stars">';
    for (let i = 1; i <= 5; i++) h += i <= a ? '★' : '<span class="empty">★</span>';
    h += '</span>';
    if (count != null) h += ` <span class="rating-count">(${count})</span>`;
    return h;
  }
  function toast(msg, type) {
    let box = document.getElementById('toasts');
    if (!box) { box = document.createElement('div'); box.id = 'toasts'; document.body.appendChild(box); }
    const t = document.createElement('div');
    t.className = 'toast' + (type ? ' ' + type : '');
    t.textContent = msg;
    box.appendChild(t);
    setTimeout(() => { t.style.opacity = '0'; t.style.transition = '.3s'; setTimeout(() => t.remove(), 300); }, 2800);
  }
  function qs(name) { return new URLSearchParams(location.search).get(name); }
  function productImg(p) { return (p && p.image) || (p && p.images && p.images[0]) || 'https://placehold.co/400x400/eef2ff/2563eb?text=Nexora'; }
  function pctOff(p) { return p.on_sale ? Math.round((1 - p.effective_price / p.price) * 100) : 0; }

  const SPEC_LABELS = {
    cores: 'Cores', threads: 'Threads', base_clock: 'Base Clock', boost_clock: 'Boost Clock',
    socket: 'Socket', cache: 'Cache', tdp: 'TDP', vram: 'VRAM', memory_type: 'Memory Type',
    memory_bus: 'Memory Bus', power: 'Power Consumption', ports: 'Ports', capacity: 'Capacity',
    interface: 'Interface', read_speed: 'Read Speed', write_speed: 'Write Speed',
    form_factor: 'Form Factor', latency: 'Latency', speed: 'Speed', chipset: 'Chipset',
    pcie: 'PCIe', audio: 'Audio', fan: 'Fan', wattage: 'Wattage', efficiency: 'Efficiency',
    modular: 'Modular', connector: 'Connector', warranty: 'Warranty', fans_included: 'Fans Included',
    front_panel: 'Front Panel', glass: 'Glass', max_gpu: 'Max GPU Length', type: 'Type',
    noise: 'Noise', airflow: 'Airflow', compatibility: 'Compatibility', resolution: 'Resolution',
    panel: 'Panel', refresh: 'Refresh Rate', response: 'Response Time', hdr: 'HDR',
    color: 'Colour Coverage', cpu: 'Processor', gpu: 'Graphics', ram: 'Memory',
    storage: 'Storage', psu: 'Power Supply', os: 'Operating System', display: 'Display',
    weight: 'Weight', lan: 'LAN', keycaps: 'Keycaps', rgb: 'RGB', connectivity: 'Connectivity',
    switch: 'Switch', layout: 'Layout', sensor: 'Sensor', dpi: 'DPI', buttons: 'Buttons',
    driver: 'Driver', frequency: 'Frequency', mic: 'Microphone', battery: 'Battery',
    platforms: 'Platforms', keys: 'Keys', software: 'Software', standard: 'Wireless Standard',
    bands: 'Bands', mesh: 'Mesh Support', security: 'Security', antennas: 'Antennas',
    mount: 'Mounting', features: 'Features', usb: 'USB', length: 'Length',
    connectors: 'Connectors', shielding: 'Shielding', thickness: 'Thickness', surface: 'Surface',
    base: 'Base', capsule: 'Capsule', pattern: 'Polar Pattern', sample_rate: 'Sample Rate',
    endurance: 'Endurance', fans: 'Fans', pack: 'Pack', size: 'Size', output: 'Output',
    safety: 'Safety', height: 'Height', fov: 'FOV', bandwidth: 'Bandwidth',
    thermal_conductivity: 'Thermal Conductivity', electrical_conductive: 'Conductive',
  };
  function specLabel(k) { return SPEC_LABELS[k] || k.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase()); }

  // ---- Compare (localStorage) ----
  const COMPARE_KEY = 'nexora_compare';
  function getCompare() { try { return JSON.parse(localStorage.getItem(COMPARE_KEY) || '[]'); } catch { return []; } }
  function saveCompare(list) { localStorage.setItem(COMPARE_KEY, JSON.stringify(list)); }
  function toggleCompare(id) {
    let list = getCompare();
    if (list.includes(id)) list = list.filter((x) => x !== id);
    else { if (list.length >= 4) throw new Error('You can compare up to 4 products.'); list.push(id); }
    saveCompare(list);
    return list;
  }

  // ---- Auth state ----
  let ME = undefined;
  async function me(force) {
    if (ME !== undefined && !force) return ME;
    try { const d = await API.get('/api/auth/me'); ME = d.user || null; }
    catch { ME = null; }
    return ME;
  }
  function requireLogin(redirect) {
    location.href = '/login.html?redirect=' + encodeURIComponent(redirect || location.pathname + location.search);
  }

  // ---- Cart count ----
  async function refreshCartCount() {
    const el = document.querySelector('[data-cart-count]');
    if (!el) return;
    if (!ME) { el.classList.add('hidden'); return; }
    try {
      const c = await API.get('/api/cart');
      const n = (c.items || []).reduce((s, i) => s + i.quantity, 0);
      if (n > 0) { el.textContent = n; el.classList.remove('hidden'); } else el.classList.add('hidden');
    } catch { el.classList.add('hidden'); }
  }

  // ---- Chrome: topbar + header + footer ----
  function authZone(user) {
    // Real auth state -> role-specific controls. Logged out = Login + Sign Up.
    const firstName = ((user && (user.full_name || user.store_name)) || 'Account').split(' ')[0];
    if (!user) {
      return `<a class="btn btn-nav ghost" href="/login.html" data-redirect>Login</a>
              <a class="btn btn-nav" href="/register.html">Sign Up</a>`;
    }
    if (user.role === 'admin') {
      return `<a class="nav-link" href="/admin.html" title="Admin Dashboard">Admin Dashboard</a>
              <a class="nav-link" href="/account.html" title="My Account">Hi, ${esc(firstName)}</a>
              <button class="btn btn-nav ghost" type="button" data-logout>Logout</button>`;
    }
    if (user.role === 'seller') {
      return `<a class="nav-link" href="/seller.html" title="Seller Dashboard">Seller Dashboard</a>
              <a class="nav-link m-hide" href="/seller.html#products" title="My Products">My Products</a>
              <a class="nav-link m-hide" href="/seller.html#orders" title="My Orders">My Orders</a>
              <a class="nav-link" href="/account.html" title="My Account">Hi, ${esc(firstName)}</a>
              <button class="btn btn-nav ghost" type="button" data-logout>Logout</button>`;
    }
    return `<a class="nav-link" href="/account.html" title="My Account">Hi, ${esc(firstName)}</a>
            <a class="nav-link m-hide" href="/account.html#orders" title="My Orders">My Orders</a>
            <button class="btn btn-nav ghost" type="button" data-logout>Logout</button>`;
  }

  function mobileMenu(user) {
    const firstName = ((user && (user.full_name || user.store_name)) || 'Account').split(' ')[0];
    const cats = [
      ['/', 'Home'], ['/shop.html', 'Shop'], ['/shop.html?category=pc-components', 'PC Components'],
      ['/shop.html?category=gaming', 'Gaming'], ['/shop.html?category=computers', 'Computers'],
      ['/shop.html?category=monitors', 'Monitors'], ['/shop.html?category=networking', 'Networking'],
      ['/shop.html?category=accessories', 'Accessories'], ['/shop.html?onSale=1', 'Deals'],
    ];
    let account;
    if (!user) {
      account = `<a class="btn block" href="/register.html">Sign Up</a>
                 <a class="btn ghost block" href="/login.html">Login</a>`;
    } else if (user.role === 'admin') {
      account = `<a href="/admin.html">Admin Dashboard</a><a href="/account.html">Hi, ${esc(firstName)}</a><a href="#" data-logout>Logout</a>`;
    } else if (user.role === 'seller') {
      account = `<a href="/seller.html">Seller Dashboard</a><a href="/seller.html#products">My Products</a>
                 <a href="/seller.html#orders">My Orders</a><a href="/account.html">Hi, ${esc(firstName)}</a><a href="#" data-logout>Logout</a>`;
    } else {
      account = `<a href="/account.html">Hi, ${esc(firstName)}</a><a href="/account.html#orders">My Orders</a><a href="#" data-logout>Logout</a>`;
    }
    return `
      <nav class="mobile-nav">
        <div class="mn-head">Shop</div>
        ${cats.map(([u, l]) => `<a href="${u}">${l}</a>`).join('')}
        <div class="mn-head">Account</div>
        ${account}
        <a href="/wishlist.html">Wishlist</a>
        <a href="/cart.html">Cart</a>
        <a href="/compare.html">Compare</a>
      </nav>`;
  }

  function renderChrome(user) {
    const header = document.querySelector('[data-chrome-header]');
    if (header) {
      const topbar = `<div class="topbar"><div class="container">
        <span class="tagline">Your Marketplace for PC Hardware &amp; Technology</span>
        <span class="muted" style="color:#94a3b8">🚚 Free shipping on orders over Rs 25,000</span>
      </div></div>`;
      header.innerHTML = topbar + `
        <div class="container">
          <div class="nav">
            <a class="brand" href="/"><span class="logo-mark">⚡</span>Nexora<em>Market</em></a>
            <nav class="nav-links" data-nav-links>
              <a href="/" data-nav="/">Home</a>
              <a href="/shop.html" data-nav="/shop.html">Shop</a>
              <a href="/shop.html?category=pc-components">PC</a>
              <a href="/shop.html?category=gaming">Gaming</a>
              <a href="/shop.html?category=computers">Computers</a>
              <a href="/shop.html?category=monitors">Monitors</a>
              <a href="/shop.html?onSale=1">Deals</a>
            </nav>
            <form class="searchbar" data-search><input name="q" placeholder="Search CPUs, GPUs, SSDs, RAM..." aria-label="Search"><button class="btn" type="submit">Search</button></form>
            <button class="menu-toggle" data-menu aria-label="Menu">☰</button>
            <nav class="nav-actions">
              <a class="nav-link" href="/compare.html" title="Compare">⚖<span class="badge-count hidden" data-compare-count></span></a>
              <a class="nav-link" href="/wishlist.html" title="Wishlist">♡<span class="hide-sm"> Wishlist</span></a>
              <a class="nav-link" href="/cart.html" title="Cart">🛒<span class="hide-sm"> Cart</span><span class="badge-count hidden" data-cart-count></span></a>
              <span class="auth-zone">${authZone(user)}</span>
            </nav>
          </div>
          <div class="mobile-menu" data-mobile-menu>${mobileMenu(user)}</div>
        </div>`;
    }
    const footer = document.querySelector('[data-chrome-footer]');
    if (footer) {
      footer.innerHTML = `
        <div class="container">
          <div class="cols">
            <div>
              <h4><span class="logo-mark" style="display:inline-flex;width:26px;height:26px;border-radius:7px;background:linear-gradient(135deg,#2563eb,#38bdf8);color:#fff;align-items:center;justify-content:center;font-size:.8rem;margin-right:6px">⚡</span>Nexora Marketplace</h4>
              <p class="small">Shop premium PC hardware, gaming components, computers, peripherals and technology products from trusted sellers.</p>
            </div>
            <div><h4>Shop</h4><a href="/shop.html">All products</a><a href="/shop.html?category=pc-components">PC Components</a><a href="/shop.html?onSale=1">Deals</a><a href="/shop.html?sort=best_selling">Best sellers</a></div>
            <div><h4>Account</h4><a href="/account.html">My account</a><a href="/account.html#orders">Orders</a><a href="/wishlist.html">Wishlist</a><a href="/compare.html">Compare</a></div>
            <div><h4>Marketplace</h4><a href="/register.html?role=seller">Sell on Nexora</a><a href="/register.html">Create account</a><a href="/login.html">Log in</a><a href="/admin.html">Admin</a></div>
          </div>
          <div class="bottom">© ${new Date().getFullYear()} Nexora Marketplace. Your Marketplace for PC Hardware &amp; Technology. All prices in Pakistani Rupees (PKR).</div>
        </div>`;
    }
  }

  // Update compare badge in the header.
  function refreshCompareCount() {
    const el = document.querySelector('[data-compare-count]');
    if (!el) return;
    const n = getCompare().length;
    if (n > 0) { el.textContent = n; el.classList.remove('hidden'); } else el.classList.add('hidden');
  }

  // Global delegated events (CSP-safe: no inline handlers).
  document.addEventListener('click', async (e) => {
    const logout = e.target.closest('[data-logout]');
    if (logout) {
      e.preventDefault();
      try { await API.post('/api/auth/logout', {}); } catch {}
      ME = null;
      document.querySelector('.mobile-menu')?.classList.remove('open');
      location.href = '/';
      return;
    }
    const redir = e.target.closest('[data-redirect]');
    if (redir) {
      e.preventDefault();
      const dest = redir.getAttribute('href') || '/login.html';
      location.href = dest + (dest.includes('?') ? '&' : '?') + 'redirect=' + encodeURIComponent(location.pathname + location.search);
      return;
    }
    const menu = e.target.closest('[data-menu]');
    if (menu) {
      const mm = document.querySelector('.mobile-menu');
      if (mm) mm.classList.toggle('open');
      return;
    }
    // Close the mobile drawer after choosing any link inside it.
    if (e.target.closest('.mobile-menu a')) {
      document.querySelector('.mobile-menu')?.classList.remove('open');
    }
  });
  document.addEventListener('submit', (e) => {
    const sb = e.target.closest('[data-search]');
    if (sb) { e.preventDefault(); const q = sb.querySelector('input').value.trim(); location.href = '/shop.html?q=' + encodeURIComponent(q); }
  });

  // Boot: fetch CSRF + user, render chrome, update cart count.
  const appReady = (async function boot() {
    await fetchCsrf();
    const user = await me();
    renderChrome(user);
    await refreshCartCount();
    refreshCompareCount();
    return { user };
  })();

  window.API = API;
  window.appReady = appReady;
  window.UI = { money, esc, stars, toast, qs, productImg, pctOff, specLabel, refreshCartCount };
  window.Auth = { me, requireLogin };
  window.Compare = { getCompare, saveCompare, toggleCompare, refreshCompareCount };
})();