// Admin Panel JavaScript
const API_URL = window.location.origin;
let authToken = null;
let currentView = 'dashboard';

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    setupEventListeners();
});

function setupEventListeners() {
    // Login
    document.getElementById('loginForm').addEventListener('submit', handleLogin);
    
    // Logout
    document.getElementById('logoutBtn').addEventListener('click', handleLogout);
    
    // Navigation
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => {
            const screen = item.dataset.screen;
            switchView(screen);
        });
    });
    
    // Refresh
    document.getElementById('refreshBtn').addEventListener('click', () => {
        loadView(currentView);
    });
    
    // Search and filters
    document.getElementById('userSearch')?.addEventListener('input', filterUsers);
    document.getElementById('userRoleFilter')?.addEventListener('change', filterUsers);
    document.getElementById('appointmentSearch')?.addEventListener('input', filterAppointments);
    document.getElementById('appointmentStatusFilter')?.addEventListener('change', filterAppointments);
    document.getElementById('transactionSearch')?.addEventListener('input', filterTransactions);
    document.getElementById('transactionTypeFilter')?.addEventListener('change', filterTransactions);
}

function checkAuth() {
    authToken = localStorage.getItem('admin_token');
    if (authToken) {
        showDashboard();
    } else {
        showLogin();
    }
}

function showLogin() {
    document.getElementById('loginScreen').classList.add('active');
    document.getElementById('dashboardScreen').classList.remove('active');
}

function showDashboard() {
    document.getElementById('loginScreen').classList.remove('active');
    document.getElementById('dashboardScreen').classList.add('active');
    loadView('dashboard');
}

async function handleLogin(e) {
    e.preventDefault();
    const username = document.getElementById('adminUsername').value;
    const password = document.getElementById('adminPassword').value;
    
    // Simple authentication (in production, this should be server-side)
    if (username === 'admin' && password === 'admin123') {
        authToken = 'admin_token_' + Date.now();
        localStorage.setItem('admin_token', authToken);
        showDashboard();
    } else {
        alert('Invalid credentials');
    }
}

function handleLogout() {
    if (confirm('Are you sure you want to logout?')) {
        localStorage.removeItem('admin_token');
        authToken = null;
        location.reload(); // Refresh to show login screen
    }
}

function switchView(viewName) {
    currentView = viewName;
    
    // Update nav
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
        if (item.dataset.screen === viewName) {
            item.classList.add('active');
        }
    });
    
    // Update page title
    const titles = {
        dashboard: 'Dashboard',
        users: 'User Management',
        appointments: 'Appointments',
        transactions: 'Transactions',
        disputes: 'Disputes',
        analytics: 'Analytics'
    };
    document.getElementById('pageTitle').textContent = titles[viewName];
    
    // Show view
    document.querySelectorAll('.view').forEach(view => {
        view.classList.remove('active');
    });
    document.getElementById(`${viewName}View`).classList.add('active');
    
    // Load data
    loadView(viewName);
}

async function loadView(viewName) {
    switch(viewName) {
        case 'dashboard':
            await loadDashboard();
            break;
        case 'users':
            await loadUsers();
            break;
        case 'appointments':
            await loadAppointments();
            break;
        case 'transactions':
            await loadTransactions();
            break;
        case 'disputes':
            await loadDisputes();
            break;
        case 'analytics':
            await loadAnalytics();
            break;
    }
}

// Dashboard
async function loadDashboard() {
    try {
        const [users, matches, appointments, transactions, disputes] = await Promise.all([
            fetch(`${API_URL}/api/admin/stats/users`).then(r => r.json()).catch(() => ({total: 0, seekers: 0, companies: 0})),
            fetch(`${API_URL}/api/admin/stats/matches`).then(r => r.json()).catch(() => ({total: 0})),
            fetch(`${API_URL}/api/admin/stats/appointments`).then(r => r.json()).catch(() => ({total: 0})),
            fetch(`${API_URL}/api/admin/stats/transactions`).then(r => r.json()).catch(() => ({total: 0, sum: 0})),
            fetch(`${API_URL}/api/admin/disputes`).then(r => r.json()).catch(() => []))
        ]);
        
        document.getElementById('totalUsers').textContent = users.total || 0;
        document.getElementById('totalSeekers').textContent = users.seekers || 0;
        document.getElementById('totalCompanies').textContent = users.companies || 0;
        document.getElementById('totalMatches').textContent = matches.total || 0;
        document.getElementById('totalAppointments').textContent = appointments.total || 0;
        document.getElementById('totalTransactions').textContent = transactions.total || 0;
        document.getElementById('totalDisputes').textContent = disputes.length || 0;
        document.getElementById('totalWalletBalance').textContent = `₹${(transactions.sum || 0).toLocaleString()}`;
        
        // Load recent activity
        await loadRecentActivity();
    } catch (error) {
        console.error('Error loading dashboard:', error);
    }
}

