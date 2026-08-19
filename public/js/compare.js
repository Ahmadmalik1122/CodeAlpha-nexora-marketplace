(async function () {
  await window.appReady;
  const { esc, money, stars, productImg, specLabel, toast } = window.UI;
  const box = document.querySelector('[data-compare]');

  async function load() {
    const ids = window.Compare.getCompare();
    document.querySelector('[data-compare-count]').textContent = `${ids.length}/4 products`;
    if (!ids.length) {
      box.innerHTML = `<div class="empty-state"><div class="big">⚖</div><h3>Nothing to compare yet</h3>
        <p>Tap the ⚖ icon on any product to add it here (up to 4).</p>
        <a class="btn mt" href="/shop.html">Browse products</a></div>`;
      return;
    }
    box.innerHTML = '<div class="spinner"></div>';
    try {
      const items = [];
      for (const id of ids) {
        try { items.push(await API.get('/api/products/' + id)); }
        catch { /* removed product */ }
      }
      if (!items.length) { window.Compare.saveCompare([]); return load(); }

      // All spec keys + a few standard rows.
      const specKeys = [...new Set(items.flatMap((p) => Object.keys(p.specifications || {})))];
      const rows = {
        Price: items.map((p) => `<b>${money(p.effective_price)}</b>${p.on_sale ? `<div class="was">${money(p.price)}</div>` : ''}`),
        Rating: items.map((p) => stars(p.rating_avg, p.rating_count)),
        Stock: items.map((p) => (p.in_stock ? `<span class="pill paid">In stock (${p.stock})</span>` : '<span class="pill cancelled">Out of stock</span>')),
        Brand: items.map((p) => esc(p.brand || '—')),
        Seller: items.map((p) => esc(p.seller_name || 'Nexora')),
        Warranty: items.map((p) => esc(p.warranty || '—')),
      };
      for (const k of specKeys) rows[specLabel(k)] = items.map((p) => esc(p.specifications[k] ?? '—'));

      box.innerHTML = `<div class="table-wrap compare-wrap">
        <table class="compare-table">
          <thead><tr><th>Compare</th>${items.map((p) => `
            <th>
              <div class="row center" style="justify-content:center;position:relative">
                <button class="remove-compare" data-rm="${p.id}" title="Remove" style="position:absolute;right:0">✕</button>
              </div>
              <a href="/product.html?slug=${encodeURIComponent(p.slug)}"><img src="${esc(productImg(p))}" alt="${esc(p.title)}" style="width:120px;height:120px;object-fit:contain;margin:6px auto"></a>
              <div style="font-size:.85rem;line-height:1.3">${esc(p.title)}</div>
              <a class="btn sm mt" style="margin-top:8px" href="/product.html?slug=${encodeURIComponent(p.slug)}">View</a>
            </th>`).join('')}</tr></thead>
          <tbody>${Object.entries(rows).map(([label, cells]) => `
            <tr><td>${esc(label)}</td>${cells.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody>
        </table>
      </div>`;

      box.querySelectorAll('[data-rm]').forEach((b) => b.addEventListener('click', () => {
        window.Compare.toggleCompare(Number(b.dataset.rm));
        window.Compare.refreshCompareCount();
        toast('Removed from compare', 'success');
        load();
      }));
    } catch (e) { box.innerHTML = `<p class="alert error">${esc(e.message)}</p>`; }
  }
  load();
})();