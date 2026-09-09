/**
 * EventOS - Event Workspace Controller
 * Sections 16 & 17: Multi-tab comprehensive event management hub
 */

document.addEventListener('DOMContentLoaded', async () => {
  if (window.AuthService) {
    const isAuthed = await AuthService.requireAuth();
    if (!isAuthed) return;
  }
  EventWorkspaceController.init();
});

class EventWorkspaceController {
  static init() {
    this.eventId = getQueryParam('id');
    if (!this.eventId) {
      // If no ID, pick the first available event or redirect to events
      const events = EventService.getAll();
      if (events.length > 0) {
        this.eventId = events[0].id;
      } else {
        window.location.href = 'events.html';
        return;
      }
    }

    this.activeTab = getQueryParam('tab') || 'overview';
    this.loadEvent();
    this.initTabs();
  }

  static loadEvent() {
    this.event = EventService.getWithStats(this.eventId);
    if (!this.event) {
      Toast.error('Event not found');
      window.location.href = 'events.html';
      return;
    }

    this.renderHeader();
    this.switchTab(this.activeTab);
  }

  // ==========================================
  // 1. WORKSPACE HEADER
  // ==========================================
  static renderHeader() {
    const e = this.event;
    document.title = `${e.name} - EventOS Workspace`;

    const titleEl = document.getElementById('ws-event-name');
    const badgeEl = document.getElementById('ws-event-status-badge');
    const dateEl = document.getElementById('ws-event-date');
    const venueEl = document.getElementById('ws-event-venue');
    const regKpiEl = document.getElementById('ws-kpi-regs');
    const chkKpiEl = document.getElementById('ws-kpi-checks');
    const publicBtn = document.getElementById('ws-public-btn');

    if (titleEl) titleEl.textContent = e.name;
    if (badgeEl) {
      badgeEl.className = `badge badge-${e.status.toLowerCase()}`;
      badgeEl.textContent = e.status;
    }
    if (dateEl) dateEl.textContent = `${DateUtils.formatDate(e.startDate)} @ ${DateUtils.formatTime(e.startTime)}`;
    if (venueEl) venueEl.textContent = e.venue || 'Online Event';
    if (regKpiEl) regKpiEl.textContent = `${e.registeredCount} / ${e.capacity || 0}`;
    if (chkKpiEl) chkKpiEl.textContent = `${e.checkedInCount} (${e.attendanceRate}%)`;

    if (publicBtn) {
      publicBtn.href = `public-event.html?id=${e.id}`;
    }

    const editBtn = document.getElementById('ws-edit-btn');
    if (editBtn) {
      editBtn.href = `create-event.html?edit=${e.id}`;
    }

    // Publish action button
    const pubActionBtn = document.getElementById('ws-publish-action-btn');
    if (pubActionBtn) {
      if (e.status === 'Draft') {
        pubActionBtn.style.display = 'inline-flex';
        pubActionBtn.onclick = () => {
          EventService.publish(e.id);
          Toast.success('Event published to public portal!');
          this.loadEvent();
        };
      } else {
        pubActionBtn.style.display = 'none';
      }
    }
  }

