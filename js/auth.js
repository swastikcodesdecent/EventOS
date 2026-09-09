/**
 * EventOS - Google Authentication & Session Service
 * Strictly enforces Google Authentication across the entire application
 * Without signup with Google, nothing is possible
 */

class AuthService {
  static _currentUser = null;
  static _initialized = false;
  static _authResolveCallbacks = [];

  static init() {
    if (this._initialized) return;
    this._initialized = true;

    // Check cached profile for immediate rendering
    try {
      const cached = localStorage.getItem('eventos_auth_user');
      if (cached) {
        this._currentUser = JSON.parse(cached);
        this.renderUserUI(this._currentUser);
      }
    } catch (e) {}

    // Listen to Firebase Auth state
    if (window.auth) {
      window.auth.onAuthStateChanged((user) => {
        if (user) {
          this._currentUser = {
            uid: user.uid,
            displayName: user.displayName || 'Event Organizer',
            email: user.email,
            photoURL: user.photoURL || '',
            phoneNumber: user.phoneNumber || ''
          };
          try {
            localStorage.setItem('eventos_auth_user', JSON.stringify(this._currentUser));
          } catch (e) {}
        } else {
          this._currentUser = null;
          try {
            localStorage.removeItem('eventos_auth_user');
          } catch (e) {}
          
          // If on a protected page and auth state became null, immediately enforce redirect
          this.enforceProtectionIfUnauthenticated();
        }

        this.renderUserUI(this._currentUser);

        // Resolve any waiting auth callbacks
        while (this._authResolveCallbacks.length > 0) {
          const cb = this._authResolveCallbacks.shift();
          cb(this._currentUser);
        }
      });
    }

    // Intercept protected clicks globally
    document.addEventListener('click', (e) => {
      const target = e.target.closest('a[href], button[data-require-auth]');
      if (!target) return;

      const href = target.getAttribute('href');
      if (!href || href.startsWith('#') || href.startsWith('javascript:')) return;

      // Allow login.html and external links
      if (href.includes('login.html') || href.startsWith('http://') || href.startsWith('https://')) return;

      // If user is not authenticated and is trying to access application features
      if (!this._currentUser && !localStorage.getItem('eventos_auth_user')) {
        e.preventDefault();
        e.stopPropagation();
        this.promptGoogleAuth(href);
      }
    }, true);
  }

  static isPublicPage() {
    const p = window.location.pathname.toLowerCase();
    return p.endsWith('login.html') || p.endsWith('index.html') || p === '/' || p === '';
  }

  static enforceProtectionIfUnauthenticated() {
    if (!this.isPublicPage()) {
      const currentPath = window.location.pathname.split('/').pop() || 'index.html';
      const redirectUrl = encodeURIComponent(currentPath + window.location.search);
      window.location.replace(`login.html?redirect=${redirectUrl}`);
    }
  }

  static getCurrentUser() {
    return this._currentUser;
  }

  static waitForAuth() {
    return new Promise((resolve) => {
      if (this._currentUser) {
        resolve(this._currentUser);
      } else if (window.auth) {
        this._authResolveCallbacks.push(resolve);
        // Timeout safeguard
        setTimeout(() => resolve(this._currentUser), 1800);
      } else {
        resolve(null);
      }
    });
  }

  /**
   * Route Guard: Protects dashboard & all application views
   */
  static async requireAuth() {
    this.init();

    // Check fast cached authentication first
    const cached = localStorage.getItem('eventos_auth_user');
    if (!cached && !this._currentUser) {
      this.enforceProtectionIfUnauthenticated();
      return false;
    }

    const user = await this.waitForAuth();
    if (!user) {
      this.enforceProtectionIfUnauthenticated();
      return false;
    }
    return true;
  }

  /**
   * Prompt Google Sign-In with popup or redirect to login.html
   */
  static async promptGoogleAuth(targetUrl = 'dashboard.html') {
    if (typeof Toast !== 'undefined') {
      Toast.warning('Google Sign-In required to access EventOS');
    }
    try {
      const res = await this.signInWithGoogle();
      if (res && res.success) {
        if (typeof Toast !== 'undefined') {
          Toast.success('Welcome back, ' + res.user.displayName);
        }
        setTimeout(() => {
          window.location.href = targetUrl;
        }, 500);
      }
    } catch (e) {
      window.location.href = `login.html?redirect=${encodeURIComponent(targetUrl)}`;
    }
  }

