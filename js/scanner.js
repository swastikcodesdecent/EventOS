/**
 * EventOS - QR Scanner & Check-In Controller
 * Sections 24, 25, 26: Live Camera Stream, Barcode/QR Detector, Gate Selection, Fallbacks & Feedback
 */

document.addEventListener('DOMContentLoaded', async () => {
  if (window.AuthService) {
    const isAuthed = await AuthService.requireAuth();
    if (!isAuthed) return;
  }
  ScannerPageController.init();
});

class ScannerPageController {
  static init() {
    this.videoEl = document.getElementById('scanner-video');
    this.canvasEl = document.getElementById('scanner-canvas');
    this.gateSelect = document.getElementById('scanner-gate-select');
    this.manualInput = document.getElementById('manual-token-input');
    this.resultCard = document.getElementById('scan-result-card');
    this.stream = null;
    this.scanningActive = false;
    this.scanCooldown = false;
    this.detector = null;

    this.populateGates();
    this.bindControls();
    this.initBarcodeDetector();
    this.startCamera();
    this.renderRecentScans();
  }

  // ==========================================
  // 1. GATE SELECTOR (Section 26)
  // ==========================================
  static populateGates() {
    if (!this.gateSelect) return;
    const gates = StorageService.getGates();
    let opts = '<option value="Main Gate">Main Gate</option>';
    gates.forEach(g => {
      opts += `<option value="${escapeHtml(g.name)}">${escapeHtml(g.name)}</option>`;
    });
    this.gateSelect.innerHTML = opts;

    // Load saved gate preference
    const savedGate = localStorage.getItem('eventos_active_gate');
    if (savedGate) {
      this.gateSelect.value = savedGate;
    }

    this.gateSelect.addEventListener('change', (e) => {
      localStorage.setItem('eventos_active_gate', e.target.value);
      Toast.info(`Active gate changed to: ${e.target.value}`);
    });
  }

  static getActiveGate() {
    return this.gateSelect ? this.gateSelect.value : 'Main Gate';
  }

