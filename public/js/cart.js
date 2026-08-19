(async function () {
  const { user } = await window.appReady;
  const { esc, money, productImg, toast } = window.UI;
  const box = document.querySelector('[data-cart]');
  if (!user) { box.innerHTML = '<div class="empty-state"><h3>Please log in</h3><p>You need an account to view your cart.</p><a class="btn mt" href="/login.html">Log in</a></div>'; return; }

  const COUPON_KEY = 'nexora_coupon';
  function getCoupon() { try { return localStorage.getItem(COUPON_KEY) || ''; } catch { return ''; } }

  function freeShip(subtotal) { return subtotal >= 25000; }

  async function load() {
    box.innerHTML = '<div class="spinner"></div>';
    try {
      const code = getCoupon();
      const endpoint = code ? `/api/cart/quote?coupon=${encodeURIComponent(code)}` : '/api/cart';
      const c = await API.get(endpoint);
      if (!c.items || !c.items.length) {
        localStorage.removeItem(COUPON_KEY);
        box.innerHTML = `<div class="empty-state"><div class="big">🛒</div><h3>Your cart is empty</h3>
          <p>Add some hardware to get started.</p>
          <div class="btn-row center"><a class="btn" href="/shop.html">Browse the shop</a>
          <a class="btn ghost" href="/shop.html?onSale=1">View deals</a></div></div>`;
        return;
      }
      const subtotal = c.subtotal || c.items.reduce((s, i) => s + i.effective_price * i.quantity, 0);
      const shipping = c.shipping_fee != null ? c.shipping_fee : (freeShip(subtotal) ? 0 : 350);
      const discount = c.discount || 0;
      const total = c.total != null ? c.total : (subtotal + shipping - discount);
      const itemsHtml = c.items.map((i) => `<div class="cart-item" data-row>
        <a class="thumb" href="/product.html?slug=${encodeURIComponent(i.slug)}"><img src="${esc(productImg(i))}" alt="${esc(i.title)}"></a>
        <div class="info">
          <a class="title" href="/product.html?slug=${encodeURIComponent(i.slug)}">${esc(i.title)}</a>
          <div class="small muted">Seller: ${esc(i.seller_name || 'Nexora')}</div>
          <div class="small muted">${money(i.effective_price)} each</div>
          <button class="link small" data-move-wish="${i.product_id}">♡ Move to wishlist</button>
        </div>
        <div class="qty">
          <button type="button" data-dec="${i.cart_item_id}" aria-label="Decrease">−</button>
          <span data-qty>${i.quantity}</span>
          <button type="button" data-inc="${i.cart_item_id}" aria-label="Increase">+</button>
        </div>
        <div class="subtotal" data-subtotal>${money(i.effective_price * i.quantity)}</div>
        <button class="remove" data-remove="${i.cart_item_id}" aria-label="Remove">✕</button>
      </div>`).join('');
      box.innerHTML = `<div class="cart-layout">
        <div>
          ${itemsHtml}
          <div class="coupon-box">
            <input data-coupon placeholder="Coupon code (try NEXORA10)" maxlength="30" value="${esc(getCoupon())}">
            <button class="btn" data-apply-coupon>Apply</button>
            ${getCoupon() ? `<button class="btn ghost" data-remove-coupon>Remove</button>` : ''}
            <span data-coupon-msg class="small">${c.couponError ? `<span class="err">${esc(c.couponError)}</span>` : (c.coupon_code ? `<span class="ok">${esc(c.coupon_code)} applied</span>` : '')}</span>
          </div>
        </div>
        <aside class="summary">
          <h3>Order summary</h3>
          <div class="sum-row"><span>Subtotal</span><b data-sum-subtotal>${money(subtotal)}</b></div>
          <div class="sum-row"><span>Shipping</span><b data-sum-ship>${shipping ? money(shipping) : 'Free'}</b></div>
          ${discount ? `<div class="sum-row discount"><span>Discount (${esc(c.coupon_code || '')})</span><b data-sum-discount>−${money(discount)}</b></div>` : ''}
          <div class="sum-row total"><span>Total</span><b data-sum-total>${money(total)}</b></div>
          ${freeShip(subtotal) ? '<p class="small muted">🚚 Free shipping unlocked!</p>' : `<p class="small muted">Add ${money(25000 - subtotal)} more for free shipping.</p>`}
          <a class="btn block lg" href="/checkout.html">Proceed to checkout →</a>
          <a class="btn ghost block mt" href="/shop.html">Continue shopping</a>
        </aside>
      </div>`;

      box.querySelector('[data-apply-coupon]').addEventListener('click', async () => {
        const code = box.querySelector('[data-coupon]').value.trim();
        if (!code) return;
        try {
          await API.post('/api/cart/apply-coupon', { code });
          localStorage.setItem(COUPON_KEY, code);
          toast(`Coupon ${code} applied`, 'success');
          load();
        } catch (e) {
          box.querySelector('[data-coupon-msg]').innerHTML = `<span class="err">${esc(e.message)}</span>`;
        }
      });
      const rmCoupon = box.querySelector('[data-remove-coupon]');
      if (rmCoupon) rmCoupon.addEventListener('click', () => {
        localStorage.removeItem(COUPON_KEY);
        box.querySelector('[data-coupon]').value = '';
        toast('Coupon removed', 'success');
        load();
      });

      box.addEventListener('click', async (e) => {
        const rem = e.target.closest('[data-remove]');
        if (rem) {
          try { await API.del('/api/cart/' + rem.dataset.remove); toast('Removed from cart', 'success'); window.UI.refreshCartCount(); load(); }
          catch (err) { toast(err.message, 'error'); } return;
        }
        const inc = e.target.closest('[data-inc]');
        const dec = e.target.closest('[data-dec]');
        if (inc || dec) {
          const id = (inc || dec).dataset.inc || (inc || dec).dataset.dec;
          const row = e.target.closest('[data-row]');
          let qty = Number(row.querySelector('[data-qty]').textContent);
          qty += inc ? 1 : -1;
          if (qty < 1) { try { await API.del('/api/cart/' + id); toast('Removed', 'success'); window.UI.refreshCartCount(); load(); } catch (err) { toast(err.message, 'error'); } return; }
          try { await API.put('/api/cart/' + id, { quantity: qty }); load(); }
          catch (err) { toast(err.message, 'error'); }
          return;
        }
        const mv = e.target.closest('[data-move-wish]');
        if (mv) {
          try { await API.del('/api/cart/' + mv.dataset.moveWish); await API.post('/api/wishlist/toggle', { productId: Number(mv.dataset.moveWish) }); toast('Moved to wishlist', 'success'); window.UI.refreshCartCount(); load(); }
          catch (err) { toast(err.message, 'error'); }
        }
      });
    } catch (e) { box.innerHTML = `<p class="alert error">${esc(e.message)}</p>`; }
  }

  load();
})();