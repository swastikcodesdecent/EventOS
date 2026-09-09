/**
 * EventOS - Core Application Shell Controller (Firebase Mode)
 * Shell Navigation, Theme Manager, First-Run Setup & Global Search
 */

document.addEventListener('DOMContentLoaded', () => {
  App.init();
});

class App {
  static init() {
    this.initTheme();
    this.highlightActiveNav();
    this.initSidebarToggle();
    this.initGlobalSearch();
    this.updateShellProfile();
  }

  // ==========================================
  // 1. THEME INITIALIZATION
  // ==========================================
  static initTheme() {
    const prefs = StorageService.getPreferences();
    const currentTheme = prefs.theme || 'dark';
    document.documentElement.setAttribute('data-theme', currentTheme);

    const toggleBtns = document.querySelectorAll('.theme-toggle-btn');
    toggleBtns.forEach(toggleBtn => {
      toggleBtn.innerHTML = currentTheme === 'dark' 
        ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>`
        : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;
      
      toggleBtn.onclick = () => this.toggleTheme();
    });

    // Update logo images for current theme
    const isLight = currentTheme === 'light';
    document.querySelectorAll('img[src*="logo"]').forEach(img => {
      img.src = isLight ? 'assets/logo-light.svg' : 'assets/logo.svg';
    });
  }

  static toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') || 'dark';
    const nextTheme = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', nextTheme);
    StorageService.savePreferences({ theme: nextTheme });
    this.initTheme();
    Toast.info(`Switched to ${nextTheme} theme`);
  }

  // ==========================================
  // 3. NAVIGATION HIGHLIGHTING
  // ==========================================
  static highlightActiveNav() {
    const currentPath = window.location.pathname.split('/').pop() || 'index.html';
    const navItems = document.querySelectorAll('.sidebar-nav .nav-item');

    navItems.forEach(item => {
      const href = item.getAttribute('href');
      if (href && (href === currentPath || (currentPath === '' && href === 'index.html'))) {
        item.classList.add('active');
      } else if (href === 'events.html' && (currentPath === 'create-event.html' || currentPath === 'event.html')) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });

    const eventBadge = document.getElementById('sidebar-event-count');
    if (eventBadge) {
      eventBadge.textContent = StorageService.getEvents().length;
    }
  }

  // ==========================================
  // 4. SIDEBAR RESPONSIVE TOGGLE
  // ==========================================
  static initSidebarToggle() {
    const toggleBtn = document.querySelector('.sidebar-toggle-btn');
    const sidebar = document.querySelector('.app-sidebar');

    let backdrop = document.querySelector('.sidebar-backdrop');
    if (!backdrop) {
      backdrop = document.createElement('div');
      backdrop.className = 'sidebar-backdrop';
      document.body.appendChild(backdrop);
    }

    if (toggleBtn && sidebar) {
      toggleBtn.onclick = () => {
        sidebar.classList.toggle('mobile-open');
        backdrop.classList.toggle('mobile-open');
      };

      backdrop.onclick = () => {
        sidebar.classList.remove('mobile-open');
        backdrop.classList.remove('mobile-open');
      };
    }
  }

  // ==========================================
  // 5. GLOBAL SEARCH (Across live Firebase records)
  // ==========================================
  static initGlobalSearch() {
    const searchInput = document.querySelector('.topbar-search-input');
    if (!searchInput) return;

    window.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInput.focus();
      }
    });

    let dropdown = document.querySelector('.search-results-dropdown');
    if (!dropdown) {
      dropdown = document.createElement('div');
      dropdown.className = 'search-results-dropdown';
      searchInput.parentElement.appendChild(dropdown);
    }

    searchInput.addEventListener('input', (e) => {
      const query = e.target.value.trim().toLowerCase();
      if (!query) {
        dropdown.classList.remove('active');
        dropdown.innerHTML = '';
        return;
      }

      this.executeGlobalSearch(query, dropdown);
    });

    document.addEventListener('click', (e) => {
      if (!searchInput.contains(e.target) && !dropdown.contains(e.target)) {
        dropdown.classList.remove('active');
      }
    });

    searchInput.addEventListener('focus', () => {
      if (searchInput.value.trim().length > 0) {
        dropdown.classList.add('active');
      }
    });
  }

  static executeGlobalSearch(q, dropdown) {
    const events = StorageService.getEvents().filter(e =>
      e.name.toLowerCase().includes(q) || (e.venue && e.venue.toLowerCase().includes(q))
    ).slice(0, 4);

    const attendees = StorageService.getAttendees().filter(a =>
      a.fullName.toLowerCase().includes(q) ||
      a.email.toLowerCase().includes(q) ||
      (a.registrationId && a.registrationId.toLowerCase().includes(q))
    ).slice(0, 4);

    const tickets = StorageService.getTickets().filter(t =>
      (t.ticketCode && t.ticketCode.toLowerCase().includes(q)) ||
      (t.qrToken && t.qrToken.toLowerCase().includes(q))
    ).slice(0, 4);

    const staff = StorageService.getStaff().filter(s =>
      s.name.toLowerCase().includes(q) || (s.role && s.role.toLowerCase().includes(q))
    ).slice(0, 3);

    const totalResults = events.length + attendees.length + tickets.length + staff.length;

    if (totalResults === 0) {
      dropdown.innerHTML = `<div class="search-empty-prompt">No records found for "<strong>${escapeHtml(q)}</strong>"</div>`;
      dropdown.classList.add('active');
      return;
    }

    let html = '';

    if (events.length > 0) {
      html += `<div class="search-category-group"><div class="search-category-header">Events</div>`;
      events.forEach(e => {
        html += `
          <a href="event.html?id=${e.id}" class="search-result-item">
            <div class="search-result-left">
              <span class="badge badge-published" style="font-size:0.65rem;">${e.status}</span>
              <div>
                <div class="search-result-title">${escapeHtml(e.name)}</div>
                <div class="search-result-sub">${DateUtils.formatDate(e.startDate)} &bull; ${escapeHtml(e.venue || 'TBD')}</div>
              </div>
            </div>
            <span style="font-size: 0.75rem; color: var(--primary);">View &rarr;</span>
          </a>
        `;
      });
      html += `</div>`;
    }

    if (attendees.length > 0) {
      html += `<div class="search-category-group"><div class="search-category-header">Attendees</div>`;
      attendees.forEach(a => {
        html += `
          <a href="attendees.html?search=${encodeURIComponent(a.registrationId || a.fullName)}" class="search-result-item">
            <div class="search-result-left">
              <span class="badge ${a.checkedIn ? 'badge-success' : 'badge-draft'}" style="font-size:0.65rem;">
                ${a.checkedIn ? 'Checked In' : 'Confirmed'}
              </span>
              <div>
                <div class="search-result-title">${escapeHtml(a.fullName)}</div>
                <div class="search-result-sub">${escapeHtml(a.registrationId)} &bull; ${escapeHtml(a.email)}</div>
              </div>
            </div>
            <span style="font-size: 0.75rem; color: var(--primary);">Details &rarr;</span>
          </a>
        `;
      });
      html += `</div>`;
    }

    if (tickets.length > 0) {
      html += `<div class="search-category-group"><div class="search-category-header">Tickets</div>`;
      tickets.forEach(t => {
        const att = StorageService.getAttendee(t.attendeeId);
        html += `
          <a href="tickets.html?search=${encodeURIComponent(t.ticketCode)}" class="search-result-item">
            <div class="search-result-left">
              <span class="badge badge-purple mono" style="font-size:0.65rem;">${t.ticketCode}</span>
              <div>
                <div class="search-result-title">${att ? escapeHtml(att.fullName) : 'Ticket Pass'}</div>
                <div class="search-result-sub">Token: ${t.qrToken}</div>
              </div>
            </div>
            <span style="font-size: 0.75rem; color: var(--primary);">View &rarr;</span>
          </a>
        `;
      });
      html += `</div>`;
    }

    if (staff.length > 0) {
      html += `<div class="search-category-group"><div class="search-category-header">Staff</div>`;
      staff.forEach(s => {
        html += `
          <a href="staff.html" class="search-result-item">
            <div class="search-result-left">
              <span class="badge badge-info" style="font-size:0.65rem;">${s.role}</span>
              <div>
                <div class="search-result-title">${escapeHtml(s.name)}</div>
                <div class="search-result-sub">${escapeHtml(s.gate || 'Unassigned')} &bull; ${escapeHtml(s.phone || '')}</div>
              </div>
            </div>
            <span style="font-size: 0.75rem; color: var(--primary);">Roster &rarr;</span>
          </a>
        `;
      });
      html += `</div>`;
    }

    dropdown.innerHTML = html;
    dropdown.classList.add('active');
  }

  // ==========================================
  // 6. UPDATE PROFILE
  // ==========================================
  static updateShellProfile() {
    const settings = StorageService.getSettings();
    const nameEl = document.querySelector('.org-name');
    const roleEl = document.querySelector('.org-role');
    const avatarEl = document.querySelector('.org-avatar');

    if (nameEl && settings.organizationName) {
      nameEl.textContent = settings.organizationName;
    }
    if (roleEl && settings.organizerName) {
      roleEl.textContent = settings.organizerName;
    }
    if (avatarEl && settings.organizationName) {
      avatarEl.textContent = settings.organizationName.charAt(0).toUpperCase();
    }
  }
}

window.App = App;
