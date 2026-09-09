/**
 * EventOS - Schedule & Agenda Controller
 * Section 29: Visual event timeline agenda, Add/Edit/Delete Sessions
 */

document.addEventListener('DOMContentLoaded', async () => {
  if (window.AuthService) {
    const isAuthed = await AuthService.requireAuth();
    if (!isAuthed) return;
  }
  SchedulePageController.init();
});

class SchedulePageController {
  static init() {
    this.selectedEventId = getQueryParam('eventId') || 'all';

    this.populateEventFilter();
    this.renderTimeline();
  }

  static populateEventFilter() {
    const filterEl = document.getElementById('schedule-event-filter');
    if (!filterEl) return;

    const events = EventService.getAll();
    let opts = '<option value="all">All Events</option>';
    events.forEach(e => {
      const isSelected = e.id === this.selectedEventId ? 'selected' : '';
      opts += `<option value="${e.id}" ${isSelected}>${escapeHtml(e.name)}</option>`;
    });
    filterEl.innerHTML = opts;

    filterEl.addEventListener('change', (e) => {
      this.selectedEventId = e.target.value;
      this.renderTimeline();
    });
  }

  static renderTimeline() {
    const container = document.getElementById('schedule-timeline-container');
    const countEl = document.getElementById('schedule-total-count');
    if (!container) return;

    let items = StorageService.getSchedule();
    if (this.selectedEventId !== 'all') {
      items = items.filter(s => s.eventId === this.selectedEventId);
    }

    // Sort by time
    items.sort((a, b) => (a.time || '').localeCompare(b.time || ''));

    if (countEl) countEl.textContent = `${items.length} Agenda Sessions`;

    if (items.length === 0) {
      container.innerHTML = `
        <div class="empty-state" style="padding: 3rem 1.5rem;">
          <div class="empty-state-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          </div>
          <h4>No sessions on schedule</h4>
          <p>Add keynotes, workshops, breaks, and ceremonies to build your event timeline.</p>
          <button class="btn btn-primary btn-sm" onclick="SchedulePageController.openAddModal()">+ Add Session</button>
        </div>
      `;
      return;
    }

    const eventsMap = {};
    EventService.getAll().forEach(e => eventsMap[e.id] = e);

    let html = '';
    items.forEach(s => {
      const ev = eventsMap[s.eventId] || { name: 'General' };

      html += `
        <div style="display: flex; gap: 1.5rem; padding: 1.25rem; background: var(--bg-card); border-radius: var(--radius-lg); border: 1px solid var(--border-subtle); border-left: 4px solid var(--primary); margin-bottom: 1rem; position: relative;">
          <div style="display: flex; flex-direction: column; align-items: center; width: 75px; flex-shrink: 0;">
            <span class="mono" style="font-size: 1.1rem; font-weight: 800; color: var(--primary);">${s.time}</span>
            <span style="font-size: 0.72rem; color: var(--text-muted); text-align: center; margin-top: 0.2rem;">${escapeHtml(ev.name)}</span>
          </div>

          <div style="flex: 1;">
            <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem;">
              <h3 style="font-size: 1.1rem; font-weight: 700; margin-bottom: 0.25rem;">${escapeHtml(s.title)}</h3>
              <div style="display: flex; gap: 0.25rem;">
                <button class="btn btn-ghost btn-sm btn-icon" onclick="SchedulePageController.openEditModal('${s.id}')" title="Edit Session">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                </button>
                <button class="btn btn-ghost btn-sm btn-icon text-danger" onclick="SchedulePageController.deleteItem('${s.id}')" title="Delete Session">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>
                </button>
              </div>
            </div>

            ${s.description ? `<p style="font-size: 0.88rem; color: var(--text-secondary); margin-bottom: 0.75rem;">${escapeHtml(s.description)}</p>` : ''}

            <div style="display: flex; align-items: center; gap: 1.5rem; font-size: 0.82rem; color: var(--text-muted); flex-wrap: wrap;">
              ${s.speaker ? `
                <span style="display: flex; align-items: center; gap: 0.4rem;">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                  <strong style="color: var(--text-main);">${escapeHtml(s.speaker)}</strong>
                </span>
              ` : ''}

              ${s.location ? `
                <span style="display: flex; align-items: center; gap: 0.4rem;">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                  <span>${escapeHtml(s.location)}</span>
                </span>
              ` : ''}
            </div>
          </div>
        </div>
      `;
    });

    container.innerHTML = html;
  }

