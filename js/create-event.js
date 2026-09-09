/**
 * EventOS - Create & Edit Event Controller
 * Section 13, 14, 15, 45: Complete Event Creation & Validation
 */

document.addEventListener('DOMContentLoaded', async () => {
  if (window.AuthService) {
    const isAuthed = await AuthService.requireAuth();
    if (!isAuthed) return;
  }
  CreateEventController.init();
});

class CreateEventController {
  static init() {
    this.editEventId = getQueryParam('edit');
    this.form = document.getElementById('event-form');
    this.submitBtn = document.getElementById('event-submit-btn');
    this.coverImageInput = document.getElementById('evt-cover-image');
    this.coverPreview = document.getElementById('cover-preview-img');

    this.bindEvents();
    if (this.editEventId) {
      this.loadExistingEvent(this.editEventId);
    } else {
      this.initDefaults();
    }
  }

  static initDefaults() {
    const today = new Date().toISOString().split('T')[0];
    const startDateInput = document.getElementById('evt-start-date');
    const endDateInput = document.getElementById('evt-end-date');
    if (startDateInput) startDateInput.value = today;
    if (endDateInput) endDateInput.value = today;

    const settings = StorageService.getSettings();
    const organizerInput = document.getElementById('evt-organizer');
    if (organizerInput && settings.organizerName) {
      organizerInput.value = settings.organizerName;
    }
  }

