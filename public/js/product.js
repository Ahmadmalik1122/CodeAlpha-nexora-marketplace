(async function () {
  const { user } = await window.appReady;
  const { esc, money, stars, productImg, toast, qs } = window.UI;
  const key = qs('slug') || qs('id');
  const box = document.querySelector('[data-product]');
  if (!key) { box.innerHTML = '<div class="empty-state"><h3>No product specified.</h3></div>'; return; }

  let product;
  try { product = await API.get('/api/products/' + encodeURIComponent(key)); }
  catch (e) { box.innerHTML = `<div class="empty-state"><div class="big">😕</div><h3>Product not found</h3><p>${esc(e.message)}</p><a class="btn mt" href="/shop.html">Back to shop</a></div>`; return; }

  document.title = product.title + ' — Nexora Marketplace';
  const imgs = (product.images && product.images.length) ? product.images : [productImg(product)];
  const off = product.on_sale ? Math.round((1 - product.effective_price / product.price) * 100) : 0;
  const specs = product.specifications || {};

  document.querySelector('[data-breadcrumb]').innerHTML =
    `<a href="/">Home</a> / <a href="/shop.html">Shop</a>` +
    (product.category_name ? ` / <a href="/shop.html?category=${esc(product.category_slug)}">${esc(product.category_name)}</a>` : '') +
    ` / ${esc(product.title)}`;

  const stockMsg = product.in_stock
    ? (product.stock <= 5
      ? `<span class="pill pending">● Low stock — only ${product.stock} left</span>`
      : `<span class="pill paid">● In stock (${product.stock} available)</span>`)
    : '<span class="pill cancelled">● Out of stock</span>';

  box.innerHTML = `<div class="pdp">
    <div class="gallery">
      <div class="main"><img data-main-img src="${esc(imgs[0])}" alt="${esc(product.title)}"></div>
      ${imgs.length > 1 ? `<div class="thumbs">${imgs.map((u, i) => `<img data-thumb src="${esc(u)}" class="${i === 0 ? 'active' : ''}" alt="view ${i + 1}">`).join('')}</div>` : ''}
    </div>
    <div>
      <div class="cat muted small" style="text-transform:uppercase;letter-spacing:.06em;font-weight:700">${esc(product.category_name || '')}${product.brand ? ` · <span style="color:var(--primary)">${esc(product.brand)}</span>` : ''}</div>
      <h1 class="mt">${esc(product.title)}</h1>
      <div class="row aic mt" style="gap:10px">${stars(product.rating_avg, product.rating_count)} <span class="small muted">SKU: ${esc(product.sku || '—')}</span></div>
      <div class="price-lg mt">${money(product.effective_price)}${product.on_sale ? `<span class="was">${money(product.price)}</span> <span class="pill-save">Save ${off}%</span>` : ''}</div>
      <div class="pdp-info-grid">
        <div class="pdp-info"><div class="k">Stock</div><div class="v">${product.in_stock ? `${product.stock} available` : 'Out of stock'}</div></div>
        <div class="pdp-info"><div class="k">Warranty</div><div class="v">${esc(product.warranty || '—')}</div></div>
        <div class="pdp-info"><div class="k">Seller</div><div class="v">${esc(product.seller_name || 'Nexora')}</div></div>
      </div>
      <div class="mt2">${stockMsg}</div>
      <p class="mt2">${esc(product.description || '')}</p>
      <div class="row aic mt2" style="gap:14px;flex-wrap:wrap">
        <div class="qty">
          <button type="button" data-q="-1" aria-label="Decrease">−</button>
          <input data-qty type="number" value="1" min="1" max="${product.stock || 1}">
          <button type="button" data-q="1" aria-label="Increase">+</button>
        </div>
        <button class="btn lg" data-add ${product.in_stock ? '' : 'disabled'}>${product.in_stock ? '🛒 Add to cart' : 'Sold out'}</button>
        <button class="btn dark lg" data-buy ${product.in_stock ? '' : 'disabled'}>Buy now</button>
        <button class="btn ghost lg" data-wish title="Add to wishlist">♡ Save</button>
      </div>
      <div class="seller-card">
        <div><b style="color:var(--ink)">🏪 ${esc(product.seller_name || 'Nexora')}</b>
          <div class="small muted">${esc(product.brand || '')} · ${esc(product.warranty || '')}</div></div>
        <a class="btn sm ghost" href="/shop.html?seller=${encodeURIComponent(product.seller_name || '')}">View store products</a>
      </div>
      ${product.tags ? `<div class="mt2 small muted">Tags: ${esc(product.tags)}</div>` : ''}
    </div>
  </div>`;

  // Gallery thumbnails
  box.addEventListener('click', (e) => {
    const t = e.target.closest('[data-thumb]');
    if (t) { document.querySelector('[data-main-img]').src = t.src; box.querySelectorAll('[data-thumb]').forEach((x) => x.classList.remove('active')); t.classList.add('active'); }
    const q = e.target.closest('[data-q]');
    if (q) { const inp = box.querySelector('[data-qty]'); const v = Math.max(1, Math.min(product.stock || 99, (Number(inp.value) || 1) + Number(q.dataset.q))); inp.value = v; }
  });

  box.querySelector('[data-add]')?.addEventListener('click', async (e) => {
    if (!(await window.Auth.me())) return window.Auth.requireLogin();
    const qty = Math.max(1, Number(box.querySelector('[data-qty]').value) || 1);
    e.target.disabled = true;
    try { await API.post('/api/cart', { productId: product.id, quantity: qty }); toast('Added to cart', 'success'); window.UI.refreshCartCount(); }
    catch (err) { toast(err.message, 'error'); } finally { e.target.disabled = false; }
  });
  box.querySelector('[data-buy]')?.addEventListener('click', async (e) => {
    if (!(await window.Auth.me())) return window.Auth.requireLogin();
    const qty = Math.max(1, Number(box.querySelector('[data-qty]').value) || 1);
    try { await API.post('/api/cart', { productId: product.id, quantity: qty }); window.UI.refreshCartCount(); location.href = '/checkout.html'; }
    catch (err) { toast(err.message, 'error'); }
  });
  box.querySelector('[data-wish]')?.addEventListener('click', async (e) => {
    if (!(await window.Auth.me())) return window.Auth.requireLogin();
    try { const r = await API.post('/api/wishlist/toggle', { productId: product.id }); e.target.classList.toggle('active', r.added); toast(r.added ? 'Saved to wishlist' : 'Removed', 'success'); }
    catch (err) { toast(err.message, 'error'); }
  });

  // Specifications
  const specKeys = Object.keys(specs);
  if (specKeys.length) {
    document.querySelector('[data-specs-section]').hidden = false;
    document.querySelector('[data-specs]').innerHTML = `<table class="spec-table">${specKeys.map((k) =>
      `<tr><td>${esc(window.UI.specLabel(k))}</td><td>${esc(specs[k])}</td></tr>`).join('')}</table>`;
  }

  // Reviews
  const revSection = document.querySelector('[data-reviews-section]');
  revSection.hidden = false;
  function renderReviews(list) {
    const el = document.querySelector('[data-review-list]');
    if (!list || !list.length) { el.innerHTML = '<p class="muted">No reviews yet. Be the first!</p>'; return; }
    el.innerHTML = list.map((r) => `<div class="review">
      <div class="row between">
        <span><span class="who">${esc(r.author || 'Customer')}</span>${r.verified ? '<span class="verified-badge">✓ Verified purchase</span>' : ''}</span>
        <span class="small muted">${(r.created_at || '').slice(0, 10)}</span>
      </div>
      ${stars(r.rating)}${r.title ? `<div class="r-title">${esc(r.title)}</div>` : ''}
      <p class="mt small">${esc(r.comment || '')}</p></div>`).join('');
  }
  renderReviews(product.reviews);

  const reviewWrap = document.querySelector('[data-review-form-wrap]');
  if (!user) {
    reviewWrap.innerHTML = '<h3>Write a review</h3><p class="muted mt">Please <a href="/login.html?redirect=' + encodeURIComponent(location.pathname + location.search) + '">log in</a> to leave a review.</p>';
  } else if (!product.can_review) {
    reviewWrap.innerHTML = '<h3>Write a review</h3><p class="muted mt">Only verified buyers who purchased this product can review it. <a href="/product.html?slug=' + encodeURIComponent(product.slug) + '">See the product</a> or place an order to unlock reviews.</p>';
  } else if (product.has_reviewed) {
    document.querySelector('[data-review-form]').addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      try {
        const r = await API.post(`/api/products/${product.id}/reviews`, { rating: Number(fd.get('rating')), title: fd.get('title'), comment: fd.get('comment') });
        renderReviews(r.reviews);
        document.querySelector('[data-review-msg]').innerHTML = '<div class="alert success">Thanks! Your review was updated.</div>';
        e.target.reset();
      } catch (err) { document.querySelector('[data-review-msg]').innerHTML = `<div class="alert error">${esc(err.message)}</div>`; }
    });
  } else {
    document.querySelector('[data-review-form]').addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      try {
        const r = await API.post(`/api/products/${product.id}/reviews`, { rating: Number(fd.get('rating')), title: fd.get('title'), comment: fd.get('comment') });
        renderReviews(r.reviews);
        document.querySelector('[data-review-msg]').innerHTML = '<div class="alert success">Thanks! Your review was posted.</div>';
        e.target.reset();
      } catch (err) { document.querySelector('[data-review-msg]').innerHTML = `<div class="alert error">${esc(err.message)}</div>`; }
    });
  }

  // Related
  if (product.related && product.related.length) {
    document.querySelector('[data-related-section]').hidden = false;
    document.querySelector('[data-related]').innerHTML = product.related.map((p) => `
      <a class="card" href="/product.html?slug=${encodeURIComponent(p.slug)}">
        <div class="thumb"><img src="${esc(productImg(p))}" alt="${esc(p.title)}" loading="lazy"></div>
        <div class="body"><div class="cat">${esc(p.category_name || '')}</div><div class="title">${esc(p.title)}</div>${stars(p.rating_avg, p.rating_count)}<div class="price">${money(p.effective_price)}</div></div></a>`).join('');
  }
})();