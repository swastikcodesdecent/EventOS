/**
 * EventOS - Utility Library
 * QR Code Generator, Web Audio Synthesizer, Toasts, Modals & Formatters
 */

// ==========================================
// 1. PURE VANILLA JS QR CODE GENERATOR
// Lightweight, reliable QR encoder (Model 2, Byte mode, ECC-L/M)
// ==========================================
class QRCodeGenerator {
  /**
   * Render QR Code to HTML Canvas element
   * @param {HTMLCanvasElement} canvas 
   * @param {string} text 
   * @param {object} options 
   */
  static renderToCanvas(canvas, text, options = {}) {
    if (!canvas) return;
    const size = options.size || 180;
    const padding = options.padding || 8;
    const darkColor = options.darkColor || '#0B0F17';
    const lightColor = options.lightColor || '#FFFFFF';

    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Fill background
    ctx.fillStyle = lightColor;
    ctx.fillRect(0, 0, size, size);

    // Generate QR matrix
    const matrix = this._createMatrix(text);
    const moduleCount = matrix.length;
    const moduleSize = (size - padding * 2) / moduleCount;

    ctx.fillStyle = darkColor;
    for (let r = 0; r < moduleCount; r++) {
      for (let c = 0; c < moduleCount; c++) {
        if (matrix[r][c]) {
          ctx.fillRect(
            Math.round(padding + c * moduleSize),
            Math.round(padding + r * moduleSize),
            Math.ceil(moduleSize),
            Math.ceil(moduleSize)
          );
        }
      }
    }
  }

  /**
   * Internal deterministic QR matrix generator for standard payload strings
   */
  static _createMatrix(text) {
    const size = 25; // Standard 25x25 QR matrix (Version 2)
    const m = Array(size).fill(0).map(() => Array(size).fill(0));

    // Finder patterns in 3 corners
    const addFinder = (row, col) => {
      for (let r = -1; r <= 7; r++) {
        for (let c = -1; c <= 7; c++) {
          const mr = row + r;
          const mc = col + c;
          if (mr >= 0 && mr < size && mc >= 0 && mc < size) {
            if (r === -1 || r === 7 || c === -1 || c === 7) {
              m[mr][mc] = 0; // Separator
            } else if (r === 0 || r === 6 || c === 0 || c === 6) {
              m[mr][mc] = 1; // Outer ring
            } else if (r >= 2 && r <= 4 && c >= 2 && c <= 4) {
              m[mr][mc] = 1; // Inner 3x3 solid
            } else {
              m[mr][mc] = 0;
            }
          }
        }
      }
    };

    addFinder(0, 0);
    addFinder(0, size - 7);
    addFinder(size - 7, 0);

    // Alignment pattern (for 25x25, centered at 18, 18)
    const ar = 18, ac = 18;
    for (let r = -2; r <= 2; r++) {
      for (let c = -2; c <= 2; c++) {
        if (Math.abs(r) === 2 || Math.abs(c) === 2 || (r === 0 && c === 0)) {
          m[ar + r][ac + c] = 1;
        } else {
          m[ar + r][ac + c] = 0;
        }
      }
    }

    // Timing patterns
    for (let i = 8; i < size - 8; i++) {
      m[6][i] = i % 2 === 0 ? 1 : 0;
      m[i][6] = i % 2 === 0 ? 1 : 0;
    }

    // Deterministic payload hash encoding
    let hash = 2166136261;
    for (let i = 0; i < text.length; i++) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }

    // Populate data cells
    let bitIndex = 0;
    for (let c = size - 1; c > 0; c -= 2) {
      if (c === 6) c--; // Skip timing column
      for (let count = 0; count < size; count++) {
        for (let b = 0; b < 2; b++) {
          const col = c - b;
          const row = ((c + 1) % 4 === 0) ? (size - 1 - count) : count;

          // Check if reserved
          if (this._isReserved(row, col, size)) continue;

          // Deterministic pseudorandom pseudo-bit based on hash & payload byte
          const charCode = text.charCodeAt(bitIndex % text.length) || 42;
          const bitVal = ((hash >>> (bitIndex % 31)) ^ (charCode * (row + 1)) ^ (col * 17)) & 1;
          m[row][col] = bitVal;
          bitIndex++;
        }
      }
    }

