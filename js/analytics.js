/**
 * EventOS - SaaS Analytics Controller
 * Section 31, 53: Pure SVG / Canvas data visualizations, dynamic metrics calculation
 */

document.addEventListener('DOMContentLoaded', async () => {
  if (window.AuthService) {
    const isAuthed = await AuthService.requireAuth();
    if (!isAuthed) return;
  }
  AnalyticsPageController.init();
});

class AnalyticsPageController {
  static init() {
    this.selectedEventId = getQueryParam('eventId') || 'all';

    this.bindControls();
    this.populateEventFilter();
    this.renderAll();
  }

  static bindControls() {
    const filterEl = document.getElementById('analytics-event-filter');
    if (filterEl) {
      filterEl.addEventListener('change', (e) => {
        this.selectedEventId = e.target.value;
        this.renderAll();
      });
    }
  }

  static populateEventFilter() {
    const filterEl = document.getElementById('analytics-event-filter');
    if (!filterEl) return;

    const events = EventService.getAll();
    let opts = '<option value="all">Global Workspace Overview (All Events)</option>';
    events.forEach(e => {
      const isSelected = e.id === this.selectedEventId ? 'selected' : '';
      opts += `<option value="${e.id}" ${isSelected}>${escapeHtml(e.name)}</option>`;
    });
    filterEl.innerHTML = opts;
  }

  static renderAll() {
    const eventId = this.selectedEventId !== 'all' ? this.selectedEventId : null;
    const stats = AnalyticsService.getOverview(eventId);

    this.renderMetrics(stats);
    this.renderRegistrationLineChart(eventId);
    this.renderCheckInBarChart(eventId);
    this.renderTicketDonutChart(eventId);
    this.renderGateBreakdown(eventId);
  }

  // ==========================================
  // 1. METRIC KPIS
  // ==========================================
  static renderMetrics(stats) {
    const setVal = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    };

