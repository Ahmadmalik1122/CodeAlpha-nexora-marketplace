(async function () {
  const { user } = await window.appReady;
  const { esc, money, toast } = window.UI;
  const guard = document.querySelector('[data-admin-guard]');
  if (!user) { location.href = '/login.html?redirect=' + encodeURIComponent('/admin.html'); return; }
  if (user.role !== 'admin') {
    guard.innerHTML = `<div class="container section"><div class="empty-state"><div class="big">🛡️</div><h3>Admin area</h3>
      <p>This dashboard is restricted to administrators.</p><a class="btn mt" href="/">Back to home</a></div></div>`;
    return;
  }

  const TABS = [
    { id: 'overview', label: '📊 Overview' },
    { id: 'sellers', label: '🏪 Sellers' },
    { id: 'products', label: '🛍️ Products' },
    { id: 'orders', label: '📦 Orders' },
    { id: 'reviews', label: '💬 Reviews' },
    { id: 'coupons', label: '🎟️ Coupons' },
    { id: 'users', label: '👥 Users' },
  ];

  guard.innerHTML = `<div class="admin-shell">
    <aside class="sidebar">
      <div class="logo"><span class="logo-mark">⚡</span>Nexora Admin</div>
      <div class="s-label">Administration</div>
      ${TABS.map((t) => `<a data-a-tab="${t.id}" ${t.id === 'overview' ? 'class="active"' : ''}>${t.label}</a>`).join('')}
      <div class="s-label">Front</div>
      <a href="/">View site ↗</a>
      <a href="/account.html">My account</a>
      <a href="#" data-logout>Log out</a>
    </aside>
    <main class="admin-main">
      <h1 style="font-size:1.5rem;margin-bottom:20px">Admin Dashboard</h1>
      <div data-a-panel></div>
    </main>
  </div>`;

  const panel = guard.querySelector('[data-a-panel]');
  let curTab = 'overview';
  const render = () => {
    panel.innerHTML = '<div class="spinner"></div>';
    if (curTab === 'overview') renderOverview();
    else if (curTab === 'sellers') renderSellers();
    else if (curTab === 'products') renderProducts();
    else if (curTab === 'orders') renderOrders();
    else if (curTab === 'reviews') renderReviews();
    else if (curTab === 'coupons') renderCoupons();
    else if (curTab === 'users') renderUsers();
  };
  guard.addEventListener('click', (e) => {
    const t = e.target.closest('[data-a-tab]');
    if (t) {
      curTab = t.dataset.aTab;
      guard.querySelectorAll('[data-a-tab]').forEach((a) => a.classList.remove('active'));
      t.classList.add('active');
      render();
    }
  });

  async function renderOverview() {
    try {
      const d = await API.get('/api/admin/analytics');
      const max = Math.max(...d.last7Days.map((x) => Number(x.v)), 1);
      panel.innerHTML = `
        <div class="stat-grid">
          <div class="stat"><div class="l">Total revenue</div><div class="n">${money(d.totalRevenue)}</div><div class="extra">${d.totalOrders} orders</div></div>
          <div class="stat"><div class="l">Today</div><div class="n">${money(d.todayRevenue)}</div><div class="extra">${d.todayOrders} orders today</div></div>
          <div class="stat"><div class="l">Month</div><div class="n">${money(d.monthRevenue)}</div><div class="extra">${d.monthOrders} orders this month</div></div>
          <div class="stat"><div class="l">Buyers</div><div class="n">${d.buyers}</div><div class="extra">${d.sellers} sellers</div></div>
          <div class="stat"><div class="l">Products</div><div class="n">${d.products}</div><div class="extra">${d.pendingProducts} pending approval</div></div>
          <div class="stat"><div class="l">Pending sellers</div><div class="n">${d.pendingSellers}</div><div class="extra">awaiting review</div></div>
        </div>
        <div class="row wrap mt2" style="gap:20px">
          <div class="form-card" style="flex:2;min-width:300px">
            <h3>Revenue — last 7 days</h3>
            <div class="chart-bar">${d.last7Days.map((x) => `<div title="${esc(x.d)}: ${money(x.v)}" style="height:${Math.max(Number(x.v) / max * 100, 3)}%"></div>`).join('')}</div>
            <div class="small muted mt">${d.last7Days.map((x) => `<span>${esc((x.d || '').slice(5))}</span>`).join(' · ')}</div>
          </div>
          <div class="form-card" style="flex:1;min-width:280px">
            <h3>Orders by status</h3>
            ${d.byStatus.map((s) => `<div class="kpi"><span class="small">${esc(s.status.replace(/_/g, ' '))}</span><b>${s.c}</b></div>`).join('') || '<p class="small muted">No orders.</p>'}
            <h3 class="mt2">🔥 Top selling</h3>
            ${d.topSelling.map((p) => `<div class="kpi"><span class="small">${esc(p.title.slice(0, 38))}</span><b>${p.sold} sold</b></div>`).join('') || '<p class="small muted">No sales.</p>'}
            <h3 class="mt2">⚠️ Low stock</h3>
            ${d.lowStock.map((p) => `<div class="kpi"><span class="small">${esc(p.title.slice(0, 38))}</span><b class="trend-warn">${p.stock}</b></div>`).join('') || '<p class="small muted">All healthy.</p>'}
          </div>
        </div>`;
    } catch (e) { panel.innerHTML = `<p class="alert error">${esc(e.message)}</p>`; }
  }

  async function renderSellers() {
    try {
      const d = await API.get('/api/admin/sellers');
      panel.innerHTML = `<h2 style="font-size:1.2rem;margin-bottom:16px">Sellers (${d.length})</h2>
        <div class="table-wrap">${d.map((s) => `
          <div class="mini-item" style="align-items:flex-start">
            <span style="flex:1">
              <b class="small">${esc(s.store_name || s.full_name)}</b>
              <div class="small muted">${esc(s.full_name)} · ${esc(s.email)} · ${esc(s.city || '—')} · ${s.product_count} products · ${money(s.revenue)} revenue</div>
              <div class="small muted">⭐ ${s.avg_rating || '—'} · ${s.items_sold} items sold · joined ${(s.created_at || '').slice(0, 10)}</div>
            </span>
            <span class="pill ${esc(s.seller_status)}">${esc(s.seller_status)}</span>
            <span style="display:flex;gap:6px;flex-wrap:wrap">
              <button class="btn ghost sm" data-s-approve="${s.id}" ${s.seller_status === 'approved' ? 'disabled' : ''}>Approve</button>
              <button class="btn ghost sm danger" data-s-reject="${s.id}" ${s.seller_status === 'rejected' ? 'disabled' : ''}>Reject</button>
              <button class="btn ghost sm" data-s-suspend="${s.id}" ${s.seller_status === 'suspended' ? 'disabled' : ''}>Suspend</button>
            </span>
          </div>`).join('')}</div>`;
      bindStatus('[data-s-approve]', 'approved');
      bindStatus('[data-s-reject]', 'rejected');
      bindStatus('[data-s-suspend]', 'suspended');
    } catch (e) { panel.innerHTML = `<p class="alert error">${esc(e.message)}</p>`; }
  }

  function bindStatus(sel, status) {
    panel.querySelectorAll(sel).forEach((b) => b.addEventListener('click', async () => {
      try { await API.put(`/api/admin/sellers/${b.dataset.sApprove || b.dataset.sReject || b.dataset.sSuspend}/status`, { status }); toast('Seller status updated', 'success'); renderSellers(); }
      catch (err) { toast(err.message, 'error'); }
    }));
  }

  async function renderProducts() {
    try {
      const d = await API.get('/api/admin/products?perPage=100');
      panel.innerHTML = `<h2 style="font-size:1.2rem;margin-bottom:16px">Products (${d.total})</h2>
        <div class="table-wrap">${d.items.map((p) => `
          <div class="mini-item" style="align-items:flex-start">
            <span style="flex:1">
              <b class="small">${esc(p.title)}</b>
              <div class="small muted">${esc(p.seller_name || '—')} · ${esc(p.category_name || '')} · stock ${p.stock}</div>
              <div class="small">${p.is_approved ? '<span class="pill paid">Approved</span>' : '<span class="pill pending">Pending</span>'} ${p.on_sale ? '<span class="pill warn">On sale</span>' : ''}</div>
            </span>
            <span class="small" style="white-space:nowrap">${money(p.effective_price)}</span>
            <span style="display:flex;gap:6px">
              <button class="btn ghost sm" data-ap-${p.is_approved ? 'un' : ''}approve="${p.id}">${p.is_approved ? 'Unapprove' : 'Approve'}</button>
              <button class="btn ghost sm danger" data-ap-del="${p.id}">Delete</button>
            </span>
          </div>`).join('')}</div>`;
      panel.querySelectorAll('[data-ap-approve]').forEach((b) => b.addEventListener('click', async () => {
        try { await API.put(`/api/admin/products/${b.dataset.apApprove}/approve`, { is_approved: true }); toast('Product approved', 'success'); renderProducts(); }
        catch (err) { toast(err.message, 'error'); }
      }));
      panel.querySelectorAll('[data-ap-unapprove]').forEach((b) => b.addEventListener('click', async () => {
        try { await API.put(`/api/admin/products/${b.dataset.apUnapprove}/approve`, { is_approved: false }); toast('Product unapproved', 'success'); renderProducts(); }
        catch (err) { toast(err.message, 'error'); }
      }));
      panel.querySelectorAll('[data-ap-del]').forEach((b) => b.addEventListener('click', async () => {
        if (!confirm('Delete this product permanently?')) return;
        try { await API.del('/api/admin/products/' + b.dataset.apDel); toast('Product deleted', 'success'); renderProducts(); }
        catch (err) { toast(err.message, 'error'); }
      }));
    } catch (e) { panel.innerHTML = `<p class="alert error">${esc(e.message)}</p>`; }
  }

  async function renderOrders() {
    try {
      const d = await API.get('/api/admin/orders?perPage=100');
      panel.innerHTML = `<h2 style="font-size:1.2rem;margin-bottom:16px">Orders (${d.total})</h2>
        ${d.items.map((o) => `
          <div class="order-card">
            <div class="row between wrap">
              <div><b>#${o.id}</b> <span class="pill ${esc(o.status)}">${esc(o.status.replace(/_/g, ' '))}</span>
                <span class="pill ${esc(o.payment_status)}">${o.payment_status === 'unpaid' ? 'COD' : esc(o.payment_status)}</span></div>
              <span class="small muted">${esc(o.customer_name)} · ${(o.created_at || '').slice(0, 16).replace('T', ' ')}</span>
            </div>
            <div class="row between mt"><span class="small">${esc(o.shipping_address || '')} ${esc(o.shipping_city || '')}</span><b>${money(o.total)}</b></div>
            <div class="row mt2 wrap" style="gap:8px">
              <select data-ao-status="${o.id}" class="sm" style="width:auto">
                ${['pending','confirmed','processing','shipped','out_for_delivery','delivered','cancelled'].map((s) => `<option value="${s}" ${o.status === s ? 'selected' : ''}>Status: ${s.replace(/_/g, ' ')}</option>`).join('')}
              </select>
              <select data-ao-pay="${o.id}" class="sm" style="width:auto">
                ${['unpaid','paid','refunded'].map((s) => `<option value="${s}" ${o.payment_status === s ? 'selected' : ''}>Pay: ${s}</option>`).join('')}
              </select>
              <input data-ao-track="${o.id}" class="sm" placeholder="Tracking #" value="${esc(o.tracking_number || '')}" style="width:auto">
              <button class="btn ghost sm" data-ao-track-save="${o.id}">Save</button>
            </div>
          </div>`).join('')}`;
      panel.querySelectorAll('[data-ao-status]').forEach((sel) => sel.addEventListener('change', async () => {
        try { await API.put(`/api/admin/orders/${sel.dataset.aoStatus}/status`, { status: sel.value }); toast('Order status updated', 'success'); }
        catch (err) { toast(err.message, 'error'); }
      }));
      panel.querySelectorAll('[data-ao-pay]').forEach((sel) => sel.addEventListener('change', async () => {
        try { await API.put(`/api/admin/orders/${sel.dataset.aoPay}/payment`, { payment_status: sel.value }); toast('Payment updated', 'success'); }
        catch (err) { toast(err.message, 'error'); }
      }));
      panel.querySelectorAll('[data-ao-track-save]').forEach((b) => b.addEventListener('click', async () => {
        const inp = panel.querySelector(`[data-ao-track="${b.dataset.aoTrackSave}"]`);
        try { await API.put(`/api/admin/orders/${b.dataset.aoTrackSave}/tracking`, { tracking_number: inp.value }); toast('Tracking saved', 'success'); }
        catch (err) { toast(err.message, 'error'); }
      }));
    } catch (e) { panel.innerHTML = `<p class="alert error">${esc(e.message)}</p>`; }
  }

  async function renderReviews() {
    try {
      const d = await API.get('/api/admin/reviews?perPage=100');
      panel.innerHTML = `<h2 style="font-size:1.2rem;margin-bottom:16px">Reviews (${d.total})</h2>
        ${d.items.length ? d.items.map((r) => `
          <div class="review">
            <div class="row between"><span><span class="who">${esc(r.author)}</span><span class="small muted"> on ${esc(r.product_title)}</span></span>
              <span class="small muted">${(r.created_at || '').slice(0, 10)}</span></div>
            ${'★'.repeat(Math.round(r.rating))}<span class="rating-count">${r.rating}/5</span>
            ${r.verified ? '<span class="verified-badge">✓ Verified</span>' : ''}
            ${r.title ? `<div class="r-title">${esc(r.title)}</div>` : ''}
            <p class="small mt">${esc(r.comment || '')}</p>
            <button class="btn ghost sm danger mt" data-arv-del="${r.id}">Remove review</button>
          </div>`).join('')
        : '<div class="empty-state"><h3>No reviews yet</h3></div>'}`;
      panel.querySelectorAll('[data-arv-del]').forEach((b) => b.addEventListener('click', async () => {
        if (!confirm('Remove this review?')) return;
        try { await API.del('/api/admin/reviews/' + b.dataset.arvDel); toast('Review removed', 'success'); renderReviews(); }
        catch (err) { toast(err.message, 'error'); }
      }));
    } catch (e) { panel.innerHTML = `<p class="alert error">${esc(e.message)}</p>`; }
  }

  async function renderCoupons() {
    try {
      const d = await API.get('/api/admin/coupons');
      panel.innerHTML = `
        <div class="row between aic wrap" style="gap:10px;margin-bottom:16px">
          <h2 style="font-size:1.2rem">Coupons (${d.length})</h2>
          <button class="btn" data-ac-new>+ New coupon</button>
        </div>
        <div class="table-wrap">${d.map((c) => `
          <div class="mini-item">
            <span style="flex:1"><b class="small">${esc(c.code)}</b>
              <span class="small muted"> · ${c.type === 'percent' ? `${c.value}% off` : money(c.value) + ' off'} · min order ${money(c.min_subtotal)} · ${c.used_count}/${c.usage_limit || '∞'} used${c.expires_at ? ' · exp ' + (c.expires_at || '').slice(0, 10) : ''}</span></div>
            <button class="btn ghost sm" data-ac-toggle="${c.id}">${c.active ? 'Deactivate' : 'Activate'}</button>
            <button class="btn ghost sm danger" data-ac-del="${c.id}">Delete</button>
          </div>`).join('')}</div>
        <div class="modal-bg hidden" data-ac-modal>
          <div class="modal">
            <h3>New coupon</h3>
            <form data-ac-form class="mt">
              <div class="row"><div class="field"><label>Code</label><input name="code" required></div>
              <div class="field"><label>Type</label><select name="type"><option value="percent">Percent</option><option value="fixed">Fixed (PKR)</option></select></div></div>
              <div class="row"><div class="field"><label>Value</label><input name="value" type="number" min="0" step="any" required></div>
              <div class="field"><label>Min order (PKR)</label><input name="min_subtotal" type="number" min="0" value="0"></div></div>
              <div class="row"><div class="field"><label>Max uses</label><input name="usage_limit" type="number" min="0" value="0"></div>
              <div class="field"><label>Expires (YYYY-MM-DD)</label><input name="expires_at" type="date"></div></div>
              <button class="btn block mt" type="submit">Create coupon</button>
            </form>
          </div>
        </div>`;
      panel.querySelector('[data-ac-new]').addEventListener('click', () => panel.querySelector('[data-ac-modal]').classList.remove('hidden'));
      panel.querySelector('[data-ac-form]').addEventListener('submit', async (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        try {
          await API.post('/api/admin/coupons', {
            code: fd.get('code'), type: fd.get('type'), value: Number(fd.get('value')),
            min_subtotal: Number(fd.get('min_subtotal')), usage_limit: Number(fd.get('usage_limit')) || null,
            expires_at: fd.get('expires_at') || null, active: 1,
          });
          toast('Coupon created', 'success'); renderCoupons();
        } catch (err) { toast(err.message, 'error'); }
      });
      panel.querySelectorAll('[data-ac-toggle]').forEach((b) => b.addEventListener('click', async () => {
        try { await API.put('/api/admin/coupons/' + b.dataset.acToggle, { active: b.textContent.trim() === 'Activate' }); toast('Coupon updated', 'success'); renderCoupons(); }
        catch (err) { toast(err.message, 'error'); }
      }));
      panel.querySelectorAll('[data-ac-del]').forEach((b) => b.addEventListener('click', async () => {
        if (!confirm('Delete this coupon?')) return;
        try { await API.del('/api/admin/coupons/' + b.dataset.acDel); toast('Coupon deleted', 'success'); renderCoupons(); }
        catch (err) { toast(err.message, 'error'); }
      }));
    } catch (e) { panel.innerHTML = `<p class="alert error">${esc(e.message)}</p>`; }
  }

  async function renderUsers() {
    try {
      const d = await API.get('/api/admin/users');
      panel.innerHTML = `<h2 style="font-size:1.2rem;margin-bottom:16px">Users (${d.length})</h2>
        <div class="table-wrap">${d.map((u) => `
          <div class="mini-item">
            <span style="flex:1"><b class="small">${esc(u.full_name)}</b>
              <span class="small muted"> · ${esc(u.email)} · role: ${u.role}${u.role === 'seller' ? ' (' + esc(u.seller_status) + ')' : ''}</span></div>
            <button class="btn ghost sm" data-au-role="${u.id}" data-role="${u.role}">Make ${u.role === 'admin' ? 'buyer' : 'admin'}</button>
            <button class="btn ghost sm danger" data-au-active="${u.id}" data-active="${u.is_active ? 1 : 0}">${u.is_active ? 'Deactivate' : 'Activate'}</button>
          </div>`).join('')}</div>`;
      panel.querySelectorAll('[data-au-role]').forEach((b) => b.addEventListener('click', async () => {
        try { await API.put(`/api/admin/users/${b.dataset.auRole}/role`, { role: b.dataset.role === 'admin' ? 'buyer' : 'admin' }); toast('Role updated', 'success'); renderUsers(); }
        catch (err) { toast(err.message, 'error'); }
      }));
      panel.querySelectorAll('[data-au-active]').forEach((b) => b.addEventListener('click', async () => {
        try { await API.put(`/api/admin/users/${b.dataset.auActive}/active`, { is_active: b.dataset.active === '1' ? false : true }); toast('User updated', 'success'); renderUsers(); }
        catch (err) { toast(err.message, 'error'); }
      }));
    } catch (e) { panel.innerHTML = `<p class="alert error">${esc(e.message)}</p>`; }
  }

  render();
})();