  // ==========================================
  // 2. TAB CONTROLLER
  // ==========================================
  static initTabs() {
    const tabBtns = document.querySelectorAll('.workspace-tab-btn');
    tabBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const tab = e.currentTarget.dataset.tab;
        this.switchTab(tab);
      });
    });
  }

  static switchTab(tabKey) {
    this.activeTab = tabKey;
    const tabBtns = document.querySelectorAll('.workspace-tab-btn');
    tabBtns.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabKey);
    });

    const panes = document.querySelectorAll('.workspace-tab-pane');
    panes.forEach(pane => {
      pane.classList.toggle('active', pane.id === `tab-pane-${tabKey}`);
    });

    // Render tab content
    if (tabKey === 'overview') this.renderOverviewTab();
    else if (tabKey === 'attendees') this.renderAttendeesTab();
    else if (tabKey === 'tickets') this.renderTicketsTab();
    else if (tabKey === 'checkin') this.renderCheckInTab();
    else if (tabKey === 'staff') this.renderStaffTab();
    else if (tabKey === 'gates') this.renderGatesTab();
    else if (tabKey === 'tasks') this.renderTasksTab();
    else if (tabKey === 'schedule') this.renderScheduleTab();
    else if (tabKey === 'analytics') this.renderAnalyticsTab();
  }

  // ==========================================
  // 3. TAB: OVERVIEW (Section 17)
  // ==========================================
  static renderOverviewTab() {
    const e = this.event;

    // Registration card
    const regLabel = document.getElementById('ws-ov-reg-label');
    const regBar = document.getElementById('ws-ov-reg-bar');
    if (regLabel) regLabel.textContent = `${e.registeredCount} / ${e.capacity} (${e.capacityUtilization}%)`;
    if (regBar) regBar.style.width = `${Math.min(100, e.capacityUtilization)}%`;

    // Attendance card
    const attLabel = document.getElementById('ws-ov-att-label');
    const attBar = document.getElementById('ws-ov-att-bar');
    if (attLabel) attLabel.textContent = `${e.checkedInCount} / ${e.registeredCount} (${e.attendanceRate}%)`;
    if (attBar) attBar.style.width = `${Math.min(100, e.attendanceRate)}%`;

    // Ticket types mini breakdown
    const ttContainer = document.getElementById('ws-ov-ticket-types');
    if (ttContainer) {
      const types = StorageService.getTicketTypesForEvent(e.id);
      const attendees = StorageService.getAttendeesForEvent(e.id);
      let ttHtml = '';
      types.forEach(t => {
        const count = attendees.filter(a => a.ticketTypeId === t.id).length;
        ttHtml += `
          <div style="display: flex; align-items: center; justify-content: space-between; padding: 0.6rem 0; border-bottom: 1px solid var(--border-subtle);">
            <div style="display: flex; align-items: center; gap: 0.5rem;">
              <span style="width: 10px; height: 10px; border-radius: 50%; background: ${t.color || '#6366F1'};"></span>
              <span style="font-size: 0.88rem; font-weight: 600;">${escapeHtml(t.name)}</span>
            </div>
            <span style="font-size: 0.85rem; font-weight: 700;">${count} Issued</span>
          </div>
        `;
      });
      ttContainer.innerHTML = ttHtml || '<p class="text-muted" style="font-size: 0.85rem;">No ticket types configured.</p>';
    }

    // Schedule mini timeline
    const schContainer = document.getElementById('ws-ov-schedule');
    if (schContainer) {
      const schedule = StorageService.getScheduleForEvent(e.id).slice(0, 4);
      let schHtml = '';
      schedule.forEach(s => {
        schHtml += `
          <div style="display: flex; gap: 1rem; padding: 0.6rem 0; border-bottom: 1px solid var(--border-subtle);">
            <span class="mono" style="font-size: 0.8rem; color: var(--primary); font-weight: 700; width: 60px;">${s.time}</span>
            <div>
              <div style="font-size: 0.86rem; font-weight: 600;">${escapeHtml(s.title)}</div>
              <div style="font-size: 0.75rem; color: var(--text-muted);">${escapeHtml(s.speaker || s.location || '')}</div>
            </div>
          </div>
        `;
      });
      schContainer.innerHTML = schHtml || '<p class="text-muted" style="font-size: 0.85rem;">No schedule items added.</p>';
    }

    // Recent activity feed for this event
    const actContainer = document.getElementById('ws-ov-activity');
    if (actContainer) {
      const activities = ActivityService.getRecent(5, e.id);
      let actHtml = '';
      activities.forEach(a => {
        actHtml += `
          <div class="activity-item" style="padding: 0.5rem 0;">
            <div class="activity-details">
              <div class="activity-message" style="font-size: 0.84rem;">${escapeHtml(a.message)}</div>
              <div class="activity-time">${DateUtils.timeAgo(a.timestamp)}</div>
            </div>
          </div>
        `;
      });
      actContainer.innerHTML = actHtml || '<p class="text-muted" style="font-size: 0.85rem;">No recent activities for this event.</p>';
    }
  }

  // ==========================================
  // 4. TAB: ATTENDEES (Section 18)
  // ==========================================
  static renderAttendeesTab() {
    const tbody = document.getElementById('ws-attendees-tbody');
    if (!tbody) return;

    const attendees = StorageService.getAttendeesForEvent(this.eventId);
    const types = StorageService.getTicketTypesForEvent(this.eventId);
    const typeMap = {};
    types.forEach(t => typeMap[t.id] = t);

    if (attendees.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; padding: 3rem 1rem;">
            <div class="empty-state" style="border: none; padding: 0;">
              <h4>No attendees registered yet</h4>
              <p>Share your public registration page or register an attendee manually.</p>
              <button class="btn btn-primary btn-sm" onclick="EventWorkspaceController.openAddAttendeeModal()">+ Register Attendee</button>
            </div>
          </td>
        </tr>
      `;
      return;
    }

    let html = '';
    attendees.forEach(a => {
      const ticketType = typeMap[a.ticketTypeId] || { name: 'General', color: '#6366F1' };
      html += `
        <tr>
          <td>
            <div style="font-weight: 600;">${escapeHtml(a.fullName)}</div>
            <div style="font-size: 0.75rem; color: var(--text-muted);">${escapeHtml(a.email)}</div>
          </td>
          <td class="mono" style="font-size: 0.82rem; color: var(--primary);">${escapeHtml(a.registrationId)}</td>
          <td>
            <span class="badge" style="background: rgba(99, 102, 241, 0.12); color: ${ticketType.color}; border: 1px solid ${ticketType.color}40;">
              ${escapeHtml(ticketType.name)}
            </span>
          </td>
          <td>${DateUtils.formatDate(a.registeredAt, 'short')}</td>
          <td>
            <span class="badge badge-${a.status === 'Confirmed' ? 'success' : 'danger'}">${a.status}</span>
          </td>
          <td>
            <button class="btn btn-sm ${a.checkedIn ? 'btn-success' : 'btn-secondary'}" onclick="EventWorkspaceController.toggleCheckIn('${a.id}')">
              ${a.checkedIn ? '✓ Checked In' : 'Check In'}
            </button>
          </td>
          <td style="text-align: right;">
            <button class="btn btn-ghost btn-sm btn-icon" onclick="EventWorkspaceController.viewTicket('${a.id}')" title="View Ticket">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>
            </button>
            <button class="btn btn-ghost btn-sm btn-icon text-danger" onclick="EventWorkspaceController.deleteAttendee('${a.id}')" title="Delete Attendee">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>
            </button>
          </td>
        </tr>
      `;
    });

    tbody.innerHTML = html;
  }

  static toggleCheckIn(attendeeId) {
    const updated = AttendeeService.toggleCheckIn(attendeeId, 'Main Gate');
    if (updated) {
      Toast.success(updated.checkedIn ? `${updated.fullName} checked in!` : 'Check-in reverted');
      this.loadEvent();
    }
  }

  static deleteAttendee(attendeeId) {
    const att = StorageService.getAttendee(attendeeId);
    if (!att) return;

    Modal.confirm({
      title: 'Remove Attendee?',
      message: `Are you sure you want to remove ${att.fullName} from this event? Their ticket will also be deleted.`,
      confirmText: 'Remove',
      confirmClass: 'btn-danger',
      onConfirm: () => {
        AttendeeService.delete(attendeeId);
        Toast.error(`Removed ${att.fullName}`);
        this.loadEvent();
      }
    });
  }

  static viewTicket(attendeeId) {
    const ticket = StorageService.getTicketByAttendee(attendeeId);
    if (ticket) {
      window.location.href = `tickets.html?ticketId=${ticket.id}`;
    } else {
      Toast.warning('Ticket record not found for this attendee.');
    }
  }

  static openAddAttendeeModal() {
    let modal = document.getElementById('ws-add-attendee-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'ws-add-attendee-modal';
      modal.className = 'modal-backdrop';
      modal.innerHTML = `
        <div class="modal-dialog">
          <div class="modal-header">
            <h3 class="modal-title">Register Attendee</h3>
            <button class="modal-close" onclick="Modal.close('ws-add-attendee-modal')">&times;</button>
          </div>
          <form id="ws-add-attendee-form">
            <div class="modal-body">
              <div class="form-group">
                <label class="form-label">Full Name <span class="required-star">*</span></label>
                <input type="text" id="ws-att-name" class="form-control" required placeholder="Full Name">
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">Email Address <span class="required-star">*</span></label>
                  <input type="email" id="ws-att-email" class="form-control" required placeholder="attendee@example.com">
                </div>
                <div class="form-group">
                  <label class="form-label">Phone Number</label>
                  <input type="text" id="ws-att-phone" class="form-control" placeholder="+1 (555) 000-0000">
                </div>
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">Organization / School</label>
                  <input type="text" id="ws-att-org" class="form-control" placeholder="Company or University">
                </div>
                <div class="form-group">
                  <label class="form-label">Ticket Type</label>
                  <select id="ws-att-ticket-type" class="form-control select-dropdown"></select>
                </div>
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" onclick="Modal.close('ws-add-attendee-modal')">Cancel</button>
              <button type="submit" class="btn btn-primary">Complete Registration</button>
            </div>
          </form>
        </div>
      `;
      document.body.appendChild(modal);

      const form = document.getElementById('ws-add-attendee-form');
      form.onsubmit = (e) => {
        e.preventDefault();
        const res = AttendeeService.register({
          eventId: this.eventId,
          fullName: document.getElementById('ws-att-name').value,
          email: document.getElementById('ws-att-email').value,
          phone: document.getElementById('ws-att-phone').value,
          organization: document.getElementById('ws-att-org').value,
          ticketTypeId: document.getElementById('ws-att-ticket-type').value
        });

        if (res.success) {
          Toast.success(`Registered ${res.attendee.fullName} (${res.attendee.registrationId})`);
          Modal.close('ws-add-attendee-modal');
          form.reset();
          this.loadEvent();
        } else {
          Toast.error(res.error || 'Registration failed');
        }
      };
    }

    // Populate ticket type select
    const ttSelect = document.getElementById('ws-att-ticket-type');
    if (ttSelect) {
      const types = StorageService.getTicketTypesForEvent(this.eventId);
      ttSelect.innerHTML = types.map(t => `<option value="${t.id}">${t.name} (${t.price ? '$' + t.price : 'Free'})</option>`).join('');
    }

    Modal.open('ws-add-attendee-modal');
  }

  // ==========================================
  // 5. TAB: TICKETS (Section 21)
  // ==========================================
  static renderTicketsTab() {
    const container = document.getElementById('ws-ticket-types-grid');
    if (!container) return;

    const types = StorageService.getTicketTypesForEvent(this.eventId);
    const attendees = StorageService.getAttendeesForEvent(this.eventId);

    let html = '';
    types.forEach(t => {
      const issued = attendees.filter(a => a.ticketTypeId === t.id).length;
      html += `
        <div class="card" style="border-top: 4px solid ${t.color || '#6366F1'};">
          <div class="card-header">
            <h4 class="card-title">${escapeHtml(t.name)}</h4>
            <span class="badge" style="background: ${t.color}20; color: ${t.color}; font-weight: 700;">
              ${t.price > 0 ? '$' + t.price : 'FREE'}
            </span>
          </div>
          <p style="font-size: 0.85rem; margin-bottom: 1rem; min-height: 40px;">${escapeHtml(t.description || 'Standard event access')}</p>
          <div style="font-size: 0.8rem; color: var(--text-muted); display: flex; justify-content: space-between; border-top: 1px solid var(--border-subtle); padding-top: 0.75rem;">
            <span>Issued: <strong>${issued}</strong> / ${t.capacity}</span>
            <span>${Math.round((issued / (t.capacity || 1)) * 100)}% Cap</span>
          </div>
        </div>
      `;
    });

    container.innerHTML = html;
  }

  // ==========================================
  // 6. TAB: CHECK-IN MONITOR
  // ==========================================
  static renderCheckInTab() {
    const listContainer = document.getElementById('ws-checkin-scans-list');
    if (!listContainer) return;

    const scans = StorageService.getScansForEvent(this.eventId);
    if (scans.length === 0) {
      listContainer.innerHTML = '<p class="text-muted" style="text-align: center; padding: 2rem;">No check-ins recorded yet for this event.</p>';
      return;
    }

    let html = '';
    scans.forEach(s => {
      const att = StorageService.getAttendee(s.attendeeId);
      html += `
        <div class="scanner-feed-item ${s.status === 'Duplicate' ? 'duplicate' : ''}">
          <div>
            <div style="font-weight: 600;">${att ? escapeHtml(att.fullName) : 'Attendee'} &bull; <span class="mono">${s.qrToken}</span></div>
            <div style="font-size: 0.72rem; color: var(--text-muted);">${DateUtils.timeAgo(s.timestamp)} at ${escapeHtml(s.gate || 'Main Gate')}</div>
          </div>
          <span class="badge ${s.status === 'Success' ? 'badge-success' : 'badge-warning'}">${s.status}</span>
        </div>
      `;
    });
    listContainer.innerHTML = html;
  }

  // ==========================================
  // 7. TAB: STAFF (Section 27)
  // ==========================================
  static renderStaffTab() {
    const container = document.getElementById('ws-staff-tbody');
    if (!container) return;

    const staff = StorageService.getStaffForEvent(this.eventId);
    if (staff.length === 0) {
      container.innerHTML = `<tr><td colspan="5" style="text-align:center; padding: 2rem;">No staff assigned to this event. <a href="staff.html" class="text-primary">Manage Staff &rarr;</a></td></tr>`;
      return;
    }

    let html = '';
    staff.forEach(s => {
      html += `
        <tr>
          <td style="font-weight: 600;">${escapeHtml(s.name)}</td>
          <td><span class="badge badge-info">${escapeHtml(s.role)}</span></td>
          <td>${escapeHtml(s.gate || 'All Gates')}</td>
          <td>${escapeHtml(s.phone || s.email)}</td>
          <td><span class="badge badge-success">${s.status}</span></td>
        </tr>
      `;
    });
    container.innerHTML = html;
  }

  // ==========================================
  // 8. TAB: GATES (Section 26)
  // ==========================================
  static renderGatesTab() {
    const container = document.getElementById('ws-gates-grid');
    if (!container) return;

    const gates = StorageService.getGatesForEvent(this.eventId);
    if (gates.length === 0) {
      container.innerHTML = '<p class="text-muted" style="grid-column: 1/-1; padding: 2rem; text-align: center;">No gates configured. Add entry gates in Gate Management.</p>';
      return;
    }

    let html = '';
    gates.forEach(g => {
      html += `
        <div class="card">
          <div class="card-header">
            <h4 class="card-title">${escapeHtml(g.name)}</h4>
            <span class="badge badge-success">${g.status}</span>
          </div>
          <p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 0.75rem;">${escapeHtml(g.description || 'Access terminal')}</p>
          <div style="font-size: 0.8rem; color: var(--text-secondary);">
            Staff Assigned: <strong>${escapeHtml(g.assignedStaff || 'None')}</strong>
          </div>
        </div>
      `;
    });
    container.innerHTML = html;
  }

  // ==========================================
  // 9. TAB: TASKS (Section 28)
  // ==========================================
  static renderTasksTab() {
    const container = document.getElementById('ws-tasks-list');
    if (!container) return;

    const tasks = StorageService.getTasksForEvent(this.eventId);
    if (tasks.length === 0) {
      container.innerHTML = '<p class="text-muted" style="text-align: center; padding: 2rem;">No tasks created for this event.</p>';
      return;
    }

    let html = '';
    tasks.forEach(t => {
      html += `
        <div style="display: flex; align-items: center; justify-content: space-between; padding: 0.85rem; background: var(--bg-surface); border-radius: var(--radius-md); border: 1px solid var(--border-subtle); margin-bottom: 0.5rem;">
          <div style="display: flex; align-items: center; gap: 0.75rem;">
            <input type="checkbox" ${t.status === 'Completed' ? 'checked' : ''} onchange="EventWorkspaceController.toggleTaskStatus('${t.id}', this.checked)" style="width: 18px; height: 18px; cursor: pointer;">
            <div>
              <div style="font-size: 0.9rem; font-weight: 600; ${t.status === 'Completed' ? 'text-decoration: line-through; opacity: 0.6;' : ''}">
                ${escapeHtml(t.title)}
              </div>
              <div style="font-size: 0.75rem; color: var(--text-muted);">
                Assigned: ${escapeHtml(t.assignedTo)} &bull; Due: ${DateUtils.formatDate(t.dueDate)}
              </div>
            </div>
          </div>
          <span class="badge badge-${t.priority.toLowerCase()}">${t.priority}</span>
        </div>
      `;
    });
    container.innerHTML = html;
  }

  static toggleTaskStatus(taskId, isChecked) {
    StorageService.updateTask(taskId, { status: isChecked ? 'Completed' : 'In Progress' });
    Toast.info(isChecked ? 'Task marked completed' : 'Task reopened');
    this.renderTasksTab();
  }

  // ==========================================
  // 10. TAB: SCHEDULE (Section 29)
  // ==========================================
  static renderScheduleTab() {
    const container = document.getElementById('ws-schedule-timeline');
    if (!container) return;

    const schedule = StorageService.getScheduleForEvent(this.eventId);
    if (schedule.length === 0) {
      container.innerHTML = '<p class="text-muted" style="text-align: center; padding: 2rem;">No timeline items scheduled.</p>';
      return;
    }

    let html = '';
    schedule.forEach(s => {
      html += `
        <div style="display: flex; gap: 1.25rem; padding: 1rem; background: var(--bg-surface); border-radius: var(--radius-md); border-left: 4px solid var(--primary); margin-bottom: 0.75rem;">
          <div class="mono" style="font-size: 0.95rem; font-weight: 700; color: var(--primary); width: 65px; flex-shrink: 0;">${s.time}</div>
          <div style="flex: 1;">
            <h4 style="font-size: 0.95rem; font-weight: 700; margin-bottom: 0.2rem;">${escapeHtml(s.title)}</h4>
            <p style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 0.4rem;">${escapeHtml(s.description || '')}</p>
            <div style="font-size: 0.78rem; color: var(--text-muted); display: flex; gap: 1rem;">
              <span><strong>Speaker:</strong> ${escapeHtml(s.speaker || 'N/A')}</span>
              <span><strong>Location:</strong> ${escapeHtml(s.location || 'Main Auditorium')}</span>
            </div>
          </div>
        </div>
      `;
    });
    container.innerHTML = html;
  }

  // ==========================================
  // 11. TAB: ANALYTICS (Section 31)
  // ==========================================
  static renderAnalyticsTab() {
    const stats = AnalyticsService.getOverview(this.eventId);
    const regCountEl = document.getElementById('ws-an-total-regs');
    const chkCountEl = document.getElementById('ws-an-total-checks');
    const rateEl = document.getElementById('ws-an-rate');
    const capEl = document.getElementById('ws-an-cap');

    if (regCountEl) regCountEl.textContent = stats.totalRegistrations;
    if (chkCountEl) chkCountEl.textContent = stats.checkedInCount;
    if (rateEl) rateEl.textContent = `${stats.attendanceRate}%`;
    if (capEl) capEl.textContent = `${stats.capacityUtilization}%`;
  }
}

window.EventWorkspaceController = EventWorkspaceController;
