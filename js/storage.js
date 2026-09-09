/**
 * EventOS - StorageService (Firebase Firestore Engine)
 * Strictly uses Firebase Firestore for all collections and persistence
 */

const COLLECTIONS = {
  EVENTS: 'events',
  ATTENDEES: 'attendees',
  TICKET_TYPES: 'ticket_types',
  TICKETS: 'tickets',
  STAFF: 'staff',
  GATES: 'gates',
  TASKS: 'tasks',
  SCHEDULE: 'schedule',
  SCANS: 'scans',
  ACTIVITY: 'activity',
  SETTINGS: 'settings',
  PREFERENCES: 'preferences'
};

const CURRENT_SCHEMA_VERSION = '2.0.0-firebase';

class StorageService {
  static _cache = {
    events: [],
    attendees: [],
    ticket_types: [],
    tickets: [],
    staff: [],
    gates: [],
    tasks: [],
    schedule: [],
    scans: [],
    activity: [],
    settings: {
      organizationName: 'EventOS Organization',
      organizerName: 'Organizer Admin',
      email: 'admin@eventos.local',
      phone: '+1 (555) 019-2834',
      website: 'https://eventos.local',
      address: 'Silicon Valley, CA',
      currency: 'USD ($)',
      eventCodePrefix: 'EVT-',
      registrationPrefix: 'REG-2026-',
      defaultTicketType: 'General',
      theme: 'dark'
    },
    preferences: {
      theme: 'dark',
      soundEnabled: true,
      hapticEnabled: true
    }
  };

  static _initialized = false;
  static _listenersAttached = false;

  /**
   * Initialize Firestore connections and real-time synchronization
   */
  static init() {
    if (this._initialized) return;
    this._initialized = true;

    // Load from local storage cache as initial fast state
    this._loadLocalCache();

    if (window.db) {
      this._attachFirestoreListeners();
    } else {
      // Retry once Firebase is ready
      setTimeout(() => {
        if (window.db && !this._listenersAttached) {
          this._attachFirestoreListeners();
        }
      }, 500);
    }
  }

  static _loadLocalCache() {
    try {
      const raw = localStorage.getItem('eventos_firestore_cache');
      if (raw) {
        const parsed = JSON.parse(raw);
        this._cache = { ...this._cache, ...parsed };
      }
    } catch (e) {}
  }

  static _saveLocalCache() {
    try {
      localStorage.setItem('eventos_firestore_cache', JSON.stringify(this._cache));
    } catch (e) {}
  }

  static _attachFirestoreListeners() {
    if (!window.db || this._listenersAttached) return;
    this._listenersAttached = true;

    const listCols = [
      COLLECTIONS.EVENTS,
      COLLECTIONS.ATTENDEES,
      COLLECTIONS.TICKET_TYPES,
      COLLECTIONS.TICKETS,
      COLLECTIONS.STAFF,
      COLLECTIONS.GATES,
      COLLECTIONS.TASKS,
      COLLECTIONS.SCHEDULE,
      COLLECTIONS.SCANS,
      COLLECTIONS.ACTIVITY
    ];

    listCols.forEach(colName => {
      try {
        window.db.collection(colName).onSnapshot(snapshot => {
          const items = [];
          snapshot.forEach(doc => {
            items.push({ ...doc.data(), id: doc.id });
          });
          this._cache[colName] = items;
          this._saveLocalCache();
        }, err => {
          console.warn(`Firestore listener notice for ${colName}:`, err.message);
        });
      } catch (e) {}
    });

    // Single document settings & preferences
    try {
      window.db.collection('settings').doc('global').onSnapshot(doc => {
        if (doc.exists) {
          this._cache.settings = { ...this._cache.settings, ...doc.data() };
          this._saveLocalCache();
        }
      }, () => {});

      window.db.collection('preferences').doc('global').onSnapshot(doc => {
        if (doc.exists) {
          this._cache.preferences = { ...this._cache.preferences, ...doc.data() };
          this._saveLocalCache();
        }
      }, () => {});
    } catch (e) {}
  }

  static generateId() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  // ==========================================
  // EVENTS (Firebase Collection: 'events')
  // ==========================================
  static getEvents() {
    this.init();
    return this._cache.events || [];
  }

  static getEvent(id) {
    this.init();
    return this.getEvents().find(e => e.id === id) || null;
  }

