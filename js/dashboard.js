/**
 * EventOS - Dashboard Controller
 * Section 11: Dynamic stats, Upcoming events, Activity stream, SVG Charts
 */

document.addEventListener('DOMContentLoaded', async () => {
  if (window.AuthService) {
    const isAuthed = await AuthService.requireAuth();
    if (!isAuthed) return;
  }
  DashboardController.init();
});

class DashboardController {
  static init() {
    this.renderStats();
    this.renderUpcomingEvents();
    this.renderRecentActivity();
    this.renderTrendChart();
    this.renderCheckInProgress();
  }

  // ==========================================
  // 1. STATS METRICS (Section 11)
  // ==========================================
  static renderStats() {
    const stats = AnalyticsService.getOverview();

    const totalEventsEl = document.getElementById('stat-total-events');
    const upcomingEventsEl = document.getElementById('stat-upcoming-events');
    const totalRegsEl = document.getElementById('stat-total-regs');
    const ticketsIssuedEl = document.getElementById('stat-tickets-issued');
    const checkedInEl = document.getElementById('stat-checked-in');
    const attendanceRateEl = document.getElementById('stat-attendance-rate');

    if (totalEventsEl) totalEventsEl.textContent = stats.totalEvents;
    if (upcomingEventsEl) upcomingEventsEl.textContent = stats.upcomingEvents;
    if (totalRegsEl) totalRegsEl.textContent = stats.totalRegistrations;
    if (ticketsIssuedEl) ticketsIssuedEl.textContent = stats.ticketsIssued;
    if (checkedInEl) checkedInEl.textContent = stats.checkedInCount;
    if (attendanceRateEl) attendanceRateEl.textContent = `${stats.attendanceRate}%`;

    // Dynamic greeting based on time of day
    const greetingEl = document.getElementById('dashboard-greeting');
    if (greetingEl) {
      const hour = new Date().getHours();
      let greeting = 'Good Evening';
      if (hour < 12) greeting = 'Good Morning';
      else if (hour < 17) greeting = 'Good Afternoon';
      const settings = StorageService.getSettings();
      greetingEl.textContent = `${greeting}, ${settings.organizerName || 'Organizer'}`;
    }
  }

  // ==========================================
  // 2. UPCOMING EVENTS
  // ==========================================
  static renderUpcomingEvents() {
    const container = document.getElementById('dashboard-upcoming-events');
    if (!container) return;

    const upcoming = EventService.getUpcoming(4);

    if (upcoming.length === 0) {
      container.innerHTML = `
        <div class="empty-state" style="padding: 2rem 1rem;">
          <div class="empty-state-icon" style="width: 48px; height: 48px; margin-bottom: 0.75rem;">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          </div>
          <h4 style="font-size: 1rem; margin-bottom: 0.25rem;">No upcoming events</h4>
          <p style="font-size: 0.85rem; margin-bottom: 1rem;">Create an event to start tracking registrations and check-ins.</p>
          <a href="create-event.html" class="btn btn-primary btn-sm">+ Create Event</a>
        </div>
      `;
      return;
    }

    let html = '';
    upcoming.forEach(e => {
      const d = new Date(e.startDate);
      const month = d.toLocaleDateString(undefined, { month: 'short' });
      const day = d.getDate();
      const stats = EventService.getWithStats(e.id);

      html += `
        <div class="upcoming-event-item">
          <div style="display: flex; align-items: center;">
            <div class="event-date-pill">
              <span class="date-month">${month}</span>
              <span class="date-day">${day}</span>
            </div>
            <div>
              <h4 style="font-size: 0.92rem; font-weight: 700; margin-bottom: 0.2rem;">
                <a href="event.html?id=${e.id}" style="color: inherit;">${escapeHtml(e.name)}</a>
              </h4>
              <p style="font-size: 0.78rem; color: var(--text-muted);">
                ${escapeHtml(e.venue || 'TBD')} &bull; ${stats ? stats.registeredCount : 0} / ${e.capacity || 0} Registered
              </p>
            </div>
          </div>
          <div style="display: flex; align-items: center; gap: 0.75rem;">
            <span class="badge badge-${e.status.toLowerCase()}">${e.status}</span>
            <a href="event.html?id=${e.id}" class="btn btn-secondary btn-sm">Manage &rarr;</a>
          </div>
        </div>
      `;
    });

    container.innerHTML = html;
  }

