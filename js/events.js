/**
 * EventOS - Events Listing Controller
 * Section 12, 34, 35, 36: Filters, Sorting, Actions (View, Edit, Duplicate, Publish, Delete)
 */

document.addEventListener('DOMContentLoaded', async () => {
  if (window.AuthService) {
    const isAuthed = await AuthService.requireAuth();
    if (!isAuthed) return;
  }
  EventsPageController.init();
});

class EventsPageController {
  static init() {
    this.currentStatusFilter = 'all';
    this.currentSort = 'newest';
    this.searchQuery = '';

    this.bindEvents();
    this.renderEvents();
  }

  static bindEvents() {
    // Filter tabs
    const tabs = document.querySelectorAll('.filter-tab');
    tabs.forEach(tab => {
      tab.addEventListener('click', (e) => {
        tabs.forEach(t => t.classList.remove('active'));
        e.currentTarget.classList.add('active');
        this.currentStatusFilter = e.currentTarget.dataset.status || 'all';
        this.renderEvents();
      });
    });

    // Search input
    const searchInput = document.getElementById('events-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value.trim();
        this.renderEvents();
      });
    }

    // Sort dropdown
    const sortSelect = document.getElementById('events-sort-select');
    if (sortSelect) {
      sortSelect.addEventListener('change', (e) => {
        this.currentSort = e.target.value;
        this.renderEvents();
      });
    }
  }

  static renderEvents() {
    const container = document.getElementById('events-grid-container');
    if (!container) return;

    const events = EventService.getAll(
      { status: this.currentStatusFilter, search: this.searchQuery },
      this.currentSort
    );

    if (events.length === 0) {
      container.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1; padding: 4rem 1.5rem;">
          <div class="empty-state-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          </div>
          <h3>No events found</h3>
          <p>There are no events matching your selected filters. Create a new event or clear your search.</p>
          <a href="create-event.html" class="btn btn-primary" style="margin-top: 1rem;">+ Create Event</a>
        </div>
      `;
      return;
    }

    let html = '';
    events.forEach(e => {
      const stats = EventService.getWithStats(e.id);
      const regCount = stats ? stats.registeredCount : 0;
      const chkCount = stats ? stats.checkedInCount : 0;
      const capacity = e.capacity || 100;
      const fillPct = Math.min(100, Math.round((regCount / capacity) * 100));

      const coverStyle = e.coverImage
        ? `background-image: url('${e.coverImage}')`
        : `background: linear-gradient(135deg, ${e.primaryColor || '#6366F1'} 0%, ${e.secondaryColor || '#8B5CF6'} 100%)`;

      html += `
        <div class="event-card">
          <div class="event-card-cover" style="${coverStyle}">
            <div class="event-card-cover-overlay"></div>
            <span class="event-category-tag">${escapeHtml(e.category)}</span>
            <div class="event-badge-top">
              <span class="badge badge-${e.status.toLowerCase()}">${e.status}</span>
            </div>
          </div>
          <div class="event-card-body">
            <h3 class="event-card-title">
              <a href="event.html?id=${e.id}">${escapeHtml(e.name)}</a>
            </h3>
            <div class="event-card-meta">
              <div class="meta-row">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                <span>${DateUtils.formatDate(e.startDate)} &bull; ${DateUtils.formatTime(e.startTime)}</span>
              </div>
              <div class="meta-row">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                <span>${escapeHtml(e.venue || 'Virtual/Online')}</span>
              </div>
            </div>
            
            <div class="event-card-stats">
              <div class="stats-labels">
                <span>Registrations: <strong>${regCount} / ${capacity}</strong></span>
                <span>${fillPct}%</span>
              </div>
              <div class="progress-bar-container">
                <div class="progress-bar-fill" style="width: ${fillPct}%;"></div>
              </div>
              <div style="font-size: 0.76rem; color: var(--text-muted); margin-top: 0.35rem; display: flex; justify-content: space-between;">
                <span>Checked In: <strong class="text-success">${chkCount}</strong></span>
                <span>Code: <code class="mono">${e.eventCode}</code></span>
              </div>
            </div>
          </div>

          <div class="event-card-actions">
            <div style="display: flex; gap: 0.4rem;">
              <a href="event.html?id=${e.id}" class="btn btn-secondary btn-sm" title="Open Workspace">
                Manage
              </a>
              <a href="public-event.html?id=${e.id}" target="_blank" class="btn btn-ghost btn-sm" title="Public Event Landing Page">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
              </a>
            </div>

            <div style="display: flex; align-items: center; gap: 0.25rem;">
              ${e.status === 'Draft' ? `
                <button class="btn btn-success btn-sm" onclick="EventsPageController.publishEvent('${e.id}')" title="Publish Event">
                  Publish
                </button>
              ` : ''}

              <button class="btn btn-ghost btn-sm btn-icon" onclick="EventsPageController.duplicateEvent('${e.id}')" title="Duplicate Event">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
              </button>

              <a href="create-event.html?edit=${e.id}" class="btn btn-ghost btn-sm btn-icon" title="Edit Event Details">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              </a>

              <button class="btn btn-ghost btn-sm btn-icon text-danger" onclick="EventsPageController.deleteEvent('${e.id}')" title="Delete Event">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
              </button>
            </div>
          </div>
        </div>
      `;
    });

    container.innerHTML = html;
  }

  static publishEvent(id) {
    const updated = EventService.publish(id);
    if (updated) {
      Toast.success(`"${updated.name}" is now live and published!`);
      this.renderEvents();
    }
  }

  static duplicateEvent(id) {
    const cloned = EventService.duplicate(id);
    if (cloned) {
      Toast.success(`Event duplicated as "${cloned.name}"`);
      this.renderEvents();
    }
  }

  static deleteEvent(id) {
    const event = EventService.getById(id);
    if (!event) return;

    Modal.confirm({
      title: 'Delete Event?',
      message: `Are you sure you want to permanently delete "${event.name}"? This will remove all associated attendees, tickets, gates, tasks, and scans. This action cannot be undone.`,
      confirmText: 'Delete Permanently',
      confirmClass: 'btn-danger',
      onConfirm: () => {
        EventService.delete(id);
        Toast.error(`Deleted event "${event.name}"`);
        this.renderEvents();
      }
    });
  }
}

window.EventsPageController = EventsPageController;
