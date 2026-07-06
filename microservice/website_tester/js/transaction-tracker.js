// Transaction Tracker JavaScript

// Initialize Mermaid
if (window.mermaid) {
    mermaid.initialize({ startOnLoad: false, theme: 'dark' });
}

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
                    <pre class="bg-black p-2 rounded text-start" style="font-size:0.8em; max-height: 120px; overflow-y: auto;">${JSON.stringify(tx.payload, null, 2)}</pre>
                </div>
            </div>
            
            <!-- Tabs Navigation -->
            <ul class="nav nav-tabs mb-4 border-secondary" id="txTabs" role="tablist">
                <li class="nav-item" role="presentation">
                    <button class="nav-link active text-info" style="background: transparent; border-color: transparent transparent var(--c-cyan) transparent;" id="flow-tab" data-bs-toggle="tab" data-bs-target="#flow" type="button" role="tab" onclick="this.style.color='var(--c-cyan)'; this.style.borderBottom='2px solid var(--c-cyan)'; document.getElementById('audit-tab').style.border='none'; document.getElementById('audit-tab').style.color='rgba(255,255,255,0.5)';"><i class="bi bi-diagram-3 me-2"></i>Visual Flow</button>
                </li>
                <li class="nav-item" role="presentation">
                    <button class="nav-link text-white-50" style="background: transparent; border: none;" id="audit-tab" data-bs-toggle="tab" data-bs-target="#audit" type="button" role="tab" onclick="this.style.color='var(--c-cyan)'; this.style.borderBottom='2px solid var(--c-cyan)'; document.getElementById('flow-tab').style.border='none'; document.getElementById('flow-tab').style.color='rgba(255,255,255,0.5)';"><i class="bi bi-list-check me-2"></i>Audit Trail</button>
                </li>
            </ul>

            <div class="tab-content" id="txTabsContent">
                <!-- Visual Flow Tab -->
                <div class="tab-pane fade show active" id="flow" role="tabpanel">
                    <div id="mermaid-container" class="text-center p-3 bg-black rounded" style="border: 1px solid rgba(0, 255, 255, 0.1); overflow-x: auto;">
                        <div class="mermaid">
                            ${generateMermaidGraph(tx, events)}
                        </div>
                    </div>
                </div>

                <!-- Audit Trail Tab -->
                <div class="tab-pane fade" id="audit" role="tabpanel">
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

        html += `</div></div></div>`; // Close timeline, audit tab, and tab-content
        body.innerHTML = html;

        // Render mermaid graph
        if (window.mermaid) {
            // Need a slight delay for modal DOM to settle
            setTimeout(() => {
                mermaid.init(undefined, document.querySelectorAll('.mermaid'));
            }, 100);
        }

    } catch (err) {
        console.error(err);
        body.innerHTML = `<div class="alert alert-danger">Failed to load transaction details.</div>`;
    }
}

function generateMermaidGraph(tx, events) {
    const completedSteps = new Set((events || []).filter(e => e.event_type === 'step_completed').map(e => e.step));
    
    // Status tracking helper
    const getStyle = (step) => {
        if (tx.current_step === step && tx.status !== 'completed' && tx.status !== 'failed') return 'active';
        if (completedSteps.has(step) || tx.status === 'completed') return 'completed';
        if (tx.current_step === step && tx.status === 'failed') return 'failed';
        return 'pending';
    };

    return `
    graph LR
        classDef completed fill:#198754,stroke:#fff,stroke-width:2px,color:#fff;
        classDef active fill:#0dcaf0,stroke:#fff,stroke-width:3px,color:#000;
        classDef pending fill:#343a40,stroke:#6c757d,stroke-width:1px,color:#adb5bd;
        classDef failed fill:#dc3545,stroke:#fff,stroke-width:2px,color:#fff;

        Applicant[Pembeli / Applicant]:::completed --> Submitted
        
        subgraph "KOPRA / TSC"
            Submitted["submitted<br>Register & Kirim Email"]:::${getStyle('submitted')}
        end
        
        subgraph "CTO / TOI"
            Dist["distributed_to_analyst<br>Distribusi Aplikasi"]:::${getStyle('distributed_to_analyst')}
        end
        
        subgraph "Agentic AI"
            DocExam["doc_examined<br>Scan & Extract"]:::${getStyle('doc_examined')}
        end
        
        subgraph "Eximbills Enterprise"
            Maker["ee_ntf_created<br>Maker Modify"]:::${getStyle('ee_ntf_created')}
            Checker["ee_ntf_approved<br>Checker Otorisasi"]:::${getStyle('ee_ntf_approved')}
            MT["mt_converted<br>Completion Template"]:::${getStyle('mt_converted')}
            Swift["swift_released<br>Release SWIFT"]:::${getStyle('swift_released')}
            Settled["settled<br>Terbit LC"]:::${getStyle('settled')}
        end
        
        Submitted --> Dist
        Dist --> DocExam
        DocExam --> Maker
        Maker --> Checker
        Checker --> MT
        MT --> Swift
        Swift --> Settled
    `;
}