  // ==========================================
  // 3. RECENT ACTIVITY STREAM
  // ==========================================
  static renderRecentActivity() {
    const container = document.getElementById('dashboard-activity-feed');
    if (!container) return;

    const activities = ActivityService.getRecent(7);

    if (activities.length === 0) {
      container.innerHTML = `
        <div class="empty-state" style="padding: 2rem 1rem;">
          <p style="font-size: 0.85rem;">No recent activities logged yet.</p>
        </div>
      `;
      return;
    }

    let html = '';
    activities.forEach(act => {
      let icon = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>`;
      if (act.type === 'register') {
        icon = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>`;
      } else if (act.type === 'scan') {
        icon = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`;
      } else if (act.type === 'event') {
        icon = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`;
      }

      html += `
        <div class="activity-item">
          <div class="activity-icon-badge">${icon}</div>
          <div class="activity-details">
            <div class="activity-message">${escapeHtml(act.message)}</div>
            <div class="activity-time">${DateUtils.timeAgo(act.timestamp)} &bull; by ${escapeHtml(act.user || 'System')}</div>
          </div>
        </div>
      `;
    });

    container.innerHTML = html;
  }

  // ==========================================
  // 4. CHECK-IN PROGRESS METER
  // ==========================================
  static renderCheckInProgress() {
    const stats = AnalyticsService.getOverview();
    const barEl = document.getElementById('dashboard-checkin-bar');
    const labelEl = document.getElementById('dashboard-checkin-label');

    if (barEl) {
      const pct = stats.totalRegistrations > 0 ? Math.min(100, (stats.checkedInCount / stats.totalRegistrations) * 100) : 0;
      barEl.style.width = `${pct}%`;
    }

    if (labelEl) {
      labelEl.textContent = `${stats.checkedInCount} / ${stats.totalRegistrations} Checked In (${stats.attendanceRate}%)`;
    }
  }

  // ==========================================
  // 5. PURE SVG REGISTRATION TREND CHART (Section 31)
  // ==========================================
  static renderTrendChart() {
    const container = document.getElementById('dashboard-trend-svg');
    if (!container) return;

    const data = AnalyticsService.getRegistrationTrend(null, 7);
    const maxVal = Math.max(...data.map(d => d.count), 4);

    const width = 500;
    const height = 180;
    const padL = 40;
    const padR = 20;
    const padT = 20;
    const padB = 30;

    const plotW = width - padL - padR;
    const plotH = height - padT - padB;

    // Generate points
    const points = data.map((d, i) => {
      const x = padL + (i / (data.length - 1)) * plotW;
      const y = padT + plotH - (d.count / maxVal) * plotH;
      return { x, y, label: d.label, count: d.count };
    });

    let pathD = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      pathD += ` L ${points[i].x} ${points[i].y}`;
    }

    const areaD = `${pathD} L ${points[points.length - 1].x} ${height - padB} L ${points[0].x} ${height - padB} Z`;

    let gridLines = '';
    for (let g = 0; g <= 3; g++) {
      const gy = padT + (plotH / 3) * g;
      const gval = Math.round(maxVal - (maxVal / 3) * g);
      gridLines += `
        <line x1="${padL}" y1="${gy}" x2="${width - padR}" y2="${gy}" class="chart-axis" />
        <text x="${padL - 8}" y="${gy + 4}" text-anchor="end" class="chart-label">${gval}</text>
      `;
    }

    let labels = '';
    let dots = '';
    points.forEach(p => {
      labels += `<text x="${p.x}" y="${height - 10}" text-anchor="middle" class="chart-label">${p.label}</text>`;
      dots += `
        <circle cx="${p.x}" cy="${p.y}" r="4" fill="#6366F1" stroke="#FFFFFF" stroke-width="2">
          <title>${p.label}: ${p.count} registrations</title>
        </circle>
      `;
    });

    container.innerHTML = `
      <svg viewBox="0 0 ${width} ${height}" class="chart-svg" preserveAspectRatio="none">
        <defs>
          <linearGradient id="chart-gradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#6366F1" stop-opacity="0.4" />
            <stop offset="100%" stop-color="#6366F1" stop-opacity="0.0" />
          </linearGradient>
        </defs>
        ${gridLines}
        <path d="${areaD}" class="chart-area" />
        <path d="${pathD}" class="chart-line" />
        ${dots}
        ${labels}
      </svg>
    `;
  }
}

window.DashboardController = DashboardController;
