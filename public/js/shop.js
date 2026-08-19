(async function () {
  await window.appReady;
  const { esc, money, stars, productImg, toast, qs, pctOff } = window.UI;
  const state = { q: qs('q') || '', category: qs('category') || 'all', brand: '', min: '', max: '',
    rating: '', inStock: false, onSale: qs('onSale') === '1', seller: '', sort: qs('sort') || 'relevance', page: 1 };
  if (!['relevance','newest','featured','top_rated','best_selling','price_asc','price_desc'].includes(state.sort)) state.sort = 'relevance';

  const form = document.querySelector('[data-filter-form]');
  const resultsBox = document.querySelector('[data-results]');
  const sortSel = document.querySelector('[data-sort]');
  sortSel.value = state.sort;
  form.querySelector('[data-f="q"]').value = state.q;
  form.querySelector('[data-f="seller"]').value = state.seller;
  document.title = state.q ? `Search: ${state.q} — Nexora Marketplace` : 'Shop PC Hardware — Nexora Marketplace';

  // Load category + brand filter lists
  try {
    const roots = await API.get('/api/categories');
    const box = document.querySelector('[data-cat-filters]');
    const link = (slug, name, sub) => `<a class="filter-link${state.category === slug ? ' active' : ''}" data-cat="${esc(slug)}" style="${sub ? 'padding-left:14px;font-size:.84rem' : ''}">${esc(name)}</a>`;
    let html = `<a class="filter-link${state.category === 'all' ? ' active' : ''}" data-cat="all">All categories</a>`;
    for (const c of roots) {
      html += link(c.slug, c.name);
      for (const ch of (c.children || [])) html += link(ch.slug, ch.name, true);
    }
    box.innerHTML = html;
    const brands = await API.get('/api/products/brands');
    const bbox = document.querySelector('[data-brand-filters]');
    bbox.innerHTML = `<a class="filter-link${!state.brand ? ' active' : ''}" data-brand="">All brands</a>` +
      (brands || []).map((b) => `<a class="filter-link" data-brand="${esc(b)}">${esc(b)}</a>`).join('');
  } catch { document.querySelector('[data-cat-filters]').innerHTML = '<p class="small muted">Could not load.</p>'; }

  function card(p) {
    const tag = !p.in_stock ? '<span class="tag out">Sold out</span>'
      : p.on_sale ? `<span class="tag">-${pctOff(p)}%</span>` : '';
    const price = p.on_sale ? `${money(p.effective_price)}<span class="was">${money(p.price)}</span>` : money(p.effective_price);
    const compared = window.Compare.getCompare().includes(p.id);
    return `<div class="card">
      ${tag}
      <button class="wish" data-wish="${p.id}" title="Add to wishlist" aria-label="Wishlist">♡</button>
      <button class="compare-toggle${compared ? ' on' : ''}" data-compare="${p.id}" title="Compare">⚖</button>
      <a class="thumb" href="/product.html?slug=${encodeURIComponent(p.slug)}"><img src="${esc(productImg(p))}" alt="${esc(p.title)}" loading="lazy"></a>
      <div class="body">
        <div class="row between aic"><span class="cat">${esc(p.category_name || '')}</span>${p.brand ? `<span class="brand-chip">${esc(p.brand)}</span>` : ''}</div>
        <a class="title" href="/product.html?slug=${encodeURIComponent(p.slug)}">${esc(p.title)}</a>
        ${stars(p.rating_avg, p.rating_count)}
        <div class="small muted">Seller: ${esc(p.seller_name || 'Nexora')}</div>
        <div class="price">${price}</div>
        <div class="actions">
          <button class="btn sm block" data-add="${p.id}" ${p.in_stock ? '' : 'disabled'}>${p.in_stock ? 'Add to cart' : 'Sold out'}</button>
        </div>
      </div></div>`;
  }

  async function load() {
    resultsBox.innerHTML = '<div class="spinner"></div>';
    const params = new URLSearchParams();
    if (state.q) params.set('search', state.q);
    if (state.category && state.category !== 'all') params.set('category', state.category);
    if (state.brand) params.set('brand', state.brand);
    if (state.min) params.set('min', state.min);
    if (state.max) params.set('max', state.max);
    if (state.rating) params.set('rating', state.rating);
    if (state.seller) params.set('seller', state.seller);
    if (state.inStock) params.set('inStock', '1');
    if (state.onSale) params.set('onSale', '1');
    params.set('sort', state.sort);
    params.set('page', state.page);
    params.set('perPage', '12');
    try {
      const data = await API.get('/api/products?' + params.toString());
      document.querySelector('[data-result-count]').textContent = `${data.total} product${data.total === 1 ? '' : 's'} found`;
      document.querySelector('[data-page-info]').textContent = `Page ${data.page} of ${data.pages}`;
      resultsBox.innerHTML = data.items.length ? data.items.map(card).join('')
        : '<div class="empty-state"><div class="big">🔍</div><h3>No products match</h3><p>Try adjusting your filters.</p></div>';
      renderPager(data);
    } catch (e) { resultsBox.innerHTML = `<p class="alert error">${esc(e.message)}</p>`; }
  }

  function renderPager(d) {
    const box = document.querySelector('[data-pagination]');
    if (d.pages <= 1) { box.innerHTML = ''; return; }
    let h = `<button class="btn ghost sm" data-pg="${d.page - 1}" ${d.page <= 1 ? 'disabled' : ''}>‹ Prev</button>`;
    for (let i = 1; i <= d.pages; i++) {
      if (i === 1 || i === d.pages || Math.abs(i - d.page) <= 1)
        h += `<button class="btn ${i === d.page ? '' : 'ghost'} sm" data-pg="${i}">${i}</button>`;
      else if (Math.abs(i - d.page) === 2) h += '<span>…</span>';
    }
    h += `<button class="btn ghost sm" data-pg="${d.page + 1}" ${d.page >= d.pages ? 'disabled' : ''}>Next ›</button>`;
    box.innerHTML = h;
  }

  // Events
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    state.q = form.querySelector('[data-f="q"]').value.trim();
    state.min = form.querySelector('[data-f="min"]').value;
    state.max = form.querySelector('[data-f="max"]').value;
    state.rating = form.querySelector('[data-f="rating"]').value;
    state.inStock = form.querySelector('[data-f="inStock"]').checked;
    state.onSale = form.querySelector('[data-f="onSale"]').checked;
    state.seller = form.querySelector('[data-f="seller"]').value.trim();
    state.page = 1; load();
  });
  document.querySelector('[data-clear]').addEventListener('click', () => {
    Object.assign(state, { q: '', category: 'all', brand: '', min: '', max: '', rating: '', inStock: false, onSale: false, seller: '', page: 1, sort: 'relevance' });
    form.reset(); sortSel.value = 'relevance';
    document.querySelectorAll('[data-cat]').forEach((a) => a.classList.toggle('active', a.dataset.cat === 'all'));
    document.querySelectorAll('[data-brand]').forEach((a) => a.classList.toggle('active', !a.dataset.brand));
    load();
  });
  sortSel.addEventListener('change', () => { state.sort = sortSel.value; state.page = 1; load(); });
  document.addEventListener('click', async (e) => {
    const cat = e.target.closest('[data-cat]');
    if (cat) {
      document.querySelectorAll('[data-cat]').forEach((a) => a.classList.remove('active'));
      cat.classList.add('active'); state.category = cat.dataset.cat; state.page = 1; load(); return;
    }
    const br = e.target.closest('[data-brand]');
    if (br) {
      document.querySelectorAll('[data-brand]').forEach((a) => a.classList.remove('active'));
      br.classList.add('active'); state.brand = br.dataset.brand; state.page = 1; load(); return;
    }
    const pg = e.target.closest('[data-pg]');
    if (pg && !pg.disabled) { state.page = Number(pg.dataset.pg); load(); window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    const add = e.target.closest('[data-add]');
    if (add) {
      if (!(await window.Auth.me())) return window.Auth.requireLogin();
      add.disabled = true;
      try { await API.post('/api/cart', { productId: Number(add.dataset.add), quantity: 1 }); toast('Added to cart', 'success'); window.UI.refreshCartCount(); }
      catch (err) { toast(err.message, 'error'); } finally { add.disabled = false; }
      return;
    }
    const wish = e.target.closest('[data-wish]');
    if (wish) {
      if (!(await window.Auth.me())) return window.Auth.requireLogin();
      try { const r = await API.post('/api/wishlist/toggle', { productId: Number(wish.dataset.wish) }); wish.classList.toggle('active', r.added); toast(r.added ? 'Saved to wishlist' : 'Removed from wishlist', 'success'); }
      catch (err) { toast(err.message, 'error'); }
      return;
    }
    const cmp = e.target.closest('[data-compare]');
    if (cmp) {
      try { const list = window.Compare.toggleCompare(Number(cmp.dataset.compare)); cmp.classList.toggle('on', list.includes(Number(cmp.dataset.compare))); window.Compare.refreshCompareCount(); toast('Added to compare. View on the Compare page.', 'success'); }
      catch (err) { toast(err.message, 'error'); }
    }
  });

  load();
})();