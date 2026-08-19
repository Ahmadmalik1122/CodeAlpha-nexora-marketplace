const { escapeHtml, money, pkr } = require('./helpers');

// Self-contained printable HTML invoice (use browser "Save as PDF").
function buildInvoice(order, user) {
  const e = escapeHtml;
  const rows = order.items.map((i) => `
    <tr>
      <td>${e(i.product_title)}</td>
      <td class="c">${i.quantity}</td>
      <td class="r">${pkr(i.price)}</td>
      <td class="r">${pkr(money(i.price * i.quantity))}</td>
    </tr>`).join('');

  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<title>Invoice #${order.id} — Nexora Marketplace</title>
<style>
  body{font-family:Arial,Helvetica,sans-serif;color:#1f2937;max-width:760px;margin:24px auto;padding:0 20px}
  h1{margin:0;color:#2563eb} .muted{color:#6b7280;font-size:13px}
  .head{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #2563eb;padding-bottom:16px;margin-bottom:20px}
  .box{background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:14px;margin:8px 0}
  table{width:100%;border-collapse:collapse;margin-top:16px}
  th,td{padding:10px;border-bottom:1px solid #e5e7eb;text-align:left}
  th{background:#f3f4f6;font-size:13px;text-transform:uppercase;letter-spacing:.03em}
  .r{text-align:right}.c{text-align:center}
  .totals{margin-top:16px;margin-left:auto;width:280px}
  .totals div{display:flex;justify-content:space-between;padding:6px 0}
  .grand{font-size:18px;font-weight:700;border-top:2px solid #1f2937;margin-top:6px;padding-top:10px}
  .badge{display:inline-block;padding:3px 10px;border-radius:999px;background:#dbeafe;color:#1e40af;font-size:12px;font-weight:600}
  @media print{.noprint{display:none}}
</style></head><body>
<div class="head">
  <div><h1>Nexora Marketplace</h1><div class="muted">Order Invoice / Receipt — Your Marketplace for PC Hardware & Technology</div></div>
  <div class="r">
    <div><strong>Invoice #${order.id}</strong></div>
    <div class="muted">${e(order.created_at)}</div>
    <div class="badge">${e(order.status)}</div>
  </div>
</div>
<div style="display:flex;gap:16px;flex-wrap:wrap">
  <div class="box" style="flex:1;min-width:220px">
    <strong>Billed to</strong><br>${e(user.full_name)}<br>
    <span class="muted">${e(user.email)}</span>
  </div>
  <div class="box" style="flex:1;min-width:220px">
    <strong>Ship to</strong><br>${e(order.shipping_name || '')}<br>
    <span class="muted">${e([order.shipping_address, order.shipping_city, order.shipping_postal, order.shipping_country].filter(Boolean).join(', '))}</span><br>
    <span class="muted">${e(order.shipping_phone || '')}</span>
  </div>
</div>
<table><thead><tr><th>Item</th><th class="c">Qty</th><th class="r">Price</th><th class="r">Total</th></tr></thead>
<tbody>${rows}</tbody></table>
<div class="totals">
  <div><span>Subtotal</span><span>${pkr(order.subtotal)}</span></div>
  ${order.discount ? `<div><span>Discount ${order.coupon_code ? '(' + e(order.coupon_code) + ')' : ''}</span><span>-${pkr(order.discount)}</span></div>` : ''}
  <div><span>Shipping</span><span>${pkr(order.shipping_fee)}</span></div>
  <div class="grand"><span>Total</span><span>${pkr(order.total)}</span></div>
  <div class="muted r">Payment: ${e(order.payment_method.toUpperCase())} — ${e(order.payment_status)}</div>
</div>
<p class="muted" style="margin-top:30px">Thank you for shopping with Nexora Marketplace.</p>
<button class="noprint" onclick="window.print()" style="padding:10px 18px;background:#2563eb;color:#fff;border:0;border-radius:8px;cursor:pointer">Print / Save as PDF</button>
</body></html>`;
}

module.exports = { buildInvoice };