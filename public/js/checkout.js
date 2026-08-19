(async function () {
  const { user } = await window.appReady;
  const { esc, money, productImg, toast } = window.UI;
  const box = document.querySelector('[data-checkout]');
  if (!user) { box.innerHTML = '<div class="empty-state"><h3>Please log in</h3><a class="btn mt" href="/login.html">Log in</a></div>'; return; }

  const COUPON_KEY = 'nexora_coupon';
  const getCoupon = () => { try { return localStorage.getItem(COUPON_KEY) || ''; } catch { return ''; } };
  const code = getCoupon();

  let cart;
  try { cart = await API.get(code ? `/api/cart/quote?coupon=${encodeURIComponent(code)}` : '/api/cart'); }
  catch (e) { box.innerHTML = `<p class="alert error">${esc(e.message)}</p>`; return; }
  if (!cart.items || !cart.items.length) {
    box.innerHTML = `<div class="empty-state"><div class="big">🛒</div><h3>Your cart is empty</h3><a class="btn mt" href="/shop.html">Browse products</a></div>`;
    return;
  }

  const subtotal = cart.subtotal || cart.items.reduce((s, i) => s + i.effective_price * i.quantity, 0);
  const shipping = cart.shipping_fee != null ? cart.shipping_fee : (subtotal >= 25000 ? 0 : 350);
  const discount = cart.discount || 0;
  const total = cart.total != null ? cart.total : (subtotal + shipping - discount);
  const freeShip = subtotal >= 25000;

  box.innerHTML = `<div class="cart-layout">
    <div class="form-card">
      <h3>Delivery details</h3>
      <form data-checkout-form>
        <div class="row">
          <div class="field"><label>Full name</label><input name="name" value="${esc(user.full_name || '')}" required></div>
          <div class="field"><label>Phone</label><input name="phone" value="${esc(user.phone || '')}" placeholder="0300 0000000" required></div>
        </div>
        <div class="field"><label>Shipping address</label><textarea name="address" rows="3" placeholder="Street, area, city" required></textarea></div>
        <div class="row">
          <div class="field"><label>City</label><input name="city" placeholder="Lahore"></div>
          <div class="field"><label>Postal code</label><input name="postal" placeholder="54000"></div>
        </div>
        <div class="row">
          <div class="field"><label>Country</label><input name="country" value="Pakistan"></div>
          <div class="field"><label>Order notes</label><input name="notes" placeholder="Optional"></div>
        </div>
        <h3 class="mt2">Payment method</h3>
        <label class="pay-option"><input type="radio" name="payment_method" value="cod" checked><span><b>Cash on Delivery</b><small>Pay when your order arrives.</small></span></label>
        <label class="pay-option"><input type="radio" name="payment_method" value="card"><span><b>Demo Online Payment</b><small>Simulated card checkout (no real charge).</small></span></label>
        <div data-card-fields hidden class="mt">
          <div class="row">
            <div class="field"><label>Card number</label><input name="cardNumber" placeholder="4242 4242 4242 4242" maxlength="19"></div>
            <div class="field"><label>Expiry</label><input name="cardExpiry" placeholder="MM/YY" maxlength="5"></div>
            <div class="field"><label>CVC</label><input name="cardCvc" placeholder="123" maxlength="3"></div>
          </div>
          <p class="small muted">Demo checkout — no payment is processed.</p>
        </div>
        <button class="btn lg block mt" data-place-order>Place order — ${money(total)}</button>
      </form>
    </div>
    <aside class="summary">
      <h3>Order summary</h3>
      ${cart.items.map((i) => `<div class="sum-item"><span class="small">${esc(i.title)} × ${i.quantity}</span><b class="small">${money(i.effective_price * i.quantity)}</b></div>`).join('')}
      <hr>
      <div class="sum-row"><span>Subtotal</span><b>${money(subtotal)}</b></div>
      <div class="sum-row"><span>Shipping</span><b>${freeShip ? 'Free' : money(shipping)}</b></div>
      ${discount ? `<div class="sum-row discount"><span>Discount (${esc(cart.coupon_code || code || '')})</span><b>−${money(discount)}</b></div>` : ''}
      <div class="sum-row total"><span>Total</span><b>${money(total)}</b></div>
      ${discount ? '' : `<p class="small muted mt">Tip: spend ${money(25000 - subtotal)} more for free shipping.</p>`}
      <a class="btn ghost block mt" href="/cart.html">Back to cart</a>
    </aside>
  </div>`;

  const form = box.querySelector('[data-checkout-form]');
  form.querySelectorAll('input[name="payment_method"]').forEach((r) => r.addEventListener('change', () => {
    form.querySelector('[data-card-fields]').hidden = r.value !== 'card';
  }));

  box.querySelector('[data-place-order]').addEventListener('click', async (e) => {
    const fd = new FormData(form);
    if (fd.get('payment_method') === 'card') {
      const cn = String(fd.get('cardNumber') || '').replace(/\s+/g, '');
      if (!/^\d{13,19}$/.test(cn)) return toast('Enter a valid card number', 'error');
      if (!/^\d{2}\/\d{2}$/.test(fd.get('cardExpiry') || '')) return toast('Enter a valid expiry (MM/YY)', 'error');
      if (!/^\d{3,4}$/.test(fd.get('cardCvc') || '')) return toast('Enter a valid CVC', 'error');
    }
    e.target.disabled = true;
    try {
      const order = await API.post('/api/orders', {
        shipping_name: fd.get('name'), shipping_phone: fd.get('phone'), shipping_address: fd.get('address'),
        shipping_city: fd.get('city') || '', shipping_postal: fd.get('postal') || '',
        shipping_country: fd.get('country') || 'Pakistan', notes: fd.get('notes'),
        payment_method: fd.get('payment_method'), coupon_code: code || undefined,
      });
      localStorage.removeItem(COUPON_KEY);
      await window.UI.refreshCartCount();
      box.innerHTML = `<div class="empty-state success-state">
        <div class="big">🎉</div><h2>Order placed!</h2>
        <p class="mt">Order <a href="/account.html#orders"><b>#${order.id}</b></a> was ${order.payment_status === 'paid' ? 'paid' : 'placed'} successfully (${money(order.total)}).<br>Track its status from your account.</p>
        <div class="btn-row center mt2"><a class="btn" href="/account.html#orders">Track my order</a><a class="btn ghost" href="/shop.html">Continue shopping</a></div>
      </div>`;
    } catch (err) { toast(err.message, 'error'); } finally { e.target.disabled = false; }
  });
})();