  /**
   * Sign In with Google
   */
  static async signInWithGoogle() {
    if (!window.auth) {
      throw new Error('Firebase Auth not available');
    }

    const provider = new firebase.auth.GoogleAuthProvider();
    provider.addScope('profile');
    provider.addScope('email');

    try {
      const result = await window.auth.signInWithPopup(provider);
      const user = result.user;
      this._currentUser = {
        uid: user.uid,
        displayName: user.displayName || 'Event Organizer',
        email: user.email,
        photoURL: user.photoURL || '',
        phoneNumber: user.phoneNumber || ''
      };
      localStorage.setItem('eventos_auth_user', JSON.stringify(this._currentUser));
      return { success: true, user: this._currentUser };
    } catch (error) {
      console.warn('Popup sign in failed, trying redirect fallback:', error);
      if (error.code === 'auth/popup-blocked' || error.code === 'auth/cancelled-popup-request') {
        try {
          await window.auth.signInWithRedirect(provider);
          return { redirect: true };
        } catch (redirectErr) {
          throw redirectErr;
        }
      }
      throw error;
    }
  }

  /**
   * Sign Out
   */
  static async signOut() {
    try {
      if (window.auth) {
        await window.auth.signOut();
      }
      this._currentUser = null;
      localStorage.removeItem('eventos_auth_user');
      if (typeof Toast !== 'undefined') {
        Toast.info('Signed out successfully');
      }
      setTimeout(() => {
        window.location.href = 'login.html';
      }, 300);
    } catch (err) {
      console.error('Sign out error:', err);
    }
  }

  /**
   * Render User profile in topbar and sidebar
   */
  static renderUserUI(user) {
    // 1. Sidebar footer info
    const orgPill = document.querySelector('.org-profile-pill');
    if (orgPill && user) {
      const avatarEl = orgPill.querySelector('.org-avatar');
      if (avatarEl) {
        if (user.photoURL) {
          avatarEl.innerHTML = `<img src="${user.photoURL}" alt="${user.displayName}" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">`;
        } else {
          avatarEl.textContent = (user.displayName || 'U').charAt(0).toUpperCase();
        }
      }
      const nameEl = orgPill.querySelector('.org-name');
      if (nameEl) nameEl.textContent = user.displayName || 'Event Organizer';
      const roleEl = orgPill.querySelector('.org-role');
      if (roleEl) roleEl.textContent = user.email || 'Admin';
    }

    // 2. Topbar Profile / Sign Out element
    const topbarRight = document.querySelector('.topbar-right');
    if (topbarRight && !document.getElementById('user-profile-menu')) {
      const userBadge = document.createElement('div');
      userBadge.id = 'user-profile-menu';
      userBadge.style.cssText = 'display: inline-flex; align-items: center; gap: 0.5rem; margin-left: 0.5rem;';
      
      if (user) {
        const avatarImg = user.photoURL 
          ? `<img src="${user.photoURL}" alt="avatar" style="width: 32px; height: 32px; border-radius: 50%; object-fit: cover; border: 1.5px solid var(--primary);">`
          : `<div style="width: 32px; height: 32px; border-radius: 50%; background: var(--primary); color: #fff; font-weight: 700; display: flex; align-items: center; justify-content: center; font-size: 0.85rem;">${(user.displayName || 'U').charAt(0).toUpperCase()}</div>`;

        userBadge.innerHTML = `
          <div style="display: flex; align-items: center; gap: 0.6rem; padding: 0.3rem 0.6rem; border-radius: 9999px; background: var(--card-bg); border: 1px solid var(--border-subtle);">
            ${avatarImg}
            <div style="text-align: left; display: none; @media(min-width: 768px){display: block;}">
              <div style="font-size: 0.78rem; font-weight: 700; line-height: 1.1; color: var(--text-heading); max-width: 110px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${user.displayName || 'Organizer'}</div>
            </div>
            <button id="auth-signout-btn" class="btn btn-ghost btn-sm" style="padding: 0.25rem 0.5rem; font-size: 0.75rem; border-radius: 8px;" title="Sign Out">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></svg>
            </button>
          </div>
        `;
        topbarRight.appendChild(userBadge);

        const signOutBtn = userBadge.querySelector('#auth-signout-btn');
        if (signOutBtn) {
          signOutBtn.onclick = (e) => {
            e.preventDefault();
            AuthService.signOut();
          };
        }
      }
    } else if (document.getElementById('user-profile-menu') && !user) {
      document.getElementById('user-profile-menu').remove();
    }
  }
}

// Immediate execution check: If user visits any protected page and has no auth token, redirect immediately!
(function() {
  const p = window.location.pathname.toLowerCase();
  const isPublic = p.endsWith('login.html') || p.endsWith('index.html') || p === '/' || p === '';
  if (!isPublic) {
    try {
      const user = localStorage.getItem('eventos_auth_user');
      if (!user) {
        const currentPath = window.location.pathname.split('/').pop() || 'index.html';
        window.location.replace(`login.html?redirect=${encodeURIComponent(currentPath + window.location.search)}`);
      }
    } catch (e) {}
  }
})();

// Auto-initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  AuthService.init();
});

window.AuthService = AuthService;
