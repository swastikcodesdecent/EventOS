/**
 * EventOS - Domain Services Layer
 * Business logic decoupling UI from StorageService
 * Sections 5, 11, 19, 25, 30, 31, 36, 57, 58, 59, 60
 */

// ==========================================
// 1. EVENT SERVICE
// ==========================================
class EventService {
  static getAll(filters = {}, sortBy = 'newest') {
    let events = StorageService.getEvents();

    // Filter by status
    if (filters.status && filters.status !== 'all') {
      events = events.filter(e => e.status.toLowerCase() === filters.status.toLowerCase());
    }

    // Filter by category
    if (filters.category && filters.category !== 'all') {
      events = events.filter(e => e.category.toLowerCase() === filters.category.toLowerCase());
    }

    // Filter by search query
    if (filters.search) {
      const q = filters.search.toLowerCase();
      events = events.filter(e =>
        e.name.toLowerCase().includes(q) ||
        (e.venue && e.venue.toLowerCase().includes(q)) ||
        (e.category && e.category.toLowerCase().includes(q)) ||
        (e.city && e.city.toLowerCase().includes(q))
      );
    }

    // Sorting
    events.sort((a, b) => {
      if (sortBy === 'newest') return new Date(b.createdAt) - new Date(a.createdAt);
      if (sortBy === 'oldest') return new Date(a.createdAt) - new Date(b.createdAt);
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'date') return new Date(a.startDate) - new Date(b.startDate);
      if (sortBy === 'capacity') return b.capacity - a.capacity;
      return 0;
    });

