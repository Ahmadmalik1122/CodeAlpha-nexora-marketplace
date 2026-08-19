(async function () {
  const { user } = await window.appReady;
  const { esc, money, productImg, toast } = window.UI;

  const guard = document.querySelector('[data-seller-guard]');
  if (!user) { location.href = '/login.html?redirect=' + encodeURIComponent('/seller.html'); return; }
  if (user.role !== 'seller') {
    guard.innerHTML = `<div class="container section"><div class="empty-state"><div class="big">🏪</div><h3>Seller area</h3>
      <p>This dashboard is only for registered sellers. Create a seller account to open your store.</p>
      <a class="btn mt" href="/register.html?role=seller">Become a seller</a></div></div>`;
    return;
  }
  if (user.seller_status !== 'approved') {
    const msgs = {
      pending: '<b>Your store is pending approval.</b> Our team is reviewing your application — you will get access once it is approved.',
      rejected: '<b>Your seller application was rejected.</b> Contact support for more information.',
      suspended: '<b>Your store is currently suspended.</b> Contact support to resolve this.',
    };
    guard.innerHTML = `<div class="container section"><div class="empty-state"><div class="big">⏳</div>
      <h3>${user.seller_status === 'pending' ? 'Pending approval' : 'Store unavailable'}</h3>
      <p>${msgs[user.seller_status] || 'Your store is not active.'}</p>
      <a class="btn ghost mt" href="/account.html">Back to account</a></div></div>`;
    return;
  }

  // ===== Approved seller: full dashboard =====
  const TABS = [
    { id: 'overview', label: '📊 Overview' },
    { id: 'products', label: '🛍️ Products' },
    { id: 'orders', label: '📦 Orders' },
    { id: 'reviews', label: '💬 Reviews' },
    { id: 'store', label: '🏪 Store settings' },
  ];
  const hashTab = (location.hash || '').replace('#', '');
  let curTab = TABS.some((t) => t.id === hashTab) ? hashTab : 'overview';

  guard.innerHTML = `<div class="admin-shell">
    <aside class="sidebar">
      <div class="logo"><span class="logo-mark">⚡</span>Nexora Seller</div>
      <div class="s-label">Dashboard</div>
      ${TABS.map((t) => `<a data-s-tab="${t.id}" ${t.id === curTab ? 'class="active"' : ''}>${t.label}</a>`).join('')}
      <div class="s-label">Store</div>
      <a href="/shop.html?seller=${encodeURIComponent(user.store_name || '')}">View my store ↗</a>
      <a href="/account.html">My account</a>
      <a href="#" data-logout>Log out</a>
    </aside>
    <main class="admin-main">
      <div class="row between aic wrap" style="gap:12px;margin-bottom:20px">
        <div>
          <h1 style="font-size:1.5rem">${esc(user.store_name || 'My Store')}</h1>
          <div class="small muted">${esc(user.full_name)} · <a href="/shop.html?seller=${encodeURIComponent(user.store_name || '')}">public store page</a></div>
        </div>
        <span class="pill paid">● Approved</span>
      </div>
      <div data-s-panel></div>
    </main>
  </div>`;

  const panel = guard.querySelector('[data-s-panel]');
  let categories = [];
  try { categories = await API.get('/api/categories/flat'); } catch { /* non-fatal */ }
  const reload = () => render();

  async function render() {
    panel.innerHTML = '<div class="spinner"></div>';
    if (curTab === 'overview') return renderOverview();
    if (curTab === 'products') return renderProducts();
    if (curTab === 'orders') return renderOrders();
    if (curTab === 'reviews') return renderReviews();
    if (curTab === 'store') return renderStore();
  }

  guard.addEventListener('click', (e) => {
    const t = e.target.closest('[data-s-tab]');
    if (t) {
      curTab = t.dataset.sTab;
      guard.querySelectorAll('[data-s-tab]').forEach((a) => a.classList.remove('active'));
      t.classList.add('active');
      render();
    }
  });

  // ---------- Overview ----------
  async function renderOverview() {
    try {
      const d = await API.get('/api/seller/overview');
      const max = Math.max(...d.last7Days.map((x) => Number(x.v)), 1);
      panel.innerHTML = `
        <div class="stat-grid">
          <div class="stat"><div class="l">Total revenue</div><div class="n">${money(d.totalRevenue)}</div><div class="extra">${d.totalOrders} orders all-time</div></div>
          <div class="stat"><div class="l">This month</div><div class="n">${money(d.monthRevenue)}</div><div class="extra">${d.monthOrders} orders this month</div></div>
          <div class="stat"><div class="l">Pending orders</div><div class="n">${d.pendingOrders}</div><div class="extra">need action</div></div>
          <div class="stat"><div class="l">Products</div><div class="n">${d.products}</div><div class="extra">${d.lowStock} low on stock</div></div>
          <div class="stat"><div class="l">Avg rating</div><div class="n">${d.avgRating || '—'} ★</div><div class="extra">${d.reviewCount} reviews</div></div>
        </div>
        <div class="row wrap mt2" style="gap:20px">
          <div class="form-card" style="flex:2;min-width:300px">
            <h3>Revenue — last 7 days</h3>
            <div class="chart-bar">${d.last7Days.map((x) => `<div title="${esc(x.d)}: ${money(x.v)}" style="height:${Math.max(Number(x.v) / max * 100, 3)}%"></div>`).join('')}</div>
            <div class="small muted mt">${d.last7Days.map((x) => `<span>${esc((x.d || '').slice(5))}</span>`).join(' · ') || 'No sales recorded yet.'}</div>
          </div>
          <div class="form-card" style="flex:1;min-width:280px">
            <h3>Top sellers</h3>
            ${d.topSelling.length ? d.topSelling.map((p) => `
              <div class="kpi"><span class="small">${esc(p.title.slice(0, 38))}</span><b>${money(p.effective_price)}</b></div>`).join('')
            : '<p class="small muted">No sales yet.</p>'}
            <h3 class="mt2">⚠️ Low stock</h3>
            ${d.lowStockItems.length ? d.lowStockItems.map((p) => `<div class="kpi"><span class="small">${esc(p.title.slice(0, 38))}</span><b class="trend-warn">${p.stock} left</b></div>`).join('')
            : '<p class="small muted">All good — no low stock.</p>'}
          </div>
        </div>`;
    } catch (e) { panel.innerHTML = `<p class="alert error">${esc(e.message)}</p>`; }
  }

  // ---------- Products ----------
  async function renderProducts() {
    try {
      const d = await API.get('/api/seller/products?perPage=100');
      const opts = categories.map((c) => `<option value="${c.id}">${c.name}${c.parent_id ? ' (sub)' : ''}</option>`).join('');
      panel.innerHTML = `
        <div class="row between aic wrap" style="gap:10px;margin-bottom:16px">
          <h2 style="font-size:1.2rem">Products (${d.total})</h2>
          <button class="btn" data-p-new>+ Add product</button>
        </div>
        <div class="table-wrap">
          ${d.items.length ? d.items.map((p) => `
          <div class="mini-item" style="align-items:flex-start">
            <img src="${esc(productImg(p))}" alt="" style="width:44px;height:44px;object-fit:cover;border-radius:8px">
            <span style="flex:1">
              <b class="small">${esc(p.title)}</b>
              <div class="small muted">${p.brand ? esc(p.brand) + ' · ' : ''}${esc(p.category_name || '')} · stock ${p.stock}</div>
              <div class="small">${p.is_approved ? '<span class="pill paid">Approved</span>' : '<span class="pill pending">Pending approval</span>'} ${p.on_sale ? '<span class="pill warn">On sale</span>' : ''} ${p.is_featured ? '<span class="pill">Featured</span>' : ''}</div>
            </span>
            <span class="small" style="white-space:nowrap">${money(p.effective_price)}</span>
            <span style="display:flex;gap:6px">
              <button class="btn ghost sm" data-p-edit="${p.id}">Edit</button>
              <button class="btn ghost sm danger" data-p-del="${p.id}">Delete</button>
            </span>
          </div>`).join('') : '<p class="muted">No products yet. Add your first product!</p>'}
        </div>
        <div class="modal-bg hidden" data-p-modal>
          <div class="modal">
            <div class="row between aic"><h3 data-p-modal-title>Add product</h3><button data-p-close class="btn ghost sm">✕</button></div>
            <form data-p-form class="mt">
              <input type="hidden" name="id">
              <div class="field"><label>Title *</label><input name="title" required></div>
              <div class="row">
                <div class="field"><label>Price (PKR) *</label><input name="price" type="number" min="0" required></div>
                <div class="field"><label>Discount price</label><input name="discount_price" type="number" min="0" placeholder="optional"></div>
              </div>
              <div class="row">
                <div class="field"><label>Stock</label><input name="stock" type="number" min="0" value="10"></div>
                <div class="field"><label>Brand</label><input name="brand" placeholder="e.g. MSI"></div>
              </div>
              <div class="row">
                <div class="field"><label>Category</label><select name="category_id"><option value="">— None —</option>${opts}</select></div>
                <div class="field"><label>Warranty</label><input name="warranty" placeholder="e.g. 1 year"></div>
              </div>
              <div class="field"><label>Description</label><textarea name="description" rows="3"></textarea></div>
              <div class="field"><label>Specifications (JSON)</label><textarea name="specifications" rows="4" placeholder='{"cores":8,"socket":"AM5"}'></textarea></div>
              <div class="field"><label>Image URL(s) — one per line</label><textarea name="images" rows="2" placeholder="https://…"></textarea></div>
              <div class="field"><label>SKU / Tags</label><input name="sku" placeholder="SKU"><input name="tags" class="mt" placeholder="tags, comma, separated"></div>
              <label class="row aic mt" style="font-weight:500"><input type="checkbox" name="is_featured" style="width:auto"> Feature this product</label>
              <p class="small muted mt">New or edited products require admin approval before going live.</p>
              <button class="btn block mt" type="submit">Save product</button>
            </form>
          </div>
        </div>`;

      panel.querySelector('[data-p-new]').addEventListener('click', () => openModal(null));
      panel.querySelectorAll('[data-p-edit]').forEach((b) => b.addEventListener('click', async () => {
        const p = await API.get('/api/products/' + b.dataset.pEdit);
        openModal(p);
      }));
      panel.querySelectorAll('[data-p-del]').forEach((b) => b.addEventListener('click', async () => {
        if (!confirm('Delete this product?')) return;
        try { await API.del('/api/seller/products/' + b.dataset.pDel); toast('Product deleted', 'success'); renderProducts(); }
        catch (err) { toast(err.message, 'error'); }
      }));
      panel.querySelector('[data-p-close]').addEventListener('click', closeModal);

      function openModal(p) {
        const modal = panel.querySelector('[data-p-modal]');
        const form = panel.querySelector('[data-p-form]');
        panel.querySelector('[data-p-modal-title]').textContent = p ? 'Edit product' : 'Add product';
        form.reset();
        Object.entries({
          id: p ? p.id : '', title: p ? p.title : '', price: p ? p.price : '', discount_price: p ? p.discount_price || '' : '',
          stock: p ? p.stock : '10', brand: p ? p.brand || '' : '', category_id: p && p.category_id ? p.category_id : '',
          warranty: p ? p.warranty || '' : '', description: p ? p.description || '' : '',
          specifications: p ? JSON.stringify(p.specifications || {}, null, 2) : '', images: p && p.images ? p.images.join('\n') : '',
          sku: p ? p.sku || '' : '', tags: p ? p.tags || '' : '',
        }).forEach(([k, v]) => { const el = form.elements[k]; if (el) el.value = v; });
        form.elements.is_featured.checked = p ? !!p.is_featured : false;
        modal.classList.remove('hidden');
      }
      function closeModal() { panel.querySelector('[data-p-modal]').classList.add('hidden'); }

      panel.querySelector('[data-p-form]').addEventListener('submit', async (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        const id = fd.get('id');
        const body = {
          title: fd.get('title'), description: fd.get('description'), sku: fd.get('sku'),
          price: Number(fd.get('price')), discount_price: fd.get('discount_price') ? Number(fd.get('discount_price')) : null,
          stock: Number(fd.get('stock')), category_id: fd.get('category_id') ? Number(fd.get('category_id')) : null,
          brand: fd.get('brand'), warranty: fd.get('warranty'), tags: fd.get('tags'),
          specifications: fd.get('specifications'), images: fd.get('images'),
          is_featured: fd.get('is_featured') === 'on',
        };
        try {
          if (id) { await API.put('/api/seller/products/' + id, body); toast('Product updated — pending re-approval', 'success'); }
          else { await API.post('/api/seller/products', body); toast('Product created — pending approval', 'success'); }
          closeModal(); renderProducts();
        } catch (err) { toast(err.message, 'error'); }
      });
    } catch (e) { panel.innerHTML = `<p class="alert error">${esc(e.message)}</p>`; }
  }

  // ---------- Orders ----------
  let curOrderStatus = '';
  async function renderOrders() {
    try {
      const q = curOrderStatus ? '&status=' + encodeURIComponent(curOrderStatus) : '';
      const d = await API.get('/api/seller/orders?perPage=100' + q);
      panel.innerHTML = `
        <div class="row between aic wrap" style="gap:10px;margin-bottom:16px">
          <h2 style="font-size:1.2rem">Orders (${d.total})</h2>
          <select data-o-status>
            <option value="">All statuses</option>
            ${['pending','confirmed','processing','shipped','out_for_delivery','delivered','cancelled'].map((s) => `<option value="${s}" ${curOrderStatus === s ? 'selected' : ''}>${s.replace(/_/g, ' ')}</option>`).join('')}
          </select>
        </div>
        ${d.items.length ? d.items.map((o) => `
          <div class="order-card">
            <div class="row between wrap">
              <div><b>Order #${o.id}</b> <span class="pill ${esc(o.status)}">${esc(o.status.replace(/_/g, ' '))}</span>
                ${o.payment_status === 'paid' ? '<span class="pill paid">Paid</span>' : ''}</div>
              <span class="small muted">${esc(o.customer_name)} · ${(o.created_at || '').slice(0, 16).replace('T', ' ')}</span>
            </div>
            <div class="row between mt"><span class="small">${esc(o.shipping_address || '')} ${esc(o.shipping_city || '')}</span><b>${money(o.total)}</b></div>
            <div class="row mt2 wrap" style="gap:8px">
              <select data-o-set="${o.id}" class="sm" style="width:auto">
                ${['pending','confirmed','processing','shipped','out_for_delivery','delivered','cancelled'].map((s) => `<option value="${s}" ${o.status === s ? 'selected' : ''}>Set: ${s.replace(/_/g, ' ')}</option>`).join('')}
              </select>
              <button class="btn ghost sm" data-o-detail="${o.id}">View items</button>
            </div>
            <div data-o-items="${o.id}" hidden></div>
          </div>`).join('') : '<div class="empty-state"><h3>No orders yet</h3><p>When customers order your products, they appear here.</p></div>'}`;
      panel.querySelector('[data-o-status]').addEventListener('change', async (e) => {
        curOrderStatus = e.target.value;
        renderOrders();
      });
      panel.querySelectorAll('[data-o-set]').forEach((sel) => sel.addEventListener('change', async () => {
        try { await API.put(`/api/seller/orders/${sel.dataset.oSet}/status`, { status: sel.value }); toast('Order status updated', 'success'); renderOrders(); }
        catch (err) { toast(err.message, 'error'); }
      }));
      panel.querySelectorAll('[data-o-detail]').forEach((b) => b.addEventListener('click', async () => {
        const box = panel.querySelector(`[data-o-items="${b.dataset.oDetail}"]`);
        if (!box.hidden) { box.hidden = true; b.textContent = 'View items'; return; }
        box.hidden = false; b.textContent = 'Hide items';
        if (!box.innerHTML.trim()) {
          const o = await API.get('/api/seller/orders/' + b.dataset.oDetail);
          box.innerHTML = o.items.map((i) => `<div class="mini-item"><span class="small">${esc(i.product_title)} × ${i.quantity}</span><b class="small">${money(i.price * i.quantity)}</b></div>`).join('');
        }
      }));
    } catch (e) { panel.innerHTML = `<p class="alert error">${esc(e.message)}</p>`; }
  }

  // ---------- Reviews ----------
  async function renderReviews() {
    try {
      const d = await API.get('/api/seller/reviews');
      panel.innerHTML = `<h2 style="font-size:1.2rem;margin-bottom:16px">Reviews (${d.length})</h2>
        ${d.length ? d.map((r) => `<div class="review">
          <div class="row between"><span><span class="who">${esc(r.author)}</span><span class="small muted"> on ${esc(r.product_title)}</span></span>
          <span class="small muted">${(r.created_at || '').slice(0, 10)}</span></div>
          ${'★'.repeat(Math.round(r.rating))}<span class="rating-count">${r.rating}/5</span>
          ${r.verified ? '<span class="verified-badge">✓ Verified</span>' : ''}
          ${r.title ? `<div class="r-title">${esc(r.title)}</div>` : ''}
          <p class="small mt">${esc(r.comment || '')}</p></div>`).join('')
        : '<div class="empty-state"><h3>No reviews yet</h3></div>'}`;
    } catch (e) { panel.innerHTML = `<p class="alert error">${esc(e.message)}</p>`; }
  }

  // ---------- Store settings ----------
  async function renderStore() {
    try {
      const s = await API.get('/api/seller/store');
      panel.innerHTML = `<div class="form-card" style="max-width:560px">
        <h3>Store settings</h3>
        <form data-store-form>
          <div class="field"><label>Store name</label><input name="store_name" value="${esc(s.store_name || '')}" required></div>
          <div class="field"><label>Store description</label><textarea name="store_description" rows="4">${esc(s.store_description || '')}</textarea></div>
          <div class="field"><label>Store logo URL</label><input name="store_logo" value="${esc(s.store_logo || '')}" placeholder="https://…"></div>
          <button class="btn" type="submit">Save settings</button>
          <span data-store-msg class="small"></span>
        </form>
        <p class="small muted mt">Buyers see this store on product pages and when shopping by seller.</p>
      </div>`;
      panel.querySelector('[data-store-form]').addEventListener('submit', async (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        try {
          await API.put('/api/seller/store', { store_name: fd.get('store_name'), store_description: fd.get('store_description'), store_logo: fd.get('store_logo') });
          panel.querySelector('[data-store-msg]').innerHTML = '<span class="ok">Saved ✓</span>';
          toast('Store updated', 'success');
        } catch (err) { panel.querySelector('[data-store-msg]').innerHTML = `<span class="err">${esc(err.message)}</span>`; }
      });
    } catch (e) { panel.innerHTML = `<p class="alert error">${esc(e.message)}</p>`; }
  }

  render();
})();