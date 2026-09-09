/**
 * EventOS - Settings Controller
 */

document.addEventListener('DOMContentLoaded', async () => {
  if (window.AuthService) {
    await AuthService.requireAuth();
  }
  SettingsPageController.init();
});

class SettingsPageController {
  static init() {
    this.loadSettings();
    this.bindEvents();
  }

  static loadSettings() {
    const s = StorageService.getSettings();
    const p = StorageService.getPreferences();

    const setVal = (id, val) => {
      const el = document.getElementById(id);
      if (el && val !== undefined) el.value = val;
    };

    setVal('set-org-name', s.organizationName);
    setVal('set-organizer-name', s.organizerName);
    setVal('set-email', s.email);
    setVal('set-phone', s.phone);
    setVal('set-website', s.website);
    setVal('set-address', s.address);
    setVal('set-currency', s.currency);
    setVal('set-evt-prefix', s.eventCodePrefix);
    setVal('set-reg-prefix', s.registrationPrefix);
    setVal('set-default-ticket', s.defaultTicketType);

    const themeSelect = document.getElementById('set-theme');
    if (themeSelect) themeSelect.value = p.theme || 'dark';
  }

  static bindEvents() {
    // Org form
    const form = document.getElementById('settings-form');
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        this.saveSettings();
      });
    }

    // Theme select
    const themeSelect = document.getElementById('set-theme');
    if (themeSelect) {
      themeSelect.addEventListener('change', (e) => {
        const newTheme = e.target.value;
        StorageService.savePreferences({ theme: newTheme });
        document.documentElement.setAttribute('data-theme', newTheme);
        Toast.success(`Theme updated to ${newTheme}`);
      });
    }

    // Export Backup
    const exportBtn = document.getElementById('btn-export-backup');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => {
        StorageService.exportBackup();
        Toast.success('Firebase database backup downloaded!');
      });
    }

    // Import Backup
    const importInput = document.getElementById('input-import-backup');
    if (importInput) {
      importInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
          this.handleImport(event.target.result);
        };
        reader.readAsText(file);
        e.target.value = '';
      });
    }

    // Clear All Data
    const clearBtn = document.getElementById('btn-clear-data');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        Modal.confirm({
          title: 'Clear All Firebase Data?',
          message: 'Warning: This will wipe out all events, attendees, tickets, gates, tasks and history stored in your workspace.',
          confirmText: 'Yes, Wipe Everything',
          confirmClass: 'btn-danger',
          onConfirm: () => {
            StorageService.clearAllData();
            localStorage.removeItem('eventos_first_run_completed');
            Toast.error('All data wiped. Refreshing application...');
            setTimeout(() => window.location.href = 'index.html', 800);
          }
        });
      });
    }
  }

  static saveSettings() {
    const updates = {
      organizationName: document.getElementById('set-org-name').value.trim(),
      organizerName: document.getElementById('set-organizer-name').value.trim(),
      email: document.getElementById('set-email').value.trim(),
      phone: document.getElementById('set-phone').value.trim(),
      website: document.getElementById('set-website').value.trim(),
      address: document.getElementById('set-address').value.trim(),
      currency: document.getElementById('set-currency').value,
      eventCodePrefix: document.getElementById('set-evt-prefix').value.trim(),
      registrationPrefix: document.getElementById('set-reg-prefix').value.trim(),
      defaultTicketType: document.getElementById('set-default-ticket').value
    };

    StorageService.saveSettings(updates);
    Toast.success('Application settings updated successfully!');
  }

  static handleImport(jsonString) {
    Modal.confirm({
      title: 'Import Backup to Firebase?',
      message: 'Your current Firebase data will be replaced by the records contained in this backup file. Do you want to proceed?',
      confirmText: 'Import & Replace',
      confirmClass: 'btn-primary',
      onConfirm: () => {
        const result = StorageService.importBackup(jsonString);
        if (result.success) {
          Toast.success('Database restored successfully from backup!');
          setTimeout(() => window.location.href = 'dashboard.html', 800);
        } else {
          Toast.error(result.error || 'Invalid backup file.');
        }
      }
    });
  }
}

window.SettingsPageController = SettingsPageController;
