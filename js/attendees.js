/**
 * EventOS - Global Attendees Controller
 * Section 18: Search, Filters (All, Confirmed, Cancelled, Checked In, Not Checked In), Actions, Add/Edit Modal
 */

document.addEventListener('DOMContentLoaded', async () => {
  if (window.AuthService) {
    const isAuthed = await AuthService.requireAuth();
    if (!isAuthed) return;
  }
  AttendeesPageController.init();
});

class AttendeesPageController {
  static init() {
    this.statusFilter = 'all';
    this.selectedEventId = getQueryParam('eventId') || 'all';
    this.searchQuery = getQueryParam('search') || '';

    this.bindControls();
    this.populateEventFilter();
    this.renderAttendees();
  }

  static bindControls() {
    const searchInput = document.getElementById('attendees-search');
    if (searchInput) {
      if (this.searchQuery) searchInput.value = this.searchQuery;
      searchInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value.trim();
        this.renderAttendees();
      });
    }

    const statusFilterEl = document.getElementById('attendees-status-filter');
    if (statusFilterEl) {
      statusFilterEl.addEventListener('change', (e) => {
        this.statusFilter = e.target.value;
        this.renderAttendees();
      });
    }

    const eventFilterEl = document.getElementById('attendees-event-filter');
    if (eventFilterEl) {
      eventFilterEl.addEventListener('change', (e) => {
        this.selectedEventId = e.target.value;
        this.renderAttendees();
      });
    }
  }

  static populateEventFilter() {
    const filterEl = document.getElementById('attendees-event-filter');
    if (!filterEl) return;

    const events = EventService.getAll();
    let opts = '<option value="all">All Events</option>';
    events.forEach(e => {
      const isSelected = e.id === this.selectedEventId ? 'selected' : '';
      opts += `<option value="${e.id}" ${isSelected}>${escapeHtml(e.name)}</option>`;
    });
    filterEl.innerHTML = opts;
  }

  static renderAttendees() {
    const tbody = document.getElementById('attendees-table-body');
    const countBadge = document.getElementById('attendees-total-count');
    if (!tbody) return;

    const eventId = this.selectedEventId !== 'all' ? this.selectedEventId : null;
    const attendees = AttendeeService.getAll(eventId, {
      status: this.statusFilter,
      search: this.searchQuery
    });

    if (countBadge) countBadge.textContent = `${attendees.length} Attendees`;

    if (attendees.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" style="text-align: center; padding: 3.5rem 1rem;">
            <div class="empty-state" style="border: none; padding: 0;">
              <div class="empty-state-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              </div>
              <h4>No attendees found</h4>
              <p>Try adjusting your search criteria or register a new attendee.</p>
              <button class="btn btn-primary btn-sm" onclick="AttendeesPageController.openAddModal()">+ Register Attendee</button>
            </div>
          </td>
        </tr>
      `;
      return;
    }

    const eventsMap = {};
    EventService.getAll().forEach(e => eventsMap[e.id] = e);

    const typesMap = {};
    StorageService.getTicketTypes().forEach(t => typesMap[t.id] = t);

    let html = '';
    attendees.forEach(a => {
      const ev = eventsMap[a.eventId] || { name: 'Unknown Event' };
      const tt = typesMap[a.ticketTypeId] || { name: 'General', color: '#6366F1' };

      html += `
        <tr>
          <td>
            <div style="font-weight: 700; font-size: 0.92rem;">${escapeHtml(a.fullName)}</div>
            <div style="font-size: 0.76rem; color: var(--text-muted);">${escapeHtml(a.organization || a.city || 'Individual')}</div>
          </td>
          <td>
            <div style="font-size: 0.86rem;">${escapeHtml(a.email)}</div>
            <div style="font-size: 0.74rem; color: var(--text-muted);">${escapeHtml(a.phone || '')}</div>
          </td>
          <td class="mono" style="font-size: 0.84rem; font-weight: 600; color: var(--primary);">
            ${escapeHtml(a.registrationId)}
          </td>
          <td>
            <a href="event.html?id=${a.eventId}" style="font-weight: 600; font-size: 0.85rem; color: inherit;" title="${escapeHtml(ev.name)}">
              ${escapeHtml(ev.name.length > 24 ? ev.name.substring(0, 24) + '...' : ev.name)}
            </a>
          </td>
          <td>
            <span class="badge" style="background: ${tt.color}18; color: ${tt.color}; border: 1px solid ${tt.color}35;">
              ${escapeHtml(tt.name)}
            </span>
          </td>
          <td>
            <span class="badge badge-${a.status === 'Confirmed' ? 'success' : 'danger'}">${a.status}</span>
          </td>
          <td>
            <button class="btn btn-sm ${a.checkedIn ? 'btn-success' : 'btn-secondary'}" onclick="AttendeesPageController.toggleCheckIn('${a.id}')">
              ${a.checkedIn ? '✓ Checked In' : 'Check In'}
            </button>
          </td>
          <td style="text-align: right;">
            <div style="display: flex; justify-content: flex-end; gap: 0.25rem;">
              <button class="btn btn-ghost btn-sm btn-icon" onclick="AttendeesPageController.viewTicket('${a.id}')" title="View Digital Pass">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>
              </button>
              <button class="btn btn-ghost btn-sm btn-icon" onclick="AttendeesPageController.openEditModal('${a.id}')" title="Edit Attendee">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              </button>
              <button class="btn btn-ghost btn-sm btn-icon text-danger" onclick="AttendeesPageController.deleteAttendee('${a.id}')" title="Remove Record">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>
              </button>
            </div>
          </td>
        </tr>
      `;
    });

    tbody.innerHTML = html;
  }

  static toggleCheckIn(id) {
    const updated = AttendeeService.toggleCheckIn(id, 'Main Gate');
    if (updated) {
      Toast.success(updated.checkedIn ? `${updated.fullName} checked in!` : 'Check-in undone');
      this.renderAttendees();
    }
  }

  static viewTicket(attendeeId) {
    const ticket = StorageService.getTicketByAttendee(attendeeId);
    if (ticket) {
      window.location.href = `tickets.html?ticketId=${ticket.id}`;
    } else {
      Toast.warning('Ticket pass not generated yet for this attendee.');
    }
  }

  static openAddModal() {
    let modal = document.getElementById('global-add-attendee-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'global-add-attendee-modal';
      modal.className = 'modal-backdrop';
      modal.innerHTML = `
        <div class="modal-dialog">
          <div class="modal-header">
            <h3 class="modal-title">Register Attendee</h3>
            <button class="modal-close" onclick="Modal.close('global-add-attendee-modal')">&times;</button>
          </div>
          <form id="global-add-att-form">
            <div class="modal-body">
              <div class="form-group">
                <label class="form-label">Target Event <span class="required-star">*</span></label>
                <select id="glb-att-event" class="form-control select-dropdown" required></select>
              </div>
              <div class="form-group">
                <label class="form-label">Full Name <span class="required-star">*</span></label>
                <input type="text" id="glb-att-name" class="form-control" required placeholder="Full Name">
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">Email <span class="required-star">*</span></label>
                  <input type="email" id="glb-att-email" class="form-control" required placeholder="attendee@example.com">
                </div>
                <div class="form-group">
                  <label class="form-label">Phone</label>
                  <input type="text" id="glb-att-phone" class="form-control" placeholder="+1 (555) 000-0000">
                </div>
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">Organization</label>
                  <input type="text" id="glb-att-org" class="form-control" placeholder="Company / College">
                </div>
                <div class="form-group">
                  <label class="form-label">Ticket Type</label>
                  <select id="glb-att-ticket-type" class="form-control select-dropdown"></select>
                </div>
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" onclick="Modal.close('global-add-attendee-modal')">Cancel</button>
              <button type="submit" class="btn btn-primary">Complete Registration</button>
            </div>
          </form>
        </div>
      `;
      document.body.appendChild(modal);

      // Bind dynamic ticket type loading when event changes
      const evtSelect = document.getElementById('glb-att-event');
      evtSelect.addEventListener('change', () => this.updateTicketTypesDropdown());

      const form = document.getElementById('global-add-att-form');
      form.onsubmit = (e) => {
        e.preventDefault();
        const eventId = document.getElementById('glb-att-event').value;
        const res = AttendeeService.register({
          eventId,
          fullName: document.getElementById('glb-att-name').value,
          email: document.getElementById('glb-att-email').value,
          phone: document.getElementById('glb-att-phone').value,
          organization: document.getElementById('glb-att-org').value,
          ticketTypeId: document.getElementById('glb-att-ticket-type').value
        });

        if (res.success) {
          Toast.success(`Registered ${res.attendee.fullName} (${res.attendee.registrationId})`);
          Modal.close('global-add-attendee-modal');
          form.reset();
          this.renderAttendees();
        } else {
          Toast.error(res.error || 'Registration failed');
        }
      };
    }

    // Populate events
    const evtSelect = document.getElementById('glb-att-event');
    const events = EventService.getAll().filter(e => e.status !== 'Cancelled');
    evtSelect.innerHTML = events.map(e => `<option value="${e.id}">${escapeHtml(e.name)}</option>`).join('');

    this.updateTicketTypesDropdown();
    Modal.open('global-add-attendee-modal');
  }

  static updateTicketTypesDropdown() {
    const evtSelect = document.getElementById('glb-att-event');
    const ttSelect = document.getElementById('glb-att-ticket-type');
    if (!evtSelect || !ttSelect) return;

    const eventId = evtSelect.value;
    const types = StorageService.getTicketTypesForEvent(eventId);
    ttSelect.innerHTML = types.map(t => `<option value="${t.id}">${t.name} (${t.price ? '$' + t.price : 'Free'})</option>`).join('');
  }

  static openEditModal(id) {
    const att = StorageService.getAttendee(id);
    if (!att) return;

    let modal = document.getElementById('edit-attendee-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'edit-attendee-modal';
      modal.className = 'modal-backdrop';
      modal.innerHTML = `
        <div class="modal-dialog">
          <div class="modal-header">
            <h3 class="modal-title">Edit Attendee</h3>
            <button class="modal-close" onclick="Modal.close('edit-attendee-modal')">&times;</button>
          </div>
          <form id="edit-att-form">
            <input type="hidden" id="edit-att-id">
            <div class="modal-body">
              <div class="form-group">
                <label class="form-label">Full Name <span class="required-star">*</span></label>
                <input type="text" id="edit-att-name" class="form-control" required>
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">Email <span class="required-star">*</span></label>
                  <input type="email" id="edit-att-email" class="form-control" required>
                </div>
                <div class="form-group">
                  <label class="form-label">Phone</label>
                  <input type="text" id="edit-att-phone" class="form-control">
                </div>
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">Organization</label>
                  <input type="text" id="edit-att-org" class="form-control">
                </div>
                <div class="form-group">
                  <label class="form-label">Status</label>
                  <select id="edit-att-status" class="form-control select-dropdown">
                    <option value="Confirmed">Confirmed</option>
                    <option value="Cancelled">Cancelled</option>
                  </select>
                </div>
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" onclick="Modal.close('edit-attendee-modal')">Cancel</button>
              <button type="submit" class="btn btn-primary">Save Changes</button>
            </div>
          </form>
        </div>
      `;
      document.body.appendChild(modal);

      const form = document.getElementById('edit-att-form');
      form.onsubmit = (e) => {
        e.preventDefault();
        const editId = document.getElementById('edit-att-id').value;
        StorageService.updateAttendee(editId, {
          fullName: document.getElementById('edit-att-name').value.trim(),
          email: document.getElementById('edit-att-email').value.trim(),
          phone: document.getElementById('edit-att-phone').value.trim(),
          organization: document.getElementById('edit-att-org').value.trim(),
          status: document.getElementById('edit-att-status').value
        });
        Toast.success('Attendee updated successfully');
        Modal.close('edit-attendee-modal');
        this.renderAttendees();
      };
    }

    document.getElementById('edit-att-id').value = att.id;
    document.getElementById('edit-att-name').value = att.fullName;
    document.getElementById('edit-att-email').value = att.email;
    document.getElementById('edit-att-phone').value = att.phone || '';
    document.getElementById('edit-att-org').value = att.organization || '';
    document.getElementById('edit-att-status').value = att.status || 'Confirmed';

    Modal.open('edit-attendee-modal');
  }

  static deleteAttendee(id) {
    const att = StorageService.getAttendee(id);
    if (!att) return;

    Modal.confirm({
      title: 'Delete Attendee Record?',
      message: `Are you sure you want to delete ${att.fullName}? This will permanently remove their ticket pass as well.`,
      confirmText: 'Delete Record',
      confirmClass: 'btn-danger',
      onConfirm: () => {
        AttendeeService.delete(id);
        Toast.error(`Deleted ${att.fullName}`);
        this.renderAttendees();
      }
    });
  }
}

window.AttendeesPageController = AttendeesPageController;
