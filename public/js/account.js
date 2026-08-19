(async function () {
  const { user } = await window.appReady;
  const { esc, money, productImg, toast } = window.UI;
  if (!user) { location.href = '/login.html?redirect=' + encodeURIComponent('/account.html'); return; }

  const panels = { orders: document.querySelector('[data-panel="orders"]'), profile: document.querySelector('[data-panel="profile"]'), security: document.querySelector('[data-panel="security"]') };

  document.querySelectorAll('[data-tab]').forEach((a) => a.addEventListener('click', (e) => {
    e.preventDefault();
    document.querySelectorAll('[data-tab]').forEach((x) => x.classList.remove('active'));
    a.classList.add('active');
    Object.entries(panels).forEach(([k, el]) => el.hidden = k !== a.dataset.tab);
    if (a.dataset.tab === 'orders') loadOrders();
    if (a.dataset.tab === 'profile') loadProfile();
  }));

  // Hash navigation
  const ht = (location.hash || '').replace('#', '');
  if (ht === 'orders' || ht === 'profile' || ht === 'security') document.querySelector(`[data-tab="${ht}"]`).click();
  else loadOrders();

  async function loadOrders() {
    panels.orders.innerHTML = '<div class="spinner"></div>';
    try {
      const orders = await API.get('/api/orders');
      if (!orders.length) {
        panels.orders.innerHTML = `<div class="empty-state"><div class="big">📦</div><h3>No orders yet</h3>
          <p>When you place an order it will appear here with live status tracking.</p>
          <a class="btn mt" href="/shop.html">Start shopping</a></div>`;
        return;
      }
      panels.orders.innerHTML = orders.map((o) => `
        <div class="order-card">
          <div class="row between wrap">
            <div>
              <b>Order #${o.id}</b>
              <span class="pill ${esc(o.status)}">${esc(o.status.replace(/_/g, ' '))}</span>
              ${o.payment_method === 'card' && o.payment_status === 'paid' ? '<span class="pill paid">Paid</span>' : o.payment_method === 'cod' ? '<span class="pill cod">COD</span>' : ''}
            </div>
            <span class="small muted">${(o.created_at || '').slice(0, 16).replace('T', ' ')}</span>
          </div>
          <div class="row between wrap mt">
            <div class="small">${esc(o.shipping_name)} · ${esc(o.shipping_address || '')} · ${esc(o.shipping_city || '')}</div>
            <b>${money(o.total)}</b>
          </div>
          <div class="row mt2 wrap" style="gap:10px">
            <button class="btn ghost sm" data-order-detail="${o.id}">View details</button>
            <a class="btn ghost sm" href="/api/orders/${o.id}/invoice" target="_blank">Invoice</a>
            ${['pending', 'confirmed', 'processing'].includes(o.status)
              ? `<button class="btn ghost sm danger" data-order-cancel="${o.id}">Cancel order</button>` : ''}
          </div>
          <div data-order-items="${o.id}" hidden></div>
        </div>`).join('');
    } catch (e) { panels.orders.innerHTML = `<p class="alert error">${esc(e.message)}</p>`; }
  }

  panels.orders.addEventListener('click', async (e) => {
    const det = e.target.closest('[data-order-detail]');
    if (det) {
      const id = det.dataset.orderDetail;
      const box = panels.orders.querySelector(`[data-order-items="${id}"]`);
      if (!box.hidden) { box.hidden = true; det.textContent = 'View details'; return; }
      box.hidden = false; det.textContent = 'Hide details';
      if (!box.innerHTML.trim()) {
        const o = await API.get('/api/orders/' + id);
        box.innerHTML = `<div class="small muted mt">Coupon: ${o.coupon_code ? esc(o.coupon_code) : '—'} · Subtotal ${money(o.subtotal)} · Shipping ${money(o.shipping_fee)} · Discount ${money(o.discount)}</div>
          <div class="table-wrap mt">${o.items.map((i) => `<div class="mini-item"><span>${esc(i.product_title)} × ${i.quantity}</span><b>${money(i.price * i.quantity)}</b></div>`).join('')}</div>`;
      }
      return;
    }
    const cn = e.target.closest('[data-order-cancel]');
    if (cn) {
      if (!confirm('Cancel this order?')) return;
      try { await API.post(`/api/orders/${cn.dataset.orderCancel}/cancel`, {}); toast('Order cancelled', 'success'); loadOrders(); }
      catch (err) { toast(err.message, 'error'); }
    }
  });

  async function loadProfile() {
    panels.profile.innerHTML = '<div class="spinner"></div>';
    const me = await window.Auth.me(true);
    panels.profile.innerHTML = `<div class="form-card">
      <h3>Profile</h3>
      <form data-profile-form>
        <div class="row">
          <div class="field"><label>Full name</label><input name="full_name" value="${esc(me.full_name || '')}" required></div>
          <div class="field"><label>Phone</label><input name="phone" value="${esc(me.phone || '')}"></div>
        </div>
        <div class="field"><label>Email</label><input value="${esc(me.email || '')}" disabled title="Email cannot be changed"></div>
        <div class="field"><label>Address</label><input name="address" value="${esc(me.address || '')}"></div>
        <div class="row">
          <div class="field"><label>City</label><input name="city" value="${esc(me.city || '')}"></div>
          <div class="field"><label>Postal code</label><input name="postal_code" value="${esc(me.postal_code || '')}"></div>
        </div>
        <button class="btn" type="submit">Save changes</button>
        <span data-profile-msg class="small"></span>
      </form>
    </div>`;
    panels.profile.querySelector('[data-profile-form]').addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      try {
        await API.put('/api/account', Object.fromEntries(fd.entries()));
        panels.profile.querySelector('[data-profile-msg]').innerHTML = '<span class="ok">Saved ✓</span>';
        window.Auth.me(true);
      } catch (err) { panels.profile.querySelector('[data-profile-msg]').innerHTML = `<span class="err">${esc(err.message)}</span>`; }
    });
  }

  async function loadSecurity() {
    panels.security.innerHTML = `<div class="form-card">
      <h3>Change password</h3>
      <form data-pw-form>
        <div class="field"><label>Current password</label><input type="password" name="current_password" required></div>
        <div class="field"><label>New password</label><input type="password" name="new_password" minlength="6" required></div>
        <button class="btn" type="submit">Update password</button>
        <span data-pw-msg class="small"></span>
      </form>
    </div>`;
    panels.security.querySelector('[data-pw-form]').addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      try {
        await API.put('/api/account/password', { current_password: fd.get('current_password'), new_password: fd.get('new_password') });
        panels.security.querySelector('[data-pw-msg]').innerHTML = '<span class="ok">Password updated ✓</span>';
        e.target.reset();
      } catch (err) { panels.security.querySelector('[data-pw-msg]').innerHTML = `<span class="err">${esc(err.message)}</span>`; }
    });
  }

  document.querySelector('[data-tab="security"]').addEventListener('click', loadSecurity);
})();