async function loadRecentActivity() {
    try {
        const response = await fetch(`${API_URL}/api/admin/recent-activity`);
        const activities = await response.json().catch(() => []);
        
        const container = document.getElementById('recentActivity');
        if (activities.length === 0) {
            container.innerHTML = '<div class=\"empty-state\"><div class=\"empty-state-icon\">📭</div><p>No recent activity</p></div>';
            return;
        }
        
        container.innerHTML = activities.map(activity => `
            <div class=\"activity-item\">
                <div class=\"activity-info\">
                    <div class=\"activity-title\">${activity.title}</div>\n                    <div class=\"activity-time\">${formatDate(activity.created_at)}</div>
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error loading recent activity:', error);
    }
}

// Users
let allUsers = [];
async function loadUsers() {
    try {
        const response = await fetch(`${API_URL}/api/admin/users`);
        allUsers = await response.json().catch(() => []);
        displayUsers(allUsers);
    } catch (error) {
        console.error('Error loading users:', error);
        document.getElementById('usersTableBody').innerHTML = '<tr><td colspan=\"6\" class=\"loading\">Failed to load users</td></tr>';
    }
}

function displayUsers(users) {
    const tbody = document.getElementById('usersTableBody');
    
    if (users.length === 0) {
        tbody.innerHTML = '<tr><td colspan=\"6\" class=\"empty-state\"><div class=\"empty-state-icon\">👥</div><p>No users found</p></td></tr>';
        return;
    }
    
    tbody.innerHTML = users.map(user => `
        <tr>
            <td>${user.user_id}</td>
            <td>${user.name}</td>
            <td>${user.email}</td>
            <td><span class=\"status-badge status-${user.active_role}\">${user.active_role}</span></td>
            <td>${formatDate(user.created_at)}</td>
            <td>
                <button class=\"action-btn btn-view\" onclick=\"viewUser('${user.user_id}')\">View</button>
                <button class=\"action-btn btn-ban\" onclick=\"banUser('${user.user_id}')\">Ban</button>
                <button class=\"action-btn btn-delete\" onclick=\"deleteUser('${user.user_id}')\">Delete</button>
            </td>
        </tr>
    `).join('');
}

function filterUsers() {
    const searchTerm = document.getElementById('userSearch').value.toLowerCase();
    const roleFilter = document.getElementById('userRoleFilter').value;
    
    let filtered = allUsers.filter(user => {
        const matchesSearch = user.name.toLowerCase().includes(searchTerm) || 
                             user.email.toLowerCase().includes(searchTerm) ||
                             user.user_id.toLowerCase().includes(searchTerm);
        const matchesRole = roleFilter === 'all' || user.active_role === roleFilter;
        return matchesSearch && matchesRole;
    });
    
    displayUsers(filtered);
}

async function viewUser(userId) {
    try {
        const response = await fetch(`${API_URL}/api/admin/users/${userId}`);
        const user = await response.json();
        
        const modal = document.getElementById('userDetailModal');
        document.getElementById('modalUserName').textContent = user.name;
        document.getElementById('modalUserContent').innerHTML = `
            <div style=\"display: grid; gap: 16px;\">
                <div><strong>User ID:</strong> ${user.user_id}</div>
                <div><strong>Email:</strong> ${user.email}</div>
                <div><strong>Role:</strong> ${user.active_role}</div>
                <div><strong>Joined:</strong> ${formatDate(user.created_at)}</div>
            </div>
        `;
        modal.classList.add('active');
    } catch (error) {
        alert('Failed to load user details');
    }
}

async function banUser(userId) {
    if (!confirm('Are you sure you want to ban this user?')) return;
    
    try {
        await fetch(`${API_URL}/api/admin/users/${userId}/ban`, { method: 'PUT' });
        alert('User banned successfully');
        loadUsers();
    } catch (error) {
        alert('Failed to ban user');
    }
}

async function deleteUser(userId) {
    if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) return;
    
    try {
        await fetch(`${API_URL}/api/admin/users/${userId}`, { method: 'DELETE' });
        alert('User deleted successfully');
        loadUsers();
    } catch (error) {
        alert('Failed to delete user');
    }
}

// Appointments
let allAppointments = [];
async function loadAppointments() {
    try {
        const response = await fetch(`${API_URL}/api/admin/appointments`);
        allAppointments = await response.json().catch(() => []);
        displayAppointments(allAppointments);
    } catch (error) {
        console.error('Error loading appointments:', error);
    }
}

function displayAppointments(appointments) {
    const tbody = document.getElementById('appointmentsTableBody');
    
    if (appointments.length === 0) {
        tbody.innerHTML = '<tr><td colspan=\"7\" class=\"empty-state\"><div class=\"empty-state-icon\">📅</div><p>No appointments found</p></td></tr>';
        return;
    }
    
    tbody.innerHTML = appointments.map(appt => `
        <tr>
            <td>${appt.appointment_id}</td>
            <td>${appt.seeker_name || 'N/A'}</td>
            <td>${appt.company_name || 'N/A'}</td>
            <td>${formatDate(appt.date)}</td>
            <td>${appt.location}</td>
            <td><span class=\"status-badge status-${appt.status}\">${appt.status}</span></td>
            <td>
                <button class=\"action-btn btn-view\" onclick=\"viewAppointment('${appt.appointment_id}')\">View</button>
                ${appt.status === 'pending' ? `<button class=\"action-btn btn-delete\" onclick=\"cancelAppointment('${appt.appointment_id}')\">Cancel</button>` : ''}
            </td>
        </tr>
    `).join('');
}

function filterAppointments() {
    const searchTerm = document.getElementById('appointmentSearch').value.toLowerCase();
    const statusFilter = document.getElementById('appointmentStatusFilter').value;
    
    let filtered = allAppointments.filter(appt => {
        const matchesSearch = appt.appointment_id.toLowerCase().includes(searchTerm) || 
                             appt.location.toLowerCase().includes(searchTerm);
        const matchesStatus = statusFilter === 'all' || appt.status === statusFilter;
        return matchesSearch && matchesStatus;
    });
    
    displayAppointments(filtered);
}

async function viewAppointment(appointmentId) {
    alert('Appointment details: ' + appointmentId);
}

async function cancelAppointment(appointmentId) {
    if (!confirm('Cancel this appointment?')) return;
    
    try {
        await fetch(`${API_URL}/api/admin/appointments/${appointmentId}/cancel`, { method: 'PUT' });
        alert('Appointment cancelled');
        loadAppointments();
    } catch (error) {
        alert('Failed to cancel appointment');
    }
}

// Transactions
let allTransactions = [];
async function loadTransactions() {
    try {
        const response = await fetch(`${API_URL}/api/admin/transactions`);
        allTransactions = await response.json().catch(() => []);
        displayTransactions(allTransactions);
    } catch (error) {
        console.error('Error loading transactions:', error);
    }
}

function displayTransactions(transactions) {
    const tbody = document.getElementById('transactionsTableBody');
    
    if (transactions.length === 0) {
        tbody.innerHTML = '<tr><td colspan=\"7\" class=\"empty-state\"><div class=\"empty-state-icon\">💰</div><p>No transactions found</p></td></tr>';
        return;
    }
    
    tbody.innerHTML = transactions.map(txn => `
        <tr>
            <td>${txn.transaction_id}</td>
            <td>${txn.from_user_id || 'System'}</td>
            <td>${txn.to_user_id}</td>
            <td>₹${txn.amount}</td>
            <td>${txn.type}</td>
            <td><span class=\"status-badge status-${txn.status}\">${txn.status}</span></td>
            <td>${formatDate(txn.created_at)}</td>
        </tr>
    `).join('');
}

function filterTransactions() {
    const searchTerm = document.getElementById('transactionSearch').value.toLowerCase();
    const typeFilter = document.getElementById('transactionTypeFilter').value;
    
    let filtered = allTransactions.filter(txn => {
        const matchesSearch = txn.transaction_id.toLowerCase().includes(searchTerm);
        const matchesType = typeFilter === 'all' || txn.type === typeFilter;
        return matchesSearch && matchesType;
    });
    
    displayTransactions(filtered);
}

// Disputes
async function loadDisputes() {
    try {
        const response = await fetch(`${API_URL}/api/admin/disputes`);
        const disputes = await response.json().catch(() => []);
        
        const container = document.getElementById('disputesList');
        
        if (disputes.length === 0) {
            container.innerHTML = '<div class=\"empty-state\"><div class=\"empty-state-icon\">✅</div><p>No disputes to resolve</p></div>';
            return;
        }
        
        container.innerHTML = disputes.map(dispute => `
            <div class=\"dispute-card\">
                <div class=\"dispute-header\">
                    <div class=\"dispute-title\">Appointment: ${dispute.appointment.appointment_id}</div>
                </div>
                <div class=\"dispute-details\">
                    <div class=\"dispute-detail\">
                        <strong>Seeker</strong>
                        ${dispute.appointment.seeker_id}
                    </div>
                    <div class=\"dispute-detail\">
                        <strong>Company</strong>
                        ${dispute.appointment.company_id}
                    </div>
                    <div class=\"dispute-detail\">
                        <strong>Meeting Date</strong>
                        ${formatDate(dispute.appointment.date)}
                    </div>
                    <div class=\"dispute-detail\">
                        <strong>Seeker Confirmed</strong>
                        ${dispute.confirmation.seeker_confirmed ? '✅ Yes' : '❌ No'}
                    </div>
                    <div class=\"dispute-detail\">
                        <strong>Company Confirmed</strong>
                        ${dispute.confirmation.company_confirmed ? '✅ Yes' : '❌ No'}
                    </div>
                </div>
                <div class=\"dispute-actions\">
                    <button class=\"action-btn btn-edit\" onclick=\"resolveDispute('${dispute.appointment.appointment_id}', 'approve')\">Approve Meeting</button>
                    <button class=\"action-btn btn-delete\" onclick=\"resolveDispute('${dispute.appointment.appointment_id}', 'reject')\">Reject Meeting</button>
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error loading disputes:', error);
    }
}

async function resolveDispute(appointmentId, action) {
    if (!confirm(`Are you sure you want to ${action} this dispute?`)) return;
    
    try {
        await fetch(`${API_URL}/api/admin/disputes/${appointmentId}/resolve`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action })
        });
        alert('Dispute resolved');
        loadDisputes();
    } catch (error) {
        alert('Failed to resolve dispute');
    }
}

// Analytics
async function loadAnalytics() {
    try {
        const response = await fetch(`${API_URL}/api/admin/analytics`);
        const analytics = await response.json().catch(() => ({
            matchRate: 0,
            confirmRate: 0,
            avgTransaction: 0,
            revenue: 0
        }));
        
        document.getElementById('matchRate').textContent = `${analytics.matchRate}%`;
        document.getElementById('confirmRate').textContent = `${analytics.confirmRate}%`;
        document.getElementById('avgTransaction').textContent = `₹${analytics.avgTransaction.toLocaleString()}`;
        document.getElementById('revenue').textContent = `₹${analytics.revenue.toLocaleString()}`;
    } catch (error) {
        console.error('Error loading analytics:', error);
    }
}

// Utility Functions
function formatDate(dateString) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Close modal when clicking outside
window.onclick = function(event) {
    const modal = document.getElementById('userDetailModal');
    if (event.target == modal) {
        modal.classList.remove('active');
    }
}

document.querySelector('.close').onclick = function() {
    document.getElementById('userDetailModal').classList.remove('active');
}
