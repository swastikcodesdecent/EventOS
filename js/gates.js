/**
 * EventOS - Gates Management Controller
 * Section 26: Gate points (Main Gate, VIP Gate, Workshop Gate, etc.), Staff assignments
 */

document.addEventListener('DOMContentLoaded', async () => {
  if (window.AuthService) {
    const isAuthed = await AuthService.requireAuth();
    if (!isAuthed) return;
  }
  GatesPageController.init();
});

class GatesPageController {
  static init() {
    this.renderGates();
  }

  static renderGates() {
    const container = document.getElementById('gates-grid-container');
    const countEl = document.getElementById('gates-total-count');
    if (!container) return;

    const gates = StorageService.getGates();
    if (countEl) countEl.textContent = `${gates.length} Gates Configured`;

    if (gates.length === 0) {
      container.innerHTML = `
        <div class="empty-state" style="grid-column: 1/-1; padding: 3rem 1.5rem;">
          <div class="empty-state-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 21h18M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16"/><path d="M9 21v-4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v4"/></svg>
          </div>
          <h4>No gates configured</h4>
          <p>Create entry gates like Main Gate or VIP Entrance to manage check-in traffic.</p>
          <button class="btn btn-primary btn-sm" onclick="GatesPageController.openAddModal()">+ Add Gate</button>
        </div>
      `;
      return;
    }

    const scans = StorageService.getScans();

    let html = '';
    gates.forEach(g => {
      const scanCount = scans.filter(s => s.gate === g.name && s.status === 'Success').length;

      html += `
        <div class="card">
          <div class="card-header">
            <div>
              <h3 class="card-title" style="font-size: 1.15rem;">${escapeHtml(g.name)}</h3>
              <span style="font-size: 0.74rem; color: var(--text-muted);">Access Terminal</span>
            </div>
            <span class="badge ${g.status === 'Active' ? 'badge-success' : 'badge-draft'}">${g.status}</span>
          </div>
          <p style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 1.25rem; min-height: 38px;">
            ${escapeHtml(g.description || 'Standard entry gate for verified attendee check-in.')}
          </p>
          <div style="font-size: 0.82rem; color: var(--text-secondary); margin-bottom: 1rem;">
            Staff Stationed: <strong>${escapeHtml(g.assignedStaff || 'Unassigned')}</strong>
          </div>
          <div style="display: flex; align-items: center; justify-content: space-between; border-top: 1px solid var(--border-subtle); padding-top: 0.85rem; font-size: 0.82rem;">
            <span>Check-Ins Processed: <strong class="text-success">${scanCount}</strong></span>
            <div style="display: flex; gap: 0.25rem;">
              <button class="btn btn-ghost btn-sm btn-icon" onclick="GatesPageController.openEditModal('${g.id}')" title="Edit Gate">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              </button>
              <button class="btn btn-ghost btn-sm btn-icon text-danger" onclick="GatesPageController.deleteGate('${g.id}')" title="Delete Gate">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>
              </button>
            </div>
          </div>
        </div>
      `;
    });

    container.innerHTML = html;
  }

