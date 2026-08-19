(async function () {
  const { user } = await window.appReady;
  const { esc, money, stars, productImg, toast, pctOff } = window.UI;
  const box = document.querySelector('[data-wishlist]');
  if (!user) { box.innerHTML = '<div class="empty-state"><h3>Please log in</h3><a class="btn mt" href="/login.html">Log in</a></div>'; return; }

  async function load() {
    box.innerHTML = '<div class="spinner"></div>';
    try {
      const raw = await API.get('/api/wishlist');
      const w = Array.isArray(raw) ? { items: raw } : raw;
      if (!w.items || !w.items.length) {
        box.innerHTML = `<div class="empty-state"><div class="big">♡</div><h3>No saved items yet</h3><p>Tap ♡ on any product to save it here.</p><a class="btn mt" href="/shop.html">Find something to love</a></div>`;
        return;
      }
      box.innerHTML = `<div class="grid products">${w.items.map((p) => {
        const tag = !p.in_stock ? '<span class="tag out">Sold out</span>' : (p.on_sale ? `<span class="tag">-${pctOff(p)}%</span>` : '');
        return `<div class="card">
          ${tag}
          <button class="wish active" data-remove-wish="${p.id}" title="Remove" aria-label="Remove from wishlist">♥</button>
          <a class="thumb" href="/product.html?slug=${encodeURIComponent(p.slug)}"><img src="${esc(productImg(p))}" alt="${esc(p.title)}" loading="lazy"></a>
          <div class="body">
            <div class="cat">${esc(p.category_name || '')}</div>
            <a class="title" href="/product.html?slug=${encodeURIComponent(p.slug)}">${esc(p.title)}</a>
            ${stars(p.rating_avg, p.rating_count)}
            <div class="small muted">Seller: ${esc(p.seller_name || 'Nexora')}</div>
            <div class="price">${money(p.effective_price)}${p.on_sale ? `<span class="was">${money(p.price)}</span>` : ''}</div>
            <button class="btn sm block" data-add="${p.id}" ${p.in_stock ? '' : 'disabled'}>${p.in_stock ? 'Add to cart' : 'Sold out'}</button>
          </div></div>`;
      }).join('')}</div>`;
      box.addEventListener('click', async (e) => {
        const rem = e.target.closest('[data-remove-wish]');
        if (rem) {
          try { await API.post('/api/wishlist/toggle', { productId: Number(rem.dataset.removeWish) }); toast('Removed from wishlist', 'success'); load(); }
          catch (err) { toast(err.message, 'error'); } return;
        }
        const add = e.target.closest('[data-add]');
        if (add) {
          add.disabled = true;
          try { await API.post('/api/cart', { productId: Number(add.dataset.add), quantity: 1 }); toast('Added to cart', 'success'); window.UI.refreshCartCount(); }
          catch (err) { toast(err.message, 'error'); } finally { add.disabled = false; }
        }
      });
    } catch (e) { box.innerHTML = `<p class="alert error">${esc(e.message)}</p>`; }
  }
  load();
})();