    return events;
  }

  static getById(id) {
    return StorageService.getEvent(id);
  }

  static getWithStats(id) {
    const event = StorageService.getEvent(id);
    if (!event) return null;

    const attendees = StorageService.getAttendeesForEvent(id);
    const confirmedAttendees = attendees.filter(a => a.status === 'Confirmed');
    const checkedInCount = confirmedAttendees.filter(a => a.checkedIn).length;
    const capacity = event.capacity || 100;
    const registeredCount = confirmedAttendees.length;

    const attendanceRate = registeredCount > 0 ? ((checkedInCount / registeredCount) * 100).toFixed(1) : 0;
    const capacityUtilization = capacity > 0 ? ((registeredCount / capacity) * 100).toFixed(1) : 0;

    return {
      ...event,
      registeredCount,
      checkedInCount,
      attendanceRate: parseFloat(attendanceRate),
      capacityUtilization: parseFloat(capacityUtilization),
      remainingSpots: Math.max(0, capacity - registeredCount)
    };
  }

  static getUpcoming(limit = 5) {
    const today = new Date().toISOString().split('T')[0];
    const events = StorageService.getEvents().filter(e => e.status !== 'Cancelled' && e.status !== 'Completed');
    events.sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
    return events.slice(0, limit);
  }

  static create(data) {
    const settings = StorageService.getSettings();
    const eventCode = (settings.eventCodePrefix || 'EVT-') + Math.floor(1000 + Math.random() * 9000);
    const newEvent = StorageService.createEvent({ ...data, eventCode });

    // Automatically create a default ticket type
    StorageService.createTicketType({
      eventId: newEvent.id,
      name: 'General Admission',
      description: 'Standard event access ticket',
      price: 0,
      capacity: newEvent.capacity || 100,
      color: newEvent.primaryColor || '#6366F1'
    });

    // Automatically create Main Gate
    StorageService.createGate({
      eventId: newEvent.id,
      name: 'Main Gate',
      description: 'Primary event entrance',
      assignedStaff: 'Registration Desk'
    });

    StorageService.createActivity({
      eventId: newEvent.id,
      type: 'event',
      message: `Event "${newEvent.name}" created (${newEvent.eventCode})`
    });

    return newEvent;
  }

  static update(id, updates) {
    const updated = StorageService.updateEvent(id, updates);
    if (updated) {
      StorageService.createActivity({
        eventId: id,
        type: 'event',
        message: `Event details updated for "${updated.name}"`
      });
    }
    return updated;
  }

  static publish(id) {
    const updated = StorageService.updateEvent(id, { status: 'Published' });
    if (updated) {
      StorageService.createActivity({
        eventId: id,
        type: 'event',
        message: `Event "${updated.name}" is now Published`
      });
    }
    return updated;
  }

  static duplicate(id) {
    const original = StorageService.getEvent(id);
    if (!original) return null;

    const settings = StorageService.getSettings();
    const newEventCode = (settings.eventCodePrefix || 'EVT-') + Math.floor(1000 + Math.random() * 9000);

    const clonedEvent = StorageService.createEvent({
      ...original,
      id: StorageService.generateId(),
      eventCode: newEventCode,
      name: `${original.name} (Copy)`,
      status: 'Draft',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    // Clone ticket types for the new event
    const oldTicketTypes = StorageService.getTicketTypesForEvent(id);
    oldTicketTypes.forEach(tt => {
      StorageService.createTicketType({
        ...tt,
        id: StorageService.generateId(),
        eventId: clonedEvent.id
      });
    });

    // Clone gates
    const oldGates = StorageService.getGatesForEvent(id);
    oldGates.forEach(g => {
      StorageService.createGate({
        ...g,
        id: StorageService.generateId(),
        eventId: clonedEvent.id
      });
    });

    StorageService.createActivity({
      eventId: clonedEvent.id,
      type: 'event',
      message: `Duplicated event from "${original.name}" to "${clonedEvent.name}"`
    });

    return clonedEvent;
  }

  static delete(id) {
    const event = StorageService.getEvent(id);
    const eventName = event ? event.name : id;
    const res = StorageService.deleteEvent(id);
    if (res) {
      StorageService.createActivity({
        eventId: 'all',
        type: 'event',
        message: `Deleted event "${eventName}"`
      });
    }
    return res;
  }
}

// ==========================================
// 2. ATTENDEE & REGISTRATION SERVICE
// ==========================================
class AttendeeService {
  static getAll(eventId = null, filters = {}) {
    let list = eventId ? StorageService.getAttendeesForEvent(eventId) : StorageService.getAttendees();

    if (filters.status && filters.status !== 'all') {
      if (filters.status === 'checkedIn') {
        list = list.filter(a => a.checkedIn);
      } else if (filters.status === 'notCheckedIn') {
        list = list.filter(a => !a.checkedIn && a.status === 'Confirmed');
      } else {
        list = list.filter(a => a.status.toLowerCase() === filters.status.toLowerCase());
      }
    }

    if (filters.search) {
      const q = filters.search.toLowerCase();
      list = list.filter(a =>
        a.fullName.toLowerCase().includes(q) ||
        a.email.toLowerCase().includes(q) ||
        (a.phone && a.phone.toLowerCase().includes(q)) ||
        (a.registrationId && a.registrationId.toLowerCase().includes(q)) ||
        (a.organization && a.organization.toLowerCase().includes(q))
      );
    }

    return list;
  }

  /**
   * Complete Registration Pipeline (Section 19)
   */
  static register(data) {
    const event = StorageService.getEvent(data.eventId);
    if (!event) {
      return { success: false, error: 'Event not found' };
    }

    // Check event status
    if (event.status !== 'Published' && event.status !== 'Ongoing') {
      return { success: false, error: 'Event is currently not accepting registrations.' };
    }

    // Check registration window
    const now = new Date();
    if (event.registrationStart && new Date(event.registrationStart) > now) {
      return { success: false, error: 'Registration for this event has not opened yet.' };
    }
    if (event.registrationEnd && new Date(event.registrationEnd) < now) {
      return { success: false, error: 'Registration for this event has ended.' };
    }

    // Check capacity
    const currentAttendees = StorageService.getAttendeesForEvent(data.eventId).filter(a => a.status === 'Confirmed');
    if (event.capacity && currentAttendees.length >= event.capacity) {
      return { success: false, error: 'Event has reached maximum capacity.' };
    }

    // Check duplicate email for same event
    const existing = currentAttendees.find(a => a.email.toLowerCase() === data.email.trim().toLowerCase());
    if (existing) {
      return { success: false, error: 'An attendee with this email is already registered.' };
    }

    // Generate formatted registration ID (Section 20)
    const settings = StorageService.getSettings();
    const prefix = settings.registrationPrefix || 'REG-2026-';
    const totalAttendees = StorageService.getAttendees().length + 1;
    const registrationId = `${prefix}${String(totalAttendees).padStart(4, '0')}`;

    // Create attendee
    const attendee = StorageService.createAttendee({
      ...data,
      registrationId,
      fullName: data.fullName.trim(),
      email: data.email.trim()
    });

    // Create unique random token for QR code (Section 23)
    const qrToken = StorageService.generateId().replace(/-/g, '').substring(0, 16).toUpperCase();

    // Create ticket
    const totalTickets = StorageService.getTickets().length + 1;
    const ticketCode = `TKT-2026-${String(totalTickets).padStart(4, '0')}`;

    const ticket = StorageService.createTicket({
      eventId: event.id,
      attendeeId: attendee.id,
      ticketTypeId: data.ticketTypeId,
      ticketCode,
      qrToken,
      status: 'Valid'
    });

    StorageService.createActivity({
      eventId: event.id,
      type: 'register',
      message: `${attendee.fullName} registered for ${event.name} (${registrationId})`
    });

    return { success: true, attendee, ticket, event };
  }

  static toggleCheckIn(attendeeId, gate = 'Main Gate') {
    const attendee = StorageService.getAttendee(attendeeId);
    if (!attendee) return null;

    const ticket = StorageService.getTicketByAttendee(attendeeId);
    const newCheckedIn = !attendee.checkedIn;
    const timestamp = newCheckedIn ? new Date().toISOString() : null;

    const updatedAttendee = StorageService.updateAttendee(attendeeId, {
      checkedIn: newCheckedIn,
      checkedInAt: timestamp
    });

    if (ticket) {
      StorageService.updateTicket(ticket.id, {
        checkedIn: newCheckedIn,
        checkedInAt: timestamp,
        checkedInGate: newCheckedIn ? gate : null,
        status: newCheckedIn ? 'Used' : 'Valid'
      });
    }

    if (newCheckedIn) {
      StorageService.createScan({
        eventId: attendee.eventId,
        ticketId: ticket ? ticket.id : '',
        attendeeId: attendee.id,
        qrToken: ticket ? ticket.qrToken : '',
        gate,
        status: 'Success',
        timestamp
      });

      StorageService.createActivity({
        eventId: attendee.eventId,
        type: 'scan',
        message: `${attendee.fullName} checked in manually at ${gate}`
      });
    }

    return updatedAttendee;
  }

  static cancel(id) {
    const attendee = StorageService.updateAttendee(id, { status: 'Cancelled' });
    const ticket = StorageService.getTicketByAttendee(id);
    if (ticket) {
      StorageService.updateTicket(ticket.id, { status: 'Cancelled' });
    }
    if (attendee) {
      StorageService.createActivity({
        eventId: attendee.eventId,
        type: 'register',
        message: `Registration cancelled for ${attendee.fullName}`
      });
    }
    return attendee;
  }

  static delete(id) {
    const attendee = StorageService.getAttendee(id);
    if (!attendee) return false;
    const res = StorageService.deleteAttendee(id);
    if (res) {
      StorageService.createActivity({
        eventId: attendee.eventId,
        type: 'register',
        message: `Attendee record deleted: ${attendee.fullName}`
      });
    }
    return res;
  }
}

// ==========================================
// 3. TICKET SERVICE
// ==========================================
class TicketService {
  static getTicketTypes(eventId) {
    return StorageService.getTicketTypesForEvent(eventId);
  }

  static getTickets(eventId) {
    return StorageService.getTicketsForEvent(eventId);
  }

  static getFullTicketDetails(ticketId) {
    const ticket = StorageService.getTicket(ticketId);
    if (!ticket) return null;

    const attendee = StorageService.getAttendee(ticket.attendeeId);
    const event = StorageService.getEvent(ticket.eventId);
    const ticketType = StorageService.getTicketTypes().find(t => t.id === ticket.ticketTypeId);

    return {
      ticket,
      attendee,
      event,
      ticketType: ticketType || { name: 'General', color: '#6366F1' }
    };
  }

  static getByQrToken(token) {
    // Strip EVENTOS:TICKET: prefix if present (Section 23)
    const cleanToken = token.replace('EVENTOS:TICKET:', '').trim();
    const ticket = StorageService.getTicketByToken(cleanToken);
    if (!ticket) return null;
    return this.getFullTicketDetails(ticket.id);
  }
}

// ==========================================
// 4. CHECK-IN SERVICE
// Section 25: Validates ticket, cancellation, gate, duplicate
// ==========================================
class CheckInService {
  static processCheckIn(inputString, gate = 'Main Gate') {
    if (!inputString || !inputString.trim()) {
      return { status: 'INVALID', message: 'No ticket token or registration code provided.' };
    }

    const query = inputString.trim();
    let cleanToken = query;
    if (query.startsWith('EVENTOS:TICKET:')) {
      cleanToken = query.replace('EVENTOS:TICKET:', '').trim();
    }

    // Step 1: Find ticket by token, registration ID, or ticket code
    let ticket = StorageService.getTicketByToken(cleanToken);
    let attendee = null;

    if (!ticket) {
      // Try finding attendee by registration ID
      const attendees = StorageService.getAttendees();
      attendee = attendees.find(a =>
        a.registrationId.toLowerCase() === query.toLowerCase() ||
        a.fullName.toLowerCase() === query.toLowerCase()
      );
      if (attendee) {
        ticket = StorageService.getTicketByAttendee(attendee.id);
      }
    } else {
      attendee = StorageService.getAttendee(ticket.attendeeId);
    }

    // If still not found, check ticket code
    if (!ticket) {
      ticket = StorageService.getTickets().find(t => t.ticketCode.toLowerCase() === query.toLowerCase());
      if (ticket) {
        attendee = StorageService.getAttendee(ticket.attendeeId);
      }
    }

    // Validation: Ticket exists?
    if (!ticket || !attendee) {
      StorageService.createScan({
        eventId: 'unknown',
        qrToken: cleanToken,
        gate,
        status: 'Invalid'
      });
      return { status: 'INVALID', message: 'Invalid ticket or attendee not found.' };
    }

    // Validation: Event exists & active?
    const event = StorageService.getEvent(ticket.eventId);
    if (!event || event.status === 'Cancelled') {
      return { status: 'INVALID', message: 'Event is invalid or cancelled.' };
    }

    // Validation: Attendee cancelled?
    if (attendee.status === 'Cancelled' || ticket.status === 'Cancelled') {
      return { status: 'INVALID', message: 'Registration has been cancelled.' };
    }

    // Validation: Check previous check-in (Duplicate)
    if (ticket.checkedIn === true || attendee.checkedIn === true) {
      // Record scan as duplicate
      StorageService.createScan({
        eventId: event.id,
        ticketId: ticket.id,
        attendeeId: attendee.id,
        qrToken: ticket.qrToken,
        gate,
        status: 'Duplicate'
      });

      return {
        status: 'DUPLICATE',
        message: 'Already checked in!',
        checkedInAt: ticket.checkedInAt || attendee.checkedInAt,
        checkedInGate: ticket.checkedInGate || 'Main Gate',
        attendee,
        ticket,
        event
      };
    }

    // Valid check-in!
    const checkInTimestamp = new Date().toISOString();

    StorageService.updateTicket(ticket.id, {
      checkedIn: true,
      checkedInAt: checkInTimestamp,
      checkedInGate: gate,
      status: 'Used'
    });

    StorageService.updateAttendee(attendee.id, {
      checkedIn: true,
      checkedInAt: checkInTimestamp
    });

    StorageService.createScan({
      eventId: event.id,
      ticketId: ticket.id,
      attendeeId: attendee.id,
      qrToken: ticket.qrToken,
      gate,
      status: 'Success',
      timestamp: checkInTimestamp
    });

    StorageService.createActivity({
      eventId: event.id,
      type: 'scan',
      message: `${attendee.fullName} checked in at ${gate} (${attendee.registrationId})`
    });

    return {
      status: 'SUCCESS',
      message: 'Check-in successful!',
      attendee,
      ticket,
      event,
      gate,
      timestamp: checkInTimestamp
    };
  }
}

// ==========================================
// 5. ANALYTICS SERVICE
// Section 31, 53, 57, 60: Dynamically derived statistics
// ==========================================
class AnalyticsService {
  static getOverview(eventId = null) {
    const events = eventId ? [StorageService.getEvent(eventId)].filter(Boolean) : StorageService.getEvents();
    const attendees = eventId ? StorageService.getAttendeesForEvent(eventId) : StorageService.getAttendees();
    const tickets = eventId ? StorageService.getTicketsForEvent(eventId) : StorageService.getTickets();
    const scans = eventId ? StorageService.getScansForEvent(eventId) : StorageService.getScans();

    const confirmedAttendees = attendees.filter(a => a.status === 'Confirmed');
    const totalRegistrations = confirmedAttendees.length;
    const cancelledRegistrations = attendees.filter(a => a.status === 'Cancelled').length;

    const checkedInCount = confirmedAttendees.filter(a => a.checkedIn).length;
    const notCheckedInCount = Math.max(0, totalRegistrations - checkedInCount);

    const totalCapacity = events.reduce((sum, e) => sum + (e.capacity || 0), 0);

    const attendanceRate = totalRegistrations > 0 ? ((checkedInCount / totalRegistrations) * 100).toFixed(1) : 0;
    const capacityUtilization = totalCapacity > 0 ? ((totalRegistrations / totalCapacity) * 100).toFixed(1) : 0;

    const upcomingEvents = events.filter(e => e.status !== 'Cancelled' && e.status !== 'Completed').length;

    return {
      totalEvents: events.length,
      upcomingEvents,
      totalRegistrations,
      cancelledRegistrations,
      ticketsIssued: tickets.length,
      checkedInCount,
      notCheckedInCount,
      totalCapacity,
      attendanceRate: parseFloat(attendanceRate),
      capacityUtilization: parseFloat(capacityUtilization),
      totalScans: scans.length
    };
  }

  /**
   * Calculate registration trend for SVG chart
   */
  static getRegistrationTrend(eventId = null, days = 7) {
    const attendees = eventId ? StorageService.getAttendeesForEvent(eventId) : StorageService.getAttendees();
    const dateMap = {};

    // Initialize last N days
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000);
      const key = d.toISOString().split('T')[0];
      const label = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      dateMap[key] = { label, count: 0 };
    }

    attendees.forEach(a => {
      if (a.registeredAt) {
        const key = a.registeredAt.split('T')[0];
        if (dateMap[key]) {
          dateMap[key].count++;
        }
      }
    });

    return Object.values(dateMap);
  }

  /**
   * Calculate ticket types breakdown
   */
  static getTicketDistribution(eventId = null) {
    const ticketTypes = eventId ? StorageService.getTicketTypesForEvent(eventId) : StorageService.getTicketTypes();
    const attendees = eventId ? StorageService.getAttendeesForEvent(eventId) : StorageService.getAttendees();

    const counts = {};
    attendees.forEach(a => {
      const typeId = a.ticketTypeId || 'unknown';
      counts[typeId] = (counts[typeId] || 0) + 1;
    });

    return ticketTypes.map(tt => ({
      name: tt.name,
      color: tt.color || '#6366F1',
      count: counts[tt.id] || 0
    }));
  }
}

// ==========================================
// 6. ACTIVITY SERVICE
// Section 30
// ==========================================
class ActivityService {
  static getRecent(limit = 10, eventId = null) {
    const list = eventId ? StorageService.getActivityForEvent(eventId) : StorageService.getActivity();
    return list.slice(0, limit);
  }

  static log(eventId, type, message, user = 'Admin') {
    return StorageService.createActivity({ eventId, type, message, user });
  }
}

// Make services globally available
window.EventService = EventService;
window.AttendeeService = AttendeeService;
window.TicketService = TicketService;
window.CheckInService = CheckInService;
window.AnalyticsService = AnalyticsService;
window.ActivityService = ActivityService;
