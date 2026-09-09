/**
 * EventOS - Event Tasks Management Controller
 * Section 28: Task Kanban / List, Priorities (Low, Medium, High, Urgent), Statuses
 */

document.addEventListener('DOMContentLoaded', async () => {
  if (window.AuthService) {
    const isAuthed = await AuthService.requireAuth();
    if (!isAuthed) return;
  }
  TasksPageController.init();
});

class TasksPageController {
  static init() {
    this.selectedEventId = getQueryParam('eventId') || 'all';
    this.searchQuery = '';

    this.bindControls();
    this.populateEventFilter();
    this.renderTasks();
  }

  static bindControls() {
    const searchInput = document.getElementById('tasks-search');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value.trim().toLowerCase();
        this.renderTasks();
      });
    }

    const eventFilterEl = document.getElementById('tasks-event-filter');
    if (eventFilterEl) {
      eventFilterEl.addEventListener('change', (e) => {
        this.selectedEventId = e.target.value;
        this.renderTasks();
      });
    }
  }

  static populateEventFilter() {
    const filterEl = document.getElementById('tasks-event-filter');
    if (!filterEl) return;

    const events = EventService.getAll();
    let opts = '<option value="all">All Events</option>';
    events.forEach(e => {
      const isSelected = e.id === this.selectedEventId ? 'selected' : '';
      opts += `<option value="${e.id}" ${isSelected}>${escapeHtml(e.name)}</option>`;
    });
    filterEl.innerHTML = opts;
  }

  static renderTasks() {
    let tasks = StorageService.getTasks();

    if (this.selectedEventId !== 'all') {
      tasks = tasks.filter(t => t.eventId === this.selectedEventId);
    }

    if (this.searchQuery) {
      const q = this.searchQuery;
      tasks = tasks.filter(t =>
        t.title.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.assignedTo.toLowerCase().includes(q)
      );
    }

    const todoCol = document.getElementById('kanban-col-todo');
    const inprogCol = document.getElementById('kanban-col-inprog');
    const doneCol = document.getElementById('kanban-col-done');

    if (!todoCol || !inprogCol || !doneCol) return;

    const todoTasks = tasks.filter(t => t.status === 'To Do');
    const inprogTasks = tasks.filter(t => t.status === 'In Progress');
    const doneTasks = tasks.filter(t => t.status === 'Completed');

    // Counts
    const todoCount = document.getElementById('count-todo');
    const inprogCount = document.getElementById('count-inprog');
    const doneCount = document.getElementById('count-done');
    if (todoCount) todoCount.textContent = todoTasks.length;
    if (inprogCount) inprogCount.textContent = inprogTasks.length;
    if (doneCount) doneCount.textContent = doneTasks.length;

    const renderCard = (t) => {
      return `
        <div class="card" style="padding: 1.1rem; margin-bottom: 0.85rem; border-left: 3px solid var(--border-light); transition: all 0.2s;">
          <div style="display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 0.4rem;">
            <h4 style="font-size: 0.92rem; font-weight: 700; line-height: 1.3;">${escapeHtml(t.title)}</h4>
            <span class="badge badge-${t.priority.toLowerCase()}" style="font-size: 0.65rem;">${t.priority}</span>
          </div>
          ${t.description ? `<p style="font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 0.75rem;">${escapeHtml(t.description)}</p>` : ''}
          
          <div style="display: flex; align-items: center; justify-content: space-between; font-size: 0.75rem; color: var(--text-muted); border-top: 1px solid var(--border-subtle); padding-top: 0.6rem;">
            <span>Assignee: <strong style="color: var(--text-main);">${escapeHtml(t.assignedTo)}</strong></span>
            <span>Due: ${DateUtils.formatDate(t.dueDate, 'short')}</span>
          </div>

          <div style="display: flex; align-items: center; justify-content: space-between; margin-top: 0.75rem;">
            <select class="select-dropdown" style="padding: 0.25rem 0.5rem; font-size: 0.75rem;" onchange="TasksPageController.changeStatus('${t.id}', this.value)">
              <option value="To Do" ${t.status === 'To Do' ? 'selected' : ''}>To Do</option>
              <option value="In Progress" ${t.status === 'In Progress' ? 'selected' : ''}>In Progress</option>
              <option value="Completed" ${t.status === 'Completed' ? 'selected' : ''}>Completed</option>
            </select>
            <div style="display: flex; gap: 0.2rem;">
              <button class="btn btn-ghost btn-sm btn-icon" onclick="TasksPageController.openEditModal('${t.id}')" title="Edit">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              </button>
              <button class="btn btn-ghost btn-sm btn-icon text-danger" onclick="TasksPageController.deleteTask('${t.id}')" title="Delete">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>
              </button>
            </div>
          </div>
        </div>
      `;
    };

    todoCol.innerHTML = todoTasks.length > 0 ? todoTasks.map(renderCard).join('') : '<p class="text-muted" style="text-align: center; font-size: 0.8rem; padding: 2rem 0;">No tasks</p>';
    inprogCol.innerHTML = inprogTasks.length > 0 ? inprogTasks.map(renderCard).join('') : '<p class="text-muted" style="text-align: center; font-size: 0.8rem; padding: 2rem 0;">No tasks</p>';
    doneCol.innerHTML = doneTasks.length > 0 ? doneTasks.map(renderCard).join('') : '<p class="text-muted" style="text-align: center; font-size: 0.8rem; padding: 2rem 0;">No tasks</p>';
  }

  static changeStatus(taskId, newStatus) {
    StorageService.updateTask(taskId, { status: newStatus });
    Toast.info(`Task moved to ${newStatus}`);
    this.renderTasks();
  }

  static openAddModal() {
    let modal = document.getElementById('add-task-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'add-task-modal';
      modal.className = 'modal-backdrop';
      modal.innerHTML = `
        <div class="modal-dialog">
          <div class="modal-header">
            <h3 class="modal-title">Create Event Task</h3>
            <button class="modal-close" onclick="Modal.close('add-task-modal')">&times;</button>
          </div>
          <form id="add-task-form">
            <div class="modal-body">
              <div class="form-group">
                <label class="form-label">Event</label>
                <select id="task-event-select" class="form-control select-dropdown"></select>
              </div>
              <div class="form-group">
                <label class="form-label">Task Title <span class="required-star">*</span></label>
                <input type="text" id="task-title" class="form-control" required placeholder="e.g. Stage LED Screen Setup">
              </div>
              <div class="form-group">
                <label class="form-label">Description</label>
                <textarea id="task-desc" class="form-control" rows="2" placeholder="Task execution instructions"></textarea>
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">Assigned To</label>
                  <input type="text" id="task-assigned" class="form-control" placeholder="Staff or Team Lead">
                </div>
                <div class="form-group">
                  <label class="form-label">Due Date</label>
                  <input type="date" id="task-due-date" class="form-control">
                </div>
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">Priority</label>
                  <select id="task-priority" class="form-control select-dropdown">
                    <option value="Low">Low</option>
                    <option value="Medium" selected>Medium</option>
                    <option value="High">High</option>
                    <option value="Urgent">Urgent</option>
                  </select>
                </div>
                <div class="form-group">
                  <label class="form-label">Status</label>
                  <select id="task-status" class="form-control select-dropdown">
                    <option value="To Do" selected>To Do</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Completed">Completed</option>
                  </select>
                </div>
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" onclick="Modal.close('add-task-modal')">Cancel</button>
              <button type="submit" class="btn btn-primary">Create Task</button>
            </div>
          </form>
        </div>
      `;
      document.body.appendChild(modal);

      const form = document.getElementById('add-task-form');
      form.onsubmit = (e) => {
        e.preventDefault();
        const newTask = StorageService.createTask({
          eventId: document.getElementById('task-event-select').value,
          title: document.getElementById('task-title').value.trim(),
          description: document.getElementById('task-desc').value.trim(),
          assignedTo: document.getElementById('task-assigned').value.trim() || 'Unassigned',
          dueDate: document.getElementById('task-due-date').value || new Date().toISOString().split('T')[0],
          priority: document.getElementById('task-priority').value,
          status: document.getElementById('task-status').value
        });

        StorageService.createActivity({
          eventId: newTask.eventId,
          type: 'task',
          message: `Created task: "${newTask.title}"`
        });

        Toast.success('Task created successfully');
        Modal.close('add-task-modal');
        form.reset();
        this.renderTasks();
      };
    }

    const evtSel = document.getElementById('task-event-select');
    evtSel.innerHTML = EventService.getAll().map(e => `<option value="${e.id}">${escapeHtml(e.name)}</option>`).join('');

    const today = new Date().toISOString().split('T')[0];
    const dueEl = document.getElementById('task-due-date');
    if (dueEl) dueEl.value = today;

    Modal.open('add-task-modal');
  }

  static openEditModal(id) {
    const task = StorageService.getTasks().find(t => t.id === id);
    if (!task) return;

    let modal = document.getElementById('edit-task-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'edit-task-modal';
      modal.className = 'modal-backdrop';
      modal.innerHTML = `
        <div class="modal-dialog">
          <div class="modal-header">
            <h3 class="modal-title">Edit Task</h3>
            <button class="modal-close" onclick="Modal.close('edit-task-modal')">&times;</button>
          </div>
          <form id="edit-task-form">
            <input type="hidden" id="edit-task-id">
            <div class="modal-body">
              <div class="form-group">
                <label class="form-label">Task Title <span class="required-star">*</span></label>
                <input type="text" id="edit-task-title" class="form-control" required>
              </div>
              <div class="form-group">
                <label class="form-label">Description</label>
                <textarea id="edit-task-desc" class="form-control" rows="2"></textarea>
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">Assigned To</label>
                  <input type="text" id="edit-task-assigned" class="form-control">
                </div>
                <div class="form-group">
                  <label class="form-label">Due Date</label>
                  <input type="date" id="edit-task-due-date" class="form-control">
                </div>
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">Priority</label>
                  <select id="edit-task-priority" class="form-control select-dropdown">
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                    <option value="Urgent">Urgent</option>
                  </select>
                </div>
                <div class="form-group">
                  <label class="form-label">Status</label>
                  <select id="edit-task-status" class="form-control select-dropdown">
                    <option value="To Do">To Do</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Completed">Completed</option>
                  </select>
                </div>
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" onclick="Modal.close('edit-task-modal')">Cancel</button>
              <button type="submit" class="btn btn-primary">Save Changes</button>
            </div>
          </form>
        </div>
      `;
      document.body.appendChild(modal);

      const form = document.getElementById('edit-task-form');
      form.onsubmit = (e) => {
        e.preventDefault();
        const editId = document.getElementById('edit-task-id').value;
        StorageService.updateTask(editId, {
          title: document.getElementById('edit-task-title').value.trim(),
          description: document.getElementById('edit-task-desc').value.trim(),
          assignedTo: document.getElementById('edit-task-assigned').value.trim(),
          dueDate: document.getElementById('edit-task-due-date').value,
          priority: document.getElementById('edit-task-priority').value,
          status: document.getElementById('edit-task-status').value
        });

        Toast.success('Task updated');
        Modal.close('edit-task-modal');
        this.renderTasks();
      };
    }

    document.getElementById('edit-task-id').value = task.id;
    document.getElementById('edit-task-title').value = task.title;
    document.getElementById('edit-task-desc').value = task.description || '';
    document.getElementById('edit-task-assigned').value = task.assignedTo || '';
    document.getElementById('edit-task-due-date').value = task.dueDate || '';
    document.getElementById('edit-task-priority').value = task.priority || 'Medium';
    document.getElementById('edit-task-status').value = task.status || 'To Do';

    Modal.open('edit-task-modal');
  }

  static deleteTask(id) {
    const task = StorageService.getTasks().find(t => t.id === id);
    if (!task) return;

    Modal.confirm({
      title: 'Delete Task?',
      message: `Are you sure you want to delete "${task.title}"?`,
      confirmText: 'Delete',
      confirmClass: 'btn-danger',
      onConfirm: () => {
        StorageService.deleteTask(id);
        Toast.error(`Deleted "${task.title}"`);
        this.renderTasks();
      }
    });
  }
}

window.TasksPageController = TasksPageController;
