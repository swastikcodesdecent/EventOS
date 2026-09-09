/**
 * EventOS - Public Event Landing & Registration Controller
 * Section 32: Public Event Portal, Ticket Tier Selector, Registration Modal & Validation
 */

document.addEventListener('DOMContentLoaded', () => {
  PublicEventController.init();
});

class PublicEventController {
  static init() {
    this.eventId = getQueryParam('id');
    if (!this.eventId) {
      // Pick first published event or fallback
      const published = StorageService.getEvents().find(e => e.status === 'Published' || e.status === 'Ongoing');
      if (published) {
        this.eventId = published.id;
      } else {
        const events = StorageService.getEvents();
        this.eventId = events.length > 0 ? events[0].id : null;
      }
    }

    if (!this.eventId) {
      document.body.innerHTML = `
        <div style="min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 2rem;">
          <h2>No Public Events Available</h2>
          <p>Please publish an event from the EventOS dashboard to view its public portal.</p>
          <a href="dashboard.html" class="btn btn-primary" style="margin-top: 1rem;">Go to Dashboard</a>
        </div>
      `;
      return;
    }

    this.selectedTicketTypeId = null;
    this.loadEvent();
    this.bindEvents();
  }

  static loadEvent() {
    this.event = EventService.getWithStats(this.eventId);
    if (!this.event) {
      document.body.innerHTML = `
        <div style="min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 2rem;">
          <h2>Event Not Found</h2>
          <a href="dashboard.html" class="btn btn-primary" style="margin-top: 1rem;">Go to Dashboard</a>
        </div>
      `;
      return;
    }

    const e = this.event;
    document.title = `${e.name} - Official Event Registration`;

    // Render Hero & Details
    const heroBg = document.getElementById('pub-hero-banner');
    if (heroBg) {
      if (e.coverImage) {
        heroBg.style.backgroundImage = `url('${e.coverImage}')`;
      } else {
        heroBg.style.background = `linear-gradient(135deg, ${e.primaryColor || '#6366F1'}, ${e.secondaryColor || '#8B5CF6'})`;
      }
    }

    const setTxt = (id, text) => {
      const el = document.getElementById(id);
      if (el) el.textContent = text;
    };

    setTxt('pub-event-name', e.name);
    setTxt('pub-event-desc', e.description || 'Welcome to this premier event. Experience world-class sessions, inspiring speakers, and community networking.');
    setTxt('pub-organizer', e.organizer || 'Event Organizer');
    setTxt('pub-category', e.category);
    setTxt('pub-date', `${DateUtils.formatDate(e.startDate)} &bull; ${DateUtils.formatTime(e.startTime)}`);
    setTxt('pub-venue', e.venue || 'Virtual / Hybrid Event');
    setTxt('pub-address', e.address ? `${e.address}, ${e.city}` : e.city || 'Location details will be shared upon registration');
    
    // Capacity & Registrations meter
    const capEl = document.getElementById('pub-cap-meter');
    if (capEl) {
      capEl.textContent = `${e.registeredCount} / ${e.capacity} Registered (${e.remainingSpots} spots remaining)`;
    }

    this.renderTicketTiers();
    this.renderAgenda();
  }