  // ==========================================
  // 2. CAMERA INITIALIZATION (Section 24)
  // ==========================================
  static async startCamera() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      this.showCameraPlaceholder('Camera API is not supported in this browser. Please use manual entry.');
      return;
    }

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      });

      if (this.videoEl) {
        this.videoEl.srcObject = this.stream;
        this.videoEl.setAttribute('playsinline', 'true');
        await this.videoEl.play();
        this.scanningActive = true;
        this.startDetectionLoop();
      }
    } catch (err) {
      console.warn('Camera access denied or unavailable:', err);
      this.showCameraPlaceholder('Camera access denied or no camera device found. Use manual token entry.');
    }
  }

  static stopCamera() {
    this.scanningActive = false;
    if (this.stream) {
      this.stream.getTracks().forEach(t => t.stop());
      this.stream = null;
    }
  }

  static showCameraPlaceholder(message) {
    const box = document.querySelector('.camera-box');
    if (box) {
      const existingPrompt = box.querySelector('.camera-error-prompt');
      if (!existingPrompt) {
        const p = document.createElement('div');
        p.className = 'camera-error-prompt';
        p.style.cssText = 'position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 2rem; text-align: center; color: #94A3B8; background: #0B0F17; z-index: 5;';
        p.innerHTML = `
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin-bottom: 0.75rem; color: #64748B;"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
          <p style="font-size: 0.85rem; max-width: 320px;">${message}</p>
        `;
        box.appendChild(p);
      }
    }
  }

  // ==========================================
  // 3. BARCODE DETECTOR LOOP
  // ==========================================
  static async initBarcodeDetector() {
    if ('BarcodeDetector' in window) {
      try {
        const formats = await window.BarcodeDetector.getSupportedFormats();
        if (formats.includes('qr_code')) {
          this.detector = new window.BarcodeDetector({ formats: ['qr_code'] });
        }
      } catch (e) {
        this.detector = null;
      }
    }
  }

  static startDetectionLoop() {
    const loop = async () => {
      if (!this.scanningActive) return;

      if (this.detector && this.videoEl && this.videoEl.readyState === this.videoEl.HAVE_ENOUGH_DATA) {
        try {
          const barcodes = await this.detector.detect(this.videoEl);
          if (barcodes && barcodes.length > 0) {
            const rawValue = barcodes[0].rawValue;
            if (rawValue && !this.scanCooldown) {
              this.handleScanResult(rawValue);
            }
          }
        } catch (e) {
          // Detection error, continue
        }
      }

      requestAnimationFrame(loop);
    };

    requestAnimationFrame(loop);
  }

  // ==========================================
  // 4. MANUAL CONTROLS & EVENT LISTENERS
  // ==========================================
  static bindControls() {
    const manualForm = document.getElementById('manual-checkin-form');
    if (manualForm) {
      manualForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const val = this.manualInput.value.trim();
        if (val) {
          this.handleScanResult(val);
          this.manualInput.value = '';
        }
      });
    }
  }

  // ==========================================
  // 5. SCAN PROCESSING & VALIDATION PIPELINE (Section 25)
  // ==========================================
  static handleScanResult(code) {
    if (this.scanCooldown) return;
    this.scanCooldown = true;

    const gate = this.getActiveGate();
    const result = CheckInService.processCheckIn(code, gate);

    // Audio and Visual feedback
    if (result.status === 'SUCCESS') {
      SoundUtils.playSuccess();
      Toast.success(`Check-In: ${result.attendee.fullName}`);
      this.displayResultCard('success', result);
    } else if (result.status === 'DUPLICATE') {
      SoundUtils.playWarning();
      Toast.warning(`Already Checked In: ${result.attendee.fullName}`);
      this.displayResultCard('duplicate', result);
    } else {
      SoundUtils.playError();
      Toast.error(result.message || 'Invalid Ticket');
      this.displayResultCard('invalid', result);
    }

    this.renderRecentScans();

    // Release cooldown after 2.5 seconds
    setTimeout(() => {
      this.scanCooldown = false;
    }, 2500);
  }

  static displayResultCard(type, result) {
    if (!this.resultCard) return;

    this.resultCard.className = `scan-result-card active ${type}`;

    if (type === 'success') {
      const att = result.attendee;
      const tkt = result.ticket;
      const typeObj = StorageService.getTicketTypes().find(t => t.id === tkt.ticketTypeId) || { name: 'General' };

      this.resultCard.innerHTML = `
        <div class="scan-status-header">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          <span>CHECK-IN SUCCESSFUL</span>
        </div>
        <div style="font-size: 1.35rem; font-weight: 800; color: #FFFFFF; margin-bottom: 0.25rem;">
          ${escapeHtml(att.fullName)}
        </div>
        <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1rem;">
          <span class="badge badge-purple">${escapeHtml(typeObj.name)}</span>
          <span class="mono" style="font-size: 0.88rem; color: var(--primary);">${escapeHtml(att.registrationId)}</span>
        </div>
        <div style="font-size: 0.82rem; color: var(--text-secondary); border-top: 1px solid var(--border-subtle); padding-top: 0.75rem; display: flex; justify-content: space-between;">
          <span>Gate: <strong>${escapeHtml(result.gate)}</strong></span>
          <span>Time: <strong>${DateUtils.formatTime(new Date().toTimeString().split(' ')[0])}</strong></span>
        </div>
      `;
    } else if (type === 'duplicate') {
      const att = result.attendee;
      this.resultCard.innerHTML = `
        <div class="scan-status-header">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          <span>ALREADY CHECKED IN</span>
        </div>
        <div style="font-size: 1.2rem; font-weight: 700; color: #FFFFFF; margin-bottom: 0.25rem;">
          ${escapeHtml(att.fullName)} (${escapeHtml(att.registrationId)})
        </div>
        <p style="font-size: 0.85rem; color: var(--warning); margin-bottom: 0.75rem;">
          This ticket has already been validated at <strong>${escapeHtml(result.checkedInGate || 'Main Gate')}</strong>
        </p>
        <div style="font-size: 0.78rem; color: var(--text-muted);">
          First check-in: ${DateUtils.formatDate(result.checkedInAt)} at ${new Date(result.checkedInAt).toLocaleTimeString()}
        </div>
      `;
    } else {
      this.resultCard.innerHTML = `
        <div class="scan-status-header">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
          <span>INVALID TICKET</span>
        </div>
        <p style="font-size: 0.9rem; color: var(--danger); margin-bottom: 0.5rem;">
          ${escapeHtml(result.message || 'The QR token could not be verified in the database.')}
        </p>
        <p style="font-size: 0.78rem; color: var(--text-muted);">
          Please verify registration status or check the attendee directory manually.
        </p>
      `;
    }
  }

  // ==========================================
  // 6. LIVE RECENT SCANS FEED
  // ==========================================
  static renderRecentScans() {
    const container = document.getElementById('scanner-feed-list');
    if (!container) return;

    const scans = StorageService.getScans().slice(0, 10);

    if (scans.length === 0) {
      container.innerHTML = '<p class="text-muted" style="font-size: 0.82rem; text-align: center; padding: 1.5rem;">No scans recorded in this session.</p>';
      return;
    }

    const attendeesMap = {};
    StorageService.getAttendees().forEach(a => attendeesMap[a.id] = a);

    let html = '';
    scans.forEach(s => {
      const att = attendeesMap[s.attendeeId];
      const name = att ? att.fullName : (s.qrToken || 'Pass');
      const regId = att ? att.registrationId : '';
      const statusClass = s.status === 'Success' ? '' : (s.status === 'Duplicate' ? 'duplicate' : 'invalid');

      html += `
        <div class="scanner-feed-item ${statusClass}">
          <div>
            <div style="font-weight: 700;">${escapeHtml(name)} ${regId ? `<span class="mono" style="font-size: 0.75rem; color: var(--primary);">(${escapeHtml(regId)})</span>` : ''}</div>
            <div style="font-size: 0.72rem; color: var(--text-muted);">${DateUtils.timeAgo(s.timestamp)} &bull; ${escapeHtml(s.gate || 'Main Gate')}</div>
          </div>
          <span class="badge badge-${s.status === 'Success' ? 'success' : (s.status === 'Duplicate' ? 'warning' : 'danger')}" style="font-size: 0.7rem;">
            ${s.status}
          </span>
        </div>
      `;
    });

    container.innerHTML = html;
  }
}

window.ScannerPageController = ScannerPageController;