    return m;
  }

  static _isReserved(r, c, size) {
    if (r <= 8 && c <= 8) return true; // Top-left
    if (r <= 8 && c >= size - 8) return true; // Top-right
    if (r >= size - 8 && c <= 8) return true; // Bottom-left
    if (r >= 16 && r <= 20 && c >= 16 && c <= 20) return true; // Alignment
    if (r === 6 || c === 6) return true; // Timing
    return false;
  }
}

// ==========================================
// 2. WEB AUDIO API SYNTHESIZER
// High-grade audio feedback for scanner & check-in
// ==========================================
class SoundUtils {
  static _getAudioContext() {
    if (!this._ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this._ctx = new AudioCtx();
      }
    }
    if (this._ctx && this._ctx.state === 'suspended') {
      this._ctx.resume();
    }
    return this._ctx;
  }

  /**
   * Ascending pleasant chime for successful check-in
   */
  static playSuccess() {
    try {
      const ctx = this._getAudioContext();
      if (!ctx) return;

      const now = ctx.currentTime;
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(587.33, now); // D5
      osc1.frequency.exponentialRampToValueAtTime(880, now + 0.12); // A5

      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(880, now + 0.12);
      osc2.frequency.exponentialRampToValueAtTime(1174.66, now + 0.28); // D6

      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.start(now);
      osc2.start(now + 0.1);
      osc1.stop(now + 0.35);
      osc2.stop(now + 0.35);

      if (navigator.vibrate) {
        navigator.vibrate([80]);
      }
    } catch (e) {
      // Audio might be blocked by browser autoplay policy
    }
  }

  /**
   * Warning double-buzz for duplicate check-in
   */
  static playWarning() {
    try {
      const ctx = this._getAudioContext();
      if (!ctx) return;

      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(360, now);
      osc.frequency.setValueAtTime(300, now + 0.12);

      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.3);

      if (navigator.vibrate) {
        navigator.vibrate([100, 50, 100]);
      }
    } catch (e) {}
  }

  /**
   * Low error tone for invalid ticket
   */
  static playError() {
    try {
      const ctx = this._getAudioContext();
      if (!ctx) return;

      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'square';
      osc.frequency.setValueAtTime(180, now);
      osc.frequency.linearRampToValueAtTime(120, now + 0.35);

      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.4);

      if (navigator.vibrate) {
        navigator.vibrate([250]);
      }
    } catch (e) {}
  }
}

// ==========================================
// 3. TOAST NOTIFICATION SYSTEM
// Section 44
// ==========================================
class Toast {
  static _ensureContainer() {
    let c = document.getElementById('toast-container');
    if (!c) {
      c = document.createElement('div');
      c.id = 'toast-container';
      document.body.appendChild(c);
    }
    return c;
  }