  static bindEvents() {
    if (!this.form) return;

    this.form.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleSubmit('Draft');
    });

    const publishBtn = document.getElementById('event-publish-btn');
    if (publishBtn) {
      publishBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.handleSubmit('Published');
      });
    }

    // Cover image preview
    if (this.coverImageInput) {
      this.coverImageInput.addEventListener('input', (e) => {
        const url = e.target.value.trim();
        if (url && this.coverPreview) {
          this.coverPreview.src = url;
          this.coverPreview.classList.add('active');
        } else if (this.coverPreview) {
          this.coverPreview.classList.remove('active');
        }
      });
    }

    // Preset cover selectors
    const presets = document.querySelectorAll('.cover-preset-btn');
    presets.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const url = e.currentTarget.dataset.url;
        if (this.coverImageInput) {
          this.coverImageInput.value = url;
          if (this.coverPreview) {
            this.coverPreview.src = url;
            this.coverPreview.classList.add('active');
          }
        }
      });
    });

    // Color pickers sync
    const priColor = document.getElementById('evt-primary-color');
    const priHex = document.getElementById('evt-primary-hex');
    if (priColor && priHex) {
      priColor.addEventListener('input', (e) => { priHex.value = e.target.value; });
      priHex.addEventListener('input', (e) => { priColor.value = e.target.value; });
    }

    const secColor = document.getElementById('evt-secondary-color');
    const secHex = document.getElementById('evt-secondary-hex');
    if (secColor && secHex) {
      secColor.addEventListener('input', (e) => { secHex.value = e.target.value; });
      secHex.addEventListener('input', (e) => { secColor.value = e.target.value; });
    }

    // Mode toggle to show/hide online URL vs venue
    const modeSelect = document.getElementById('evt-mode');
    const onlineGroup = document.getElementById('group-online-url');
    const venueGroup = document.getElementById('group-venue');
    if (modeSelect) {
      modeSelect.addEventListener('change', (e) => {
        const mode = e.target.value;
        if (onlineGroup) onlineGroup.style.display = (mode === 'Online' || mode === 'Hybrid') ? 'flex' : 'none';
        if (venueGroup) venueGroup.style.display = (mode === 'Offline' || mode === 'Hybrid') ? 'flex' : 'none';
      });
    }
  }

  static loadExistingEvent(id) {
    const event = EventService.getById(id);
    if (!event) {
      Toast.error('Event not found');
      return;
    }

    // Page title update
    const titleEl = document.getElementById('form-page-title');
    if (titleEl) titleEl.textContent = `Edit: ${event.name}`;

    // Fill form fields
    const setVal = (elemId, val) => {
      const el = document.getElementById(elemId);
      if (el && val !== undefined) el.value = val;
    };

    setVal('evt-name', event.name);
    setVal('evt-description', event.description);
    setVal('evt-category', event.category);
    setVal('evt-organizer', event.organizer);
    setVal('evt-start-date', event.startDate);
    setVal('evt-start-time', event.startTime);
    setVal('evt-end-date', event.endDate);
    setVal('evt-end-time', event.endTime);
    setVal('evt-mode', event.mode);
    setVal('evt-venue', event.venue);
    setVal('evt-address', event.address);
    setVal('evt-city', event.city);
    setVal('evt-online-url', event.onlineUrl);
    setVal('evt-capacity', event.capacity);
    setVal('evt-cover-image', event.coverImage);
    setVal('evt-primary-color', event.primaryColor || '#6366F1');
    setVal('evt-primary-hex', event.primaryColor || '#6366F1');
    setVal('evt-secondary-color', event.secondaryColor || '#8B5CF6');
    setVal('evt-secondary-hex', event.secondaryColor || '#8B5CF6');

    if (event.coverImage && this.coverPreview) {
      this.coverPreview.src = event.coverImage;
      this.coverPreview.classList.add('active');
    }

    if (this.submitBtn) {
      this.submitBtn.textContent = 'Update Event';
    }
  }

  static handleSubmit(targetStatus = 'Draft') {
    const name = document.getElementById('evt-name').value.trim();
    const category = document.getElementById('evt-category').value;
    const organizer = document.getElementById('evt-organizer').value.trim();
    const startDate = document.getElementById('evt-start-date').value;
    const startTime = document.getElementById('evt-start-time').value;
    const endDate = document.getElementById('evt-end-date').value;
    const endTime = document.getElementById('evt-end-time').value;
    const capacity = parseInt(document.getElementById('evt-capacity').value, 10);

    // Validation (Section 45)
    if (!name) {
      Toast.error('Please enter an event name', 'Validation Error');
      document.getElementById('evt-name').focus();
      return;
    }

    if (!startDate || !endDate) {
      Toast.error('Please enter start and end dates', 'Validation Error');
      return;
    }

    if (new Date(endDate) < new Date(startDate)) {
      Toast.error('End date cannot be earlier than start date', 'Validation Error');
      return;
    }

    if (isNaN(capacity) || capacity <= 0) {
      Toast.error('Capacity must be a positive number', 'Validation Error');
      return;
    }

    const eventData = {
      name,
      description: document.getElementById('evt-description').value.trim(),
      category,
      organizer: organizer || 'Event Organizer',
      startDate,
      startTime: startTime || '09:00',
      endDate,
      endTime: endTime || '18:00',
      mode: document.getElementById('evt-mode').value,
      venue: document.getElementById('evt-venue').value.trim(),
      address: document.getElementById('evt-address').value.trim(),
      city: document.getElementById('evt-city').value.trim(),
      onlineUrl: document.getElementById('evt-online-url').value.trim(),
      capacity,
      coverImage: document.getElementById('evt-cover-image').value.trim(),
      primaryColor: document.getElementById('evt-primary-color').value,
      secondaryColor: document.getElementById('evt-secondary-color').value,
      status: targetStatus
    };

    if (this.editEventId) {
      const updated = EventService.update(this.editEventId, eventData);
      Toast.success(`Event "${updated.name}" updated successfully!`);
      setTimeout(() => {
        window.location.href = `event.html?id=${updated.id}`;
      }, 500);
    } else {
      const created = EventService.create(eventData);
      Toast.success(`Event "${created.name}" created successfully!`);
      setTimeout(() => {
        window.location.href = `event.html?id=${created.id}`;
      }, 500);
    }
  }
}

window.CreateEventController = CreateEventController;
