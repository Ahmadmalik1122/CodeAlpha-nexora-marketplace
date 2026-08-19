(async function () {
  await window.appReady;
  const { esc, money, stars, productImg, pctOff } = window.UI;

  function card(p) {
    const tag = !p.in_stock ? '<span class="tag out">Sold out</span>'
      : p.on_sale ? `<span class="tag">-${pctOff(p)}%</span>` : '';
    const price = p.on_sale
      ? `${money(p.effective_price)}<span class="was">${money(p.price)}</span>`
      : money(p.effective_price);
    return `<a class="card" href="/product.html?slug=${encodeURIComponent(p.slug)}">
      ${tag}
      <div class="thumb"><img src="${esc(productImg(p))}" alt="${esc(p.title)}" loading="lazy"></div>
      <div class="body">
        <div class="row between aic"><span class="cat">${esc(p.category_name || '')}</span>${p.brand ? `<span class="brand-chip">${esc(p.brand)}</span>` : ''}</div>
        <div class="title">${esc(p.title)}</div>
        ${stars(p.rating_avg, p.rating_count)}
        <div class="price">${price}</div>
        <div class="small muted">Seller: ${esc(p.seller_name || 'Nexora')}</div>
      </div></a>`;
  }
  const grid = (list) => (list && list.length) ? list.map(card).join('') : '<p class="muted">Nothing here yet.</p>';

  // Newsletter (demo)
  document.querySelector('[data-newsletter]')?.addEventListener('submit', (e) => {
    e.preventDefault();
    e.target.querySelector('input').value = '';
    window.UI.toast('Thanks for subscribing to Nexora deals!', 'success');
  });

  try {
    const [cats, trending, deals, best, components, gaming, latest] = await Promise.all([
      API.get('/api/categories?tree=1'),
      API.get('/api/products?sort=best_selling&perPage=4'),
      API.get('/api/products?onSale=1&perPage=4'),
      API.get('/api/products?sort=best_selling&perPage=4'),
      API.get('/api/products?category=pc-components&sort=top_rated&perPage=4'),
      API.get('/api/products?category=gaming&sort=top_rated&perPage=4'),
      API.get('/api/products?sort=newest&perPage=4'),
    ]);

    const catBox = document.querySelector('[data-categories]');
    const tops = (cats.categories || cats || []).slice(0, 6);
    catBox.innerHTML = tops.map((c) => `
      <a class="cat-card" href="/shop.html?category=${encodeURIComponent(c.slug)}">
        <img src="${esc(c.image || 'https://placehold.co/300x190/eef2ff/2563eb?text=' + encodeURIComponent(c.name))}" alt="${esc(c.name)}" loading="lazy">
        <div>${esc(c.name)}<small>${c.product_count} products</small></div>
      </a>`).join('');

    document.querySelector('[data-trending]').innerHTML = grid(trending.items);
    document.querySelector('[data-deals]').innerHTML = grid(deals.items);
    document.querySelector('[data-best]').innerHTML = grid(best.items);
    document.querySelector('[data-components]').innerHTML = grid(components.items);
    document.querySelector('[data-gaming]').innerHTML = grid(gaming.items);
    document.querySelector('[data-latest]').innerHTML = grid(latest.items);
  } catch (e) {
    window.UI.toast('Failed to load homepage: ' + e.message, 'error');
  }
})();