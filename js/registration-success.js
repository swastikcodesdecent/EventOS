/**
 * EventOS - Registration Success Controller
 * Section 33: Registration confirmation, attendee pass, QR rendering & print
 */

document.addEventListener('DOMContentLoaded', () => {
  RegistrationSuccessController.init();
});

class RegistrationSuccessController {
  static init() {
    this.ticketId = getQueryParam('ticketId');
    if (!this.ticketId) {
      // Pick the latest generated ticket
      const tickets = StorageService.getTickets();
      if (tickets.length > 0) {
        this.ticketId = tickets[0].id;
      } else {
        window.location.href = 'index.html';
        return;
      }
    }

    this.renderSuccessPass();
  }

  static renderSuccessPass() {
    const details = TicketService.getFullTicketDetails(this.ticketId);
    if (!details || !details.ticket) {
      Toast.error('Ticket record not found.');
      return;
    }

    const { ticket, attendee, event, ticketType } = details;

    const nameEl = document.getElementById('succ-attendee-name');
    const regIdEl = document.getElementById('succ-reg-id');
    const eventNameEl = document.getElementById('succ-event-name');
    const tierBadge = document.getElementById('succ-tier-badge');
    const passName = document.getElementById('pass-attendee-name');
    const passEvent = document.getElementById('pass-event-name');
    const passReg = document.getElementById('pass-reg-id');
    const passDateTime = document.getElementById('pass-date-time');
    const passVenue = document.getElementById('pass-venue');
    const backBtn = document.getElementById('succ-back-btn');

    if (nameEl && attendee) nameEl.textContent = attendee.fullName;
    if (regIdEl && attendee) regIdEl.textContent = attendee.registrationId;
    if (eventNameEl && event) eventNameEl.textContent = event.name;

    if (tierBadge && ticketType) {
      tierBadge.textContent = ticketType.name;
      tierBadge.style.background = `${ticketType.color}20`;
      tierBadge.style.color = ticketType.color;
      tierBadge.style.borderColor = `${ticketType.color}40`;
    }

    if (passName && attendee) passName.textContent = attendee.fullName;
    if (passEvent && event) passEvent.textContent = event.name;
    if (passReg && attendee) passReg.textContent = `${attendee.registrationId} • ${ticket.ticketCode}`;

    if (passDateTime && event) {
      passDateTime.textContent = `${DateUtils.formatDate(event.startDate)} @ ${DateUtils.formatTime(event.startTime)}`;
    }

    if (passVenue && event) {
      passVenue.textContent = event.venue || 'Online / Hybrid Event';
    }

    if (backBtn && event) {
      backBtn.href = `public-event.html?id=${event.id}`;
    }

    // Render Canvas QR Code (Section 23: contains only EVENTOS:TICKET:<random-token>)
    const canvas = document.getElementById('pass-qr-canvas');
    if (canvas) {
      QRCodeGenerator.renderToCanvas(canvas, `EVENTOS:TICKET:${ticket.qrToken}`, {
        size: 170,
        padding: 6,
        darkColor: '#0B0F17',
        lightColor: '#FFFFFF'
      });
    }

    const tokenLabel = document.getElementById('pass-token-label');
    if (tokenLabel) {
      tokenLabel.textContent = `TOKEN: ${ticket.qrToken}`;
    }
  }

  static printPass() {
    window.print();
  }
}

window.RegistrationSuccessController = RegistrationSuccessController;