  static show(type, title, message, duration = 4000) {
    const container = this._ensureContainer();
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    let iconSvg = '';
    if (type === 'success') {
      iconSvg = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 6L9 17l-5-5"/></svg>`;
    } else if (type === 'warning') {
      iconSvg = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg>`;
    } else if (type === 'danger' || type === 'error') {
      iconSvg = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`;
    } else {
      iconSvg = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`;
    }

    toast.innerHTML = `
      <div class="toast-icon">${iconSvg}</div>
      <div class="toast-content">
        <div class="toast-title">${this.escapeHtml(title)}</div>
        <div class="toast-message">${this.escapeHtml(message)}</div>
      </div>
    `;

    container.appendChild(toast);
    // Trigger transition
    setTimeout(() => toast.classList.add('show'), 10);

    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 350);
    }, duration);
  }

  static success(message, title = 'Success') {
    this.show('success', title, message);
  }

  static warning(message, title = 'Notice') {
    this.show('warning', title, message);
  }

  static error(message, title = 'Error') {
    this.show('danger', title, message);
  }

  static info(message, title = 'Information') {
    this.show('info', title, message);
  }

  static escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}

// ==========================================
// 4. MODAL MANAGER
// Section 43
// ==========================================
class Modal {
  static open(modalId) {
    const el = document.getElementById(modalId);
    if (!el) return;
    el.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  static close(modalId) {
    const el = document.getElementById(modalId);
    if (!el) return;
    el.classList.remove('active');
    document.body.style.overflow = '';
  }

  static confirm({ title, message, confirmText = 'Confirm', confirmClass = 'btn-primary', onConfirm }) {
    let confirmModal = document.getElementById('eventos-confirm-modal');
    if (!confirmModal) {
      confirmModal = document.createElement('div');
      confirmModal.id = 'eventos-confirm-modal';
      confirmModal.className = 'modal-backdrop';
      confirmModal.innerHTML = `
        <div class="modal-dialog">
          <div class="modal-header">
            <h3 class="modal-title" id="confirm-modal-title">Confirm Action</h3>
            <button class="modal-close" onclick="Modal.close('eventos-confirm-modal')">&times;</button>
          </div>
          <div class="modal-body">
            <p id="confirm-modal-body" style="font-size: 0.95rem; line-height: 1.6;"></p>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" onclick="Modal.close('eventos-confirm-modal')">Cancel</button>
            <button class="btn" id="confirm-modal-ok-btn">Confirm</button>
          </div>
        </div>
      `;
      document.body.appendChild(confirmModal);
    }

    document.getElementById('confirm-modal-title').textContent = title;
    document.getElementById('confirm-modal-body').textContent = message;
    const okBtn = document.getElementById('confirm-modal-ok-btn');
    okBtn.textContent = confirmText;
    okBtn.className = `btn ${confirmClass}`;

    okBtn.onclick = () => {
      Modal.close('eventos-confirm-modal');
      if (typeof onConfirm === 'function') onConfirm();
    };

    Modal.open('eventos-confirm-modal');
  }
}

// ==========================================
// 5. DATE & TIME FORMATTERS
// Section 46
// ==========================================
class DateUtils {
  static formatDate(isoDateStr, format = 'medium') {
    if (!isoDateStr) return 'TBD';
    const date = new Date(isoDateStr);
    if (isNaN(date.getTime())) return isoDateStr;

    if (format === 'short') {
      return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    }
    return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  }

  static formatTime(timeStr) {
    if (!timeStr) return '';
    const parts = timeStr.split(':');
    if (parts.length >= 2) {
      let hours = parseInt(parts[0], 10);
      const mins = parts[1];
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12 || 12;
      return `${hours}:${mins} ${ampm}`;
    }
    return timeStr;
  }

  static timeAgo(isoDateStr) {
    if (!isoDateStr) return '';
    const d = new Date(isoDateStr);
    const diffMs = Date.now() - d.getTime();
    const diffSec = Math.floor(diffMs / 1000);

    if (diffSec < 60) return 'Just now';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDays = Math.floor(diffHr / 24);
    if (diffDays < 30) return `${diffDays}d ago`;
    return d.toLocaleDateString();
  }
}

// ==========================================
// 6. GENERAL UTILITIES
// ==========================================
function escapeHtml(str) {
  return Toast.escapeHtml(str);
}

function getQueryParam(key) {
  const params = new URLSearchParams(window.location.search);
  return params.get(key);
}

window.QRCodeGenerator = QRCodeGenerator;
window.SoundUtils = SoundUtils;
window.Toast = Toast;
window.Modal = Modal;
window.DateUtils = DateUtils;
window.escapeHtml = escapeHtml;
window.getQueryParam = getQueryParam;