  static renderTicketTiers() {
    const container = document.getElementById('pub-ticket-tiers');
    if (!container) return;

    const tiers = StorageService.getTicketTypesForEvent(this.eventId);
    const attendees = StorageService.getAttendeesForEvent(this.eventId);

    if (tiers.length === 0) {
      container.innerHTML = '<p class="text-muted">Registration is currently unavailable.</p>';
      return;
    }

    let html = '';
    tiers.forEach((t, index) => {
      const issued = attendees.filter(a => a.ticketTypeId === t.id).length;
      const isSoldOut = issued >= t.capacity;

      html += `
        <div class="card pub-ticket-card ${index === 0 ? 'selected' : ''}" data-ticket-id="${t.id}" style="border-top: 4px solid ${t.color || '#6366F1'}; cursor: pointer; transition: all 0.2s;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.5rem;">
            <div>
              <h4 style="font-size: 1.15rem; font-weight: 800;">${escapeHtml(t.name)}</h4>
              <p style="font-size: 0.84rem; color: var(--text-secondary);">${escapeHtml(t.description || 'Standard admission tier')}</p>
            </div>
            <div style="text-align: right;">
              <span style="font-size: 1.35rem; font-weight: 800; color: ${t.color || '#6366F1'};">
                ${t.price > 0 ? '$' + t.price : 'FREE'}
              </span>
              ${isSoldOut ? '<div class="badge badge-danger" style="display: block; margin-top: 4px;">SOLD OUT</div>' : ''}
            </div>
          </div>
          <div style="font-size: 0.78rem; color: var(--text-muted); display: flex; justify-content: space-between; border-top: 1px solid var(--border-subtle); padding-top: 0.6rem;">
            <span>Availability: <strong>${Math.max(0, t.capacity - issued)} spots left</strong></span>
            <span style="font-weight: 600; color: var(--primary);">Select Tier &rarr;</span>
          </div>
        </div>
      `;
    });

    container.innerHTML = html;

    // Set first available tier as active selection
    const firstTier = tiers[0];
    if (firstTier) this.selectedTicketTypeId = firstTier.id;

    // Click handler for tiers
    container.querySelectorAll('.pub-ticket-card').forEach(card => {
      card.addEventListener('click', (e) => {
        container.querySelectorAll('.pub-ticket-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        this.selectedTicketTypeId = card.dataset.ticketId;
      });
    });
  }

  static renderAgenda() {
    const container = document.getElementById('pub-schedule-timeline');
    if (!container) return;

    const schedule = StorageService.getScheduleForEvent(this.eventId);
    if (schedule.length === 0) {
      container.innerHTML = '<p class="text-muted" style="text-align: center; padding: 2rem;">Agenda timeline will be announced soon.</p>';
      return;
    }

    let html = '';
    schedule.forEach(s => {
      html += `
        <div style="display: flex; gap: 1.25rem; padding: 1rem 0; border-bottom: 1px solid var(--border-subtle);">
          <div class="mono" style="font-size: 0.95rem; font-weight: 700; color: var(--primary); width: 65px; flex-shrink: 0;">${s.time}</div>
          <div>
            <h4 style="font-size: 1rem; font-weight: 700; margin-bottom: 0.2rem;">${escapeHtml(s.title)}</h4>
            ${s.description ? `<p style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 0.35rem;">${escapeHtml(s.description)}</p>` : ''}
            <div style="font-size: 0.78rem; color: var(--text-muted); display: flex; gap: 1rem;">
              ${s.speaker ? `<span>Host: <strong>${escapeHtml(s.speaker)}</strong></span>` : ''}
              ${s.location ? `<span>Venue: ${escapeHtml(s.location)}</span>` : ''}
            </div>
          </div>
        </div>
      `;
    });

    container.innerHTML = html;
  }

  static bindEvents() {
    const triggerBtn = document.getElementById('pub-register-btn');
    if (triggerBtn) {
      triggerBtn.addEventListener('click', () => {
        this.openRegistrationModal();
      });
    }

    // Modal form submission
    const regForm = document.getElementById('pub-registration-form');
    if (regForm) {
      regForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.handleRegistrationSubmit();
      });
    }
  }

  static openRegistrationModal() {
    const modal = document.getElementById('pub-reg-modal');
    if (modal) {
      // Sync tier select inside modal
      const modalSelect = document.getElementById('pub-reg-ticket-select');
      if (modalSelect) {
        const tiers = StorageService.getTicketTypesForEvent(this.eventId);
        modalSelect.innerHTML = tiers.map(t => `<option value="${t.id}" ${t.id === this.selectedTicketTypeId ? 'selected' : ''}>${t.name} (${t.price ? '$' + t.price : 'Free'})</option>`).join('');
      }
      Modal.open('pub-reg-modal');
    }
  }

  static handleRegistrationSubmit() {
    const fullName = document.getElementById('reg-name').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const phone = document.getElementById('reg-phone').value.trim();
    const organization = document.getElementById('reg-org').value.trim();
    const city = document.getElementById('reg-city').value.trim();
    const ticketTypeId = document.getElementById('pub-reg-ticket-select').value || this.selectedTicketTypeId;

    if (!fullName || !email) {
      Toast.error('Please complete all required fields.');
      return;
    }

    const res = AttendeeService.register({
      eventId: this.eventId,
      fullName,
      email,
      phone,
      organization,
      city,
      ticketTypeId
    });

    if (res.success) {
      Modal.close('pub-reg-modal');
      Toast.success('Registration successful! Generating digital pass...');
      setTimeout(() => {
        window.location.href = `registration-success.html?ticketId=${res.ticket.id}`;
      }, 600);
    } else {
      Toast.error(res.error || 'Registration could not be completed.');
    }
  }
}

window.PublicEventController = PublicEventController;
