class AdminDashboard {
    constructor() {
        this.allStudentChoices = [];
        this.supervisors = [];
        this.init();
    }

    init() {
        this.loadTitleManagement();
        this.attachEventListeners();
    }

    attachEventListeners() {
        // Title management
        $(document).on('click', '#add-title-btn', () => this.showAddTitleModal());
        $(document).on('click', '.approve-title', (e) => this.approveTitle(e));
        $(document).on('click', '.reject-title', (e) => this.rejectTitle(e));
        $(document).on('click', '.edit-title', (e) => this.editTitle(e));
        $(document).on('click', '.delete-title', (e) => this.deleteTitle(e));
        $(document).on('click', '.new-supervisor-select', (e) => this.stopPropagation(e));

        // $(document).on('click', '.new-supervisor-select', (e) => {
        //     e.stopPropagation();
        // });

        // User management
        $(document).on('click', '#upload-users-btn', () => this.showUploadModal());
        $(document).on('change', '#csv-file', (e) => this.handleFileUpload(e));

        // Allocation
        $(document).on('click', '#run-allocation-btn', () => this.runAllocation());

        // Reports
        $(document).on('click', '#generate-report-btn', () => this.generateReport());

        // System Settings
        $(document).on('click', '#system-settings-card', () => this.loadSystemSettings());

        // Capacity Conflicts
        $(document).on('click', '#capacity-conflicts-card', () => this.loadCapacityConflicts());

        // Supervisor Assignment
        $(document).on('click', '#supervisor-assignment-card', () => this.loadSupervisorAssignment());



        // Publish / Unpublish
        $(document).on('click', '#allocation-management-card', () => this.loadAllocationManagement());
        $(document).on('click', '#publish-allocations-btn', () => this.publishAllocations());
        $(document).on('click', '#unpublish-allocations-btn', () => this.unpublishAllocations());
    }

    async loadTitleManagement() {

        try {
            const response = await $.ajax({
                url: '/api/titles',
                method: 'GET',
                headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') }
            });

            let html = `
                <div class="bg-white rounded-lg shadow p-6">
                    <div class="flex justify-between items-center mb-6">
                        <h2 class="text-2xl font-bold">Title Management</h2>
                        <button id="add-title-btn" class="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">
                            Add Title
                        </button>
                    </div>
                    <div class="overflow-x-auto">
                        <table class="min-w-full table-auto">
                            <thead>
                                <tr class="bg-gray-50">
                                    <th class="px-4 py-2 text-left">Title</th>
                                    <th class="px-4 py-2 text-left">Description</th>
                                    <th class="px-4 py-2 text-left">Supervisor</th>
                                    <th class="px-4 py-2 text-left">Status</th>
                                    <th class="px-4 py-2 text-left">Actions</th>
                                </tr>
                            </thead>
                            <tbody>`;

            if (response.length === 0) {
                html += `
                    <tr>
                        <td colspan="5" class="px-4 py-8 text-center text-gray-500">
                            No titles found. Supervisors can add titles for approval.
                        </td>
                    </tr>
                `;
            } else {
                response.forEach(title => {
                    html += `
                        <tr class="border-t">
                            <td class="px-4 py-2">${title.title}</td>
                            <td class="px-4 py-2">${title.description}</td>
                            <td class="px-4 py-2">${title.supervisorName}</td>
                            <td class="px-4 py-2">
                                <span class="px-2 py-1 rounded text-xs font-semibold ${title.status === 'approved' ? 'bg-green-100 text-green-800' :
                            title.status === 'rejected' ? 'bg-red-100 text-red-800' :
                                'bg-yellow-100 text-yellow-800'
                        }">
                                    ${title.status}
                                </span>
                            </td>
                            <td class="px-4 py-2 space-x-2">
                                ${title.status === 'pending' ? `
                                    <button class="approve-title bg-green-500 text-white px-3 py-1 rounded text-sm" data-id="${title._id}">Approve</button>
                                    <button class="reject-title bg-red-500 text-white px-3 py-1 rounded text-sm" data-id="${title._id}">Reject</button>
                                ` : ''}
                                <button class="edit-title bg-blue-500 text-white px-3 py-1 rounded text-sm" 
                                        data-id="${title._id}" 
                                        data-title="${title.title}" 
                                        data-description="${title.description}">
                                    Edit
                                </button>
                                <button class="delete-title bg-red-500 text-white px-3 py-1 rounded text-sm" data-id="${title._id}">Delete</button>
                            </td>
                        </tr>`;
                });
            }

            html += `</tbody></table></div></div>`;
            $('#admin-content').html(html);
        } catch (error) {
            console.error('Error loading titles:', error);
            $('#admin-content').html('<div class="text-red-500">Error loading titles</div>');
        }
    }


