/**
 * Auth module: handles login/register modal and session state.
 * Call Auth.init() before booting the app — it resolves once the user is
 * either authenticated or has chosen to continue as a guest.
 */
const Auth = (() => {
  let resolveReady;
  let mode = 'login';

  async function init() {
    _attachListeners();
    try {
      const resp = await fetch('/api/auth/me', { credentials: 'include' });
      const data = await resp.json();
      if (data.authenticated) {
        _onAuth(data.username);
        return data.username;
      }
    } catch { /* backend unreachable — fall through to show modal */ }

    showModal();
    return new Promise(resolve => { resolveReady = resolve; });
  }

  function showModal() {
    document.getElementById('auth-overlay').classList.remove('hidden');
    document.getElementById('auth-username').focus();
  }

  function _onAuth(username) {
    document.getElementById('auth-overlay').classList.add('hidden');
    document.getElementById('login-btn').classList.add('hidden');
    document.getElementById('user-name').textContent = username;
    document.getElementById('logout-btn').classList.remove('hidden');
    const tabBar = document.getElementById('tab-bar');
    const userBar = document.getElementById('user-bar');
    tabBar.appendChild(userBar);
    userBar.classList.remove('hidden');
  }

  function _onGuest() {
    document.getElementById('auth-overlay').classList.add('hidden');
    const tabBar = document.getElementById('tab-bar');
    const userBar = document.getElementById('user-bar');
    const loginBtn = document.getElementById('login-btn');
    tabBar.appendChild(userBar);
    userBar.classList.remove('hidden');
    tabBar.appendChild(loginBtn);
    loginBtn.classList.remove('hidden');
  }

  function _attachListeners() {
    // Tab switching (Login / Register)
    document.querySelectorAll('.auth-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        mode = tab.dataset.tab;
        document.querySelectorAll('.auth-tab').forEach(t => {
          t.classList.toggle('active', t.dataset.tab === mode);
        });
        document.getElementById('auth-submit').textContent =
          mode === 'login' ? 'Login' : 'Register';
        document.getElementById('auth-error').textContent = '';
        document.getElementById('auth-password').autocomplete =
          mode === 'login' ? 'current-password' : 'new-password';
      });
    });

    // Login / Register form submit
    document.getElementById('auth-form').addEventListener('submit', async e => {
      e.preventDefault();
      const username = document.getElementById('auth-username').value.trim();
      const password = document.getElementById('auth-password').value;
      const submitBtn = document.getElementById('auth-submit');
      const errorEl = document.getElementById('auth-error');

      errorEl.textContent = '';
      submitBtn.disabled = true;

      try {
        const resp = await fetch(`/api/auth/${mode}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password }),
          credentials: 'include',
        });
        const data = await resp.json();
        if (resp.ok) {
          _onAuth(data.username);
          if (resolveReady) resolveReady(data.username);
        } else {
          errorEl.textContent = data.error || 'An error occurred';
        }
      } catch {
        errorEl.textContent = 'Network error — is the backend running?';
      } finally {
        submitBtn.disabled = false;
      }
    });

    // Continue as Guest
    document.getElementById('auth-guest-btn').addEventListener('click', () => {
      _onGuest();
      if (resolveReady) resolveReady(null);
    });

    // Login button (shown in tab bar for guests)
    document.getElementById('login-btn').addEventListener('click', () => {
      showModal();
    });

    // Logout
    document.getElementById('logout-btn').addEventListener('click', async () => {
      try {
        await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
      } finally {
        location.reload();
      }
    });
  }

  return { init, showModal };
})();
