(function () {
  const { esc, toast, qs } = window.UI;

  // If already logged in, bounce buyers/sellers away from auth pages.
  window.appReady.then(({ user }) => {
    if (!user) return;
    const page = location.pathname.split('/').pop();
    if (page === 'login.html' || page === 'register.html') {
      if (qs('redirect')) location.href = qs('redirect');
      else location.href = user.role === 'admin' ? '/admin.html' : user.role === 'seller' ? '/seller.html' : '/account.html';
    }
  });

  const loginForm = document.querySelector('[data-login-form]');
  if (loginForm) loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(loginForm);
    const msg = document.querySelector('[data-login-msg]');
    msg.innerHTML = '<span class="spinner" style="display:inline-block;width:18px;height:18px"></span>';
    try {
      const r = await API.post('/api/auth/login', { email: fd.get('email'), password: fd.get('password') });
      toast(`Welcome back, ${esc(r.user.full_name.split(' ')[0])}!`, 'success');
      window.appReady.then(async () => { await window.Auth.me(true); await window.UI.refreshCartCount(); });
      location.href = qs('redirect') || (r.user.role === 'admin' ? '/admin.html' : r.user.role === 'seller' ? '/seller.html' : '/');
    } catch (err) {
      msg.innerHTML = `<span class="alert error">${esc(err.message)}</span>`;
    }
  });

  const regForm = document.querySelector('[data-register-form]');
  if (regForm) {
    const storeField = document.querySelector('[data-store-field]');
    document.querySelectorAll('.role-picker input[name="role"]').forEach((r) => r.addEventListener('change', () => {
      storeField.hidden = r.value !== 'seller';
      if (r.value === 'seller') storeField.querySelector('input').required = true;
      else storeField.querySelector('input').required = false;
    }));
    regForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(regForm);
      const role = document.querySelector('.role-picker input[name="role"]:checked').value;
      const msg = document.querySelector('[data-register-msg]');
      if (fd.get('password') !== fd.get('confirm_password')) {
        msg.innerHTML = '<span class="alert error">Passwords do not match.</span>';
        return;
      }
      msg.innerHTML = '<span class="spinner" style="display:inline-block;width:18px;height:18px"></span>';
      try {
        const r = await API.post('/api/auth/register', {
          full_name: fd.get('full_name'), email: fd.get('email'), password: fd.get('password'),
          role, store_name: role === 'seller' ? fd.get('store_name') : undefined,
        });
        window.appReady.then(async () => { await window.Auth.me(true); await window.UI.refreshCartCount(); });
        if (r.user.role === 'seller') {
          location.href = '/seller.html?new=1';
          toast('Account created. Your store is pending approval.', 'success');
        } else {
          location.href = '/account.html';
          toast('Welcome to Nexora Marketplace!', 'success');
        }
      } catch (err) { msg.innerHTML = `<span class="alert error">${esc(err.message)}</span>`; }
    });
  }

  const forgotForm = document.querySelector('[data-forgot-form]');
  if (forgotForm) forgotForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = document.querySelector('[data-forgot-msg]');
    msg.innerHTML = '<span class="spinner" style="display:inline-block;width:18px;height:18px"></span>';
    try {
      const r = await API.post('/api/auth/request-reset', { email: new FormData(forgotForm).get('email') });
      if (r.reset_url) {
        msg.innerHTML = `<span class="alert success">${esc(r.message)} <a href="${esc(r.reset_url)}">Click here to reset →</a></span>`;
      } else msg.innerHTML = `<span class="alert success">${esc(r.message)}</span>`;
    } catch (err) { msg.innerHTML = `<span class="alert error">${esc(err.message)}</span>`; }
  });

  const resetForm = document.querySelector('[data-reset-form]');
  if (resetForm) resetForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(resetForm);
    const msg = document.querySelector('[data-reset-msg]');
    if (fd.get('password') !== fd.get('confirm')) { msg.innerHTML = '<span class="alert error">Passwords do not match.</span>'; return; }
    msg.innerHTML = '<span class="spinner" style="display:inline-block;width:18px;height:18px"></span>';
    try {
      const r = await API.post('/api/auth/reset-password', { token: qs('token') || '', password: fd.get('password') });
      msg.innerHTML = `<span class="alert success">${esc(r.message)} <a href="/login.html">Log in →</a></span>`;
      e.target.reset();
    } catch (err) { msg.innerHTML = `<span class="alert error">${esc(err.message)}</span>`; }
  });
})();