    async loadEditableAllocations() {
        // Initialize pending changes
        if (!this.pendingAllocationChanges) {
            this.pendingAllocationChanges = {};
        }
        try {
            const [allocations, supervisors, settings] = await Promise.all([
                $.ajax({
                    url: '/api/allocations',
                    method: 'GET',
                    headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') }
                }),
                $.ajax({
                    url: '/api/users/supervisors',
                    method: 'GET',
                    headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') }
                }),
                $.ajax({
                    url: '/api/system-settings/allocation-status',
                    method: 'GET',
                    headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') }
                })
            ]);

            const allocationPublished = settings.allocationPublished;

            let html = `
      <div class="bg-white rounded-lg shadow p-6">
          <div class="flex justify-between items-center mb-6">
    <h2 class="text-2xl font-bold">Edit Allocations</h2>
    <div class="flex space-x-2">
      <button id="save-allocation-changes-btn"
              class="bg-gray-400 text-white px-4 py-2 rounded cursor-not-allowed" disabled>
        Save All Changes
      </button>
<button id="back-to-view-mode-btn"
        class="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600">
    Back to View Mode
</button>
    </div>
  </div>


        ${allocationPublished ? `
          <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
            <p class="text-yellow-800">
              <strong>Note:</strong> Allocations are currently published. Changes will be immediately visible to students and supervisors.
            </p>
          </div>
        ` : `
          <div class="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <p class="text-blue-800">
              <strong>Edit Mode:</strong> Allocations are not published yet. You can make changes without affecting students.
            </p>
          </div>
        `}

        <div class="overflow-x-auto">
          <table class="min-w-full table-auto">
            <thead class="bg-gray-50">
              <tr>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Student</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Title</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Current Supervisor</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">New Supervisor</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
    `;

            allocations.forEach(allocation => {
                // Build supervisor option list and preselect the current one
                const supervisorOptions = supervisors.map(s => `
        <option value="${s._id}" ${allocation.supervisorId === s._id ? 'selected' : ''}>
          ${s.name} (Capacity: ${s.capacity ?? 0})
        </option>
      `).join('');

                html += `
    <tr>
        <td>${allocation.studentName}<br/><small class="text-gray-500">${allocation.studentUsername}</small></td>
        <td>${allocation.title}${allocation.isCustomTitle ? '<span class="ml-2 inline-block px-2 py-1 text-xs bg-green-100 text-green-700 rounded">Custom</span>' : ''}</td>
        <td>${allocation.supervisorName ?? 'Not Assigned'}</td>
        <td>
            <select class="new-supervisor-select form-select border border-gray-300 rounded px-3 py-2"
                    data-allocation-id="${allocation._id}"
                    data-old-supervisor-id="${allocation.supervisorId ?? ''}">
                <option value="">No Supervisor</option>
                ${supervisorOptions}
            </select>
        </td>
        <td>${allocation.isCustomTitle ? 'Custom' : 'Regular'}</td>
        <td>${allocation.needsSupervisor ? 'Needs Supervisor' : 'Complete'}</td>
    </tr>
`;

            });

            html += `
            </tbody>
          </table>
        </div>
      </div>
    `;

            // Inject the view once
            $('#admin-content').html(html);

            // Bind edit events ONCE
            this.attachAllocationEditEvents(supervisors);

            $('#admin-content').off('click', '#back-to-view-mode-btn')
                .on('click', '#back-to-view-mode-btn', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this.loadAllocationManagement();
                });

        } catch (error) {
            console.error('Error loading editable allocations:', error);
            $('#admin-content').html('<div class="text-red-500">Error loading allocations for editing</div>');
        }
    }


    attachAllocationEditEvents(supervisors) {
        // Initialize pending changes as instance property
        if (!this.pendingAllocationChanges) {
            this.pendingAllocationChanges = {};
        }

        // Remove any existing event handlers to prevent duplicates
        $('#admin-content').off('change', '.new-supervisor-select');
        $('#admin-content').off('click', '#save-allocation-changes-btn');

        // Supervisor select change events
        $('#admin-content').on('change', '.new-supervisor-select', (e) => {
            const $select = $(e.target);
            const allocationId = $select.data('allocation-id');
            const oldSupervisorId = ($select.data('old-supervisor-id') || '').toString();
            const newSupervisorId = ($select.val() || '').toString();

            console.log('Selection changed:', { allocationId, oldSupervisorId, newSupervisorId });

            if (!newSupervisorId || newSupervisorId === oldSupervisorId) {
                delete this.pendingAllocationChanges[allocationId];
                $select.removeClass('border-yellow-400 border-green-400').addClass('border-gray-300');
            } else {
                this.pendingAllocationChanges[allocationId] = {
                    newSupervisorId: newSupervisorId,
                    oldSupervisorId: oldSupervisorId
                };
                $select.removeClass('border-gray-300').addClass('border-yellow-400');
            }

            // Update save button visibility based on changes
            this.updateSaveButtonVisibility();
        });

        // Save button click event - only trigger when button is actually clicked
        $('#admin-content').on('click', '#save-allocation-changes-btn', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.saveAllocationChanges();
        });

        // Initialize save button state
        this.updateSaveButtonVisibility();
    }

    updateSaveButtonVisibility() {
        const $saveBtn = $('#save-allocation-changes-btn');
        if (!$saveBtn.length) return;

        const hasChanges = this.pendingAllocationChanges && Object.keys(this.pendingAllocationChanges).length > 0;

        if (hasChanges) {
            $saveBtn.prop('disabled', false)
                .removeClass('bg-gray-400 cursor-not-allowed')
                .addClass('bg-green-500 hover:bg-green-600 cursor-pointer');
        } else {
            $saveBtn.prop('disabled', true)
                .removeClass('bg-green-500 hover:bg-green-600 cursor-pointer')
                .addClass('bg-gray-400 cursor-not-allowed');
        }
    }

    async saveAllocationChanges() {
        // Prevent the method from running if there are truly no changes
        if (!this.pendingAllocationChanges || Object.keys(this.pendingAllocationChanges).length === 0) {
            // Only show the info alert if this method was explicitly called (via button click)
            // but don't prevent the user from interacting with the dropdowns
            const $saveBtn = $('#save-allocation-changes-btn');
            if ($saveBtn.is(':focus') || event?.type === 'click') {
                await Swal.fire({
                    icon: 'info',
                    title: 'No Changes',
                    text: 'There are no changes to save.',
                    timer: 2000,
                    showConfirmButton: false
                });
            }
            return;
        }

        const changes = Object.entries(this.pendingAllocationChanges).map(([allocationId, change]) => ({
            allocationId,
            newSupervisorId: change.newSupervisorId
        }));

        const confirm = await Swal.fire({
            title: 'Save Changes?',
            text: `You are about to save ${changes.length} change(s). This will update supervisor assignments.`,
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Yes, Save Changes',
            cancelButtonText: 'Cancel',
            confirmButtonColor: '#10B981',
            cancelButtonColor: '#6B7280'
        });

        if (!confirm.isConfirmed) return;

        try {
            // Show loading state
            const $saveBtn = $('#save-allocation-changes-btn');
            const originalText = $saveBtn.html();
            $saveBtn.html('<i class="fas fa-spinner fa-spin mr-2"></i>Saving...');
            $saveBtn.prop('disabled', true);

            const response = await $.ajax({
                url: '/api/allocations/admin/batch-update-supervisors',
                method: 'POST',
                headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') },
                contentType: 'application/json',
                data: JSON.stringify({ changes })
            });

            // Reset pending changes
            this.pendingAllocationChanges = {};

            // Reset all select borders
            $('.new-supervisor-select').removeClass('border-yellow-400 border-green-400').addClass('border-gray-300');

            // Update save button
            this.updateSaveButtonVisibility();

            await Swal.fire({
                title: 'Success!',
                text: response.message || 'Changes saved successfully!',
                icon: 'success',
                confirmButtonText: 'OK',
                confirmButtonColor: '#10B981'
            });

            // Refresh the data
            await this.loadEditableAllocations();

        } catch (error) {
            console.error('Error saving changes:', error);

            // Restore save button
            const $saveBtn = $('#save-allocation-changes-btn');
            $saveBtn.html('Save All Changes');
            $saveBtn.prop('disabled', false);

            this.updateSaveButtonVisibility();

            await Swal.fire({
                title: 'Error',
                text: error.responseJSON?.message || 'Failed to save changes. Please try again.',
                icon: 'error',
                confirmButtonText: 'OK',
                confirmButtonColor: '#EF4444'
            });
        }
    }


    showAddTitleModal() {
        const modalHtml = `
            <div id="add-title-modal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div class="bg-white rounded-lg p-6 w-96">
                    <h3 class="text-xl font-bold mb-4">Add New Title</h3>
                    <form id="add-title-form">
                        <div class="mb-4">
                            <label class="block text-sm font-medium mb-2">Title</label>
                            <input type="text" id="title-input" class="w-full border rounded px-3 py-2" required>
                        </div>
                        <div class="mb-4">
                            <label class="block text-sm font-medium mb-2">Description</label>
                            <textarea id="description-input" class="w-full border rounded px-3 py-2" rows="3" required></textarea>
                        </div>
                        <div class="flex justify-end space-x-2">
                            <button type="button" id="cancel-add-title" class="px-4 py-2 border rounded hover:bg-gray-50">Cancel</button>
                            <button type="submit" class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">Add Title</button>
                        </div>
                    </form>
                </div>
            </div>`;

        $('body').append(modalHtml);

        $('#cancel-add-title').on('click', () => {
            $('#add-title-modal').remove();
        });

        $('#add-title-form').on('submit', (e) => this.handleAddTitle(e));
    }

    editTitle(e) {
        const titleId = $(e.target).data('id');
        const currentTitle = $(e.target).data('title');
        const currentDescription = $(e.target).data('description');

        const modalHtml = `
            <div id="edit-title-modal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div class="bg-white rounded-lg p-6 w-96">
                    <h3 class="text-xl font-bold mb-4">Edit Title</h3>
                    <form id="edit-title-form">
                        <input type="hidden" id="edit-title-id" value="${titleId}">
                        <div class="mb-4">
                            <label class="block text-sm font-medium mb-2">Title</label>
                            <input type="text" id="edit-title-input" value="${currentTitle}" class="w-full border rounded px-3 py-2" required>
                        </div>
                        <div class="mb-4">
                            <label class="block text-sm font-medium mb-2">Description</label>
                            <textarea id="edit-description-input" class="w-full border rounded px-3 py-2" rows="3" required>${currentDescription}</textarea>
                        </div>
                        <div class="flex justify-end space-x-2">
                            <button type="button" id="cancel-edit-title" class="px-4 py-2 border rounded hover:bg-gray-50">Cancel</button>
                            <button type="submit" class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">Update Title</button>
                        </div>
                    </form>
                </div>
            </div>`;

        // Remove any existing modals
        $('#edit-title-modal').remove();

        $('body').append(modalHtml);

        $('#cancel-edit-title').on('click', () => {
            $('#edit-title-modal').remove();
        });

        $('#edit-title-form').on('submit', (e) => this.handleEditTitle(e));
    }

    async handleEditTitle(e) {
        e.preventDefault();

        const titleId = $('#edit-title-id').val();
        const title = $('#edit-title-input').val();
        const description = $('#edit-description-input').val();

        if (!title.trim() || !description.trim()) {
            await SweetAlert.error('Please fill in all fields');
            return;
        }

        try {
            const response = await $.ajax({
                url: `/api/titles/${titleId}`,
                method: 'PUT',
                headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') },
                contentType: 'application/json',
                data: JSON.stringify({ title, description })
            });

            $('#edit-title-modal').remove();
            this.loadTitleManagement();
            await SweetAlert.success('Title updated successfully!');
        } catch (error) {
            await SweetAlert.error('Error updating title: ' + (error.responseJSON?.message || 'Unknown error'));
        }
    }

    async handleAddTitle(e) {
        e.preventDefault();

        const title = $('#title-input').val();
        const description = $('#description-input').val();

        if (!title.trim()) {
            await SweetAlert.error('Please enter a title');
            return;
        }

        try {
            await $.ajax({
                url: '/api/titles',
                method: 'POST',
                headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') },
                contentType: 'application/json',
                data: JSON.stringify({
                    title: title.trim(),
                    description: description.trim() || 'No description provided'
                })
            });

            $('#add-title-modal').remove();
            this.loadTitleManagement();
            await SweetAlert.success('Title added successfully! It will be reviewed by admin.');
        } catch (error) {
            await SweetAlert.error('Error adding title: ' + (error.responseJSON?.message || 'Unknown error'));
        }
    }

    async approveTitle(e) {
        const titleId = $(e.target).data('id');

        try {
            await $.ajax({
                url: `/api/titles/${titleId}/status`,
                method: 'PATCH',
                headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') },
                contentType: 'application/json',
                data: JSON.stringify({ status: 'approved' })
            });

            this.loadTitleManagement();
            await SweetAlert.success('Title approved successfully!');
        } catch (error) {
            await SweetAlert.error('Error approving title: ' + (error.responseJSON?.message || 'Unknown error'));
        }
    }

    async rejectTitle(e) {
        const titleId = $(e.target).data('id');

        try {
            await $.ajax({
                url: `/api/titles/${titleId}/status`,
                method: 'PATCH',
                headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') },
                contentType: 'application/json',
                data: JSON.stringify({ status: 'rejected' })
            });

            this.loadTitleManagement();
            await SweetAlert.success('Title rejected successfully!');
        } catch (error) {
            await SweetAlert.error('Error rejecting title: ' + (error.responseJSON?.message || 'Unknown error'));
        }
    }

    async deleteTitle(e) {
        const titleId = $(e.target).data('id');

        const result = await SweetAlert.confirm(
            'Delete Title?',
            'Are you sure you want to delete this title? This action cannot be undone.'
        );

        if (!result.isConfirmed) {
            return;
        }

        try {
            await $.ajax({
                url: `/api/titles/${titleId}`,
                method: 'DELETE',
                headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') }
            });

            this.loadTitleManagement();
            await SweetAlert.success('Title deleted successfully!');
        } catch (error) {
            await SweetAlert.error('Error deleting title: ' + (error.responseJSON?.message || 'Unknown error'));
        }
    }

    loadCacheStatistics() {
        const content = $('#admin-content');
        const stats = window.cacheManager.getStats();

        content.html(`
        <div class="bg-white rounded-lg shadow p-6">
            <div class="flex justify-between items-center mb-6">
                <h2 class="text-2xl font-bold">Cache Statistics</h2>
                <div class="flex space-x-2">
                    <button id="refresh-cache-stats" class="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">
                        Refresh
                    </button>
                    <button id="clear-all-cache" class="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600">
                        Clear All Cache
                    </button>
                </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div class="text-2xl font-bold text-blue-700">${stats.totalEntries}</div>
                    <div class="text-sm text-blue-600">Cache Entries</div>
                </div>
                <div class="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div class="text-2xl font-bold text-green-700">${stats.totalSize}</div>
                    <div class="text-sm text-green-600">Cache Size</div>
                </div>
                <div class="bg-purple-50 border border-purple-200 rounded-lg p-4">
                    <div class="text-2xl font-bold text-purple-700">${Math.round(window.cacheManager.defaultTTL / 60000)} min</div>
                    <div class="text-sm text-purple-600">Default TTL</div>
                </div>
            </div>

            <div class="mb-4">
                <h3 class="text-lg font-semibold mb-2">Cache Entries</h3>
                <div class="bg-gray-50 border rounded-lg p-4 max-h-64 overflow-y-auto">
                    ${stats.cacheKeys.length > 0 ?
                stats.cacheKeys.map(key => `<div class="text-sm font-mono py-1 border-b">${key}</div>`).join('') :
                '<p class="text-gray-500">No cache entries</p>'
            }
                </div>
            </div>
        </div>
    `);

        $('#refresh-cache-stats').on('click', () => this.loadCacheStatistics());
        $('#clear-all-cache').on('click', async () => {
            const result = await SweetAlert.confirm('Clear All Cache', 'This will clear all cached data. Continue?');
            if (result.isConfirmed) {
                window.cacheManager.clearAll();
                await SweetAlert.success('Cache cleared successfully!');
                this.loadCacheStatistics();
            }
        });
    }

    loadUserManagement() {
        const content = $('#admin-content');

        const roleOptions = `
    <option value="student">Student</option>
    <option value="supervisor">Supervisor</option>
    <option value="moduleAdmin">Module Admin</option>
`;

        content.html(`
        <div class="bg-white rounded-lg shadow p-6">
        <h2 class="text-2xl font-bold mb-6">User Management</h2>

        <!-- Users List -->
            <div class="mb-6">
                <div class="flex justify-between items-center mb-4">
                    <h3 class="text-lg font-semibold">All Users</h3>
                    <div class="flex space-x-2">
                        <select id="role-filter" class="border rounded px-3 py-2">
                            <option value="">All Roles</option>
                            <option value="student">Students</option>
                            <option value="supervisor">Supervisors</option>
                            <option value="admin">Admins</option>
                        </select>
                        <input type="text" id="user-search" placeholder="Search users..." 
                               class="border rounded px-3 py-2 w-64">
                    </div>
                </div>
                <div id="users-list">
                    <div class="text-center py-8">
                        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
                        <p class="mt-4 text-gray-600">Loading users...</p>
                    </div>
                </div>
            </div>
            
            <!-- Create User Form -->
            <div class="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
                <h3 class="text-lg font-semibold text-blue-800 mb-4">Create New User</h3>
                <form id="create-user-form" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div>
                        <label class="block text-sm font-medium mb-2">Username *</label>
                        <input type="text" id="new-username" required 
                               class="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500">
                    </div>
                    <div>
                        <label class="block text-sm font-medium mb-2">Password *</label>
                        <input type="password" id="new-password" required 
                               class="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500">
                    </div>
                    <div>
                        <label class="block text-sm font-medium mb-2">Role *</label>
                        <select id="new-role" required 
                                class="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500">
                        <option value="">Select Role</option>
                        ${roleOptions}
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium mb-2">Full Name *</label>
                        <input type="text" id="new-name" required 
                               class="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500">
                    </div>
                    <div>
                        <label class="block text-sm font-medium mb-2">Email</label>
                        <input type="email" id="new-email" 
                               class="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500">
                    </div>
                    <div id="capacity-field" class="hidden">
                        <label class="block text-sm font-medium mb-2">Capacity</label>
                        <input type="number" id="new-capacity" min="0" max="20" value="0"
                               class="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500">
                    </div>
                    <div class="md:col-span-2 flex items-end">
                        <button type="submit" 
                                class="bg-blue-500 text-white px-6 py-2 rounded hover:bg-blue-600 transition-colors">
                            Create User
                        </button>
                    </div>
                </form>
            </div>

            <!-- Bulk Upload Section -->
            <div class="bg-gray-50 border border-gray-200 rounded-lg p-6 mb-6">
                <h3 class="text-lg font-semibold text-gray-800 mb-4">Bulk Upload Users</h3>
                
                <!-- Template Download Section -->
                <div class="bg-white border border-green-200 rounded-lg p-4 mb-4">
                    <h4 class="font-semibold text-green-800 mb-2">Download CSV Template</h4>
                    <p class="text-sm text-gray-600 mb-3">
                        Download the template CSV file to ensure proper formatting for bulk upload.
                    </p>
                    <button id="download-template-btn" 
                            class="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 transition-colors flex items-center">
                        <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                        </svg>
                        Download CSV Template
                    </button>
                </div>

                <!-- Upload Section -->
                <div class="bg-white border border-blue-200 rounded-lg p-4">
                    <h4 class="font-semibold text-blue-800 mb-2">Upload Users CSV</h4>
                    <form id="bulk-upload-form" enctype="multipart/form-data" class="flex items-end space-x-4">
                        <div class="flex-1">
                            <label class="block text-sm font-medium mb-2">CSV File</label>
                            <input type="file" id="bulk-upload-file" accept=".csv" required
                                   class="w-full border rounded px-3 py-2">
                            <p class="text-xs text-gray-500 mt-1">
                                Upload CSV file with user data. Use the template above for correct formatting.
                            </p>
                        </div>
                        <button type="submit" 
                                class="bg-blue-500 text-white px-6 py-2 rounded hover:bg-blue-600 transition-colors">
                            Upload CSV
                        </button>
                    </form>
                </div>
            </div>

            <!-- CSV Format Instructions -->
            <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                <h4 class="font-semibold text-yellow-800 mb-2">CSV Format Instructions</h4>
                <div class="text-sm text-yellow-700 space-y-1">
                    <p><strong>Required columns:</strong> username, password, role, name, email, capacity</p>
                    <p><strong>Role values:</strong> student, supervisor, admin</p>
                    <p><strong>Capacity:</strong> Only required for supervisors (number of students they can supervise)</p>
                    <p><strong>Example:</strong> student1,password123,student,John Doe,john@example.com,</p>
                    <p><strong>Example:</strong> prof1,password123,supervisor,Dr. Smith,smith@example.com,5</p>
                </div>
            </div>
        </div>
    `);

        // Load users data
        this.loadUsersData();

        // Event listeners
        $('#create-user-form').on('submit', (e) => this.handleCreateUser(e));
        $('#bulk-upload-form').on('submit', (e) => this.handleBulkUpload(e));
        $('#download-template-btn').on('click', () => this.downloadCSVTemplate());
        $('#new-role').on('change', (e) => this.toggleCapacityField(e.target.value));
        $('#role-filter').on('change', () => this.filterUsers());
        $('#user-search').on('input', () => this.filterUsers());
    }

    async handleBulkUpload(e) {
        e.preventDefault();

        const fileInput = $('#bulk-upload-file')[0];
        const file = fileInput.files[0];

        if (!file) {
            await SweetAlert.error('Please select a CSV file to upload');
            return;
        }

        // Validate file type
        if (!file.name.toLowerCase().endsWith('.csv')) {
            await SweetAlert.error('Please select a CSV file');
            return;
        }

        // Validate file size (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
            await SweetAlert.error('File size must be less than 5MB');
            return;
        }

        const formData = new FormData();
        formData.append('file', file);

        try {
            SweetAlert.loading('Processing bulk upload...');

            const response = await $.ajax({
                url: '/api/users/bulk-upload',
                method: 'POST',
                headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') },
                data: formData,
                processData: false,
                contentType: false,
                timeout: 60000 // 60 second timeout
            });

            SweetAlert.close();

            // In the success message part of handleBulkUpload:
            let successMessage = `
  <div class="text-left">
    <p><strong>${response.message}</strong></p>
    <div class="mt-3 space-y-1 text-sm">
      <p>🎓 <strong>Students:</strong> ${response.totalStudentCount}</p>
      ${response.supervisorCount !== undefined ? `<p>👨‍🏫 <strong>Supervisors:</strong> ${response.supervisorCount}</p>` : ''}
      <p>📊 <strong>Total Capacity:</strong> ${response.totalSupervisorCapacity}</p>
      ${response.capacityUtilization ? `<p>📈 <strong>Capacity Utilization:</strong> ${response.capacityUtilization}</p>` : ''}
      <p>✅ <strong>Created:</strong> ${response.createdCount} users</p>
    </div>
// `;

            //             // Build success message with details
            //             let successMessage = `
            //       <div class="text-left">
            //         <p><strong>${response.message}</strong></p>
            //         <div class="mt-3 space-y-1 text-sm">
            //           <p>🎓 <strong>Students:</strong> ${response.totalStudentCount}</p>
            //           <p>👨‍🏫 <strong>Supervisors:</strong> ${response.supervisorCount}</p>
            //           <p>📊 <strong>Total Capacity:</strong> ${response.totalSupervisorCapacity}</p>
            //           ${response.capacityUtilization ? `<p>📈 <strong>Capacity Utilization:</strong> ${response.capacityUtilization}</p>` : ''}
            //           <p>✅ <strong>Created:</strong> ${response.createdCount} users</p>
            //         </div>
            //     `;

            // Handle warnings if they exist
            if (response.warnings && response.warnings.length > 0) {
                successMessage += `
        <div class="mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded">
          <p class="font-semibold text-yellow-800">⚠️ Warnings (${response.warnings.length}):</p>
          <ul class="text-xs text-yellow-700 mt-1 max-h-32 overflow-y-auto">
            ${response.warnings.slice(0, 8).map(warning => `<li class="truncate">• ${this.escapeHtml(warning)}</li>`).join('')}
            ${response.warnings.length > 8 ? `<li>... and ${response.warnings.length - 8} more warnings</li>` : ''}
          </ul>
        </div>
      `;
            }

            // Show created users preview
            if (response.createdUsers && response.createdUsers.length > 0) {
                successMessage += `
        <div class="mt-3 p-2 bg-green-50 border border-green-200 rounded">
          <p class="font-semibold text-green-800">📝 Created Users (${response.createdUsers.length}):</p>
          <ul class="text-xs text-green-700 mt-1 max-h-32 overflow-y-auto">
            ${response.createdUsers.slice(0, 10).map(user =>
                    `<li class="truncate">• ${this.escapeHtml(user.username)} (${user.role}) - ${this.escapeHtml(user.name)}</li>`
                ).join('')}
            ${response.createdUsers.length > 10 ? `<li>... and ${response.createdUsers.length - 10} more users</li>` : ''}
          </ul>
        </div>
      `;
            }

            successMessage += `</div>`;

            await Swal.fire({
                title: 'Bulk Upload Successful!',
                html: successMessage,
                icon: 'success',
                confirmButtonText: 'OK',
                width: 600
            });

            // Reset form and reload users
            $('#bulk-upload-form')[0].reset();
            this.loadUsersData();

        } catch (error) {
            SweetAlert.close();

            console.error('Upload error:', error);

            // Check if it's a validation error from the server
            if (error.responseJSON) {
                const serverError = error.responseJSON;

                // Handle validation errors
                if (serverError.errors && Array.isArray(serverError.errors)) {
                    const errors = serverError.errors.slice(0, 10);
                    const errorHtml = `
          <div class="text-left">
            <p class="font-semibold text-red-700 mb-3">${serverError.message || 'Validation errors found:'}</p>
            <div class="bg-red-50 border border-red-200 rounded p-3 max-h-60 overflow-y-auto">
              <ul class="text-sm text-red-700 space-y-1">
                ${errors.map(err => `<li>• ${this.escapeHtml(err)}</li>`).join('')}
              </ul>
              ${serverError.errors.length > 10 ?
                            `<p class="text-xs text-red-600 mt-2">... and ${serverError.errors.length - 10} more errors</p>` : ''}
            </div>
            ${serverError.totalStudentCount !== undefined ? `
              <div class="mt-3 p-2 bg-blue-50 border border-blue-200 rounded">
                <p class="text-sm font-semibold text-blue-800">Capacity Summary:</p>
                <ul class="text-xs text-blue-700 mt-1">
                  <li>Students: ${serverError.totalStudentCount}</li>
                  <li>Supervisor Capacity: ${serverError.totalSupervisorCapacity}</li>
                  ${serverError.requiredAdditionalCapacity ?
                                `<li class="text-red-600">Additional Capacity Needed: ${serverError.requiredAdditionalCapacity}</li>` : ''}
                </ul>
              </div>
            ` : ''}
          </div>
        `;

                    await Swal.fire({
                        title: 'Upload Failed',
                        html: errorHtml,
                        icon: 'error',
                        confirmButtonText: 'OK',
                        width: 600
                    });
                    return;
                }

                // Handle other server errors
                if (serverError.message) {
                    await SweetAlert.error(serverError.message);
                    return;
                }
            }

            // Handle network errors
            if (error.status === 0 || error.statusText === 'error') {
                await Swal.fire({
                    title: 'Upload Completed with Network Issue',
                    html: `
          <div class="text-left">
            <p>✅ Users were created successfully, but there was a network issue receiving the confirmation.</p>
            <p class="mt-2 text-sm text-gray-600">Please check the users list to verify the upload was complete.</p>
          </div>
        `,
                    icon: 'warning',
                    confirmButtonText: 'Check Users'
                });

                // Reset form and reload users anyway
                $('#bulk-upload-form')[0].reset();
                this.loadUsersData();
                return;
            }

            // Generic error
            await SweetAlert.error('Upload failed: ' + (error.statusText || 'Unknown error'));
        }
    }

    // Add helper method to escape HTML (prevent XSS)
    escapeHtml(unsafe) {
        if (!unsafe) return '';
        return unsafe
            .toString()
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }


    // Add this method to the AdminDashboard class
    downloadCSVTemplate() {
        try {
            // Create CSV template content
            const csvContent = `username,password,role,name,email,capacity
student1,password123,student,Student One,student1@live.mdx.ac.uk,
student2,password123,student,Student Two,student2@live.mdx.ac.uk,
supervisor1,password123,supervisor,Dr. Supervisor One,supervisor1@mdx.ac.mu,5
supervisor2,password123,supervisor,Prof. Supervisor Two,supervisor2@mdx.ac.mu,3
admin2,password123,admin,Admin User,admin2@mdx.ac.mu,

# Instructions:
# - Required columns: username, password, role, name, email, capacity
# - Role must be one of: student, supervisor, moduleAdmin
# - Capacity: Only required for supervisors (number of students they can supervise)
# - Email: Use university email format
# - Remove instruction lines (starting with #) before uploading
# - Save as CSV (Comma delimited) format`;

            // Create blob and download link
            const blob = new Blob([csvContent], { type: 'text/csv' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'users_template.csv';
            document.body.appendChild(a);
            a.click();

            // Clean up
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

            SweetAlert.success('Template downloaded successfully!');

        } catch (error) {
            console.error('Error downloading template:', error);
            SweetAlert.error('Error downloading template: ' + error.message);
        }
    }

    // Add these methods to the AdminDashboard class
    toggleCapacityField(role) {
        const capacityField = $('#capacity-field');
        if (role === 'supervisor') {
            capacityField.removeClass('hidden');
            $('#new-capacity').prop('required', true);
        } else {
            capacityField.addClass('hidden');
            $('#new-capacity').prop('required', false);
        }
    }

    async handleCreateUser(e) {
        e.preventDefault();

        const userData = {
            username: $('#new-username').val().trim(),
            password: $('#new-password').val(),
            role: $('#new-role').val(),
            name: $('#new-name').val().trim(),
            email: $('#new-email').val().trim(),
            capacity: $('#new-role').val() === 'supervisor' ? parseInt($('#new-capacity').val()) || 0 : 0
        };

        // Validation
        if (!userData.username || !userData.password || !userData.role || !userData.name) {
            await SweetAlert.error('Please fill in all required fields');
            return;
        }

        if (userData.password.length < 6) {
            await SweetAlert.error('Password must be at least 6 characters long');
            return;
        }

        try {
            SweetAlert.loading('Creating user...');

            const response = await $.ajax({
                url: '/api/users',
                method: 'POST',
                headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') },
                contentType: 'application/json',
                data: JSON.stringify(userData)
            });

            SweetAlert.close();
            await SweetAlert.success(`User ${userData.username} created successfully!`);

            // Reset form
            $('#create-user-form')[0].reset();
            $('#capacity-field').addClass('hidden');

            // Reload users list
            this.loadUsersData();

        } catch (error) {
            SweetAlert.close();
            await SweetAlert.error('Error creating user: ' + (error.responseJSON?.message || error.statusText));
        }
    }


    async loadAllocationManagement() {
        try {
            const [allocations, settings, stats] = await Promise.all([
                $.ajax({
                    url: '/api/allocations',
                    method: 'GET',
                    headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') }
                }),
                $.ajax({
                    url: '/api/system-settings/allocation-status',
                    method: 'GET',
                    headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') }
                }),
                $.ajax({
                    url: '/api/allocations/stats',
                    method: 'GET',
                    headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') }
                }).catch(() => null)
            ]);

            const allocationCompleted = settings.allocationCompleted;
            const allocationPublished = settings.allocationPublished;

            let html = `
 <div class="bg-white rounded-lg shadow p-6">
    <div class="flex justify-between items-center mb-6">
      <h2 class="text-2xl font-bold">Allocation Management</h2>
      <div class="flex space-x-2">
        ${!allocationCompleted ? `
          <button id="run-allocation-btn" class="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">
            Run Allocation
          </button>
        ` : ''}
        ${allocationCompleted && !allocationPublished ? `
          <button id="publish-allocations-btn" class="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600">
            Publish to Students & Supervisors
          </button>
          <button id="edit-allocations-btn" class="bg-yellow-500 text-white px-4 py-2 rounded hover:bg-yellow-600">
            Edit Allocations
          </button>
        ` : ''}
        ${allocationPublished ? `
          <button id="unpublish-allocations-btn" class="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600">
            Unpublish Allocations
          </button>

                        ` : ''}
                    </div>
                </div>

                <!-- Status Cards -->
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <div class="bg-gray-50 border rounded-lg p-4 text-center">
                        <div class="text-2xl font-bold ${allocationCompleted ? 'text-green-600' : 'text-gray-400'}">
                            ${allocationCompleted ? '✓' : '○'}
                        </div>
                        <div class="text-sm font-medium mt-2">Allocation Run</div>
                        <div class="text-xs text-gray-500">Process Completed</div>
                    </div>
                    <div class="bg-gray-50 border rounded-lg p-4 text-center">
                        <div class="text-2xl font-bold ${allocationPublished ? 'text-green-600' : 'text-yellow-600'}">
                            ${allocationPublished ? '✓' : '○'}
                        </div>
                        <div class="text-sm font-medium mt-2">Published Status</div>
                        <div class="text-xs text-gray-500">Visible to Users</div>
                    </div>
                    <div class="bg-gray-50 border rounded-lg p-4 text-center">
                        <div class="text-2xl font-bold text-blue-600">${allocations.length}</div>
                        <div class="text-sm font-medium mt-2">Total Allocations</div>
                        <div class="text-xs text-gray-500">Students Allocated</div>
                    </div>
                </div>

                <!-- Action Information -->
                <div class="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                    <h3 class="font-semibold text-blue-800 mb-2">Allocation Workflow</h3>
                    <div class="text-sm text-blue-700 space-y-1">
                        ${!allocationCompleted ? `
                            <p>1. <strong>Run Allocation</strong> - Process student preferences and create allocations (Admin only)</p>
                            <p>2. <strong>Review Results</strong> - Check allocations and make adjustments if needed</p>
                            <p>3. <strong>Publish</strong> - Make allocations visible to students and supervisors</p>
                        ` : !allocationPublished ? `
                            <p>✓ Allocation process completed</p>
                            <p>✓ Results are ready for review</p>
                            <p>→ <strong>Ready to publish</strong> to students and supervisors</p>
                        ` : `
                            <p>✓ Allocation process completed</p>
                            <p>✓ Results published to users</p>
                            <p>→ Students and supervisors can view their allocations</p>
                        `}
                    </div>
                </div>
        `;


            if (allocationCompleted && !allocationPublished) {
                html += `
                    <div class="mt-3">
                    <button id="edit-allocations-btn" class="btn btn-primary">Edit Allocations (Unpublished)</button>
                    </div>
                `;
            }


            // Add allocation preview table
            if (allocationCompleted && allocations.length > 0) {
                html += `
                <div class="mt-6">
                    <h3 class="text-lg font-semibold mb-4">Allocation Preview</h3>
                    <div class="overflow-x-auto border rounded-lg">
                        <table class="min-w-full table-auto">
                            <thead class="bg-gray-50">
                                <tr>
                                    <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Student</th>
                                    <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Title</th>
                                    <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Supervisor</th>
                                    <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                                </tr>
                            </thead>
                            <tbody class="bg-white divide-y divide-gray-200">
            `;

                // Show first 10 allocations as preview
                allocations.slice(0, 10).forEach(allocation => {
                    html += `
                    <tr class="hover:bg-gray-50">
                        <td class="px-4 py-3 whitespace-nowrap text-sm">
                            <div class="font-medium">${allocation.studentName}</div>
                            <div class="text-gray-500">${allocation.studentUsername}</div>
                        </td>
                        <td class="px-4 py-3 text-sm text-gray-900">
                            ${allocation.title}
                            ${allocation.isCustomTitle ? '<span class="text-xs text-green-600">(Custom)</span>' : ''}
                        </td>
                        <td class="px-4 py-3 text-sm text-gray-900">
                            ${allocation.supervisorName || 'Not Assigned'}
                        </td>
                        <td class="px-4 py-3 whitespace-nowrap">
                            <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${allocation.isCustomTitle ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}">
                                ${allocation.isCustomTitle ? 'Custom' : 'Regular'}
                            </span>
                        </td>
                    </tr>
                `;
                });

                if (allocations.length > 10) {
                    html += `
                    <tr>
                        <td colspan="4" class="px-4 py-3 text-center text-sm text-gray-500">
                            ... and ${allocations.length - 10} more allocations
                        </td>
                    </tr>
                `;
                }

                html += `</tbody></table></div>`;
            }

            html += `</div>`;
            $('#admin-content').html(html);

            // $(document).off('click', '#edit-allocations-btn')
            //     .on('click', () => this.loadEditableAllocations());
            // $('#edit-allocations-btn').off('click').on('click', () => this.loadEditableAllocations());

            $('#edit-allocations-btn').on('click', () => this.loadEditableAllocations());
            $('#publish-allocations-btn').on('click', () => this.publishAllocations());
            $('#unpublish-allocations-btn').on('click', () => this.unpublishAllocations());
            $('#run-allocation-btn').on('click', () => this.runAllocation());


        } catch (error) {
            console.error('Error loading allocation management:', error);
            $('#admin-content').html('<div class="text-red-500">Error loading allocation management</div>');
        }
    }

    async publishAllocations() {
        const result = await SweetAlert.confirm(
            'Publish Allocations?',
            'This will make allocations visible to all students and supervisors. They will be able to see their assigned titles and supervisors.'
        );

        if (!result.isConfirmed) return;

        try {
            const response = await $.ajax({
                url: '/api/allocations/publish',
                method: 'POST',
                headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') }
            });

            await SweetAlert.success(response.message);
            this.loadAllocationManagement();
        } catch (error) {
            await SweetAlert.error('Error publishing allocations: ' + (error.responseJSON?.message || 'Unknown error'));
        }
    }

    async unpublishAllocations() {
        const result = await SweetAlert.confirm(
            'Unpublish Allocations?',
            'This will hide allocations from students and supervisors. They will no longer be able to see their assigned titles.'
        );

        if (!result.isConfirmed) return;

        try {
            const response = await $.ajax({
                url: '/api/allocations/unpublish',
                method: 'POST',
                headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') }
            });

            await SweetAlert.success(response.message);
            this.loadAllocationManagement();
        } catch (error) {
            await SweetAlert.error('Error unpublishing allocations: ' + (error.responseJSON?.message || 'Unknown error'));
        }
    }


    async loadUsersData() {
        try {
            const users = await $.ajax({
                url: '/api/users',
                method: 'GET',
                headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') }
            });

            this.allUsers = users || [];
            this.currentFilteredUsers = [...this.allUsers];
            this.renderUsersList();

        } catch (error) {
            console.error('Error loading users:', error);
            $('#users-list').html(`
            <div class="text-center py-8 text-red-500">
                <p>Error loading users data. Please try again.</p>
            </div>
        `);
        }
    }

    renderUsersList() {
        const container = $('#users-list');
        const users = this.currentFilteredUsers;

        if (users.length === 0) {
            container.html(`
            <div class="text-center py-8">
                <svg class="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z"></path>
                </svg>
                <p class="text-gray-500 text-lg">No users found</p>
                <p class="text-gray-400 mt-2">Create a new user or upload a CSV file.</p>
            </div>
        `);
            return;
        }

        let html = `
        <div class="overflow-x-auto border rounded-lg">
            <table class="min-w-full table-auto">
                <thead class="bg-gray-50">
                    <tr>
                        <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                        <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                        <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                        <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Capacity</th>
                        <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                        <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                </thead>
                <tbody class="bg-white divide-y divide-gray-200">
    `;

        users.forEach(user => {
            const roleBadge = user.role === 'admin' ? 'bg-red-100 text-red-800' :
                user.role === 'moduleAdmin' ? 'bg-purple-100 text-purple-800' :
                    user.role === 'supervisor' ? 'bg-blue-100 text-blue-800' :
                        'bg-green-100 text-green-800';

            // Check if this is the main System Administrator (username 'admin')
            const isSystemAdmin = user.username === 'admin';

            html += `
            <tr class="hover:bg-gray-50">
                <td class="px-4 py-3 whitespace-nowrap">
                    <div class="flex items-center">
                        <div class="ml-4">
                            <div class="text-sm font-medium text-gray-900">${user.name}</div>
                            <div class="text-sm text-gray-500">${user.username}</div>
                            ${isSystemAdmin ? '<div class="text-xs text-red-600 font-semibold">System Administrator</div>' : ''}
                        </div>
                    </div>
                </td>
                <td class="px-4 py-3 whitespace-nowrap">
                    <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${roleBadge}">
                        ${user.role}
                    </span>
                </td>
                <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                    ${user.email || 'N/A'}
                </td>
                <td class="px-4 py-3 whitespace-nowrap">
                    ${user.role === 'supervisor' ? `
                        <div class="flex items-center space-x-2">
                            <input type="number" 
                                   value="${user.capacity || 0}" 
                                   min="0" 
                                   max="20"
                                   data-user-id="${user._id}"
                                   class="capacity-input w-20 border rounded px-2 py-1 text-sm">
                            <button class="save-capacity-btn bg-blue-500 text-white px-3 py-1 rounded text-sm hover:bg-blue-600 hidden"
                                    data-user-id="${user._id}">
                                Save
                            </button>
                        </div>
                    ` : 'N/A'}
                </td>
                <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                    ${user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}
                </td>
                <td class="px-4 py-3 whitespace-nowrap text-sm">
                    ${!isSystemAdmin ? `
                        <button class="delete-user-btn bg-red-500 text-white px-3 py-1 rounded text-sm hover:bg-red-600"
                                data-user-id="${user._id}" data-username="${user.username}">
                            Delete
                        </button>
                    ` : `
                        <span class="text-xs text-gray-400 italic">Protected</span>
                    `}
                </td>
            </tr>
        `;
        });

        html += `</tbody></table></div>`;
        container.html(html);

        // Add event listeners for dynamic elements
        this.attachUserManagementEvents();
    }


    attachUserManagementEvents() {
        // Capacity input change events
        $('.capacity-input').on('input', (e) => {
            const userId = $(e.target).data('user-id');
            $(`.save-capacity-btn[data-user-id="${userId}"]`).removeClass('hidden');
        });

        // Save capacity events
        $('.save-capacity-btn').on('click', (e) => {
            const userId = $(e.target).data('user-id');
            this.updateSupervisorCapacity(userId);
        });

        // Delete user events
        $('.delete-user-btn').on('click', (e) => {
            const userId = $(e.target).data('user-id');
            const username = $(e.target).data('username');
            this.deleteUser(userId, username);
        });
    }

    async updateSupervisorCapacity(userId) {
        const newCapacity = parseInt($(`.capacity-input[data-user-id="${userId}"]`).val());

        if (isNaN(newCapacity) || newCapacity < 0) {
            await SweetAlert.error('Please enter a valid capacity number');
            return;
        }

        try {
            SweetAlert.loading('Updating capacity...');

            const response = await $.ajax({
                url: `/api/users/${userId}/capacity`,
                method: 'PUT',
                headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') },
                contentType: 'application/json',
                data: JSON.stringify({ capacity: newCapacity })
            });

            SweetAlert.close();
            await SweetAlert.success('Supervisor capacity updated successfully!');

            // Hide save button
            $(`.save-capacity-btn[data-user-id="${userId}"]`).addClass('hidden');

            // Reload users to reflect changes
            this.loadUsersData();

        } catch (error) {
            SweetAlert.close();
            await SweetAlert.error('Error updating capacity: ' + (error.responseJSON?.message || error.statusText));
        }
    }

    async deleteUser(userId, username) {
        const result = await SweetAlert.confirm(
            'Delete User?',
            `Are you sure you want to delete user "${username}"? This action cannot be undone.`
        );

        if (!result.isConfirmed) return;

        try {
            SweetAlert.loading('Deleting user...');

            await $.ajax({
                url: `/api/users/${userId}`,
                method: 'DELETE',
                headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') }
            });

            SweetAlert.close();
            await SweetAlert.success(`User ${username} deleted successfully!`);

            // Reload users list
            this.loadUsersData();

        } catch (error) {
            SweetAlert.close();
            await SweetAlert.error('Error deleting user: ' + (error.responseJSON?.message || error.statusText));
        }
    }

    filterUsers() {
        const roleFilter = $('#role-filter').val();
        const searchTerm = $('#user-search').val().toLowerCase();

        this.currentFilteredUsers = this.allUsers.filter(user => {
            // Role filter
            if (roleFilter && user.role !== roleFilter) {
                return false;
            }

            // Search filter
            if (searchTerm) {
                const name = user.name.toLowerCase();
                const username = user.username.toLowerCase();
                const email = user.email ? user.email.toLowerCase() : '';

                if (!name.includes(searchTerm) &&
                    !username.includes(searchTerm) &&
                    !email.includes(searchTerm)) {
                    return false;
                }
            }

            return true;
        });

        this.renderUsersList();
    }

    showUploadModal() {
        $('#csv-file').click();
    }

    async handleFileUpload(e) {
        const file = e.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await $.ajax({
                url: '/api/users/bulk-upload',
                method: 'POST',
                headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') },
                data: formData,
                processData: false,
                contentType: false
            });

            await SweetAlert.success(`Successfully uploaded ${response.count} users`);
            this.loadUsersList();
        } catch (error) {
            await SweetAlert.error('Error uploading users: ' + error.responseJSON?.message);
        }
    }

    async loadUsersList() {
        try {
            const response = await $.ajax({
                url: '/api/users',
                method: 'GET',
                headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') }
            });

            let html = `
                <table class="min-w-full table-auto">
                    <thead>
                        <tr class="bg-gray-50">
                            <th class="px-4 py-2 text-left">Username</th>
                            <th class="px-4 py-2 text-left">Name</th>
                            <th class="px-4 py-2 text-left">Role</th>
                            <th class="px-4 py-2 text-left">Email</th>
                        </tr>
                    </thead>
                    <tbody>`;

            if (response.length === 0) {
                html += `
                    <tr>
                        <td colspan="4" class="px-4 py-8 text-center text-gray-500">
                            No users found. Upload a CSV file to add users.
                        </td>
                    </tr>
                `;
            } else {
                response.forEach(user => {
                    html += `
                        <tr class="border-t">
                            <td class="px-4 py-2">${user.username}</td>
                            <td class="px-4 py-2">${user.name}</td>
                            <td class="px-4 py-2">
                                <span class="px-2 py-1 rounded text-xs font-semibold ${user.role === 'admin' ? 'bg-purple-100 text-purple-800' :
                            user.role === 'supervisor' ? 'bg-blue-100 text-blue-800' :
                                'bg-green-100 text-green-800'
                        }">
                                    ${user.role}
                                </span>
                            </td>
                            <td class="px-4 py-2">${user.email}</td>
                        </tr>`;
                });
            }

            html += `</tbody></table>`;
            $('#users-list').html(html);
        } catch (error) {
            $('#users-list').html('<div class="text-red-500">Error loading users</div>');
        }
    }

    // Add to AdminDashboard class
    loadFinalizedAllocations() {
        const content = $('#admin-content');
        content.html(`
        <div class="bg-white rounded-lg shadow p-6">
            <div class="flex justify-between items-center mb-6">
                <h2 class="text-2xl font-bold">Finalized Allocations</h2>
                <div class="flex space-x-2">
                    <button id="refresh-allocations-btn" class="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 flex items-center">
                        <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
                        </svg>
                        Refresh
                    </button>
                </div>
            </div>

            <!-- Statistics Cards -->
            <div id="allocation-stats" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <!-- Stats will be loaded here -->
            </div>

            <!-- Filters and Search -->
            <div class="bg-gray-50 rounded-lg p-4 mb-6">
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div>
                        <label class="block text-sm font-medium mb-2">Filter by Supervisor</label>
                        <select id="supervisor-filter" class="w-full border rounded px-3 py-2">
                            <option value="">All Supervisors</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium mb-2">Filter by Allocation Type</label>
                        <select id="type-filter" class="w-full border rounded px-3 py-2">
                            <option value="">All Types</option>
                            <option value="regular">Regular Titles</option>
                            <option value="custom">Custom Titles</option>
                            <option value="needs_supervisor">Needs Supervisor</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium mb-2">Search Students</label>
                        <input type="text" id="student-search" placeholder="Search by student name or ID..." 
                               class="w-full border rounded px-3 py-2">
                    </div>
                </div>
                <div class="flex justify-between items-center">
                    <span id="results-count" class="text-sm text-gray-600">Loading...</span>
                    <button id="clear-filters" class="text-sm text-blue-600 hover:text-blue-800">Clear Filters</button>
                </div>
            </div>

            <!-- Allocations Table -->
            <div id="allocations-table-container">
                <div class="text-center py-8">
                    <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
                    <p class="mt-4 text-gray-600">Loading allocations...</p>
                </div>
            </div>
        </div>
    `);

        // Load data
        this.loadAllocationsData();

        // Event listeners
        $('#refresh-allocations-btn').on('click', () => this.loadAllocationsData());
        $('#supervisor-filter').on('change', () => this.filterAllocations());
        $('#type-filter').on('change', () => this.filterAllocations());
        $('#student-search').on('input', () => this.filterAllocations());
        $('#clear-filters').on('click', () => this.clearFilters());
    }

    async loadAllocationsData() {
        try {
            const [allocations, supervisors, settings] = await Promise.all([
                $.ajax({
                    url: '/api/allocations',
                    method: 'GET',
                    headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') }
                }),
                $.ajax({
                    url: '/api/users/supervisors',
                    method: 'GET',
                    headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') }
                }),
                $.ajax({
                    url: '/api/system-settings',
                    method: 'GET',
                    headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') }
                }).catch(() => ({ allocationCompleted: false }))
            ]);

            this.allAllocations = allocations || [];
            this.allSupervisors = supervisors || [];

            // Store for filtering
            this.currentFilteredAllocations = [...this.allAllocations];

            this.renderAllocationStats();
            this.renderSupervisorFilter();
            this.renderAllocationsTable();
            this.updateResultsCount();

        } catch (error) {
            console.error('Error loading allocations data:', error);
            $('#allocations-table-container').html(`
            <div class="text-center py-8 text-red-500">
                <p>Error loading allocations data. Please try again.</p>
            </div>
        `);
        }
    }

    renderAllocationStats() {
        const statsContainer = $('#allocation-stats');
        const allocations = this.allAllocations;

        const totalStudents = allocations.length;
        const customTitles = allocations.filter(a => a.isCustomTitle).length;
        const needsSupervisor = allocations.filter(a => a.needsSupervisor).length;
        const regularTitles = totalStudents - customTitles;
        const allocationRate = this.allSupervisors.length > 0 ?
            ((allocations.filter(a => a.supervisorId).length / totalStudents) * 100).toFixed(1) : 0;

        statsContainer.html(`
        <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div class="flex items-center">
                <div class="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                    <svg class="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path>
                    </svg>
                </div>
                <div>
                    <p class="text-2xl font-bold text-blue-700">${totalStudents}</p>
                    <p class="text-sm text-blue-600">Total Allocated</p>
                </div>
            </div>
        </div>

        <div class="bg-green-50 border border-green-200 rounded-lg p-4">
            <div class="flex items-center">
                <div class="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center mr-3">
                    <svg class="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                    </svg>
                </div>
                <div>
                    <p class="text-2xl font-bold text-green-700">${customTitles}</p>
                    <p class="text-sm text-green-600">Custom Titles</p>
                </div>
            </div>
        </div>

        <div class="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <div class="flex items-center">
                <div class="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center mr-3">
                    <svg class="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"></path>
                    </svg>
                </div>
                <div>
                    <p class="text-2xl font-bold text-purple-700">${regularTitles}</p>
                    <p class="text-sm text-purple-600">Regular Titles</p>
                </div>
            </div>
        </div>

        <div class="bg-orange-50 border border-orange-200 rounded-lg p-4">
            <div class="flex items-center">
                <div class="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center mr-3">
                    <svg class="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.35 16.5c-.77.833.192 2.5 1.732 2.5z"></path>
                    </svg>
                </div>
                <div>
                    <p class="text-2xl font-bold text-orange-700">${needsSupervisor}</p>
                    <p class="text-sm text-orange-600">Need Supervisor</p>
                </div>
            </div>
        </div>
    `);
    }

    renderSupervisorFilter() {
        const supervisorFilter = $('#supervisor-filter');
        let options = '<option value="">All Supervisors</option>';

        this.allSupervisors.forEach(supervisor => {
            options += `<option value="${supervisor._id}">${supervisor.name}</option>`;
        });

        supervisorFilter.html(options);
    }

    renderAllocationsTable() {
        const container = $('#allocations-table-container');
        const allocations = this.currentFilteredAllocations;

        if (allocations.length === 0) {
            container.html(`
            <div class="text-center py-8">
                <svg class="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
                <p class="text-gray-500 text-lg">No allocations found</p>
                <p class="text-gray-400 mt-2">Run the allocation process to see results here.</p>
            </div>
        `);
            return;
        }

        let tableHtml = `
        <div class="overflow-x-auto border rounded-lg">
            <table class="min-w-full table-auto">
                <thead class="bg-gray-50">
                    <tr>
                        <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Student</th>
                        <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Title</th>
                        <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Supervisor</th>
                        <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                        <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                        <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Preference</th>
                    </tr>
                </thead>
                <tbody class="bg-white divide-y divide-gray-200">
    `;

        allocations.forEach(allocation => {
            const allocationType = allocation.isCustomTitle ? 'Custom Title' : 'Regular Title';
            const typeBadge = allocation.isCustomTitle ?
                'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800';

            const statusBadge = allocation.needsSupervisor ?
                'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800';
            const statusText = allocation.needsSupervisor ? 'Needs Supervisor' : 'Complete';

            tableHtml += `
            <tr class="hover:bg-gray-50">
                <td class="px-4 py-3 whitespace-nowrap">
                    <div class="flex items-center">
                        <div class="ml-4">
                            <div class="text-sm font-medium text-gray-900">${allocation.studentName}</div>
                            <div class="text-sm text-gray-500">${allocation.studentUsername}</div>
                        </div>
                    </div>
                </td>
                <td class="px-4 py-3">
                    <div class="text-sm text-gray-900 max-w-xs truncate">${allocation.title}</div>
                    ${allocation.isCustomTitle ? '<div class="text-xs text-green-600">Custom Title</div>' : ''}
                </td>
                <td class="px-4 py-3 whitespace-nowrap">
                    <div class="text-sm text-gray-900">${allocation.supervisorName || 'Not Assigned'}</div>
                    ${allocation.originalSupervisorName && allocation.originalSupervisorName !== allocation.supervisorName ?
                    `<div class="text-xs text-gray-500">Originally: ${allocation.originalSupervisorName}</div>` : ''}
                </td>
                <td class="px-4 py-3 whitespace-nowrap">
                    <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${typeBadge}">
                        ${allocationType}
                    </span>
                </td>
                <td class="px-4 py-3 whitespace-nowrap">
                    <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusBadge}">
                        ${statusText}
                    </span>
                </td>
                <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                    ${allocation.preferenceRank ? `Rank ${allocation.preferenceRank}` : 'N/A'}
                    ${allocation.isTop3 ? '<div class="text-xs text-blue-600">Top 3 Preference</div>' : ''}
                </td>
            </tr>
        `;
        });

        tableHtml += `</tbody></table></div>`;
        container.html(tableHtml);
    }

    filterAllocations() {
        const supervisorFilter = $('#supervisor-filter').val();
        const typeFilter = $('#type-filter').val();
        const searchTerm = $('#student-search').val().toLowerCase();

        this.currentFilteredAllocations = this.allAllocations.filter(allocation => {
            // Supervisor filter
            if (supervisorFilter && allocation.supervisorId !== supervisorFilter) {
                return false;
            }

            // Type filter
            if (typeFilter === 'custom' && !allocation.isCustomTitle) {
                return false;
            }
            if (typeFilter === 'regular' && allocation.isCustomTitle) {
                return false;
            }
            if (typeFilter === 'needs_supervisor' && !allocation.needsSupervisor) {
                return false;
            }

            // Search filter
            if (searchTerm) {
                const studentName = allocation.studentName.toLowerCase();
                const studentId = allocation.studentUsername.toLowerCase();
                const title = allocation.title.toLowerCase();

                if (!studentName.includes(searchTerm) &&
                    !studentId.includes(searchTerm) &&
                    !title.includes(searchTerm)) {
                    return false;
                }
            }

            return true;
        });

        this.renderAllocationsTable();
        this.updateResultsCount();
    }

    clearFilters() {
        $('#supervisor-filter').val('');
        $('#type-filter').val('');
        $('#student-search').val('');
        this.currentFilteredAllocations = [...this.allAllocations];
        this.renderAllocationsTable();
        this.updateResultsCount();
    }

    updateResultsCount() {
        const total = this.allAllocations.length;
        const filtered = this.currentFilteredAllocations.length;
        const countText = filtered === total ?
            `Showing all ${total} allocations` :
            `Showing ${filtered} of ${total} allocations`;

        $('#results-count').text(countText);
    }

    // updated system settings
    async loadSystemSettings() {
        try {
            const response = await $.ajax({
                url: '/api/system-settings',
                method: 'GET',
                headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') }
            });

            const preferenceDeadline = response.preferenceDeadline ?
                new Date(response.preferenceDeadline).toISOString().slice(0, 16) : '';

            const titleSubmissionDeadline = response.titleSubmissionDeadline ?
                new Date(response.titleSubmissionDeadline).toISOString().slice(0, 16) : '';

            const allocationStatus = response.allocationCompleted ? 'completed' : 'not completed';

            const html = `
    <div class="bg-white rounded-lg shadow p-6">
      <h2 class="text-2xl font-bold mb-6">System Settings</h2>
      
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">

      <!-- Supervisor Title Submission Deadline -->
        <div class="border rounded-lg p-6">
          <h3 class="text-lg font-semibold mb-4 text-green-700">Supervisor Titles</h3>
          <form id="title-submission-deadline-form">
            <div class="mb-4">
              <label class="block text-sm font-medium mb-2">Title Submission Deadline</label>
              <input type="datetime-local" id="title-submission-deadline" 
                     class="w-full border rounded px-3 py-2" 
                     value="${titleSubmissionDeadline}">
              <p class="text-sm text-gray-500 mt-1">
                Supervisors cannot add/edit titles after this deadline.
              </p>
            </div>
            <div class="flex justify-between">
              <button type="button" id="clear-title-deadline" class="text-red-500 hover:text-red-700">
                Clear Deadline
              </button>
              <button type="submit" class="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600">
                Save Deadline
              </button>
            </div>
          </form>
        </div>

        <!-- Student Preference Deadline -->
        <div class="border rounded-lg p-6">
          <h3 class="text-lg font-semibold mb-4 text-blue-700">Student Preferences</h3>
          <form id="preference-deadline-form">
            <div class="mb-4">
              <label class="block text-sm font-medium mb-2">Preference Deadline</label>
              <input type="datetime-local" id="preference-deadline" 
                     class="w-full border rounded px-3 py-2" 
                     value="${preferenceDeadline}">
              <p class="text-sm text-gray-500 mt-1">
                Students cannot edit preferences after this deadline.
              </p>
            </div>
            <div class="flex justify-between">
              <button type="button" id="clear-preference-deadline" class="text-red-500 hover:text-red-700">
                Clear Deadline
              </button>
              <button type="submit" class="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">
                Save Deadline
              </button>
            </div>
          </form>
        </div>

      </div>

      <!-- Current Status Display -->
        <div class="mt-6 p-4 bg-gray-50 rounded-lg">
        <h4 class="font-semibold mb-2">Current System Status:</h4>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <!-- Left Column: Supervisor Title Editing -->
            <div>
            <span class="font-medium">Supervisor Title Editing:</span>
            <span class="ml-2 ${response.titleSubmissionDeadline && new Date() > new Date(response.titleSubmissionDeadline) ? 'text-red-600' : 'text-green-600'}">
                ${response.titleSubmissionDeadline && new Date() > new Date(response.titleSubmissionDeadline) ? 'DISABLED (Deadline passed)' : 'ENABLED'}
            </span>
            </div>

            <!-- Right Column: Student Preference Editing + Allocation View -->
            <div class="space-y-2">
            <div>
                <span class="font-medium">Student Preference Editing:</span>
                <span class="ml-2 ${response.preferenceDeadline && new Date() > new Date(response.preferenceDeadline) ? 'text-red-600' : 'text-green-600'}">
                ${response.preferenceDeadline && new Date() > new Date(response.preferenceDeadline) ? 'DISABLED (Deadline passed)' : 'ENABLED'}
                </span>
            </div>
            <div>
                <span class="font-medium">Allocation View:</span>
                <span class="ml-2 ${response.allocationCompleted ? 'text-green-600' : 'text-yellow-600'}">
                ${response.allocationCompleted ? 'ACTIVE' : 'INACTIVE'}
                </span>
            </div>
            </div>
        </div>
        </div>


            <!-- Allocation Status -->
      <div class="border rounded-lg p-6 mt-6">
        <h3 class="text-lg font-semibold mb-4">Allocation Status</h3>
        <div class="mb-4">
          <p class="text-sm text-gray-600 mb-2">Current Status: 
            <span class="font-semibold ${allocationStatus === 'completed' ? 'text-green-600' : 'text-yellow-600'}">
              ${allocationStatus.toUpperCase()}
            </span>
          </p>
          <p class="text-xs text-gray-500">
            When allocation is completed, students can only view their allocation and cannot edit preferences.
          </p>
        </div>
        <div class="flex space-x-2">
          <button id="mark-allocation-completed" 
                  class="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 ${allocationStatus === 'completed' ? 'opacity-50 cursor-not-allowed' : ''}"
                  ${allocationStatus === 'completed' ? 'disabled' : ''}>
            Mark Allocation Completed
          </button>
          <button id="mark-allocation-pending" 
                  class="bg-yellow-500 text-white px-4 py-2 rounded hover:bg-yellow-600 ${allocationStatus === 'not completed' ? 'opacity-50 cursor-not-allowed' : ''}"
                  ${allocationStatus === 'not completed' ? 'disabled' : ''}>
            Mark Allocation Pending
          </button>
        </div>
      </div>
    </div>
  `;

            $('#admin-content').html(html);
            this.attachEnhancedSystemSettingsEvents();
        } catch (error) {
            console.error('Error loading system settings:', error);
            $('#admin-content').html('<div class="text-red-500">Error loading system settings</div>');
        }
    }

    // Add this method to handle the enhanced system settings events
    attachEnhancedSystemSettingsEvents() {
        // Remove any existing event handlers to prevent duplicates
        $('#preference-deadline-form').off('submit');
        $('#title-submission-deadline-form').off('submit');
        $('#clear-preference-deadline').off('click');
        $('#clear-title-deadline').off('click');
        $('#mark-allocation-completed').off('click');
        $('#mark-allocation-pending').off('click');

        // Save preference deadline
        $('#preference-deadline-form').on('submit', (e) => this.handleSavePreferenceDeadline(e));

        // Save title submission deadline
        $('#title-submission-deadline-form').on('submit', (e) => this.handleSaveTitleSubmissionDeadline(e));

        // Clear deadlines
        $('#clear-preference-deadline').on('click', () => this.handleClearPreferenceDeadline());
        $('#clear-title-deadline').on('click', () => this.handleClearTitleSubmissionDeadline());

        // Allocation status buttons
        $('#mark-allocation-completed').on('click', () => this.handleSetAllocationStatus(true));
        $('#mark-allocation-pending').on('click', () => this.handleSetAllocationStatus(false));
    }

    // Add these new methods for handling title submission deadline
    async handleSaveTitleSubmissionDeadline(e) {
        e.preventDefault();

        const deadline = $('#title-submission-deadline').val();

        if (!deadline) {
            await SweetAlert.error('Please select a deadline date and time');
            return;
        }

        try {
            await $.ajax({
                url: '/api/system-settings/title-submission-deadline',
                method: 'POST',
                headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') },
                contentType: 'application/json',
                data: JSON.stringify({ deadline })
            });

            await SweetAlert.success('Title submission deadline saved successfully!');
            this.loadSystemSettings();
        } catch (error) {
            await SweetAlert.error('Error saving title submission deadline: ' + (error.responseJSON?.message || 'Unknown error'));
        }
    }

    async handleSavePreferenceDeadline(e) {
        e.preventDefault();

        const deadline = $('#preference-deadline').val();

        if (!deadline) {
            await SweetAlert.error('Please select a deadline date and time');
            return;
        }

        try {
            await $.ajax({
                url: '/api/system-settings/preference-deadline',
                method: 'POST',
                headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') },
                contentType: 'application/json',
                data: JSON.stringify({ deadline })
            });

            await SweetAlert.success('Preference deadline saved successfully!');
            this.loadSystemSettings();
        } catch (error) {
            await SweetAlert.error('Error saving preference deadline: ' + (error.responseJSON?.message || 'Unknown error'));
        }
    }

    async handleSaveTitleSubmissionDeadline(e) {
        e.preventDefault();

        const deadline = $('#title-submission-deadline').val();

        if (!deadline) {
            await SweetAlert.error('Please select a deadline date and time');
            return;
        }

        try {
            await $.ajax({
                url: '/api/system-settings/title-submission-deadline',
                method: 'POST',
                headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') },
                contentType: 'application/json',
                data: JSON.stringify({ deadline })
            });

            await SweetAlert.success('Title submission deadline saved successfully!');
            this.loadSystemSettings();
        } catch (error) {
            await SweetAlert.error('Error saving title submission deadline: ' + (error.responseJSON?.message || 'Unknown error'));
        }
    }

    async handleClearPreferenceDeadline() {
        const result = await SweetAlert.confirm(
            'Clear Preference Deadline?',
            'This will remove the preference deadline and allow students to edit preferences at any time.'
        );

        if (!result.isConfirmed) return;

        try {
            await $.ajax({
                url: '/api/system-settings/preference-deadline',
                method: 'POST',
                headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') },
                contentType: 'application/json',
                data: JSON.stringify({ deadline: null })
            });

            await SweetAlert.success('Preference deadline cleared successfully!');
            this.loadSystemSettings();
        } catch (error) {
            await SweetAlert.error('Error clearing preference deadline: ' + (error.responseJSON?.message || 'Unknown error'));
        }
    }

    async handleClearTitleSubmissionDeadline() {
        const result = await SweetAlert.confirm(
            'Clear Title Submission Deadline?',
            'This will remove the title submission deadline and allow supervisors to edit titles at any time.'
        );

        if (!result.isConfirmed) return;

        try {
            await $.ajax({
                url: '/api/system-settings/title-submission-deadline',
                method: 'POST',
                headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') },
                contentType: 'application/json',
                data: JSON.stringify({ deadline: null })
            });

            await SweetAlert.success('Title submission deadline cleared successfully!');
            this.loadSystemSettings();
        } catch (error) {
            await SweetAlert.error('Error clearing title submission deadline: ' + (error.responseJSON?.message || 'Unknown error'));
        }
    }

    async handleSetAllocationStatus(completed) {
        const action = completed ? 'complete' : 'revert to pending';
        const result = await SweetAlert.confirm(
            `Mark Allocation as ${completed ? 'Completed' : 'Pending'}?`,
            `This will ${action} the allocation process. Students will ${completed ? 'be able to view their allocations' : 'no longer see their allocations'}.`
        );

        if (!result.isConfirmed) return;

        try {
            await $.ajax({
                url: '/api/system-settings/allocation-completed',
                method: 'POST',
                headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') },
                contentType: 'application/json',
                data: JSON.stringify({ completed })
            });

            await SweetAlert.success(`Allocation status updated to ${completed ? 'completed' : 'pending'}!`);
            this.loadSystemSettings();
        } catch (error) {
            await SweetAlert.error('Error updating allocation status: ' + (error.responseJSON?.message || 'Unknown error'));
        }
    }

    async handleClearTitleSubmissionDeadline() {
        const result = await SweetAlert.confirm(
            'Clear Title Submission Deadline?',
            'This will remove the title submission deadline and allow supervisors to edit titles at any time.'
        );

        if (!result.isConfirmed) return;

        try {
            await $.ajax({
                url: '/api/system-settings/title-submission-deadline',
                method: 'POST',
                headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') },
                contentType: 'application/json',
                data: JSON.stringify({ deadline: null })
            });

            await SweetAlert.success('Title submission deadline cleared successfully!');
            this.loadSystemSettings();
        } catch (error) {
            await SweetAlert.error('Error clearing title submission deadline: ' + (error.responseJSON?.message || 'Unknown error'));
        }
    }

    attachSystemSettingsEvents() {
        // Save deadline
        $('#deadline-form').on('submit', (e) => this.handleSaveDeadline(e));

        // Clear deadline
        $('#clear-deadline').on('click', () => this.handleClearDeadline());

        // Allocation status buttons
        $('#mark-allocation-completed').on('click', () => this.handleSetAllocationStatus(true));
        $('#mark-allocation-pending').on('click', () => this.handleSetAllocationStatus(false));
    }

    async handleSaveDeadline(e) {
        e.preventDefault();

        const deadline = $('#preference-deadline').val();

        if (!deadline) {
            await SweetAlert.error('Please select a deadline date and time');
            return;
        }

        try {
            await $.ajax({
                url: '/api/system-settings/preference-deadline',
                method: 'POST',
                headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') },
                contentType: 'application/json',
                data: JSON.stringify({ deadline })
            });

            await SweetAlert.success('Preference deadline saved successfully!');
            this.loadSystemSettings();
        } catch (error) {
            await SweetAlert.error('Error saving deadline: ' + (error.responseJSON?.message || 'Unknown error'));
        }
    }

    async handleClearDeadline() {
        const result = await SweetAlert.confirm(
            'Clear Deadline?',
            'This will remove the preference deadline and allow students to edit preferences at any time.'
        );

        if (!result.isConfirmed) return;

        try {
            await $.ajax({
                url: '/api/system-settings/preference-deadline',
                method: 'POST',
                headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') },
                contentType: 'application/json',
                data: JSON.stringify({ deadline: null })
            });

            await SweetAlert.success('Deadline cleared successfully!');
            this.loadSystemSettings();
        } catch (error) {
            await SweetAlert.error('Error clearing deadline: ' + (error.responseJSON?.message || 'Unknown error'));
        }
    }

    async handleSetAllocationStatus(completed) {
        const action = completed ? 'complete' : 'revert to pending';
        const result = await SweetAlert.confirm(
            `Mark Allocation as ${completed ? 'Completed' : 'Pending'}?`,
            `This will ${action} the allocation process. Students will ${completed ? 'be able to view their allocations' : 'no longer see their allocations'}.`
        );

        if (!result.isConfirmed) return;

        try {
            await $.ajax({
                url: '/api/system-settings/allocation-completed',
                method: 'POST',
                headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') },
                contentType: 'application/json',
                data: JSON.stringify({ completed })
            });

            await SweetAlert.success(`Allocation status updated to ${completed ? 'completed' : 'pending'}!`);
            this.loadSystemSettings();
        } catch (error) {
            await SweetAlert.error('Error updating allocation status: ' + (error.responseJSON?.message || 'Unknown error'));
        }
    }

    async loadSupervisorAssignment() {
        try {            // Show loading state
            $('#admin-content').html(`
                <div class="bg-white rounded-lg shadow p-6">
                    <h2 class="text-2xl font-bold mb-4">Loading Supervisor Assignment...</h2>
                    <div class="text-center">
                        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
                        <p class="mt-4">Loading real-time supervisor capacity data...</p>
                    </div>
                </div>
            `);

            const response = await $.ajax({
                url: '/api/supervisor-assignment/needs-supervisor',
                method: 'GET',
                headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') }
            });

            const { allocations, supervisors } = response;

            let html = `
                <div class="bg-white rounded-lg shadow p-6">
                    <div class="flex justify-between items-center mb-6">
                        <h2 class="text-2xl font-bold">Supervisor Assignment</h2>
                        <div class="flex space-x-2">
                            <button id="auto-assign-btn" class="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600">
                                Auto-Assign All
                            </button>
                            <button onclick="window.adminDashboard.refreshSupervisorAssignment()" 
                                    class="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">
                                Refresh Data
                            </button>
                        </div>
                    </div>

                    <div class="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center">
                            <div class="text-2xl font-bold text-yellow-700">${allocations.length}</div>
                            <div class="text-sm text-yellow-600">Need Supervisor</div>
                        </div>
                        <div class="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
                            <div class="text-2xl font-bold text-blue-700">${supervisors.length}</div>
                            <div class="text-sm text-blue-600">Available Supervisors</div>
                        </div>
                        <div class="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center">
                            <div class="text-2xl font-bold text-gray-700">${supervisors.reduce((sum, s) => sum + s.remaining, 0)}</div>
                            <div class="text-sm text-gray-600">Total Remaining Capacity</div>
                        </div>
                    </div>

                    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div>
                            <h3 class="text-lg font-semibold mb-4 text-yellow-700">Allocations Needing Supervisor</h3>
            `;

            if (allocations.length === 0) {
                html += `
                    <div class="text-center py-8 text-gray-500">
                        <p>No allocations need supervisor assignment.</p>
                        <p class="mt-2">All students have been properly allocated.</p>
                    </div>
                `;
            } else {
                html += `<div class="space-y-4">`;
                allocations.forEach(allocation => {
                    html += `
                        <div class="border border-yellow-300 bg-yellow-50 rounded-lg p-4">
                            <div class="flex justify-between items-start mb-2">
                                <div>
                                    <h4 class="font-semibold">${allocation.studentName}</h4>
                                    <p class="text-sm text-gray-600">ID: ${allocation.studentUsername}</p>
                                </div>
                                <span class="bg-yellow-200 text-yellow-800 px-2 py-1 rounded text-xs font-semibold">
                                    Rank ${allocation.preferenceRank || 'N/A'}
                                </span>
                            </div>
                            <p class="text-sm mb-2"><strong>Title:</strong> ${allocation.title}</p>
                            <p class="text-sm mb-3"><strong>Original Supervisor:</strong> ${allocation.originalSupervisorName || 'Not assigned'}</p>
                            
                            <div class="flex items-center space-x-2">
                                <select class="supervisor-select border rounded px-3 py-1 text-sm" data-allocation-id="${allocation._id}">
                                    <option value="">Select Supervisor</option>
                    `;

                    supervisors.forEach(supervisor => {
                        const status = supervisor.remaining > 0 ? '🟢' : '🔴';
                        html += `<option value="${supervisor.supervisor._id}">${status} ${supervisor.supervisor.name} (${supervisor.remaining}/${supervisor.capacity})</option>`;
                    });

                    html += `
                                </select>
                                <button class="assign-supervisor-btn bg-blue-500 text-white px-3 py-1 rounded text-sm hover:bg-blue-600"
                                        data-allocation-id="${allocation._id}">
                                    Assign
                                </button>
                            </div>
                        </div>
                    `;
                });
                html += `</div>`;
            }

            html += `
                    </div>
                    <div>
                        <h3 class="text-lg font-semibold mb-4 text-blue-700">Supervisor Capacity (Real-time)</h3>
                        <div class="space-y-3">
            `;

            supervisors.forEach(supervisor => {
                const percentage = supervisor.capacity > 0 ? (supervisor.current / supervisor.capacity) * 100 : 0;
                const color = supervisor.remaining > 0 ? 'text-green-600' : 'text-red-600';

                html += `
                    <div class="border rounded-lg p-3">
                        <div class="flex justify-between items-center mb-2">
                            <span class="font-medium">${supervisor.supervisor.name}</span>
                            <span class="${color} font-semibold">${supervisor.remaining} remaining</span>
                        </div>
                        <div class="w-full bg-gray-200 rounded-full h-2">
                            <div class="bg-blue-600 h-2 rounded-full" style="width: ${percentage}%"></div>
                        </div>
                        <div class="flex justify-between text-xs text-gray-600 mt-1">
                            <span>${supervisor.current}/${supervisor.capacity} students</span>
                            <span>${Math.round(percentage)}% utilized</span>
                        </div>
                    </div>
                `;
            });

            html += `
                        </div>
                    </div>
                </div>
            `;

            $('#admin-content').html(html);
            this.attachSupervisorAssignmentEvents();
        } catch (error) {
            console.error('Error loading supervisor assignment:', error);
            $('#admin-content').html(`
                <div class="bg-white rounded-lg shadow p-6">
                    <h2 class="text-2xl font-bold mb-4 text-red-600">Error Loading Supervisor Assignment</h2>
                    <div class="bg-red-50 border border-red-200 rounded-lg p-4">
                        <p class="text-red-800">Failed to load supervisor assignment data. Please try refreshing.</p>
                        <button onclick="window.adminDashboard.loadSupervisorAssignment()" 
                                class="mt-3 bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600">
                            Retry
                        </button>
                    </div>
                </div>
            `);
        }
    }

    // NEW: Refresh method for supervisor assignment
    async refreshSupervisorAssignment() {
        try {
            await this.loadSupervisorAssignment();
            await SweetAlert.success('Supervisor assignment data refreshed!');
        } catch (error) {
            await SweetAlert.error('Error refreshing data: ' + error.message);
        }
    }

    attachSupervisorAssignmentEvents() {
        // Assign supervisor to specific allocation
        $(document).off('click', '.assign-supervisor-btn').on('click', '.assign-supervisor-btn', async (e) => {
            const allocationId = $(e.target).data('allocation-id');
            const supervisorSelect = $(`select[data-allocation-id="${allocationId}"]`);
            const supervisorId = supervisorSelect.val();

            if (!supervisorId) {
                await SweetAlert.error('Please select a supervisor');
                return;
            }

            try {
                const response = await $.ajax({
                    url: `/api/supervisor-assignment/${allocationId}/assign-supervisor`,
                    method: 'POST',
                    headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') },
                    contentType: 'application/json',
                    data: JSON.stringify({ supervisorId })
                });

                await SweetAlert.success(`Supervisor assigned: ${response.supervisorName}`);

                // Refresh the view to show updated data
                await this.loadSupervisorAssignment();

            } catch (error) {
                await SweetAlert.error('Error assigning supervisor: ' + (error.responseJSON?.message || 'Unknown error'));
            }
        });

        // Auto-assign all
        $(document).on('click', '#auto-assign-btn', async () => {
            const result = await SweetAlert.confirm(
                'Auto-Assign Supervisors?',
                'This will automatically assign available supervisors to all pending allocations.'
            );

            if (!result.isConfirmed) return;

            try {
                // Show loading state
                $('#admin-content').html(`
                    <div class="bg-white rounded-lg shadow p-6">
                        <h2 class="text-2xl font-bold mb-4">Auto-Assigning Supervisors...</h2>
                        <div class="text-center">
                            <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
                            <p class="mt-4">Assigning supervisors to ${$('.assign-supervisor-btn').length} allocations...</p>
                        </div>
                    </div>
                `);

                const response = await $.ajax({
                    url: '/api/supervisor-assignment/auto-assign',
                    method: 'POST',
                    headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') }
                });

                await SweetAlert.success(response.message);
                // Refresh the view to show updated data
                await this.loadSupervisorAssignment();

            } catch (error) {
                await SweetAlert.error('Error during auto-assignment: ' + (error.responseJSON?.message || 'Unknown error'));
                // Reload the view even on error to show current state
                await this.loadSupervisorAssignment();
            }
        });
    }

    // Add to AdminDashboard class
    async loadCapacityConflicts() {
        try {
            const response = await $.ajax({
                url: '/api/capacity-conflicts/conflicts',
                method: 'GET',
                headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') }
            });

            const { conflicts, supervisors } = response;

            let html = `
            <div class="bg-white rounded-lg shadow p-6">
                <div class="flex justify-between items-center mb-6">
                    <h2 class="text-2xl font-bold">Capacity Conflict Resolution</h2>
                    <div class="text-sm text-gray-600">
                        <span class="bg-red-100 text-red-800 px-2 py-1 rounded">
                            Conflicts: ${conflicts.length}
                        </span>
                    </div>
                </div>
        `;

            if (conflicts.length === 0) {
                html += `
                <div class="text-center py-8 text-gray-500">
                    <div class="text-4xl mb-4">✅</div>
                    <p class="text-lg">No capacity conflicts found!</p>
                    <p class="mt-2">All approved custom titles have been allocated within supervisor capacity limits.</p>
                </div>
            `;
            } else {
                html += `
                <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                    <h3 class="font-semibold text-yellow-800 mb-2">⚠️ Capacity Conflicts Detected</h3>
                    <p class="text-yellow-700 text-sm">
                        The following approved custom titles cannot be allocated because their assigned supervisors have reached capacity.
                        You need to either reassign them to other supervisors or reject the custom titles.
                    </p>
                </div>

                <div class="space-y-6">
            `;

                conflicts.forEach(conflict => {
                    html += `
                    <div class="border border-red-300 bg-red-50 rounded-lg p-6">
                        <div class="flex justify-between items-start mb-4">
                            <div>
                                <h3 class="text-lg font-semibold text-red-800">${conflict.studentName}</h3>
                                <p class="text-gray-600">ID: ${conflict.studentUsername}</p>
                            </div>
                            <span class="bg-red-200 text-red-800 px-3 py-1 rounded text-sm font-semibold">
                                Capacity Exceeded
                            </span>
                        </div>

                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                            <div>
                                <p class="text-sm"><strong>Custom Title:</strong></p>
                                <p class="font-semibold text-red-700">${conflict.customTitle}*</p>
                            </div>
                            <div>
                                <p class="text-sm"><strong>Preferred Supervisor:</strong></p>
                                <p class="font-semibold">${conflict.preferredSupervisorName}</p>
                                <p class="text-sm text-red-600">
                                    Capacity: ${conflict.supervisorCurrent}/${conflict.supervisorCapacity} students
                                </p>
                            </div>
                        </div>

                        <div class="border-t pt-4">
                            <h4 class="font-semibold mb-3">Resolution Options:</h4>
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <!-- Reassign Option -->
                                <div class="border rounded-lg p-4 bg-white">
                                    <h5 class="font-semibold text-green-700 mb-2">🔄 Reassign to Another Supervisor</h5>
                                    <form class="reassign-form" data-student-id="${conflict.studentId}">
                                        <div class="mb-3">
                                            <select class="w-full border rounded px-3 py-2 text-sm new-supervisor-select" required>
                                                <option value="">Select available supervisor</option>
                `;

                    // Add supervisor options with CORRECT capacity info
                    supervisors.forEach(supervisor => {
                        const remaining = supervisor.remainingCapacity;
                        const status = remaining > 0 ? '🟢' : '🔴';

                        html += `<option value="${supervisor.supervisorId}" ${remaining <= 0 ? 'disabled' : ''}>
                                ${status} ${supervisor.supervisorName} (${remaining}/${supervisor.capacity} remaining)
                            </option>`;
                    });

                    html += `
                                            </select>
                                        </div>
                                        <button type="submit" class="w-full bg-green-500 text-white px-3 py-2 rounded text-sm hover:bg-green-600">
                                            Reassign
                                        </button>
                                    </form>
                                </div>

                                <!-- Reject Option -->
                                <div class="border rounded-lg p-4 bg-white">
                                    <h5 class="font-semibold text-red-700 mb-2">❌ Reject Custom Title</h5>
                                    <form class="reject-form" data-student-id="${conflict.studentId}">
                                        <div class="mb-3">
                                            <textarea class="w-full border rounded px-3 py-2 text-sm" rows="2" 
                                                      placeholder="Reason for rejection (optional)"></textarea>
                                        </div>
                                        <button type="submit" class="w-full bg-red-500 text-white px-3 py-2 rounded text-sm hover:bg-red-600">
                                            Reject Custom Title
                                        </button>
                                        <p class="text-xs text-gray-500 mt-2">
                                            Student will be allocated based on regular preferences
                                        </p>
                                    </form>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
                });

                html += `</div>`; // Close space-y-6

                // Add supervisor summary table
                html += `
                <div class="mt-8">
                    <h3 class="text-lg font-semibold mb-4">Supervisor Capacity Summary</h3>
                    <div class="overflow-x-auto">
                        <table class="min-w-full table-auto">
                            <thead>
                                <tr class="bg-gray-50">
                                    <th class="px-4 py-2 text-left">Supervisor</th>
                                    <th class="px-4 py-2 text-left">Current</th>
                                    <th class="px-4 py-2 text-left">Capacity</th>
                                    <th class="px-4 py-2 text-left">Remaining</th>
                                    <th class="px-4 py-2 text-left">Status</th>
                                </tr>
                            </thead>
                            <tbody>
            `;

                supervisors.forEach(supervisor => {
                    const percentage = supervisor.capacity > 0 ? (supervisor.currentAllocations / supervisor.capacity) * 100 : 0;
                    const status = supervisor.remainingCapacity > 0 ? 'Available' : 'Full';
                    const statusColor = supervisor.remainingCapacity > 0 ? 'text-green-600' : 'text-red-600';

                    html += `
                    <tr class="border-t">
                        <td class="px-4 py-2">${supervisor.supervisorName}</td>
                        <td class="px-4 py-2">${supervisor.currentAllocations}</td>
                        <td class="px-4 py-2">${supervisor.capacity}</td>
                        <td class="px-4 py-2 ${statusColor} font-semibold">${supervisor.remainingCapacity}</td>
                        <td class="px-4 py-2">
                            <span class="px-2 py-1 rounded text-xs font-semibold ${status === 'Available' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}">
                                ${status}
                            </span>
                        </td>
                    </tr>
                `;
                });

                html += `
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
            }

            html += `</div>`; // Close main div

            $('#admin-content').html(html);
            this.attachCapacityConflictEvents();
        } catch (error) {
            console.error('Error loading capacity conflicts:', error);
            $('#admin-content').html('<div class="text-red-500">Error loading capacity conflicts</div>');
        }
    }

    attachCapacityConflictEvents() {
        // Reassign form submission
        $(document).on('submit', '.reassign-form', async (e) => {
            e.preventDefault();
            const form = $(e.target);
            const studentId = form.data('student-id');
            const newSupervisorId = form.find('.new-supervisor-select').val();

            if (!newSupervisorId) {
                await SweetAlert.error('Please select a supervisor for reassignment');
                return;
            }

            try {
                const response = await $.ajax({
                    url: '/api/capacity-conflicts/resolve',
                    method: 'POST',
                    headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') },
                    contentType: 'application/json',
                    data: JSON.stringify({
                        studentId: studentId,
                        action: 'reassign',
                        newSupervisorId: newSupervisorId
                    })
                });

                await SweetAlert.success(`Custom title reassigned to ${response.supervisorName}`);
                this.loadCapacityConflicts();
            } catch (error) {
                await SweetAlert.error('Error reassigning custom title: ' + (error.responseJSON?.message || 'Unknown error'));
            }
        });

        // Reject form submission
        $(document).on('submit', '.reject-form', async (e) => {
            e.preventDefault();
            const form = $(e.target);
            const studentId = form.data('student-id');
            const rejectReason = form.find('textarea').val();

            const result = await SweetAlert.confirm(
                'Reject Custom Title?',
                'This will reject the custom title and the student will be allocated based on their regular preferences.'
            );

            if (!result.isConfirmed) return;

            try {
                const response = await $.ajax({
                    url: '/api/capacity-conflicts/resolve',
                    method: 'POST',
                    headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') },
                    contentType: 'application/json',
                    data: JSON.stringify({
                        studentId: studentId,
                        action: 'reject',
                        rejectReason: rejectReason
                    })
                });

                await SweetAlert.success('Custom title rejected. Student will use regular preferences.');
                this.loadCapacityConflicts();
            } catch (error) {
                await SweetAlert.error('Error rejecting custom title: ' + (error.responseJSON?.message || 'Unknown error'));
            }
        });
    }


    async runAllocation() {
        const result = await SweetAlert.confirm(
            'Run Allocation Process?',
            'This will run the Gale-Shapley algorithm to allocate titles to students. This cannot be undone.'
        );

        if (!result.isConfirmed) {
            return;
        }

        $('#admin-content').html(`
            <div class="bg-white rounded-lg shadow p-6">
                <h2 class="text-2xl font-bold mb-4">Running Allocation</h2>
                <div class="text-center">
                    <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
                    <p class="mt-4">Processing allocation using Gale-Shapley algorithm...</p>
                </div>
            </div>
        `);

        try {
            const response = await $.ajax({
                url: '/api/allocations/run',
                method: 'POST',
                headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') }
            });

            $('#admin-content').html(`
                <div class="bg-white rounded-lg shadow p-6">
                    <h2 class="text-2xl font-bold mb-4 text-green-600">Allocation Complete</h2>
                    <div class="bg-green-50 border border-green-200 rounded-lg p-4">
                        <p class="text-green-800"><strong>${response.message}</strong></p>
                        <p class="text-green-700 mt-2">Total allocations: <strong>${response.allocations}</strong></p>
                        ${response.statistics ? `
                            <div class="mt-3 text-sm">
                                <p class="font-semibold">Allocation Statistics:</p>
                                <ul class="list-disc list-inside mt-1">
                                    <li>Total Students: ${response.statistics.totalStudents}</li>
                                    <li>Custom Titles: ${response.statistics.studentsWithApprovedCustomTitles}</li>
                                    <li>Regular Allocations: ${response.statistics.studentsWithRegularAllocations}</li>
                                    <li>Unallocated: ${response.statistics.unallocatedStudents}</li>
                                </ul>
                            </div>
                        ` : ''}
                    </div>
                </div>
            `);
        } catch (error) {
            $('#admin-content').html(`
                <div class="bg-white rounded-lg shadow p-6">
                    <h2 class="text-2xl font-bold mb-4 text-red-600">Allocation Failed</h2>
                    <div class="bg-red-50 border border-red-200 rounded-lg p-4">
                        <p class="text-red-800"><strong>Error:</strong> ${error.responseJSON?.message || 'Unknown error occurred'}</p>
                    </div>
                </div>
            `);
        }
    }

    async generateReport() {
        try {
            // Show loading state
            $('#admin-content').html(`
                <div class="bg-white rounded-lg shadow p-6">
                    <h2 class="text-2xl font-bold mb-4">Generating Report</h2>
                    <div class="text-center">
                        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
                        <p class="mt-4">Generating Excel report with latest allocation data...</p>
                        <p class="text-sm text-gray-600">This may take a moment as we fetch real-time data</p>
                    </div>
                </div>
            `);

            // Get the token
            const token = localStorage.getItem('token');
            if (!token) {
                throw new Error('No authentication token found. Please log in again.');
            }

            console.log('Making report request with token:', token.substring(0, 20) + '...');

            // Generate the actual report (NO NEED FOR SEPARATE REFRESH - backend uses real-time data)
            const response = await fetch('/api/reports/excel', {
                method: 'GET',
                headers: {
                    'Authorization': 'Bearer ' + token
                }
            });

            if (!response.ok) {
                const errorText = await response.text();
                let errorMessage = 'Failed to generate report';
                try {
                    const errorData = JSON.parse(errorText);
                    errorMessage = errorData.message || errorMessage;
                } catch (e) {
                    errorMessage = errorText || `Server error: ${response.status}`;
                }
                throw new Error(errorMessage);
            }

            // Convert response to blob
            const blob = await response.blob();

            // Check if blob is valid
            if (blob.size === 0) {
                throw new Error('Received empty file from server');
            }

            // Create download link
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;

            // Get filename from Content-Disposition header or use default
            const contentDisposition = response.headers.get('Content-Disposition');
            let filename = 'title_allocations.xlsx';
            if (contentDisposition) {
                const filenameMatch = contentDisposition.match(/filename="?(.+)"?/);
                if (filenameMatch) filename = filenameMatch[1];
            }
            a.download = filename;

            // Trigger download
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

            // Show success message
            $('#admin-content').html(`
                <div class="bg-white rounded-lg shadow p-6">
                    <h2 class="text-2xl font-bold mb-4 text-green-600">Report Generated Successfully</h2>
                    <div class="bg-green-50 border border-green-200 rounded-lg p-4">
                        <p class="text-green-800">
                            <strong>Excel report downloaded successfully!</strong>
                        </p>
                        <p class="text-green-700 mt-2">
                            File: <strong>${filename}</strong>
                        </p>
                        <p class="text-green-700">
                            Size: <strong>${(blob.size / 1024).toFixed(2)} KB</strong>
                        </p>
                        <p class="text-green-600 text-sm mt-2">
                            The report contains the latest allocation data with real-time supervisor capacity information.
                        </p>
                    </div>
                    <div class="mt-4">
                        <button onclick="window.adminDashboard.loadTitleManagement()" 
                                class="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">
                            Back to Dashboard
                        </button>
                    </div>
                </div>
            `);

        } catch (error) {
            console.error('Report generation error:', error);

            let errorMessage = error.message;
            if (errorMessage.includes('401') || errorMessage.includes('unauthorized') || errorMessage.includes('token')) {
                errorMessage = 'Authentication failed. Please log out and log in again.';
            }

            await SweetAlert.error(errorMessage);

            $('#admin-content').html(`
                <div class="bg-white rounded-lg shadow p-6">
                    <h2 class="text-2xl font-bold mb-4 text-red-600">Report Generation Failed</h2>
                    <div class="bg-red-50 border border-red-200 rounded-lg p-4">
                        <p class="text-red-800"><strong>Error:</strong> ${errorMessage}</p>
                        <div class="mt-3 text-sm text-red-700">
                            <p>Possible solutions:</p>
                            <ul class="list-disc list-inside mt-1">
                                <li>Log out and log in again</li>
                                <li>Check if you have admin permissions</li>
                                <li>Run the allocation process first</li>
                                <li>Check server console for errors</li>
                            </ul>
                        </div>
                    </div>
                    <div class="mt-4 flex space-x-2">
                        <button onclick="window.location.reload()" 
                                class="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">
                            Reload Page
                        </button>
                        <button onclick="window.adminDashboard.loadTitleManagement()" 
                                class="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600">
                            Back to Dashboard
                        </button>
                    </div>
                </div>
            `);
        }
    }


    // STUDENT CHOICES WITH SEARCH AND FILTER
    async loadStudentChoices() {
        try {
            const response = await $.ajax({
                url: '/api/preferences/student-choices',
                method: 'GET',
                headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') }
            });

            // FIX: Load and store supervisors for modal use
            const supervisors = await $.ajax({
                url: '/api/users/supervisors',
                method: 'GET',
                headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') }
            });

            // Store supervisors globally
            window.adminDashboardSupervisors = supervisors;
            this.supervisors = supervisors;


            // Store the data for filtering
            this.allStudentChoices = response;

            this.renderStudentChoicesWithSearch(response);

            // Add search and filter functionality
            this.setupStudentChoicesSearch();
            this.attachStudentChoicesEventListeners();
        } catch (error) {
            console.error('Error loading student choices:', error);
            $('#admin-content').html('<div class="text-red-500">Error loading student choices</div>');
        }
    }

    async ensureSupervisorsLoaded() {
        if (!this.supervisors || this.supervisors.length === 0) {
            try {
                this.supervisors = await $.ajax({
                    url: '/api/users/supervisors',
                    method: 'GET',
                    headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') }
                });
                window.adminDashboardSupervisors = this.supervisors;
            } catch (error) {
                console.error('Error loading supervisors:', error);
                throw new Error('Failed to load supervisors');
            }
        }
        return this.supervisors;
    }

    renderStudentChoicesWithSearch(students) {
        const studentsWithCustomTitles = students.filter(s => s.customTitle).length;
        const studentsWithApprovedCustom = students.filter(s => s.customTitle && s.customTitle.status === 'approved').length;
        const studentsWithRejectedCustom = students.filter(s => s.customTitle && s.customTitle.status === 'rejected').length;
        const studentsWithPendingCustom = students.filter(s => s.customTitle && (!s.customTitle.status || s.customTitle.status === 'pending')).length;

        let html = `
            <div class="bg-white rounded-lg shadow p-6">
                <div class="flex justify-between items-center mb-6">
                    <h2 class="text-2xl font-bold">All Student Choices & Preferences</h2>
                    <div class="text-sm text-gray-600">
                        <span class="bg-blue-100 text-blue-800 px-2 py-1 rounded">Total: ${students.length}</span>
                        <span class="bg-purple-100 text-purple-800 px-2 py-1 rounded ml-2">Custom: ${studentsWithCustomTitles}</span>
                    </div>
                </div>

                <!-- Search and Filter Section -->
                <div class="mb-6 grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div class="md:col-span-2">
                        <input type="text" id="search-student-choices" placeholder="Search by student name or ID..." 
                               class="w-full border rounded px-3 py-2" value="${$('#search-student-choices').val() || ''}">
                    </div>
                    <div>
                        <select id="filter-custom-title-status" class="w-full border rounded px-3 py-2">
                            <option value="all">All Custom Title Status</option>
                            <option value="has_custom">Has Custom Title</option>
                            <option value="no_custom">No Custom Title</option>
                            <option value="approved">Approved Custom</option>
                            <option value="rejected">Rejected Custom</option>
                            <option value="pending">Pending Custom</option>
                        </select>
                    </div>
                    <div>
                        <button id="clear-filters" class="w-full bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600">
                            Clear Filters
                        </button>
                    </div>
                </div>

                <!-- Expand/Collapse All Buttons -->
                <div class="mb-4 flex justify-end space-x-2">
                    <button id="expand-all-students" class="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 text-sm">
                        Expand All
                    </button>
                    <button id="collapse-all-students" class="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600 text-sm">
                        Collapse All
                    </button>
                </div>

                <!-- Statistics Cards -->
                <div class="mb-6 grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div class="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
                        <div class="text-2xl font-bold text-blue-700">${students.length}</div>
                        <div class="text-sm text-blue-600">Total Students</div>
                    </div>
                    <div class="bg-purple-50 border border-purple-200 rounded-lg p-4 text-center">
                        <div class="text-2xl font-bold text-purple-700">${studentsWithCustomTitles}</div>
                        <div class="text-sm text-purple-600">Custom Titles</div>
                    </div>
                    <div class="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                        <div class="text-2xl font-bold text-green-700">${studentsWithApprovedCustom}</div>
                        <div class="text-sm text-green-600">Approved</div>
                    </div>
                    <div class="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
                        <div class="text-2xl font-bold text-red-700">${studentsWithRejectedCustom}</div>
                        <div class="text-sm text-red-600">Rejected</div>
                    </div>
                </div>

                <div id="student-choices-results">
        `;

        if (students.length === 0) {
            html += `
                <div class="text-center py-8 text-gray-500">
                    <p>No student preferences found yet.</p>
                    <p class="mt-2">Students need to submit their title preferences first.</p>
                </div>
            `;
        } else {
            html += `<div class="space-y-6">`;

            students.forEach(student => {
                html += this.renderStudentChoiceItem(student);
            });

            html += `</div>`; // Close space-y-6
        }

        html += `
                </div>
            </div>
        `;

        $('#admin-content').html(html);

        // Set the current filter value
        $('#filter-custom-title-status').val($('#filter-custom-title-status').val() || 'all');
    }

    renderStudentChoiceItem(student) {
        return `
        <div class="border rounded-lg bg-gray-50 student-choice-item">
            <div class="flex justify-between items-center p-4 cursor-pointer student-choice-header">
                <div class="flex items-center space-x-4">
                    <svg class="w-5 h-5 transform transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
                    </svg>
                    <div>
                        <h3 class="text-lg font-semibold">${student.studentName}</h3>
                        <p class="text-gray-600">ID: ${student.studentUsername}</p>
                    </div>
                </div>
                <div class="text-right">
                    <p class="text-sm text-gray-500">Submitted: ${new Date(student.submittedAt).toLocaleString()}</p>
                    ${student.customTitle ? `
                        <span class="px-2 py-1 rounded text-xs font-semibold ${student.customTitle.status === 'approved' ? 'bg-green-100 text-green-800' :
                    student.customTitle.status === 'rejected' ? 'bg-red-100 text-red-800' :
                        'bg-yellow-100 text-yellow-800'
                }">
                            Custom Title: ${student.customTitle.status || 'pending'}
                        </span>
                    ` : ''}
                </div>
            </div>
            <div class="student-choice-details hidden p-4 border-t">
                <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <!-- Regular Preferences -->
                    <div>
                        <h4 class="font-semibold mb-3 text-blue-700">Top 5 Preferences</h4>
                        <div class="space-y-2">
                            ${student.preferences.map(pref => `
                                <div class="flex items-center justify-between p-3 bg-white border rounded-lg">
                                    <div class="flex items-center space-x-3">
                                        <span class="flex items-center justify-center w-6 h-6 bg-blue-500 text-white text-xs font-semibold rounded-full">
                                            ${pref.rank}
                                        </span>
                                        <div>
                                            <div class="font-medium">${pref.title}</div>
                                            <div class="text-sm text-gray-600">Supervisor: ${pref.supervisorName}</div>
                                        </div>
                                    </div>
                                    <span class="px-2 py-1 rounded text-xs font-semibold ${pref.titleStatus === 'approved' ? 'bg-green-100 text-green-800' :
                        pref.titleStatus === 'rejected' ? 'bg-red-100 text-red-800' :
                            pref.titleStatus === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                                'bg-gray-100 text-gray-800'
                    }">
                                        ${pref.titleStatus}
                                    </span>
                                </div>
                            `).join('')}
                        </div>
                    </div>

                    <!-- Custom Title Section -->
                    <div>
                        <h4 class="font-semibold mb-3 text-purple-700">Custom Title Proposal</h4>
                        ${student.customTitle ? `
                            <div class="p-4 bg-white border rounded-lg">
                                <div class="mb-3">
                                    <div class="font-semibold text-lg text-purple-800">${student.customTitle.title}*</div>
                                    <div class="text-sm text-gray-600 mt-1">Preferred Supervisor: ${student.customTitle.supervisorName}</div>
                                </div>
                                
                                <div class="space-y-2 text-sm">
                                    <div class="flex justify-between">
                                        <span class="font-medium">Status:</span>
                                        <span class="px-2 py-1 rounded text-xs font-semibold ${student.customTitle.status === 'approved' ? 'bg-green-100 text-green-800' :
                    student.customTitle.status === 'rejected' ? 'bg-red-100 text-red-800' :
                        'bg-yellow-100 text-yellow-800'
                }">
                                            ${student.customTitle.status || 'pending'}
                                        </span>
                                    </div>
                                    ${student.customTitle.status === 'rejected' && student.customTitle.rejectedReason ? `
                                        <div class="flex justify-between">
                                            <span class="font-medium">Rejection Reason:</span>
                                            <span class="text-red-600 text-right">${student.customTitle.rejectedReason}</span>
                                        </div>
                                    ` : ''}
                                    ${student.customTitle.status === 'approved' ? `
                                        <div class="flex justify-between">
                                            <span class="font-medium">Approval Date:</span>
                                            <span class="text-green-600">${new Date(student.submittedAt).toLocaleDateString()}</span>
                                        </div>
                                    ` : ''}
                                </div>

                                ${(!student.customTitle.status || student.customTitle.status === 'pending') ? `
                                    <div class="mt-4 flex space-x-2">
                                        <button class="approve-custom-title-from-choices bg-green-500 text-white px-3 py-1 rounded text-sm" 
                                                data-student-id="${student.studentId}"
                                                data-student-name="${student.studentName}"
                                                data-title="${student.customTitle.title}"
                                                data-preferred-supervisor="${student.customTitle.supervisorName}">
                                            Approve
                                        </button>
                                        <button class="reject-custom-title-from-choices bg-red-500 text-white px-3 py-1 rounded text-sm" 
                                                data-student-id="${student.studentId}"
                                                data-student-name="${student.studentName}"
                                                data-title="${student.customTitle.title}">
                                            Reject
                                        </button>
                                    </div>
                                ` : ''}
                            </div>
                        ` : `
                            <div class="p-4 bg-white border rounded-lg text-center text-gray-500">
                                <p>No custom title proposed</p>
                                <p class="text-sm mt-1">This student only selected from available titles</p>
                            </div>
                        `}
                    </div>
                </div>
            </div>
        </div>
    `;
    }

    setupStudentChoicesSearch() {
        $('#search-student-choices').off('input').on('input', () => {
            this.filterStudentChoices();
        });

        $('#filter-custom-title-status').off('change').on('change', () => {
            this.filterStudentChoices();
        });

        $('#clear-filters').off('click').on('click', () => {
            $('#search-student-choices').val('');
            $('#filter-custom-title-status').val('all');
            this.filterStudentChoices();
        });

        $('#expand-all-students').off('click').on('click', () => {
            $('.student-choice-details').slideDown();
            $('.student-choice-header svg').addClass('rotate-180');
        });

        $('#collapse-all-students').off('click').on('click', () => {
            $('.student-choice-details').slideUp();
            $('.student-choice-header svg').removeClass('rotate-180');
        });
    }

    filterStudentChoices() {
        const searchTerm = $('#search-student-choices').val().toLowerCase();
        const statusFilter = $('#filter-custom-title-status').val();

        const filtered = this.allStudentChoices.filter(student => {
            // Search filter
            const matchesSearch = !searchTerm ||
                student.studentName.toLowerCase().includes(searchTerm) ||
                student.studentUsername.toLowerCase().includes(searchTerm);

            // Status filter
            let matchesStatus = true;
            switch (statusFilter) {
                case 'has_custom':
                    matchesStatus = !!student.customTitle;
                    break;
                case 'no_custom':
                    matchesStatus = !student.customTitle;
                    break;
                case 'approved':
                    matchesStatus = student.customTitle && student.customTitle.status === 'approved';
                    break;
                case 'rejected':
                    matchesStatus = student.customTitle && student.customTitle.status === 'rejected';
                    break;
                case 'pending':
                    matchesStatus = student.customTitle && (!student.customTitle.status || student.customTitle.status === 'pending');
                    break;
                // 'all' matches everything
            }

            return matchesSearch && matchesStatus;
        });

        this.renderFilteredStudentChoices(filtered);
    }

    renderFilteredStudentChoices(filteredStudents) {
        const resultsContainer = $('#student-choices-results');

        if (filteredStudents.length === 0) {
            resultsContainer.html(`
                <div class="text-center py-8 text-gray-500">
                    <p>No students match your search criteria.</p>
                    <p class="mt-2">Try adjusting your search terms or filters.</p>
                </div>
            `);
        } else {
            let html = `<div class="space-y-6">`;
            filteredStudents.forEach(student => {
                html += this.renderStudentChoiceItem(student);
            });
            html += `</div>`;
            resultsContainer.html(html);

            // Re-attach event listeners for the new elements
            this.attachStudentChoicesEventListeners();
        }

        // Update the count in the header
        $('.bg-blue-100').text(`Total: ${filteredStudents.length}`);
    }

    // CUSTOM TITLES MANAGEMENT
    async loadCustomTitles() {
        try {
            const response = await $.ajax({
                url: '/api/custom-titles',
                method: 'GET',
                headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') }
            });

            // Also load supervisors for the approval dropdown
            const supervisors = await $.ajax({
                url: '/api/users/supervisors',
                method: 'GET',
                headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') }
            });

            window.adminDashboardSupervisors = supervisors;
            this.supervisors = supervisors; // Also store in current instance


            let html = `
                <div class="bg-white rounded-lg shadow p-6">
                    <div class="flex justify-between items-center mb-6">
                        <h2 class="text-2xl font-bold">Student Proposed Custom Titles</h2>
                        <div class="text-sm text-gray-600">
                            <span class="bg-yellow-100 text-yellow-800 px-2 py-1 rounded">Pending: ${response.filter(t => t.status === 'pending').length}</span>
                            <span class="bg-green-100 text-green-800 px-2 py-1 rounded ml-2">Approved: ${response.filter(t => t.status === 'approved').length}</span>
                            <span class="bg-red-100 text-red-800 px-2 py-1 rounded ml-2">Rejected: ${response.filter(t => t.status === 'rejected').length}</span>
                        </div>
                    </div>
                    <div class="overflow-x-auto">
            `;

            if (response.length === 0) {
                html += `
                    <div class="text-center py-8 text-gray-500">
                        <p>No custom titles proposed by students yet.</p>
                        <p class="mt-2">Students can suggest custom titles when selecting their preferences.</p>
                    </div>
                `;
            } else {
                html += `
                    <table class="min-w-full table-auto">
                        <thead>
                            <tr class="bg-gray-50">
                                <th class="px-4 py-2 text-left">Student Name</th>
                                <th class="px-4 py-2 text-left">Student ID</th>
                                <th class="px-4 py-2 text-left">Custom Title</th>
                                <th class="px-4 py-2 text-left">Preferred Supervisor</th>
                                <th class="px-4 py-2 text-left">Status</th>
                                <th class="px-4 py-2 text-left">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                `;

                response.forEach(item => {
                    html += `
                        <tr class="border-t">
                            <td class="px-4 py-2">${item.studentName}</td>
                            <td class="px-4 py-2">${item.studentUsername}</td>
                            <td class="px-4 py-2 font-semibold">${item.customTitle}*</td>
                            <td class="px-4 py-2">${item.preferredSupervisor}</td>
                            <td class="px-4 py-2">
                                <span class="px-2 py-1 rounded text-xs font-semibold ${item.status === 'approved' ? 'bg-green-100 text-green-800' :
                            item.status === 'rejected' ? 'bg-red-100 text-red-800' :
                                'bg-yellow-100 text-yellow-800'
                        }">
                                    ${item.status}
                                </span>
                                ${item.status === 'approved' && item.approvedSupervisorName ? `
                                    <br><span class="text-xs text-gray-600">Assigned to: ${item.approvedSupervisorName}</span>
                                ` : ''}
                                ${item.status === 'rejected' && item.rejectedReason ? `
                                    <br><span class="text-xs text-red-600">Reason: ${item.rejectedReason}</span>
                                ` : ''}
                            </td>
                            <td class="px-4 py-2 space-x-2">
                    `;

                    if (item.status === 'pending') {
                        html += `
                            <button class="approve-custom-title bg-green-500 text-white px-3 py-1 rounded text-sm" 
                                    data-student-id="${item.studentId}"
                                    data-student-name="${item.studentName}"
                                    data-title="${item.customTitle}"
                                    data-preferred-supervisor="${item.preferredSupervisor}">
                                Approve
                            </button>
                            <button class="reject-custom-title bg-red-500 text-white px-3 py-1 rounded text-sm" 
                                    data-student-id="${item.studentId}"
                                    data-student-name="${item.studentName}"
                                    data-title="${item.customTitle}">
                                Reject
                            </button>
                        `;
                    } else if (item.status === 'approved') {
                        html += `
                            <span class="text-green-600 text-sm">Approved</span>
                        `;
                    } else {
                        html += `
                            <span class="text-red-600 text-sm">Rejected</span>
                        `;
                    }

                    html += `</td></tr>`;
                });

                html += `</tbody></table>`;
            }

            html += `</div></div>`;

            // Store supervisors for use in modals
            this.supervisors = supervisors;

            $('#admin-content').html(html);

            // Attach event listeners
            this.attachCustomTitleEventListeners();
        } catch (error) {
            console.error('Error loading custom titles:', error);
            $('#admin-content').html('<div class="text-red-500">Error loading custom titles</div>');
        }
    }


    // Add this method to the AdminDashboard class
    loadSecondMarkerAssignment() {
        const content = $('#admin-content');
        content.html(`
        <div class="bg-white rounded-lg shadow p-6">
            <h2 class="text-2xl font-bold mb-6">Second Marker Assignment</h2>
            
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h3 class="font-semibold text-blue-800 mb-2">Assignment Rules</h3>
                    <ul class="text-sm text-blue-700 space-y-1">
                        <li>• Each supervisor second marks exactly the same number of students they supervise</li>
                        <li>• Supervisors cannot be second markers for their own students</li>
                        <li>• Minimizes the number of different second marker pairs</li>
                    </ul>
                </div>
                
                <div class="bg-green-50 border border-green-200 rounded-lg p-4">
                    <h3 class="font-semibold text-green-800 mb-2">Actions</h3>
                    <div class="space-y-2">
                        <button id="assign-second-markers-btn" class="w-full bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600">
                            Assign Second Markers
                        </button>
                        <button id="view-second-markers-btn" class="w-full bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">
                            View Current Assignments
                        </button>
                    </div>
                </div>
            </div>
            
            <div id="second-marker-results" class="mt-6">
                <!-- Results will be displayed here -->
            </div>
        </div>
    `);

        // Event listeners
        $('#assign-second-markers-btn').on('click', () => this.assignSecondMarkers());
        $('#view-second-markers-btn').on('click', () => this.viewSecondMarkerAssignments());
    }

    // Add these methods to the AdminDashboard class
    async assignSecondMarkers() {
        try {
            const result = await SweetAlert.confirm(
                'Assign Second Markers',
                'This will assign second markers to all allocated students based on the optimization rules. Continue?'
            );

            if (!result.isConfirmed) return;

            SweetAlert.loading('Assigning second markers...');

            const response = await $.ajax({
                url: '/api/second-markers/assign',
                method: 'POST',
                headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') }
            });

            SweetAlert.close();

            await SweetAlert.success('Second markers assigned successfully!');
            this.displaySecondMarkerResults(response);

        } catch (error) {
            SweetAlert.close();
            await SweetAlert.error('Error assigning second markers: ' + (error.responseJSON?.message || error.statusText));
        }
    }

    async viewSecondMarkerAssignments() {
        try {
            SweetAlert.loading('Loading second marker assignments...');

            const response = await $.ajax({
                url: '/api/second-markers/assignments',
                method: 'GET',
                headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') }
            });

            SweetAlert.close();
            this.displaySecondMarkerAssignments(response);

        } catch (error) {
            SweetAlert.close();
            await SweetAlert.error('Error loading assignments: ' + (error.responseJSON?.message || error.statusText));
        }
    }

    displaySecondMarkerResults(data) {
        const resultsContainer = $('#second-marker-results');

        let html = `
    <div class="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
        <h3 class="font-semibold text-green-800 mb-2">Assignment Completed Successfully</h3>
        <p class="text-green-700">Assigned second markers for ${data.assignments.length} students.</p>
        <p class="text-green-700">Pairing Efficiency: ${data.statistics.pairingEfficiency} (higher is better)</p>
    </div>
`;

        // Display statistics
        if (data.statistics && data.statistics.supervisorPairStats) {
            html += `
        <div class="mb-6">
            <h3 class="text-lg font-semibold mb-4">Supervisor Pairing Statistics</h3>
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
    `;

            data.statistics.supervisorPairStats.forEach(stat => {
                const balanceStatus = stat.isBalanced ?
                    '<span class="text-green-600">✓ Balanced</span>' :
                    '<span class="text-red-600">✗ Imbalanced</span>';

                html += `
            <div class="bg-white border rounded-lg p-4">
                <h4 class="font-semibold mb-2">${stat.supervisorName}</h4>
                <div class="text-sm space-y-1">
                    <p>Supervises: <span class="font-semibold">${stat.supervisionCount}</span> students</p>
                    <p>Second Marks: <span class="font-semibold">${stat.secondMarkingCount}</span> students</p>
                    <p>Works with: <span class="font-semibold">${stat.uniquePairs}</span> second markers</p>
                    <p>Status: ${balanceStatus}</p>
                    <p class="text-xs text-gray-600 mt-2">Partners: ${stat.pairs.join(', ') || 'None'}</p>
                </div>
            </div>
        `;
            });

            html += `</div></div>`;
        }

        // Display assignments table
        html += this.renderSecondMarkerAssignmentsTable(data.assignments);

        resultsContainer.html(html);
    }


    displaySecondMarkerAssignments(assignments) {
        const resultsContainer = $('#second-marker-results');

        let html = `
        <div class="mb-6">
            <h3 class="text-lg font-semibold mb-4">Current Second Marker Assignments</h3>
            <p class="text-gray-600 mb-4">Showing ${assignments.length} assignments</p>
        </div>
    `;

        html += this.renderSecondMarkerAssignmentsTable(assignments);

        resultsContainer.html(html);
    }

    renderSecondMarkerAssignmentsTable(assignments) {
        if (!assignments || assignments.length === 0) {
            return `
        <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
            <p class="text-yellow-700">No second marker assignments found.</p>
            <p class="text-yellow-600 text-sm mt-2">Click "Assign Second Markers" to generate assignments.</p>
        </div>
    `;
        }

        let html = `
    <div class="overflow-x-auto">
        <table class="min-w-full table-auto border-collapse">
            <thead>
                <tr class="bg-gray-50">
                    <th class="border px-4 py-2 text-left">Student ID</th>
                    <th class="border px-4 py-2 text-left">Student Name</th>
                    <th class="border px-4 py-2 text-left">Project Title</th>
                    <th class="border px-4 py-2 text-left">Supervisor</th>
                    <th class="border px-4 py-2 text-left">2nd Marker</th>
                </tr>
            </thead>
            <tbody>
`;

        assignments.forEach(assignment => {
            html += `
        <tr class="hover:bg-gray-50">
            <td class="border px-4 py-2">${assignment.studentUsername}</td>
            <td class="border px-4 py-2">${assignment.studentName}</td>
            <td class="border px-4 py-2">${assignment.title}</td>
            <td class="border px-4 py-2">${assignment.supervisorName}</td>
            <td class="border px-4 py-2 ${assignment.secondMarkerName === 'Not Assigned' ? 'text-red-600 font-semibold' : ''}">
                ${assignment.secondMarkerName}
            </td>
        </tr>
    `;
        });

        html += `</tbody></table></div>`;

        return html;
    }



    attachCustomTitleEventListeners() {
        $(document).off('click', '.approve-custom-title').on('click', '.approve-custom-title', (e) => {
            const studentId = $(e.target).data('student-id');
            const studentName = $(e.target).data('student-name');
            const title = $(e.target).data('title');
            const preferredSupervisor = $(e.target).data('preferred-supervisor');
            this.showApproveCustomTitleModal(studentId, studentName, title, preferredSupervisor);
        });

        $(document).off('click', '.reject-custom-title').on('click', '.reject-custom-title', (e) => {
            const studentId = $(e.target).data('student-id');
            const studentName = $(e.target).data('student-name');
            const title = $(e.target).data('title');
            this.showRejectCustomTitleModal(studentId, studentName, title);
        });
    }

    // Update the attachStudentChoicesEventListeners method
    attachStudentChoicesEventListeners() {
        $(document).off('click', '.approve-custom-title-from-choices').on('click', '.approve-custom-title-from-choices', (e) => {
            const studentId = $(e.target).data('student-id');
            const studentName = $(e.target).data('student-name');
            const title = $(e.target).data('title');
            const preferredSupervisor = $(e.target).data('preferred-supervisor');
            this.showApproveCustomTitleModal(studentId, studentName, title, preferredSupervisor);
        });

        $(document).off('click', '.reject-custom-title-from-choices').on('click', '.reject-custom-title-from-choices', (e) => {
            const studentId = $(e.target).data('student-id');
            const studentName = $(e.target).data('student-name');
            const title = $(e.target).data('title');
            this.showRejectCustomTitleModal(studentId, studentName, title);
        });

        // Add click event for collapsing/expanding student details
        $(document).off('click', '.student-choice-header').on('click', '.student-choice-header', function () {
            const $details = $(this).next('.student-choice-details');
            const $icon = $(this).find('svg');
            $details.slideToggle();
            $icon.toggleClass('rotate-180');
        });
    }

    async showApproveCustomTitleModal(studentId, studentName, title, preferredSupervisor) {
        try {

            // FIX: Load supervisors if not available
            let supervisors = this.supervisors || window.adminDashboardSupervisors;


            if (!supervisors || supervisors.length === 0) {
                console.log('Loading supervisors for modal...');
                supervisors = await $.ajax({
                    url: '/api/users/supervisors',
                    method: 'GET',
                    headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') }
                });
                // Store for future use
                this.supervisors = supervisors;
                window.adminDashboardSupervisors = supervisors;
            }

            // Build supervisor options
            const supervisorOptions = this.supervisors.map(supervisor =>
                `<option value="${supervisor._id}">${supervisor.name}</option>`
            ).join('');

            const modalHtml = `
            <div id="approve-custom-title-modal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div class="bg-white rounded-lg p-6 w-96">
                    <h3 class="text-xl font-bold mb-4">Approve Custom Title</h3>
                    <div class="mb-4 space-y-2">
                        <p><strong>Student:</strong> ${studentName}</p>
                        <p><strong>Custom Title:</strong> ${title}*</p>
                        <p><strong>Preferred Supervisor:</strong> ${preferredSupervisor}</p>
                    </div>
                    <form id="approve-custom-title-form">
                        <input type="hidden" id="approve-student-id" value="${studentId}">
                        <div class="mb-4">
                            <label class="block text-sm font-medium mb-2">Assign Supervisor *</label>
                            <select id="approve-supervisor-id" class="w-full border rounded px-3 py-2" required>
                                <option value="">Select a supervisor</option>
                                ${supervisorOptions}
                            </select>
                            <p class="text-xs text-gray-500 mt-1">You can assign a different supervisor than the student's preference</p>
                        </div>
                        <div class="flex justify-end space-x-2">
                            <button type="button" id="cancel-approve-custom-title" class="px-4 py-2 border rounded hover:bg-gray-50">Cancel</button>
                            <button type="submit" class="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600">Approve Title</button>
                        </div>
                    </form>
                </div>
            </div>
        `;
            $('#approve-custom-title-modal').remove();

            $('body').append(modalHtml);

            $('#cancel-approve-custom-title').on('click', () => {
                $('#approve-custom-title-modal').remove();
            });

            $('#approve-custom-title-form').on('submit', (e) => this.handleApproveCustomTitle(e));
        } catch (error) {
            console.error('Error loading supervisors for modal:', error);
            await SweetAlert.error('Error loading supervisors list. Please try again.');
        }
    }

    async handleApproveCustomTitle(e) {
        e.preventDefault();

        const studentId = $('#approve-student-id').val();
        const supervisorId = $('#approve-supervisor-id').val();

        if (!supervisorId) {
            await SweetAlert.error('Please select a supervisor');
            return;
        }

        try {
            const response = await $.ajax({
                url: `/api/custom-titles/${studentId}/approve`,
                method: 'POST',
                headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') },
                contentType: 'application/json',
                data: JSON.stringify({ supervisorId })
            });

            $('#approve-custom-title-modal').remove();
            await SweetAlert.success(`Custom title approved successfully! Assigned to ${response.supervisorName}`);

            // Refresh both views if they're active
            this.loadCustomTitles();
            this.loadStudentChoices();
        } catch (error) {
            await SweetAlert.error('Error approving custom title: ' + (error.responseJSON?.message || 'Unknown error'));
        }
    }

    showRejectCustomTitleModal(studentId, studentName, title) {
        const modalHtml = `
            <div id="reject-custom-title-modal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div class="bg-white rounded-lg p-6 w-96">
                    <h3 class="text-xl font-bold mb-4">Reject Custom Title</h3>
                    <div class="mb-4 space-y-2">
                        <p><strong>Student:</strong> ${studentName}</p>
                        <p><strong>Custom Title:</strong> ${title}*</p>
                        <p class="text-red-600 font-semibold">This student will be allocated based on their regular preferences.</p>
                    </div>
                    <form id="reject-custom-title-form">
                        <input type="hidden" id="reject-student-id" value="${studentId}">
                        <div class="mb-4">
                            <label class="block text-sm font-medium mb-2">Rejection Reason (Optional)</label>
                            <textarea id="reject-reason" class="w-full border rounded px-3 py-2" rows="3" 
                                      placeholder="Explain why this custom title was rejected..."></textarea>
                        </div>
                        <div class="flex justify-end space-x-2">
                            <button type="button" id="cancel-reject-custom-title" class="px-4 py-2 border rounded hover:bg-gray-50">Cancel</button>
                            <button type="submit" class="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600">Reject Title</button>
                        </div>
                    </form>
                </div>
            </div>
        `;

        $('body').append(modalHtml);

        $('#cancel-reject-custom-title').on('click', () => {
            $('#reject-custom-title-modal').remove();
        });

        $('#reject-custom-title-form').on('submit', (e) => this.handleRejectCustomTitle(e));
    }

    async handleRejectCustomTitle(e) {
        e.preventDefault();

        const studentId = $('#reject-student-id').val();
        const reason = $('#reject-reason').val();

        const result = await SweetAlert.confirm(
            'Reject Custom Title?',
            'Are you sure you want to reject this custom title? The student will be allocated based on their regular preferences.'
        );

        if (!result.isConfirmed) {
            $('#reject-custom-title-modal').remove();
            return;
        }

        try {
            await $.ajax({
                url: `/api/custom-titles/${studentId}/reject`,
                method: 'POST',
                headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') },
                contentType: 'application/json',
                data: JSON.stringify({ reason })
            });

            $('#reject-custom-title-modal').remove();
            await SweetAlert.success('Custom title rejected successfully!');

            // Refresh both views if they're active
            this.loadCustomTitles();
            this.loadStudentChoices();
        } catch (error) {
            await SweetAlert.error('Error rejecting custom title: ' + (error.responseJSON?.message || 'Unknown error'));
        }
    }
}

// Make it globally available
window.AdminDashboard = AdminDashboard;
