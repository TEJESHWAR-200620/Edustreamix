// In-app Owner Verifications (admin only, no separate URL).
// Visible only when logged in as the admin user (server-verified token session).
// The token proves admin rights; ADMIN_KEY itself never reaches the browser.

(function () {
    'use strict';

    function isAdmin() {
        try {
            return typeof isAdminUser === 'function' && isAdminUser();
        } catch (e) {
            return false;
        }
    }

    function adminHeaders(extra) {
        var h = { 'Content-Type': 'application/json' };
        try {
            h['x-admin-token'] = (typeof getAdminToken === 'function' ? getAdminToken() : '') || '';
        } catch (e) { h['x-admin-token'] = ''; }
        if (extra) {
            Object.keys(extra).forEach(function (k) { h[k] = extra[k]; });
        }
        return h;
    }

    function esc(s) {
        return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function pill(st) {
        if (st === 'CERTIFICATE_ISSUED' || st === 'PAYMENT_VERIFIED') return '<span class="pill issued">Issued</span>';
        if (st === 'REJECTED') return '<span class="pill rejected">Rejected</span>';
        return '<span class="pill pending">Under Verification</span>';
    }

    function dropAdminSession(msg) {
        try {
            if (typeof clearAdminSession === 'function') clearAdminSession();
        } catch (e) { /* ignore */ }
        updateAdminMenu();
        if (msg) alert(msg);
        if (typeof switchView === 'function') switchView('dashboard');
    }

    // Show the Verifications menu item only for admin sessions.
    window.updateAdminMenu = function () {
        var m = document.getElementById('menu-verifications');
        if (!m) return;
        m.style.display = isAdmin() ? '' : 'none';
        if (!isAdmin()) {
            var v = document.getElementById('verifications-view');
            if (v && v.classList.contains('active') && typeof switchView === 'function') {
                switchView('dashboard');
            }
        }
    };

    window.renderVerificationsView = function () {
        updateAdminMenu();
        if (!isAdmin()) {
            var list = document.getElementById('verif-rows');
            if (list) list.innerHTML = '<tr><td colspan="4">Owner access required.</td></tr>';
            return;
        }
        var rows = document.getElementById('verif-rows');
        if (rows) rows.innerHTML = '<tr><td colspan="4">Loading…</td></tr>';
        fetch('/api/admin/submissions', { headers: adminHeaders() })
            .then(function (r) {
                if (r.status === 401) {
                    dropAdminSession('Admin session expired. Please log in again.');
                    throw new Error('done');
                }
                return r.json();
            })
            .then(function (d) {
                if (!d || !d.submissions) throw new Error('Bad response');
                var count = document.getElementById('verif-count');
                if (count) count.textContent = d.count || 0;
                if (!d.submissions.length) {
                    rows.innerHTML = '<tr><td colspan="4">No verification requests yet.</td></tr>';
                    return;
                }
                rows.innerHTML = '';
                d.submissions.forEach(function (s) {
                    var tr = document.createElement('tr');
                    var pending = (s.status === 'UNDER_VERIFICATION' || s.status === 'PAYMENT_SUBMITTED');
                    var pid = s.paymentId || s.utr || '';
                    tr.innerHTML =
                        '<td><strong>' + esc(s.studentName) + '</strong><br/><span style="color:var(--text-muted)">@' + esc(s.username) + '</span>' +
                        '<br/><span style="color:var(--text-muted)">' + esc(s.studentEmail || '') + '</span></td>' +
                        '<td><code>' + esc(pid) + '</code><br/><small style="color:var(--text-muted)">' + esc(s.courseName || '') + '</small></td>' +
                        '<td>' + pill(s.status) + (s.certificateId ? '<br/><small>' + esc(s.certificateId) + '</small>' : '') + '</td>' +
                        '<td><div class="admin-actions">' +
                            (s.hasScreenshot ? '<button class="btn-view" data-act="shot" data-id="' + esc(s.id) + '" data-utr="' + esc(pid) + '">Screenshot</button>' : '') +
                            (pending ? '<button class="btn-approve" data-act="approve" data-id="' + esc(s.id) + '">Approve</button>' +
                                       '<button class="btn-reject" data-act="reject" data-id="' + esc(s.id) + '">Reject</button>' : '') +
                        '</div></td>';
                    rows.appendChild(tr);
                });
            })
            .catch(function (e) {
                if (e && e.message === 'done') return;
                if (rows) rows.innerHTML = '<tr><td colspan="4">Unable to load. Check connection.</td></tr>';
            });
    };

    // Legacy screenshot viewer (old UTR rows only; new Razorpay rows have no screenshot).
    window.viewVerifShot = function (id, utr) {
        fetch('/api/admin/screenshot/' + encodeURIComponent(id), { headers: adminHeaders() })
            .then(function (r) {
                if (r.status === 401) {
                    dropAdminSession('Admin session expired. Please log in again.');
                    throw new Error('done');
                }
                if (!r.ok) throw new Error('shot');
                return r.blob();
            })
            .then(function (blob) {
                var img = document.getElementById('verif-shot-img');
                if (img.src && img.src.indexOf('blob:') === 0) URL.revokeObjectURL(img.src);
                img.src = URL.createObjectURL(blob);
                document.getElementById('verif-shot-title').textContent = 'Payment Screenshot — ' + utr;
                document.getElementById('verif-shot-modal').classList.add('active');
            })
            .catch(function (e) {
                if (e && e.message === 'done') return;
                alert('Unable to load screenshot.');
            });
    };

    window.closeVerifShot = function () {
        document.getElementById('verif-shot-modal').classList.remove('active');
        var img = document.getElementById('verif-shot-img');
        if (img.src && img.src.indexOf('blob:') === 0) URL.revokeObjectURL(img.src);
        img.src = '';
    };

    window.decideVerif = function (id, decision, btn) {
        if (decision === 'REJECT' && !confirm('Reject this payment? The student will be able to retry.')) return;
        if (decision === 'APPROVE' && !confirm('Approve? Confirm you verified Rs.99 in the Razorpay Dashboard against the payment ID.')) return;
        btn.disabled = true;
        fetch('/api/admin/decision', { method: 'POST', headers: adminHeaders(), body: JSON.stringify({ id: id, decision: decision }) })
            .then(function (r) {
                if (r.status === 401) {
                    dropAdminSession('Admin session expired. Please log in again.');
                    throw new Error('done');
                }
                return r.json();
            })
            .then(function (d) {
                if (!d.ok) alert(d.error || 'Decision failed.');
                renderVerificationsView();
            })
            .catch(function (e) {
                if (e && e.message === 'done') return;
                alert('Network error.');
                renderVerificationsView();
            });
    };

    // Admin console shell: student areas are hidden via body.admin-mode CSS.
    // Blocked views bounce back to the dashboard for admin sessions.
    var ADMIN_BLOCKED_VIEWS = ['bookmarks', 'workshop', 'certificates', 'courseware', 'quiz', 'search'];

    window.updateAdminShell = function () {
        var admin = isAdmin();
        try {
            document.body.classList.toggle('admin-mode', admin);
            var sub = document.getElementById('dashboard-subtitle');
            if (sub) {
                sub.textContent = admin
                    ? 'Owner console — user activity and certificate verifications.'
                    : 'Track your B.Tech CSE learning progress and resume your studies.';
            }
        } catch (e) { /* ignore */ }
        updateAdminMenu();
        // NOTE: renderAdminDashboard() is NOT called here — the 2s shell sync
        // below must stay cheap. Dashboard data loads on view switch + Refresh.
    };

    // Extend the view switcher (wraps any previous patch, e.g. certificates).
    function patchForVerifications() {
        if (typeof switchView !== 'function' || window.__verifSwitchPatched) return;
        var orig = switchView;
        window.__verifSwitchPatched = true;
        window.switchView = function (viewId) {
            if (viewId === 'verifications' && !isAdmin()) {
                alert('Owner access required.');
                return;
            }
            if (isAdmin() && ADMIN_BLOCKED_VIEWS.indexOf(viewId) !== -1) {
                orig('dashboard');
                updateAdminShell();
                return;
            }
            orig(viewId);
            try {
                if (viewId === 'verifications') {
                    var m = document.getElementById('menu-verifications');
                    document.querySelectorAll('.sidebar-menu .menu-item').forEach(function (item) {
                        item.classList.remove('active');
                    });
                    if (m) m.classList.add('active');
                    renderVerificationsView();
                } else {
                    updateAdminShell();
                    if (viewId === 'dashboard' && isAdmin()) renderAdminDashboard();
                }
            } catch (e) { /* ignore */ }
        };
    }

    // ---- Admin Dashboard: user stats + verification counts.
    window.renderAdminDashboard = function () {
        if (!isAdmin()) return;
        var uRows = document.getElementById('adm-user-rows');
        if (uRows && !uRows.dataset.loading) {
            uRows.dataset.loading = '1';
            uRows.innerHTML = '<tr><td colspan="4">Loading…</td></tr>';
        }
        fetch('/api/admin/users', { headers: adminHeaders() })
            .then(function (r) {
                if (r.status === 401) {
                    dropAdminSession('Admin session expired. Please log in again.');
                    throw new Error('done');
                }
                return r.json();
            })
            .then(function (d) {
                var total = document.getElementById('adm-stat-users');
                if (total) total.textContent = (d && d.count) || 0;
                if (!uRows) return;
                delete uRows.dataset.loading;
                if (!d || !d.users || !d.users.length) {
                    uRows.innerHTML = '<tr><td colspan="4">No users have reported progress yet.</td></tr>';
                    return;
                }
                uRows.innerHTML = '';
                d.users.forEach(function (u) {
                    var tag = '';
                    try {
                        if (/^demo/i.test(u.username || '')) tag = ' <span class="pill pending">demo</span>';
                    } catch (e) { /* ignore */ }
                    var courses = (u.startedCourses || []).slice(0, 4)
                        .map(function (c) { return esc(c.name) + ' (' + c.done + '/' + c.total + ')'; })
                        .join('<br/>');
                    if ((u.startedCourses || []).length > 4) {
                        courses += '<br/><span style="color:var(--text-muted)">+' + ((u.startedCourses || []).length - 4) + ' more</span>';
                    }
                    if (!courses) courses = '<span style="color:var(--text-muted)">—</span>';
                    var tr = document.createElement('tr');
                    tr.innerHTML =
                        '<td><strong>' + esc(u.displayName) + '</strong><br/><span style="color:var(--text-muted)">@' + esc(u.username) + '</span>' + tag + '</td>' +
                        '<td><strong>' + u.percent + '%</strong><br/><span style="color:var(--text-muted)">' + u.doneUnits + '/' + u.totalUnits + ' units</span></td>' +
                        '<td><small>' + courses + '</small></td>' +
                        '<td><small>' + esc((u.lastSeen || '').slice(0, 16).replace('T', ' ')) + '</small></td>';
                    uRows.appendChild(tr);
                });
            })
            .catch(function (e) {
                if (e && e.message === 'done') return;
                if (uRows) {
                    delete uRows.dataset.loading;
                    uRows.innerHTML = '<tr><td colspan="4">Unable to load. Check connection.</td></tr>';
                }
            });
        fetch('/api/admin/submissions', { headers: adminHeaders() })
            .then(function (r) { return r.ok ? r.json() : null; })
            .then(function (d) {
                if (!d || !d.submissions) return;
                var pending = 0, issued = 0;
                d.submissions.forEach(function (s) {
                    if (s.status === 'UNDER_VERIFICATION' || s.status === 'PAYMENT_SUBMITTED') pending++;
                    if (s.status === 'CERTIFICATE_ISSUED' || s.status === 'PAYMENT_VERIFIED') issued++;
                });
                var p = document.getElementById('adm-stat-pending');
                var i = document.getElementById('adm-stat-issued');
                if (p) p.textContent = pending;
                if (i) i.textContent = issued;
            })
            .catch(function () { /* silent */ });
    };

    document.addEventListener('DOMContentLoaded', function () {
        patchForVerifications();
        updateAdminShell();
        // Keep the shell in sync across login/logout without touching app.js views.
        setInterval(updateAdminShell, 2000);
        // Delegate table button clicks (no inline secrets involved).
        document.addEventListener('click', function (e) {
            var t = e.target;
            if (!t || !t.dataset || !t.dataset.act) return;
            var id = t.dataset.id;
            if (t.dataset.act === 'shot') viewVerifShot(id, t.dataset.utr || '');
            else if (t.dataset.act === 'approve') decideVerif(id, 'APPROVE', t);
            else if (t.dataset.act === 'reject') decideVerif(id, 'REJECT', t);
        });
    });
})();