  static openAddModal() {
    let modal = document.getElementById('add-schedule-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'add-schedule-modal';
      modal.className = 'modal-backdrop';
      modal.innerHTML = `
        <div class="modal-dialog">
          <div class="modal-header">
            <h3 class="modal-title">Add Schedule Session</h3>
            <button class="modal-close" onclick="Modal.close('add-schedule-modal')">&times;</button>
          </div>
          <form id="add-schedule-form">
            <div class="modal-body">
              <div class="form-group">
                <label class="form-label">Event</label>
                <select id="sch-event-select" class="form-control select-dropdown" required></select>
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">Start Time <span class="required-star">*</span></label>
                  <input type="time" id="sch-time" class="form-control" required value="09:00">
                </div>
                <div class="form-group">
                  <label class="form-label">Location / Room</label>
                  <input type="text" id="sch-location" class="form-control" placeholder="Main Auditorium">
                </div>
              </div>
              <div class="form-group">
                <label class="form-label">Session Title <span class="required-star">*</span></label>
                <input type="text" id="sch-title" class="form-control" required placeholder="Keynote, Workshop, Lunch Break, etc.">
              </div>
              <div class="form-group">
                <label class="form-label">Speaker / Host</label>
                <input type="text" id="sch-speaker" class="form-control" placeholder="Keynote Speaker Name">
              </div>
              <div class="form-group">
                <label class="form-label">Description</label>
                <textarea id="sch-desc" class="form-control" rows="2" placeholder="Session overview or topics covered"></textarea>
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" onclick="Modal.close('add-schedule-modal')">Cancel</button>
              <button type="submit" class="btn btn-primary">Add Session</button>
            </div>
          </form>
        </div>
      `;
      document.body.appendChild(modal);

      const form = document.getElementById('add-schedule-form');
      form.onsubmit = (e) => {
        e.preventDefault();
        const eventId = document.getElementById('sch-event-select').value;
        const newItem = StorageService.createSchedule({
          eventId,
          time: document.getElementById('sch-time').value,
          title: document.getElementById('sch-title').value.trim(),
          speaker: document.getElementById('sch-speaker').value.trim(),
          location: document.getElementById('sch-location').value.trim(),
          description: document.getElementById('sch-desc').value.trim()
        });

        Toast.success(`Session "${newItem.title}" added to agenda`);
        Modal.close('add-schedule-modal');
        form.reset();
        this.renderTimeline();
      };
    }

    const sel = document.getElementById('sch-event-select');
    sel.innerHTML = EventService.getAll().map(e => `<option value="${e.id}">${escapeHtml(e.name)}</option>`).join('');

    Modal.open('add-schedule-modal');
  }

  static openEditModal(id) {
    const item = StorageService.getSchedule().find(s => s.id === id);
    if (!item) return;

    let modal = document.getElementById('edit-schedule-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'edit-schedule-modal';
      modal.className = 'modal-backdrop';
      modal.innerHTML = `
        <div class="modal-dialog">
          <div class="modal-header">
            <h3 class="modal-title">Edit Session</h3>
            <button class="modal-close" onclick="Modal.close('edit-schedule-modal')">&times;</button>
          </div>
          <form id="edit-schedule-form">
            <input type="hidden" id="edit-sch-id">
            <div class="modal-body">
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">Start Time <span class="required-star">*</span></label>
                  <input type="time" id="edit-sch-time" class="form-control" required>
                </div>
                <div class="form-group">
                  <label class="form-label">Location / Room</label>
                  <input type="text" id="edit-sch-location" class="form-control">
                </div>
              </div>
              <div class="form-group">
                <label class="form-label">Session Title <span class="required-star">*</span></label>
                <input type="text" id="edit-sch-title" class="form-control" required>
              </div>
              <div class="form-group">
                <label class="form-label">Speaker / Host</label>
                <input type="text" id="edit-sch-speaker" class="form-control">
              </div>
              <div class="form-group">
                <label class="form-label">Description</label>
                <textarea id="edit-sch-desc" class="form-control" rows="2"></textarea>
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" onclick="Modal.close('edit-schedule-modal')">Cancel</button>
              <button type="submit" class="btn btn-primary">Save Changes</button>
            </div>
          </form>
        </div>
      `;
      document.body.appendChild(modal);

      const form = document.getElementById('edit-schedule-form');
      form.onsubmit = (e) => {
        e.preventDefault();
        const editId = document.getElementById('edit-sch-id').value;
        StorageService.updateSchedule(editId, {
          time: document.getElementById('edit-sch-time').value,
          title: document.getElementById('edit-sch-title').value.trim(),
          speaker: document.getElementById('edit-sch-speaker').value.trim(),
          location: document.getElementById('edit-sch-location').value.trim(),
          description: document.getElementById('edit-sch-desc').value.trim()
        });

        Toast.success('Session updated');
        Modal.close('edit-schedule-modal');
        this.renderTimeline();
      };
    }

    document.getElementById('edit-sch-id').value = item.id;
    document.getElementById('edit-sch-time').value = item.time || '09:00';
    document.getElementById('edit-sch-location').value = item.location || '';
    document.getElementById('edit-sch-title').value = item.title;
    document.getElementById('edit-sch-speaker').value = item.speaker || '';
    document.getElementById('edit-sch-desc').value = item.description || '';

    Modal.open('edit-schedule-modal');
  }

  static deleteItem(id) {
    const item = StorageService.getSchedule().find(s => s.id === id);
    if (!item) return;

    Modal.confirm({
      title: 'Remove Schedule Session?',
      message: `Are you sure you want to delete "${item.title}" from the agenda?`,
      confirmText: 'Delete Session',
      confirmClass: 'btn-danger',
      onConfirm: () => {
        StorageService.deleteSchedule(id);
        Toast.error(`Deleted "${item.title}"`);
        this.renderTimeline();
      }
    });
  }
}

window.SchedulePageController = SchedulePageController;