  static openAddModal() {
    let modal = document.getElementById('add-gate-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'add-gate-modal';
      modal.className = 'modal-backdrop';
      modal.innerHTML = `
        <div class="modal-dialog">
          <div class="modal-header">
            <h3 class="modal-title">Configure Entry Gate</h3>
            <button class="modal-close" onclick="Modal.close('add-gate-modal')">&times;</button>
          </div>
          <form id="add-gate-form">
            <div class="modal-body">
              <div class="form-group">
                <label class="form-label">Gate Name <span class="required-star">*</span></label>
                <input type="text" id="gate-name" class="form-control" required placeholder="e.g. VIP East Gate, Workshop Entrance">
              </div>
              <div class="form-group">
                <label class="form-label">Description</label>
                <textarea id="gate-desc" class="form-control" rows="2" placeholder="Location directions, physical access restrictions"></textarea>
              </div>
              <div class="form-group">
                <label class="form-label">Stationed Staff (Comma-separated)</label>
                <input type="text" id="gate-staff" class="form-control" placeholder="e.g. Marcus Vance, David Kim">
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" onclick="Modal.close('add-gate-modal')">Cancel</button>
              <button type="submit" class="btn btn-primary">Create Gate</button>
            </div>
          </form>
        </div>
      `;
      document.body.appendChild(modal);

      const form = document.getElementById('add-gate-form');
      form.onsubmit = (e) => {
        e.preventDefault();
        const newGate = StorageService.createGate({
          name: document.getElementById('gate-name').value.trim(),
          description: document.getElementById('gate-desc').value.trim(),
          assignedStaff: document.getElementById('gate-staff').value.trim()
        });

        StorageService.createActivity({
          type: 'staff',
          message: `Created gate checkpoint "${newGate.name}"`
        });

        Toast.success(`Gate "${newGate.name}" created`);
        Modal.close('add-gate-modal');
        form.reset();
        this.renderGates();
      };
    }

    Modal.open('add-gate-modal');
  }

  static openEditModal(id) {
    const gate = StorageService.getGates().find(g => g.id === id);
    if (!gate) return;

    let modal = document.getElementById('edit-gate-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'edit-gate-modal';
      modal.className = 'modal-backdrop';
      modal.innerHTML = `
        <div class="modal-dialog">
          <div class="modal-header">
            <h3 class="modal-title">Edit Gate Point</h3>
            <button class="modal-close" onclick="Modal.close('edit-gate-modal')">&times;</button>
          </div>
          <form id="edit-gate-form">
            <input type="hidden" id="edit-gate-id">
            <div class="modal-body">
              <div class="form-group">
                <label class="form-label">Gate Name <span class="required-star">*</span></label>
                <input type="text" id="edit-gate-name" class="form-control" required>
              </div>
              <div class="form-group">
                <label class="form-label">Description</label>
                <textarea id="edit-gate-desc" class="form-control" rows="2"></textarea>
              </div>
              <div class="form-group">
                <label class="form-label">Assigned Staff</label>
                <input type="text" id="edit-gate-staff" class="form-control">
              </div>
              <div class="form-group">
                <label class="form-label">Status</label>
                <select id="edit-gate-status" class="form-control select-dropdown">
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" onclick="Modal.close('edit-gate-modal')">Cancel</button>
              <button type="submit" class="btn btn-primary">Save Changes</button>
            </div>
          </form>
        </div>
      `;
      document.body.appendChild(modal);

      const form = document.getElementById('edit-gate-form');
      form.onsubmit = (e) => {
        e.preventDefault();
        const editId = document.getElementById('edit-gate-id').value;
        StorageService.updateGate(editId, {
          name: document.getElementById('edit-gate-name').value.trim(),
          description: document.getElementById('edit-gate-desc').value.trim(),
          assignedStaff: document.getElementById('edit-gate-staff').value.trim(),
          status: document.getElementById('edit-gate-status').value
        });

        Toast.success('Gate configuration updated');
        Modal.close('edit-gate-modal');
        this.renderGates();
      };
    }

    document.getElementById('edit-gate-id').value = gate.id;
    document.getElementById('edit-gate-name').value = gate.name;
    document.getElementById('edit-gate-desc').value = gate.description || '';
    document.getElementById('edit-gate-staff').value = gate.assignedStaff || '';
    document.getElementById('edit-gate-status').value = gate.status || 'Active';

    Modal.open('edit-gate-modal');
  }

  static deleteGate(id) {
    const gate = StorageService.getGates().find(g => g.id === id);
    if (!gate) return;

    Modal.confirm({
      title: 'Delete Gate Point?',
      message: `Are you sure you want to remove ${gate.name}?`,
      confirmText: 'Delete Gate',
      confirmClass: 'btn-danger',
      onConfirm: () => {
        StorageService.deleteGate(id);
        Toast.error(`Deleted ${gate.name}`);
        this.renderGates();
      }
    });
  }
}

window.GatesPageController = GatesPageController;