  static createEvent(data) {
    this.init();
    const id = data.id || this.generateId();
    const newEvent = {
      id,
      eventCode: data.eventCode || ('EVT-' + Math.floor(1000 + Math.random() * 9000)),
      name: data.name || 'Untitled Event',
      description: data.description || '',
      category: data.category || 'Conference',
      organizer: data.organizer || 'EventOS Organizer',
      startDate: data.startDate || new Date().toISOString().split('T')[0],
      startTime: data.startTime || '09:00',
      endDate: data.endDate || new Date().toISOString().split('T')[0],
      endTime: data.endTime || '18:00',
      mode: data.mode || 'Offline',
      venue: data.venue || 'Main Auditorium',
      address: data.address || '',
      city: data.city || '',
      onlineUrl: data.onlineUrl || '',
      capacity: parseInt(data.capacity, 10) || 100,
      registrationStart: data.registrationStart || new Date().toISOString(),
      registrationEnd: data.registrationEnd || '',
      logo: data.logo || '',
      coverImage: data.coverImage || '',
      primaryColor: data.primaryColor || '#6366F1',
      secondaryColor: data.secondaryColor || '#8B5CF6',
      status: data.status || 'Draft',
      createdAt: data.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Update in-memory cache
    this._cache.events = [newEvent, ...this._cache.events.filter(e => e.id !== id)];
    this._saveLocalCache();

    // Persist to Firebase Firestore
    if (window.db) {
      window.db.collection(COLLECTIONS.EVENTS).doc(id).set(newEvent).catch(err => {
        console.warn('Firestore createEvent sync notice:', err.message);
      });
    }

    return newEvent;
  }

  static updateEvent(id, updates) {
    this.init();
    const index = this._cache.events.findIndex(e => e.id === id);
    if (index === -1) return null;

    const updated = {
      ...this._cache.events[index],
      ...updates,
      updatedAt: new Date().toISOString()
    };

    this._cache.events[index] = updated;
    this._saveLocalCache();

    if (window.db) {
      window.db.collection(COLLECTIONS.EVENTS).doc(id).set(updated, { merge: true }).catch(err => {
        console.warn('Firestore updateEvent sync notice:', err.message);
      });
    }

    return updated;
  }

  static deleteEvent(id) {
    this.init();
    this._cache.events = this._cache.events.filter(e => e.id !== id);
    this._cache.attendees = this._cache.attendees.filter(a => a.eventId !== id);
    this._cache.tickets = this._cache.tickets.filter(t => t.eventId !== id);
    this._cache.ticket_types = this._cache.ticket_types.filter(tt => tt.eventId !== id);
    this._cache.staff = this._cache.staff.filter(s => s.eventId !== id && s.eventId !== 'all');
    this._cache.gates = this._cache.gates.filter(g => g.eventId !== id);
    this._cache.tasks = this._cache.tasks.filter(t => t.eventId !== id);
    this._cache.schedule = this._cache.schedule.filter(s => s.eventId !== id);
    this._cache.scans = this._cache.scans.filter(s => s.eventId !== id);
    this._cache.activity = this._cache.activity.filter(a => a.eventId !== id);

    this._saveLocalCache();

    if (window.db) {
      window.db.collection(COLLECTIONS.EVENTS).doc(id).delete().catch(() => {});
    }

    return true;
  }

  // ==========================================
  // TICKET TYPES (Firebase Collection: 'ticket_types')
  // ==========================================
  static getTicketTypes() {
    this.init();
    return this._cache.ticket_types || [];
  }

  static getTicketTypesForEvent(eventId) {
    return this.getTicketTypes().filter(t => t.eventId === eventId);
  }

  static createTicketType(data) {
    this.init();
    const id = data.id || this.generateId();
    const newType = {
      id,
      eventId: data.eventId,
      name: data.name || 'General',
      description: data.description || '',
      price: parseFloat(data.price) || 0,
      capacity: parseInt(data.capacity, 10) || 50,
      color: data.color || '#6366F1'
    };

    this._cache.ticket_types.push(newType);
    this._saveLocalCache();

    if (window.db) {
      window.db.collection(COLLECTIONS.TICKET_TYPES).doc(id).set(newType).catch(() => {});
    }

    return newType;
  }

  static updateTicketType(id, updates) {
    this.init();
    const index = this._cache.ticket_types.findIndex(t => t.id === id);
    if (index === -1) return null;

    this._cache.ticket_types[index] = { ...this._cache.ticket_types[index], ...updates };
    this._saveLocalCache();

    if (window.db) {
      window.db.collection(COLLECTIONS.TICKET_TYPES).doc(id).set(updates, { merge: true }).catch(() => {});
    }

    return this._cache.ticket_types[index];
  }

  static deleteTicketType(id) {
    this.init();
    this._cache.ticket_types = this._cache.ticket_types.filter(t => t.id !== id);
    this._saveLocalCache();

    if (window.db) {
      window.db.collection(COLLECTIONS.TICKET_TYPES).doc(id).delete().catch(() => {});
    }

    return true;
  }

  // ==========================================
  // ATTENDEES (Firebase Collection: 'attendees')
  // ==========================================
  static getAttendees() {
    this.init();
    return this._cache.attendees || [];
  }

  static getAttendee(id) {
    return this.getAttendees().find(a => a.id === id) || null;
  }

  static getAttendeesForEvent(eventId) {
    return this.getAttendees().filter(a => a.eventId === eventId);
  }

  static createAttendee(data) {
    this.init();
    const id = data.id || this.generateId();
    const attendees = this.getAttendees();
    const newAttendee = {
      id,
      eventId: data.eventId,
      registrationId: data.registrationId || ('REG-2026-' + String(attendees.length + 1).padStart(4, '0')),
      fullName: data.fullName || 'Anonymous Attendee',
      email: data.email || '',
      phone: data.phone || '',
      organization: data.organization || '',
      designation: data.designation || '',
      city: data.city || '',
      ticketTypeId: data.ticketTypeId || '',
      customFields: data.customFields || {},
      registeredAt: data.registeredAt || new Date().toISOString(),
      status: data.status || 'Confirmed',
      checkedIn: data.checkedIn === true,
      checkedInAt: data.checkedInAt || null
    };

    this._cache.attendees.unshift(newAttendee);
    this._saveLocalCache();

    if (window.db) {
      window.db.collection(COLLECTIONS.ATTENDEES).doc(id).set(newAttendee).catch(() => {});
    }

    return newAttendee;
  }

  static updateAttendee(id, updates) {
    this.init();
    const index = this._cache.attendees.findIndex(a => a.id === id);
    if (index === -1) return null;

    this._cache.attendees[index] = { ...this._cache.attendees[index], ...updates };
    this._saveLocalCache();

    if (window.db) {
      window.db.collection(COLLECTIONS.ATTENDEES).doc(id).set(updates, { merge: true }).catch(() => {});
    }

    return this._cache.attendees[index];
  }

  static deleteAttendee(id) {
    this.init();
    this._cache.attendees = this._cache.attendees.filter(a => a.id !== id);
    this._cache.tickets = this._cache.tickets.filter(t => t.attendeeId !== id);
    this._saveLocalCache();

    if (window.db) {
      window.db.collection(COLLECTIONS.ATTENDEES).doc(id).delete().catch(() => {});
    }

    return true;
  }

  // ==========================================
  // TICKETS (Firebase Collection: 'tickets')
  // ==========================================
  static getTickets() {
    this.init();
    return this._cache.tickets || [];
  }

  static getTicket(id) {
    return this.getTickets().find(t => t.id === id) || null;
  }

  static getTicketByToken(token) {
    return this.getTickets().find(t => t.qrToken === token) || null;
  }

  static getTicketByAttendee(attendeeId) {
    return this.getTickets().find(t => t.attendeeId === attendeeId) || null;
  }

  static getTicketsForEvent(eventId) {
    return this.getTickets().filter(t => t.eventId === eventId);
  }

  static createTicket(data) {
    this.init();
    const id = data.id || this.generateId();
    const tickets = this.getTickets();
    const newTicket = {
      id,
      ticketCode: data.ticketCode || ('TKT-2026-' + String(tickets.length + 1).padStart(4, '0')),
      eventId: data.eventId,
      attendeeId: data.attendeeId,
      ticketTypeId: data.ticketTypeId,
      qrToken: data.qrToken || this.generateId().replace(/-/g, '').substring(0, 16).toUpperCase(),
      status: data.status || 'Valid',
      checkedIn: data.checkedIn === true,
      checkedInAt: data.checkedInAt || null,
      checkedInGate: data.checkedInGate || null,
      createdAt: data.createdAt || new Date().toISOString()
    };

    this._cache.tickets.unshift(newTicket);
    this._saveLocalCache();

    if (window.db) {
      window.db.collection(COLLECTIONS.TICKETS).doc(id).set(newTicket).catch(() => {});
    }

    return newTicket;
  }

  static updateTicket(id, updates) {
    this.init();
    const index = this._cache.tickets.findIndex(t => t.id === id);
    if (index === -1) return null;

    this._cache.tickets[index] = { ...this._cache.tickets[index], ...updates };
    this._saveLocalCache();

    if (window.db) {
      window.db.collection(COLLECTIONS.TICKETS).doc(id).set(updates, { merge: true }).catch(() => {});
    }

    return this._cache.tickets[index];
  }

  // ==========================================
  // STAFF (Firebase Collection: 'staff')
  // ==========================================
  static getStaff() {
    this.init();
    return this._cache.staff || [];
  }

  static getStaffForEvent(eventId) {
    return this.getStaff().filter(s => s.eventId === eventId || s.eventId === 'all');
  }

  static createStaff(data) {
    this.init();
    const id = data.id || this.generateId();
    const newStaff = {
      id,
      eventId: data.eventId || 'all',
      name: data.name || '',
      email: data.email || '',
      phone: data.phone || '',
      role: data.role || 'Volunteer',
      gate: data.gate || 'Main Gate',
      status: data.status || 'Active',
      createdAt: new Date().toISOString()
    };

    this._cache.staff.unshift(newStaff);
    this._saveLocalCache();

    if (window.db) {
      window.db.collection(COLLECTIONS.STAFF).doc(id).set(newStaff).catch(() => {});
    }

    return newStaff;
  }

  static updateStaff(id, updates) {
    this.init();
    const index = this._cache.staff.findIndex(s => s.id === id);
    if (index === -1) return null;

    this._cache.staff[index] = { ...this._cache.staff[index], ...updates };
    this._saveLocalCache();

    if (window.db) {
      window.db.collection(COLLECTIONS.STAFF).doc(id).set(updates, { merge: true }).catch(() => {});
    }

    return this._cache.staff[index];
  }

  static deleteStaff(id) {
    this.init();
    this._cache.staff = this._cache.staff.filter(s => s.id !== id);
    this._saveLocalCache();

    if (window.db) {
      window.db.collection(COLLECTIONS.STAFF).doc(id).delete().catch(() => {});
    }

    return true;
  }

  // ==========================================
  // GATES (Firebase Collection: 'gates')
  // ==========================================
  static getGates() {
    this.init();
    return this._cache.gates || [];
  }

  static getGatesForEvent(eventId) {
    return this.getGates().filter(g => g.eventId === eventId);
  }

  static createGate(data) {
    this.init();
    const id = data.id || this.generateId();
    const newGate = {
      id,
      eventId: data.eventId,
      name: data.name || 'Main Gate',
      description: data.description || '',
      assignedStaff: data.assignedStaff || '',
      status: data.status || 'Active'
    };

    this._cache.gates.push(newGate);
    this._saveLocalCache();

    if (window.db) {
      window.db.collection(COLLECTIONS.GATES).doc(id).set(newGate).catch(() => {});
    }

    return newGate;
  }

  static updateGate(id, updates) {
    this.init();
    const index = this._cache.gates.findIndex(g => g.id === id);
    if (index === -1) return null;

    this._cache.gates[index] = { ...this._cache.gates[index], ...updates };
    this._saveLocalCache();

    if (window.db) {
      window.db.collection(COLLECTIONS.GATES).doc(id).set(updates, { merge: true }).catch(() => {});
    }

    return this._cache.gates[index];
  }

  static deleteGate(id) {
    this.init();
    this._cache.gates = this._cache.gates.filter(g => g.id !== id);
    this._saveLocalCache();

    if (window.db) {
      window.db.collection(COLLECTIONS.GATES).doc(id).delete().catch(() => {});
    }

    return true;
  }

  // ==========================================
  // TASKS (Firebase Collection: 'tasks')
  // ==========================================
  static getTasks() {
    this.init();
    return this._cache.tasks || [];
  }

  static getTasksForEvent(eventId) {
    return this.getTasks().filter(t => t.eventId === eventId);
  }

  static createTask(data) {
    this.init();
    const id = data.id || this.generateId();
    const newTask = {
      id,
      eventId: data.eventId,
      title: data.title || 'Untitled Task',
      description: data.description || '',
      assignedTo: data.assignedTo || 'Unassigned',
      dueDate: data.dueDate || new Date().toISOString().split('T')[0],
      priority: data.priority || 'Medium',
      status: data.status || 'To Do',
      createdAt: new Date().toISOString()
    };

    this._cache.tasks.push(newTask);
    this._saveLocalCache();

    if (window.db) {
      window.db.collection(COLLECTIONS.TASKS).doc(id).set(newTask).catch(() => {});
    }

    return newTask;
  }

  static updateTask(id, updates) {
    this.init();
    const index = this._cache.tasks.findIndex(t => t.id === id);
    if (index === -1) return null;

    this._cache.tasks[index] = { ...this._cache.tasks[index], ...updates };
    this._saveLocalCache();

    if (window.db) {
      window.db.collection(COLLECTIONS.TASKS).doc(id).set(updates, { merge: true }).catch(() => {});
    }

    return this._cache.tasks[index];
  }

  static deleteTask(id) {
    this.init();
    this._cache.tasks = this._cache.tasks.filter(t => t.id !== id);
    this._saveLocalCache();

    if (window.db) {
      window.db.collection(COLLECTIONS.TASKS).doc(id).delete().catch(() => {});
    }

    return true;
  }

  // ==========================================
  // SCHEDULE (Firebase Collection: 'schedule')
  // ==========================================
  static getSchedule() {
    this.init();
    return this._cache.schedule || [];
  }

  static getScheduleForEvent(eventId) {
    const list = this.getSchedule().filter(s => s.eventId === eventId);
    return list.sort((a, b) => (a.time || '').localeCompare(b.time || ''));
  }

  static createSchedule(data) {
    this.init();
    const id = data.id || this.generateId();
    const newItem = {
      id,
      eventId: data.eventId,
      time: data.time || '09:00',
      title: data.title || '',
      description: data.description || '',
      speaker: data.speaker || '',
      location: data.location || ''
    };

    this._cache.schedule.push(newItem);
    this._saveLocalCache();

    if (window.db) {
      window.db.collection(COLLECTIONS.SCHEDULE).doc(id).set(newItem).catch(() => {});
    }

    return newItem;
  }

  static updateSchedule(id, updates) {
    this.init();
    const index = this._cache.schedule.findIndex(s => s.id === id);
    if (index === -1) return null;

    this._cache.schedule[index] = { ...this._cache.schedule[index], ...updates };
    this._saveLocalCache();

    if (window.db) {
      window.db.collection(COLLECTIONS.SCHEDULE).doc(id).set(updates, { merge: true }).catch(() => {});
    }

    return this._cache.schedule[index];
  }

  static deleteSchedule(id) {
    this.init();
    this._cache.schedule = this._cache.schedule.filter(s => s.id !== id);
    this._saveLocalCache();

    if (window.db) {
      window.db.collection(COLLECTIONS.SCHEDULE).doc(id).delete().catch(() => {});
    }

    return true;
  }

  // ==========================================
  // SCANS (Firebase Collection: 'scans')
  // ==========================================
  static getScans() {
    this.init();
    return this._cache.scans || [];
  }

  static getScansForEvent(eventId) {
    return this.getScans().filter(s => s.eventId === eventId);
  }

  static createScan(data) {
    this.init();
    const id = data.id || this.generateId();
    const newScan = {
      id,
      eventId: data.eventId,
      ticketId: data.ticketId || '',
      attendeeId: data.attendeeId || '',
      qrToken: data.qrToken || '',
      gate: data.gate || 'Main Gate',
      status: data.status || 'Success',
      timestamp: data.timestamp || new Date().toISOString()
    };

    this._cache.scans.unshift(newScan);
    this._saveLocalCache();

    if (window.db) {
      window.db.collection(COLLECTIONS.SCANS).doc(id).set(newScan).catch(() => {});
    }

    return newScan;
  }

  // ==========================================
  // ACTIVITY (Firebase Collection: 'activity')
  // ==========================================
  static getActivity() {
    this.init();
    return this._cache.activity || [];
  }

  static getActivityForEvent(eventId) {
    return this.getActivity().filter(a => a.eventId === eventId || a.eventId === 'all');
  }

  static createActivity(data) {
    this.init();
    const id = data.id || this.generateId();
    const newActivity = {
      id,
      eventId: data.eventId || 'all',
      type: data.type || 'info',
      message: data.message || '',
      user: data.user || 'Admin',
      timestamp: data.timestamp || new Date().toISOString()
    };

    this._cache.activity.unshift(newActivity);
    if (this._cache.activity.length > 200) this._cache.activity.length = 200;
    this._saveLocalCache();

    if (window.db) {
      window.db.collection(COLLECTIONS.ACTIVITY).doc(id).set(newActivity).catch(() => {});
    }

    return newActivity;
  }

  // ==========================================
  // SETTINGS & PREFERENCES (Firebase Document)
  // ==========================================
  static getSettings() {
    this.init();
    return this._cache.settings;
  }

  static saveSettings(updates) {
    this.init();
    this._cache.settings = { ...this._cache.settings, ...updates };
    this._saveLocalCache();

    if (window.db) {
      window.db.collection(COLLECTIONS.SETTINGS).doc('global').set(this._cache.settings, { merge: true }).catch(() => {});
    }

    return this._cache.settings;
  }

  static getPreferences() {
    this.init();
    return this._cache.preferences;
  }

  static savePreferences(updates) {
    this.init();
    this._cache.preferences = { ...this._cache.preferences, ...updates };
    this._saveLocalCache();

    if (window.db) {
      window.db.collection(COLLECTIONS.PREFERENCES).doc('global').set(this._cache.preferences, { merge: true }).catch(() => {});
    }

    return this._cache.preferences;
  }

  // ==========================================
  // BACKUP & RESTORE
  // ==========================================
  static exportBackup() {
    this.init();
    const backupData = {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      source: 'Firebase Firestore',
      exportedAt: new Date().toISOString(),
      events: this.getEvents(),
      attendees: this.getAttendees(),
      ticketTypes: this.getTicketTypes(),
      tickets: this.getTickets(),
      staff: this.getStaff(),
      gates: this.getGates(),
      tasks: this.getTasks(),
      schedule: this.getSchedule(),
      scans: this.getScans(),
      activity: this.getActivity(),
      settings: this.getSettings(),
      preferences: this.getPreferences()
    };

    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const dateStr = new Date().toISOString().split('T')[0];
    const a = document.createElement('a');
    a.href = url;
    a.download = `eventos-firebase-backup-${dateStr}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return true;
  }

  static importBackup(jsonString) {
    try {
      const data = JSON.parse(jsonString);

      const required = ['events', 'attendees', 'tickets', 'settings'];
      for (const req of required) {
        if (!data[req]) throw new Error(`Missing ${req} collection`);
      }

      this._cache = {
        events: data.events || [],
        attendees: data.attendees || [],
        ticket_types: data.ticketTypes || data.ticket_types || [],
        tickets: data.tickets || [],
        staff: data.staff || [],
        gates: data.gates || [],
        tasks: data.tasks || [],
        schedule: data.schedule || [],
        scans: data.scans || [],
        activity: data.activity || [],
        settings: data.settings || this._cache.settings,
        preferences: data.preferences || this._cache.preferences
      };

      this._saveLocalCache();

      // Sync batch to Firestore if db is active
      if (window.db) {
        const batch = window.db.batch();
        this._cache.events.forEach(e => batch.set(window.db.collection('events').doc(e.id), e));
        this._cache.attendees.forEach(a => batch.set(window.db.collection('attendees').doc(a.id), a));
        this._cache.tickets.forEach(t => batch.set(window.db.collection('tickets').doc(t.id), t));
        batch.commit().catch(() => {});
      }

      this.createActivity({
        type: 'settings',
        message: `Database backup imported to Firebase Firestore (${this._cache.events.length} events)`
      });

      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  static clearAllData() {
    this._cache = {
      events: [],
      attendees: [],
      ticket_types: [],
      tickets: [],
      staff: [],
      gates: [],
      tasks: [],
      schedule: [],
      scans: [],
      activity: [],
      settings: this._cache.settings,
      preferences: this._cache.preferences
    };
    this._saveLocalCache();
    return true;
  }
}

// Global initialization
window.StorageService = StorageService;
window.COLLECTIONS = COLLECTIONS;
StorageService.init();
