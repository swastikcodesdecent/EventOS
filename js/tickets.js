/**
 * EventOS - Ticket Management & Digital Ticket Controller
 * Sections 21, 22, 23, 37: Ticket Types, Digital Pass Preview & Printing
 */

document.addEventListener('DOMContentLoaded', async () => {
  if (window.AuthService) {
    const isAuthed = await AuthService.requireAuth();
    if (!isAuthed) return;
  }
  TicketsPageController.init();
});

class TicketsPageController {
  static init() {
    this.searchQuery = getQueryParam('search') || '';
    this.selectedEventId = getQueryParam('eventId') || 'all';

    this.bindControls();
    this.populateEventFilter();
    this.renderTicketTypes();
    this.renderTicketsList();

    // Auto open digital pass if ticketId query param is provided
    const targetTicketId = getQueryParam('ticketId');
    if (targetTicketId) {
      setTimeout(() => this.openDigitalTicketModal(targetTicketId), 150);
    }
  }

  static bindControls() {
    const searchInput = document.getElementById('tickets-search');
    if (searchInput) {
      if (this.searchQuery) searchInput.value = this.searchQuery;
      searchInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value.trim().toLowerCase();
        this.renderTicketsList();
      });
    }

    const eventFilterEl = document.getElementById('tickets-event-filter');
    if (eventFilterEl) {
      eventFilterEl.addEventListener('change', (e) => {
        this.selectedEventId = e.target.value;
        this.renderTicketTypes();
        this.renderTicketsList();
      });
    }
  }

  static populateEventFilter() {
    const filterEl = document.getElementById('tickets-event-filter');
    if (!filterEl) return;

    const events = EventService.getAll();
    let opts = '<option value="all">All Events</option>';
    events.forEach(e => {
      const isSelected = e.id === this.selectedEventId ? 'selected' : '';
      opts += `<option value="${e.id}" ${isSelected}>${escapeHtml(e.name)}</option>`;
    });
    filterEl.innerHTML = opts;
  }

  // ==========================================
  // 1. TICKET TYPES (Section 21)
  // ==========================================
  static renderTicketTypes() {
    const container = document.getElementById('ticket-types-grid');
    if (!container) return;

    let types = StorageService.getTicketTypes();
    if (this.selectedEventId !== 'all') {
      types = types.filter(t => t.eventId === this.selectedEventId);
    }

    if (types.length === 0) {
      container.innerHTML = `
        <div class="empty-state" style="grid-column: 1/-1; padding: 2rem;">
          <p>No ticket tiers configured. Add ticket types to open registrations.</p>
          <button class="btn btn-primary btn-sm" onclick="TicketsPageController.openAddTypeModal()">+ Add Ticket Type</button>
        </div>
      `;
      return;
    }

    const eventsMap = {};
    EventService.getAll().forEach(e => eventsMap[e.id] = e);

    const attendees = StorageService.getAttendees();

    let html = '';
    types.forEach(t => {
      const ev = eventsMap[t.eventId] || { name: 'Universal' };
      const count = attendees.filter(a => a.ticketTypeId === t.id).length;

      html += `
        <div class="card" style="border-top: 4px solid ${t.color || '#6366F1'};">
          <div class="card-header">
            <div>
              <h4 class="card-title">${escapeHtml(t.name)}</h4>
              <span style="font-size: 0.74rem; color: var(--text-muted);">${escapeHtml(ev.name)}</span>
            </div>
            <span class="badge" style="background: ${t.color}20; color: ${t.color}; font-weight: 800; font-size: 0.85rem;">
              ${t.price > 0 ? '$' + t.price : 'FREE'}
            </span>
          </div>
          <p style="font-size: 0.84rem; color: var(--text-secondary); margin-bottom: 1.25rem; min-height: 38px;">
            ${escapeHtml(t.description || 'Standard access tier for registered attendees.')}
          </p>
          <div style="display: flex; align-items: center; justify-content: space-between; font-size: 0.8rem; border-top: 1px solid var(--border-subtle); padding-top: 0.75rem;">
            <span>Capacity: <strong>${count} / ${t.capacity}</strong></span>
            <div style="display: flex; gap: 0.25rem;">
              <button class="btn btn-ghost btn-sm btn-icon" onclick="TicketsPageController.openEditTypeModal('${t.id}')" title="Edit Tier">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              </button>
              <button class="btn btn-ghost btn-sm btn-icon text-danger" onclick="TicketsPageController.deleteType('${t.id}')" title="Delete Tier">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>
              </button>
            </div>
          </div>
        </div>
      `;
    });

    container.innerHTML = html;
  }

  // ==========================================
  // 2. ISSUED TICKETS LIST
  // ==========================================
  static renderTicketsList() {
    const tbody = document.getElementById('tickets-table-body');
    if (!tbody) return;

    let tickets = StorageService.getTickets();
    if (this.selectedEventId !== 'all') {
      tickets = tickets.filter(t => t.eventId === this.selectedEventId);
    }

    const attendeesMap = {};
    StorageService.getAttendees().forEach(a => attendeesMap[a.id] = a);

    const typesMap = {};
    StorageService.getTicketTypes().forEach(t => typesMap[t.id] = t);

    const eventsMap = {};
    EventService.getAll().forEach(e => eventsMap[e.id] = e);

    if (this.searchQuery) {
      const q = this.searchQuery;
      tickets = tickets.filter(t => {
        const att = attendeesMap[t.attendeeId];
        return (t.ticketCode && t.ticketCode.toLowerCase().includes(q)) ||
               (t.qrToken && t.qrToken.toLowerCase().includes(q)) ||
               (att && att.fullName.toLowerCase().includes(q)) ||
               (att && att.registrationId.toLowerCase().includes(q));
      });
    }

    if (tickets.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; padding: 3rem 1rem;">
            <p class="text-muted">No tickets match your search filters.</p>
          </td>
        </tr>
      `;
      return;
    }

    let html = '';
    tickets.forEach(t => {
      const att = attendeesMap[t.attendeeId] || { fullName: 'Unknown', registrationId: 'N/A' };
      const ev = eventsMap[t.eventId] || { name: 'Unknown Event' };
      const tt = typesMap[t.ticketTypeId] || { name: 'General', color: '#6366F1' };

      html += `
        <tr>
          <td class="mono" style="font-weight: 700; color: var(--primary); font-size: 0.88rem;">
            ${escapeHtml(t.ticketCode || 'TKT-2026-0000')}
          </td>
          <td>
            <div style="font-weight: 600;">${escapeHtml(att.fullName)}</div>
            <div class="mono" style="font-size: 0.74rem; color: var(--text-muted);">${escapeHtml(att.registrationId)}</div>
          </td>
          <td>
            <div style="font-size: 0.86rem;">${escapeHtml(ev.name)}</div>
          </td>
          <td>
            <span class="badge" style="background: ${tt.color}18; color: ${tt.color}; border: 1px solid ${tt.color}35;">
              ${escapeHtml(tt.name)}
            </span>
          </td>
          <td class="mono" style="font-size: 0.78rem; color: var(--text-secondary);">
            ${escapeHtml(t.qrToken)}
          </td>
          <td>
            <span class="badge ${t.checkedIn ? 'badge-success' : 'badge-draft'}">
              ${t.checkedIn ? '✓ Checked In' : 'Valid'}
            </span>
          </td>
          <td style="text-align: right;">
            <button class="btn btn-primary btn-sm" onclick="TicketsPageController.openDigitalTicketModal('${t.id}')">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
              View Pass
            </button>
          </td>
        </tr>
      `;
    });

    tbody.innerHTML = html;
  }

  // ==========================================
  // 3. DIGITAL TICKET MODAL (Section 22, 23)
  // ==========================================
  static openDigitalTicketModal(ticketId) {
    const details = TicketService.getFullTicketDetails(ticketId);
    if (!details || !details.ticket) {
      Toast.error('Ticket not found');
      return;
    }

    const { ticket, attendee, event, ticketType } = details;

    let modal = document.getElementById('digital-ticket-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'digital-ticket-modal';
      modal.className = 'modal-backdrop';
      modal.innerHTML = `
        <div class="modal-dialog" style="max-width: 480px; background: transparent; border: none; box-shadow: none;">
          <div style="text-align: right; margin-bottom: 0.5rem;" class="no-print">
            <button class="btn btn-secondary btn-sm" onclick="Modal.close('digital-ticket-modal')">&times; Close</button>
          </div>
          
          <div class="ticket-card" id="printable-ticket-card">
            <div class="ticket-top">
              <div class="ticket-brand">
                <span class="ticket-brand-logo">EVENTOS PASS</span>
                <span class="badge" style="background: ${ticketType.color}25; color: ${ticketType.color}; border: 1px solid ${ticketType.color}60; font-weight: 800;">
                  ${escapeHtml(ticketType.name)}
                </span>
              </div>
              <h2 class="ticket-event-name" id="dt-event-name">Event Name</h2>
              
              <div class="ticket-attendee-info">
                <div class="ticket-attendee-name" id="dt-attendee-name">Attendee Name</div>
                <div class="ticket-reg-id" id="dt-reg-id">REG-2026-0000</div>
              </div>
            </div>

            <div class="ticket-bottom">
              <div class="ticket-qr-container">
                <canvas id="dt-qr-canvas" width="170" height="170"></canvas>
              </div>

              <div class="mono" style="font-size: 0.75rem; color: #94A3B8; margin-bottom: 1rem; letter-spacing: 0.05em;" id="dt-qr-token">
                EVENTOS:TICKET:TOKEN
              </div>

              <div class="ticket-meta-grid">
                <div class="ticket-meta-item">
                  <span class="ticket-meta-label">Date & Time</span>
                  <span class="ticket-meta-val" id="dt-date-time">Date TBD</span>
                </div>
                <div class="ticket-meta-item">
                  <span class="ticket-meta-label">Venue & Gate</span>
                  <span class="ticket-meta-val" id="dt-venue-gate">Venue TBD</span>
                </div>
              </div>
            </div>

            <div class="ticket-status-stamp" id="dt-stamp-checkedin" style="display: none;">
              CHECKED IN
            </div>
          </div>

          <div style="margin-top: 1.25rem; display: flex; gap: 0.75rem;" class="no-print">
            <button class="btn btn-secondary" style="flex: 1;" onclick="window.print()">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
              Print Ticket / PDF
            </button>
            <button class="btn btn-primary" style="flex: 1;" onclick="TicketsPageController.shareTicket('${ticket.id}')">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
              Copy Ticket Link
            </button>
          </div>
        </div>
      `;
      document.body.appendChild(modal);
    }

    // Populate digital pass fields
    document.getElementById('dt-event-name').textContent = event ? event.name : 'Event';
    document.getElementById('dt-attendee-name').textContent = attendee ? attendee.fullName : 'Guest Attendee';
    document.getElementById('dt-reg-id').textContent = (attendee ? attendee.registrationId : '') + ' • ' + ticket.ticketCode;
    document.getElementById('dt-qr-token').textContent = `EVENTOS:TICKET:${ticket.qrToken}`;

    const dateStr = event ? `${DateUtils.formatDate(event.startDate, 'short')} • ${DateUtils.formatTime(event.startTime)}` : 'TBD';
    document.getElementById('dt-date-time').textContent = dateStr;

    const venueStr = event ? (event.venue || 'Online Event') : 'Main Venue';
    document.getElementById('dt-venue-gate').textContent = venueStr;

    // Checked-in stamp
    const stampEl = document.getElementById('dt-stamp-checkedin');
    if (stampEl) {
      stampEl.style.display = ticket.checkedIn ? 'block' : 'none';
    }

    // Render pure JS QR code onto canvas
    const canvas = document.getElementById('dt-qr-canvas');
    if (canvas) {
      QRCodeGenerator.renderToCanvas(canvas, `EVENTOS:TICKET:${ticket.qrToken}`, {
        size: 170,
        padding: 6,
        darkColor: '#0B0F17',
        lightColor: '#FFFFFF'
      });
    }

    Modal.open('digital-ticket-modal');
  }

  static shareTicket(ticketId) {
    const url = `${window.location.origin}${window.location.pathname}?ticketId=${ticketId}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url).then(() => {
        Toast.success('Ticket pass link copied to clipboard!');
      });
    } else {
      Toast.info(`Ticket URL: ${url}`);
    }
  }

  // ==========================================
  // 4. TICKET TYPE MODALS
  // ==========================================
  static openAddTypeModal() {
    let modal = document.getElementById('add-ticket-type-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'add-ticket-type-modal';
      modal.className = 'modal-backdrop';
      modal.innerHTML = `
        <div class="modal-dialog">
          <div class="modal-header">
            <h3 class="modal-title">Create Ticket Tier</h3>
            <button class="modal-close" onclick="Modal.close('add-ticket-type-modal')">&times;</button>
          </div>
          <form id="add-ticket-type-form">
            <div class="modal-body">
              <div class="form-group">
                <label class="form-label">Event <span class="required-star">*</span></label>
                <select id="tt-event-select" class="form-control select-dropdown" required></select>
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">Tier Name <span class="required-star">*</span></label>
                  <input type="text" id="tt-name" class="form-control" required placeholder="e.g. VIP, Student, Speaker">
                </div>
                <div class="form-group">
                  <label class="form-label">Price ($) <span class="required-star">*</span></label>
                  <input type="number" id="tt-price" class="form-control" required min="0" step="1" value="0">
                </div>
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">Max Capacity <span class="required-star">*</span></label>
                  <input type="number" id="tt-capacity" class="form-control" required min="1" value="50">
                </div>
                <div class="form-group">
                  <label class="form-label">Accent Color</label>
                  <input type="color" id="tt-color" class="form-control" value="#6366F1" style="height: 42px; padding: 2px;">
                </div>
              </div>
              <div class="form-group">
                <label class="form-label">Description & Privileges</label>
                <textarea id="tt-desc" class="form-control" rows="2" placeholder="Describe perks, seating privileges, or swag items included"></textarea>
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" onclick="Modal.close('add-ticket-type-modal')">Cancel</button>
              <button type="submit" class="btn btn-primary">Create Tier</button>
            </div>
          </form>
        </div>
      `;
      document.body.appendChild(modal);

      const form = document.getElementById('add-ticket-type-form');
      form.onsubmit = (e) => {
        e.preventDefault();
        const eventId = document.getElementById('tt-event-select').value;
        const newType = StorageService.createTicketType({
          eventId,
          name: document.getElementById('tt-name').value.trim(),
          price: parseFloat(document.getElementById('tt-price').value),
          capacity: parseInt(document.getElementById('tt-capacity').value, 10),
          color: document.getElementById('tt-color').value,
          description: document.getElementById('tt-desc').value.trim()
        });

        Toast.success(`Created ticket tier "${newType.name}"`);
        Modal.close('add-ticket-type-modal');
        form.reset();
        this.renderTicketTypes();
      };
    }

    const sel = document.getElementById('tt-event-select');
    sel.innerHTML = EventService.getAll().map(e => `<option value="${e.id}">${escapeHtml(e.name)}</option>`).join('');

    Modal.open('add-ticket-type-modal');
  }

  static openEditTypeModal(id) {
    const type = StorageService.getTicketTypes().find(t => t.id === id);
    if (!type) return;

    let modal = document.getElementById('edit-ticket-type-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'edit-ticket-type-modal';
      modal.className = 'modal-backdrop';
      modal.innerHTML = `
        <div class="modal-dialog">
          <div class="modal-header">
            <h3 class="modal-title">Edit Ticket Tier</h3>
            <button class="modal-close" onclick="Modal.close('edit-ticket-type-modal')">&times;</button>
          </div>
          <form id="edit-ticket-type-form">
            <input type="hidden" id="edit-tt-id">
            <div class="modal-body">
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">Tier Name <span class="required-star">*</span></label>
                  <input type="text" id="edit-tt-name" class="form-control" required>
                </div>
                <div class="form-group">
                  <label class="form-label">Price ($) <span class="required-star">*</span></label>
                  <input type="number" id="edit-tt-price" class="form-control" required min="0">
                </div>
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">Capacity <span class="required-star">*</span></label>
                  <input type="number" id="edit-tt-capacity" class="form-control" required min="1">
                </div>
                <div class="form-group">
                  <label class="form-label">Accent Color</label>
                  <input type="color" id="edit-tt-color" class="form-control" style="height: 42px; padding: 2px;">
                </div>
              </div>
              <div class="form-group">
                <label class="form-label">Description</label>
                <textarea id="edit-tt-desc" class="form-control" rows="2"></textarea>
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" onclick="Modal.close('edit-ticket-type-modal')">Cancel</button>
              <button type="submit" class="btn btn-primary">Save Changes</button>
            </div>
          </form>
        </div>
      `;
      document.body.appendChild(modal);

      const form = document.getElementById('edit-ticket-type-form');
      form.onsubmit = (e) => {
        e.preventDefault();
        const editId = document.getElementById('edit-tt-id').value;
        StorageService.updateTicketType(editId, {
          name: document.getElementById('edit-tt-name').value.trim(),
          price: parseFloat(document.getElementById('edit-tt-price').value),
          capacity: parseInt(document.getElementById('edit-tt-capacity').value, 10),
          color: document.getElementById('edit-tt-color').value,
          description: document.getElementById('edit-tt-desc').value.trim()
        });

        Toast.success('Ticket tier updated successfully');
        Modal.close('edit-ticket-type-modal');
        this.renderTicketTypes();
      };
    }

    document.getElementById('edit-tt-id').value = type.id;
    document.getElementById('edit-tt-name').value = type.name;
    document.getElementById('edit-tt-price').value = type.price || 0;
    document.getElementById('edit-tt-capacity').value = type.capacity || 50;
    document.getElementById('edit-tt-color').value = type.color || '#6366F1';
    document.getElementById('edit-tt-desc').value = type.description || '';

    Modal.open('edit-ticket-type-modal');
  }

  static deleteType(id) {
    const type = StorageService.getTicketTypes().find(t => t.id === id);
    if (!type) return;

    Modal.confirm({
      title: 'Delete Ticket Tier?',
      message: `Are you sure you want to delete "${type.name}"? Existing issued tickets will remain intact.`,
      confirmText: 'Delete Tier',
      confirmClass: 'btn-danger',
      onConfirm: () => {
        StorageService.deleteTicketType(id);
        Toast.error(`Deleted tier "${type.name}"`);
        this.renderTicketTypes();
      }
    });
  }
}

window.TicketsPageController = TicketsPageController;