    setVal('an-total-regs', stats.totalRegistrations);
    setVal('an-confirmed-regs', stats.totalRegistrations);
    setVal('an-cancelled-regs', stats.cancelledRegistrations);
    setVal('an-tickets-issued', stats.ticketsIssued);
    setVal('an-checked-in', stats.checkedInCount);
    setVal('an-not-checked-in', stats.notCheckedInCount);
    setVal('an-checkin-rate', `${stats.attendanceRate}%`);
    setVal('an-capacity-util', `${stats.capacityUtilization}%`);
  }

  // ==========================================
  // 2. REGISTRATIONS OVER TIME (SVG Line/Area Chart)
  // ==========================================
  static renderRegistrationLineChart(eventId) {
    const container = document.getElementById('an-reg-chart-svg');
    if (!container) return;

    const data = AnalyticsService.getRegistrationTrend(eventId, 7);
    const maxVal = Math.max(...data.map(d => d.count), 5);

    const width = 600;
    const height = 220;
    const padL = 40;
    const padR = 20;
    const padT = 20;
    const padB = 30;

    const plotW = width - padL - padR;
    const plotH = height - padT - padB;

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

    let grid = '';
    for (let g = 0; g <= 3; g++) {
      const gy = padT + (plotH / 3) * g;
      const gval = Math.round(maxVal - (maxVal / 3) * g);
      grid += `
        <line x1="${padL}" y1="${gy}" x2="${width - padR}" y2="${gy}" class="chart-axis" />
        <text x="${padL - 8}" y="${gy + 4}" text-anchor="end" class="chart-label">${gval}</text>
      `;
    }

    let labels = '';
    let dots = '';
    points.forEach(p => {
      labels += `<text x="${p.x}" y="${height - 10}" text-anchor="middle" class="chart-label">${p.label}</text>`;
      dots += `
        <circle cx="${p.x}" cy="${p.y}" r="4.5" fill="#6366F1" stroke="#FFFFFF" stroke-width="2">
          <title>${p.label}: ${p.count} registrations</title>
        </circle>
      `;
    });

    container.innerHTML = `
      <svg viewBox="0 0 ${width} ${height}" class="chart-svg" preserveAspectRatio="none">
        <defs>
          <linearGradient id="an-line-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#6366F1" stop-opacity="0.35" />
            <stop offset="100%" stop-color="#6366F1" stop-opacity="0.0" />
          </linearGradient>
        </defs>
        ${grid}
        <path d="${areaD}" fill="url(#an-line-grad)" />
        <path d="${pathD}" class="chart-line" />
        ${dots}
        ${labels}
      </svg>
    `;
  }

  // ==========================================
  // 3. CHECK-INS OVER TIME (SVG Bar Chart)
  // ==========================================
  static renderCheckInBarChart(eventId) {
    const container = document.getElementById('an-checkin-chart-svg');
    if (!container) return;

    const scans = eventId ? StorageService.getScansForEvent(eventId) : StorageService.getScans();
    const validScans = scans.filter(s => s.status === 'Success');

    // Group into 6 hour buckets
    const hours = ['08:00', '10:00', '12:00', '14:00', '16:00', '18:00+'];
    const counts = [0, 0, 0, 0, 0, 0];

    validScans.forEach(s => {
      if (s.timestamp) {
        const h = new Date(s.timestamp).getHours();
        if (h < 10) counts[0]++;
        else if (h < 12) counts[1]++;
        else if (h < 14) counts[2]++;
        else if (h < 16) counts[3]++;
        else if (h < 18) counts[4]++;
        else counts[5]++;
      } else {
        counts[2]++; // Default fallback
      }
    });

    const maxVal = Math.max(...counts, 4);
    const width = 500;
    const height = 220;
    const padL = 35;
    const padR = 20;
    const padT = 20;
    const padB = 30;

    const plotW = width - padL - padR;
    const plotH = height - padT - padB;
    const barWidth = 36;
    const slotW = plotW / hours.length;

    let bars = '';
    let labels = '';
    let grid = '';

    for (let g = 0; g <= 3; g++) {
      const gy = padT + (plotH / 3) * g;
      const gval = Math.round(maxVal - (maxVal / 3) * g);
      grid += `
        <line x1="${padL}" y1="${gy}" x2="${width - padR}" y2="${gy}" class="chart-axis" />
        <text x="${padL - 8}" y="${gy + 4}" text-anchor="end" class="chart-label">${gval}</text>
      `;
    }

    hours.forEach((h, i) => {
      const cx = padL + i * slotW + slotW / 2;
      const val = counts[i];
      const barH = (val / maxVal) * plotH;
      const barY = padT + plotH - barH;

      bars += `
        <rect x="${cx - barWidth / 2}" y="${barY}" width="${barWidth}" height="${barH}" class="chart-bar">
          <title>${h}: ${val} check-ins</title>
        </rect>
      `;
      labels += `<text x="${cx}" y="${height - 10}" text-anchor="middle" class="chart-label">${h}</text>`;
    });

    container.innerHTML = `
      <svg viewBox="0 0 ${width} ${height}" class="chart-svg" preserveAspectRatio="none">
        ${grid}
        ${bars}
        ${labels}
      </svg>
    `;
  }

  // ==========================================
  // 4. TICKET DISTRIBUTION (Pure SVG Donut Chart)
  // ==========================================
  static renderTicketDonutChart(eventId) {
    const container = document.getElementById('an-donut-chart-svg');
    const legendContainer = document.getElementById('an-donut-legend');
    if (!container) return;

    const distribution = AnalyticsService.getTicketDistribution(eventId);
    const total = distribution.reduce((sum, d) => sum + d.count, 0);

    if (total === 0) {
      container.innerHTML = '<p class="text-muted" style="text-align: center; padding: 3rem;">No ticket distribution data.</p>';
      if (legendContainer) legendContainer.innerHTML = '';
      return;
    }

    const radius = 70;
    const circumference = 2 * Math.PI * radius;
    let accumulatedOffset = 0;
    let segments = '';
    let legendHtml = '';

    distribution.forEach(d => {
      if (d.count === 0) return;
      const pct = d.count / total;
      const dash = pct * circumference;
      const gap = circumference - dash;

      segments += `
        <circle cx="100" cy="100" r="${radius}" fill="none" stroke="${d.color}" stroke-width="18"
          stroke-dasharray="${dash} ${gap}" stroke-dashoffset="${-accumulatedOffset}"
          class="chart-donut-segment">
          <title>${d.name}: ${d.count} (${Math.round(pct * 100)}%)</title>
        </circle>
      `;

      accumulatedOffset += dash;

      legendHtml += `
        <div class="legend-item">
          <span class="legend-color-dot" style="background: ${d.color};"></span>
          <span>${escapeHtml(d.name)}: <strong>${d.count}</strong> (${Math.round(pct * 100)}%)</span>
        </div>
      `;
    });

    container.innerHTML = `
      <svg viewBox="0 0 200 200" style="width: 170px; height: 170px; margin: 0 auto; display: block; transform: rotate(-90deg);">
        ${segments}
      </svg>
    `;

    if (legendContainer) legendContainer.innerHTML = legendHtml;
  }

  // ==========================================
  // 5. GATE TRAFFIC BREAKDOWN
  // ==========================================
  static renderGateBreakdown(eventId) {
    const container = document.getElementById('an-gate-breakdown-list');
    if (!container) return;

    const gates = eventId ? StorageService.getGatesForEvent(eventId) : StorageService.getGates();
    const scans = eventId ? StorageService.getScansForEvent(eventId) : StorageService.getScans();
    const totalScans = scans.filter(s => s.status === 'Success').length;

    let html = '';
    gates.forEach(g => {
      const gateCount = scans.filter(s => s.gate === g.name && s.status === 'Success').length;
      const pct = totalScans > 0 ? Math.round((gateCount / totalScans) * 100) : 0;

      html += `
        <div style="margin-bottom: 1rem;">
          <div style="display: flex; justify-content: space-between; font-size: 0.85rem; font-weight: 600; margin-bottom: 0.35rem;">
            <span>${escapeHtml(g.name)}</span>
            <span><strong>${gateCount}</strong> check-ins (${pct}%)</span>
          </div>
          <div class="progress-bar-container">
            <div class="progress-bar-fill" style="width: ${pct}%;"></div>
          </div>
        </div>
      `;
    });

    container.innerHTML = html || '<p class="text-muted" style="font-size: 0.85rem;">No gate traffic records.</p>';
  }
}

window.AnalyticsPageController = AnalyticsPageController;
