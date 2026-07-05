// Transaction Tracker JavaScript

// Override Auth to support X-Robot-Key
document.addEventListener('DOMContentLoaded', function() {
    const originalGetHeaders = API.getHeaders.bind(API);
    API.getHeaders = function(contentType = true) {
        const headers = originalGetHeaders(contentType);
        const robotKey = localStorage.getItem('robot_key');
        if (robotKey) {
            headers['x-robot-key'] = robotKey;
            delete headers['Authorization']; // Prefer Robot Key over JWT for this dashboard
        }
        return headers;
    };

    const originalCheckAuth = Utils.checkAuth;
    Utils.checkAuth = function() {
        if (localStorage.getItem('robot_key')) return true;
        return originalCheckAuth();
    };

    if (!Utils.checkAuth()) {
        Utils.showNotification('Please configure your Robot Key in the Config page', 'danger');
        setTimeout(() => window.location.href = 'system-config.html', 2000);
        return;
    }

    loadTransactions();
});

let currentTransactions = [];

async function loadTransactions() {
    const typeFilter = document.getElementById('filter-type').value;
    const statusFilter = document.getElementById('filter-status').value;
    
    document.getElementById('transactions-loading').style.display = 'block';
    document.getElementById('transactions-table').style.display = 'none';

    try {
        let url = '/transactions?limit=50';
        if (typeFilter) url += `&type=${typeFilter}`;
        if (statusFilter) url += `&status=${statusFilter}`;

        const data = await API.get(url);
        currentTransactions = data.items || [];
        
        renderTransactions();
    } catch (err) {
        console.error(err);
        Utils.showNotification('Failed to load transactions: ' + (err.error?.message || err.detail || err.message), 'danger');
    } finally {
        document.getElementById('transactions-loading').style.display = 'none';
        document.getElementById('transactions-table').style.display = 'table';
    }
}

function getStatusClass(status) {
    switch(status) {
        case 'active': return 'status-processing';
        case 'completed': return 'status-completed';
        case 'failed': return 'status-failed';
        default: return 'status-pending';
    }
}

function renderTransactions() {
    const tbody = document.getElementById('transactions-tbody');
    
    if (currentTransactions.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-white-50">No transactions found</td></tr>`;
        return;
    }

    let html = '';
    currentTransactions.forEach(tx => {
        const updated = new Date(tx.updated_at).toLocaleString();
        html += `
            <tr>
                <td class="font-monospace text-info">${tx.id.split('-')[0]}...</td>
                <td class="text-uppercase">${tx.type.replace('_', ' ')}</td>
                <td><span class="badge bg-secondary">${tx.current_step}</span></td>
                <td><span class="status-badge ${getStatusClass(tx.status)}">${tx.status.toUpperCase()}</span></td>
                <td class="small text-white-50">${updated}</td>
                <td>
                    <button class="btn btn-sm btn-outline-info" onclick="viewTransaction('${tx.id}')">
                        <i class="bi bi-eye"></i> View
                    </button>
                </td>
            </tr>
        `;
    });
    tbody.innerHTML = html;
}

async function viewTransaction(id) {
    const modal = new bootstrap.Modal(document.getElementById('transactionModal'));
    const body = document.getElementById('transaction-detail-body');
    
    body.innerHTML = '<div class="text-center p-4"><div class="spinner-border text-info" role="status"></div></div>';
    modal.show();

    try {
        const data = await API.get(`/transactions/${id}`);
        const tx = data.transaction;
        const events = data.events;

        let html = `
            <div class="row mb-4">
                <div class="col-sm-6">
                    <p class="mb-1 text-white-50 small">Transaction ID</p>
                    <p class="font-monospace">${tx.id}</p>
                </div>
                <div class="col-sm-6 text-sm-end">
                    <p class="mb-1 text-white-50 small">Status</p>
                    <span class="status-badge ${getStatusClass(tx.status)}">${tx.status.toUpperCase()}</span>
                </div>
                <div class="col-sm-6">
                    <p class="mb-1 text-white-50 small">Type</p>
                    <p class="text-uppercase">${tx.type.replace('_', ' ')}</p>
                </div>
                <div class="col-sm-6 text-sm-end">
                    <p class="mb-1 text-white-50 small">Payload</p>
                    <pre class="bg-black p-2 rounded text-start" style="font-size:0.8em">${JSON.stringify(tx.payload, null, 2)}</pre>
                </div>
            </div>
            
            <h5 class="text-info border-bottom border-secondary pb-2">Audit Trail / History</h5>
            <div class="timeline">
        `;

        if (events && events.length > 0) {
            events.forEach(ev => {
                html += `
                    <div class="timeline-item">
                        <div class="timeline-date">${new Date(ev.created_at).toLocaleString()}</div>
                        <div class="timeline-content">
                            <div class="d-flex justify-content-between">
                                <div class="timeline-step">${ev.step}</div>
                                <span class="badge ${ev.event_type === 'step_completed' ? 'bg-success' : 'bg-warning text-dark'}">${ev.event_type}</span>
                            </div>
                            <div class="small text-white-50 mt-1">
                                <strong>Agent:</strong> ${ev.actor_id || 'System'}<br>
                                ${ev.reason ? `<strong>Note:</strong> ${ev.reason}` : ''}
                            </div>
                        </div>
                    </div>
                `;
            });
        } else {
            html += `<p class="text-white-50">No events recorded.</p>`;
        }

        html += `</div>`;
        body.innerHTML = html;

    } catch (err) {
        console.error(err);
        body.innerHTML = `<div class="alert alert-danger">Failed to load transaction details.</div>`;
    }
}
