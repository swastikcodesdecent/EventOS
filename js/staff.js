/**
 * EventOS - Staff Management Controller
 * Section 27: Roster, Roles (Admin, Manager, Registration, Check-In, Volunteer, Security), Gates, Add/Edit/Delete
 */

document.addEventListener('DOMContentLoaded', async () => {
  if (window.AuthService) {
    const isAuthed = await AuthService.requireAuth();
    if (!isAuthed) return;
  }
  StaffPageController.init();
});

class StaffPageController {
  static init() {
    this.roleFilter = 'all';
    this.searchQuery = '';

    this.bindControls();
    this.renderStaff();
  }

  static bindControls() {
    const searchInput = document.getElementById('staff-search');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value.trim().toLowerCase();
        this.renderStaff();
      });
    }

    const roleFilterEl = document.getElementById('staff-role-filter');
    if (roleFilterEl) {
      roleFilterEl.addEventListener('change', (e) => {
        this.roleFilter = e.target.value;
        this.renderStaff();
      });
    }
  }

  static renderStaff() {
    const tbody = document.getElementById('staff-table-body');
    const countEl = document.getElementById('staff-total-count');
    if (!tbody) return;

    let staff = StorageService.getStaff();

    if (this.roleFilter !== 'all') {
      staff = staff.filter(s => s.role.toLowerCase() === this.roleFilter.toLowerCase());
    }

    if (this.searchQuery) {
      const q = this.searchQuery;
      staff = staff.filter(s =>
        s.name.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q) ||
        (s.phone && s.phone.toLowerCase().includes(q)) ||
        (s.gate && s.gate.toLowerCase().includes(q))
      );
    }

    if (countEl) countEl.textContent = `${staff.length} Members`;

    if (staff.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; padding: 3rem 1rem;">
            <div class="empty-state" style="border: none; padding: 0;">
              <h4>No staff members found</h4>
              <p>Add coordinators, managers, and check-in volunteers to your team.</p>
              <button class="btn btn-primary btn-sm" onclick="StaffPageController.openAddModal()">+ Add Staff Member</button>
            </div>
          </td>
        </tr>
      `;
      return;
    }

    let html = '';
    staff.forEach(s => {
      html += `
        <tr>
          <td>
            <div style="font-weight: 700; font-size: 0.92rem;">${escapeHtml(s.name)}</div>
            <div style="font-size: 0.76rem; color: var(--text-muted);">${escapeHtml(s.email)}</div>
          </td>
          <td>
            <span class="badge badge-info">${escapeHtml(s.role)}</span>
          </td>
          <td>
            <div style="font-weight: 600; font-size: 0.86rem;">${escapeHtml(s.gate || 'Unassigned')}</div>
          </td>
          <td>
            <div style="font-size: 0.85rem;">${escapeHtml(s.phone || 'N/A')}</div>
          </td>
          <td>
            <span class="badge ${s.status === 'Active' ? 'badge-success' : 'badge-draft'}">${s.status}</span>
          </td>
          <td style="text-align: right;">
            <div style="display: flex; justify-content: flex-end; gap: 0.25rem;">
              <button class="btn btn-ghost btn-sm btn-icon" onclick="StaffPageController.openEditModal('${s.id}')" title="Edit Staff">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              </button>
              <button class="btn btn-ghost btn-sm btn-icon text-danger" onclick="StaffPageController.deleteStaff('${s.id}')" title="Delete Staff">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>
              </button>
            </div>
          </td>
        </tr>
      `;
    });

    tbody.innerHTML = html;
  }

  static openAddModal() {
    let modal = document.getElementById('add-staff-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'add-staff-modal';
      modal.className = 'modal-backdrop';
      modal.innerHTML = `
        <div class="modal-dialog">
          <div class="modal-header">
            <h3 class="modal-title">Add Staff Member</h3>
            <button class="modal-close" onclick="Modal.close('add-staff-modal')">&times;</button>
          </div>
          <form id="add-staff-form">
            <div class="modal-body">
              <div class="form-group">
                <label class="form-label">Full Name <span class="required-star">*</span></label>
                <input type="text" id="staff-name" class="form-control" required placeholder="Staff Full Name">
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">Email <span class="required-star">*</span></label>
                  <input type="email" id="staff-email" class="form-control" required placeholder="staff@eventos.local">
                </div>
                <div class="form-group">
                  <label class="form-label">Phone Number</label>
                  <input type="text" id="staff-phone" class="form-control" placeholder="+1 (555) 000-0000">
                </div>
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">Role <span class="required-star">*</span></label>
                  <select id="staff-role" class="form-control select-dropdown" required>
                    <option value="Event Admin">Event Admin</option>
                    <option value="Manager">Manager</option>
                    <option value="Registration Staff">Registration Staff</option>
                    <option value="Check-In Staff" selected>Check-In Staff</option>
                    <option value="Volunteer">Volunteer</option>
                    <option value="Security">Security</option>
                  </select>
                </div>
                <div class="form-group">
                  <label class="form-label">Assigned Gate</label>
                  <select id="staff-gate" class="form-control select-dropdown"></select>
                </div>
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" onclick="Modal.close('add-staff-modal')">Cancel</button>
              <button type="submit" class="btn btn-primary">Add Member</button>
            </div>
          </form>
        </div>
      `;
      document.body.appendChild(modal);

      const form = document.getElementById('add-staff-form');
      form.onsubmit = (e) => {
        e.preventDefault();
        const newStaff = StorageService.createStaff({
          name: document.getElementById('staff-name').value.trim(),
          email: document.getElementById('staff-email').value.trim(),
          phone: document.getElementById('staff-phone').value.trim(),
          role: document.getElementById('staff-role').value,
          gate: document.getElementById('staff-gate').value
        });

        StorageService.createActivity({
          type: 'staff',
          message: `Added new staff member ${newStaff.name} as ${newStaff.role}`
        });

        Toast.success(`Staff member "${newStaff.name}" added`);
        Modal.close('add-staff-modal');
        form.reset();
        this.renderStaff();
      };
    }

    const gateSelect = document.getElementById('staff-gate');
    const gates = StorageService.getGates();
    let gateOpts = '<option value="Main Gate">Main Gate</option>';
    gates.forEach(g => gateOpts += `<option value="${escapeHtml(g.name)}">${escapeHtml(g.name)}</option>`);
    gateSelect.innerHTML = gateOpts;

    Modal.open('add-staff-modal');
  }

  static openEditModal(id) {
    const member = StorageService.getStaff().find(s => s.id === id);
    if (!member) return;

    let modal = document.getElementById('edit-staff-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'edit-staff-modal';
      modal.className = 'modal-backdrop';
      modal.innerHTML = `
        <div class="modal-dialog">
          <div class="modal-header">
            <h3 class="modal-title">Edit Staff Member</h3>
            <button class="modal-close" onclick="Modal.close('edit-staff-modal')">&times;</button>
          </div>
          <form id="edit-staff-form">
            <input type="hidden" id="edit-staff-id">
            <div class="modal-body">
              <div class="form-group">
                <label class="form-label">Full Name <span class="required-star">*</span></label>
                <input type="text" id="edit-staff-name" class="form-control" required>
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">Email <span class="required-star">*</span></label>
                  <input type="email" id="edit-staff-email" class="form-control" required>
                </div>
                <div class="form-group">
                  <label class="form-label">Phone</label>
                  <input type="text" id="edit-staff-phone" class="form-control">
                </div>
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">Role <span class="required-star">*</span></label>
                  <select id="edit-staff-role" class="form-control select-dropdown" required>
                    <option value="Event Admin">Event Admin</option>
                    <option value="Manager">Manager</option>
                    <option value="Registration Staff">Registration Staff</option>
                    <option value="Check-In Staff">Check-In Staff</option>
                    <option value="Volunteer">Volunteer</option>
                    <option value="Security">Security</option>
                  </select>
                </div>
                <div class="form-group">
                  <label class="form-label">Gate</label>
                  <select id="edit-staff-gate" class="form-control select-dropdown"></select>
                </div>
              </div>
              <div class="form-group">
                <label class="form-label">Status</label>
                <select id="edit-staff-status" class="form-control select-dropdown">
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" onclick="Modal.close('edit-staff-modal')">Cancel</button>
              <button type="submit" class="btn btn-primary">Save Changes</button>
            </div>
          </form>
        </div>
      `;
      document.body.appendChild(modal);

      const form = document.getElementById('edit-staff-form');
      form.onsubmit = (e) => {
        e.preventDefault();
        const editId = document.getElementById('edit-staff-id').value;
        StorageService.updateStaff(editId, {
          name: document.getElementById('edit-staff-name').value.trim(),
          email: document.getElementById('edit-staff-email').value.trim(),
          phone: document.getElementById('edit-staff-phone').value.trim(),
          role: document.getElementById('edit-staff-role').value,
          gate: document.getElementById('edit-staff-gate').value,
          status: document.getElementById('edit-staff-status').value
        });

        Toast.success('Staff member updated');
        Modal.close('edit-staff-modal');
        this.renderStaff();
      };
    }

    const gateSelect = document.getElementById('edit-staff-gate');
    const gates = StorageService.getGates();
    let gateOpts = '<option value="Main Gate">Main Gate</option>';
    gates.forEach(g => gateOpts += `<option value="${escapeHtml(g.name)}">${escapeHtml(g.name)}</option>`);
    gateSelect.innerHTML = gateOpts;

    document.getElementById('edit-staff-id').value = member.id;
    document.getElementById('edit-staff-name').value = member.name;
    document.getElementById('edit-staff-email').value = member.email;
    document.getElementById('edit-staff-phone').value = member.phone || '';
    document.getElementById('edit-staff-role').value = member.role;
    document.getElementById('edit-staff-gate').value = member.gate || 'Main Gate';
    document.getElementById('edit-staff-status').value = member.status || 'Active';

    Modal.open('edit-staff-modal');
  }

  static deleteStaff(id) {
    const member = StorageService.getStaff().find(s => s.id === id);
    if (!member) return;

    Modal.confirm({
      title: 'Remove Staff Member?',
      message: `Are you sure you want to remove ${member.name} from the roster?`,
      confirmText: 'Remove',
      confirmClass: 'btn-danger',
      onConfirm: () => {
        StorageService.deleteStaff(id);
        Toast.error(`Removed ${member.name}`);
        this.renderStaff();
      }
    });
  }
}

window.StaffPageController = StaffPageController;
