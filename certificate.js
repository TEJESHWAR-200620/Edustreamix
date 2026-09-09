// Certificate flow (Rs.99) — fully separate from the Rs.49 registration flow.
// Registration (Rs.49): Razorpay Checkout + localStorage `est_subscription_*`. Untouched.
// Certificate (Rs.99): Razorpay Checkout (same Key ID) + server record + MANUAL email
// of the payment ID to the owner. No auto-email, no QR image, no UTR, no screenshot.

(function () {
    'use strict';

    var CERT_FEE_LABEL = 'Certificate Fee: \u20B999';
    var REG_FEE_LABEL = 'Registration Fee: \u20B949';
    var OWNER_EMAIL = 't.harinarayana@gmail.com';
    try {
        if (typeof OWNER_MANUAL_EMAIL !== 'undefined' && OWNER_MANUAL_EMAIL) OWNER_EMAIL = OWNER_MANUAL_EMAIL;
    } catch (e) { /* keep default */ }
    var certSubmitting = false;
    var activeCert = null; // { sem, subj }

    function certKey(sem, subj) {
        var user = (typeof authUsername !== 'undefined' && authUsername) || 'guest';
        return 'est_cert_' + user + '_' + sem + '-' + subj;
    }

    function getCertLocal(sem, subj) {
        try {
            return JSON.parse(localStorage.getItem(certKey(sem, subj))) || null;
        } catch (e) {
            return null;
        }
    }

    function setCertLocal(sem, subj, data) {
        localStorage.setItem(certKey(sem, subj), JSON.stringify(data));
    }

    function subjectProgress(semIdx, subjIdx) {
        var subject = cseAcademicData[semIdx].subjects[subjIdx];
        var total = subject.units.length;
        var done = 0;
        for (var i = 0; i < total; i++) {
            if (progressState[semIdx + '-' + subjIdx + '-' + i]) done++;
        }
        return { done: done, total: total };
    }

    function isQuizCleared(semIdx, subjIdx) {
        return !!(typeof clearedQuizzesState !== 'undefined' && clearedQuizzesState[semIdx + '-' + subjIdx]);
    }

    // Eligibility: Rs.49 active + 100% units + quiz cleared.
    // Demo accounts (e.g. demopro) bypass all checks: full access, like quizzes.
    function certEligibility(semIdx, subjIdx) {
        if (typeof isDemoAccount === 'function') {
            try {
                if (isDemoAccount(typeof authUsername !== 'undefined' ? authUsername : null)) {
                    return { eligible: true, reason: 'ELIGIBLE_TO_CLAIM', hint: '' };
                }
            } catch (e) { /* fall through to normal checks */ }
        }
        // Owner admin: full in-app access, like demo accounts.
        if (typeof isAdminUser === 'function') {
            try {
                if (isAdminUser()) {
                    return { eligible: true, reason: 'ELIGIBLE_TO_CLAIM', hint: '' };
                }
            } catch (e) { /* fall through to normal checks */ }
        }        if (typeof hasActiveSubscription === 'function' && !hasActiveSubscription()) {
            return { eligible: false, reason: 'NOT_ELIGIBLE', hint: 'Unlock Full Access (Registration Fee: \u20B949) first.' };
        }
        var p = subjectProgress(semIdx, subjIdx);
        if (p.done < p.total) {
            return { eligible: false, reason: 'NOT_ELIGIBLE', hint: 'Complete all ' + p.total + ' units (' + p.done + '/' + p.total + ').' };
        }
        if (!isQuizCleared(semIdx, subjIdx)) {
            return { eligible: false, reason: 'NOT_ELIGIBLE', hint: 'Pass the subject quiz (75%+) to become eligible.' };
        }
        return { eligible: true, reason: 'ELIGIBLE_TO_CLAIM', hint: '' };
    }

    function certStatus(semIdx, subjIdx) {
        var local = getCertLocal(semIdx, subjIdx);
        if (local && local.status) return local.status;
        return certEligibility(semIdx, subjIdx).eligible ? 'ELIGIBLE_TO_CLAIM' : 'NOT_ELIGIBLE';
    }

    function statusBadge(status) {
        var map = {
            NOT_ELIGIBLE: ['cert-badge muted', 'Not eligible'],
            ELIGIBLE_TO_CLAIM: ['cert-badge ready', 'Eligible to claim'],
            CERTIFICATE_PAYMENT_PENDING: ['cert-badge pending', 'Payment pending'],
            PAYMENT_SUBMITTED: ['cert-badge pending', 'Payment submitted \u2014 Under Verification'],
            UNDER_VERIFICATION: ['cert-badge pending', 'Under Verification'],
            PAYMENT_VERIFIED: ['cert-badge verified', 'Payment verified'],
            CERTIFICATE_ISSUED: ['cert-badge verified', 'Certificate issued'],
            REJECTED: ['cert-badge rejected', 'Payment rejected \u2014 you may retry']
        };
        return map[status] || map.NOT_ELIGIBLE;
    }

    function escapeHtml(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    function currentUserName() {
        if (typeof authUser !== 'undefined' && authUser) return authUser;
        return '';
    }

    function currentUserEmail() {
        var g = localStorage.getItem('cse_portal_google_email') || '';
        if (g) return g;
        try {
            var users = JSON.parse(localStorage.getItem('cse_portal_registered_users')) || [];
            var u = users.find(function (x) { return x.username === authUsername; });
            if (u && u.email && u.email.indexOf('@') > -1) return u.email;
        } catch (e) { /* ignore */ }
        return '';
    }

    // ---- Certificates view ----
    window.renderCertificatesView = function () {
        var list = document.getElementById('certificates-list');
        if (!list || typeof cseAcademicData === 'undefined') return;
        list.innerHTML = '';

        if (typeof hasActiveSubscription === 'function' && !hasActiveSubscription()) {
            var note = document.createElement('div');
            note.className = 'cert-fee-note';
            note.innerHTML = '<strong>' + REG_FEE_LABEL + '</strong> is required first. ' +
                'Subscribe via the <strong>Go Premium</strong> button. The <strong>' + CERT_FEE_LABEL + '</strong> is a separate charge after course completion.';
            list.appendChild(note);
        }

        cseAcademicData.forEach(function (sem, semIdx) {
            sem.subjects.forEach(function (subject, subjIdx) {
                var p = subjectProgress(semIdx, subjIdx);
                var elig = certEligibility(semIdx, subjIdx);
                var st = certStatus(semIdx, subjIdx);
                // If locally marked submitted but eligibility data says otherwise, trust stored status.
                var badge = statusBadge(st);
                var card = document.createElement('div');
                card.className = 'chapter-item cert-card';
                var actionHtml;
                if (st === 'PAYMENT_SUBMITTED' || st === 'UNDER_VERIFICATION') {
                    actionHtml = '<span class="cert-badge pending">Certificate Payment Status: Under Verification</span> ' +
                        '<button class="btn btn-secondary" onclick="refreshAllCertStatuses()">Refresh status</button>';
                } else if (st === 'PAYMENT_VERIFIED' || st === 'CERTIFICATE_ISSUED') {
                    actionHtml = '<span class="cert-badge verified">' + escapeHtml(badge[1]) + '</span> ' +
                        '<button class="btn btn-primary" onclick="openCertificateView(' + semIdx + ',' + subjIdx + ')">' +
                        '<i class="fa-solid fa-download"></i> View / Download Certificate</button>';
                } else if (st === 'REJECTED') {
                    actionHtml = '<span class="cert-badge rejected">Payment rejected \u2014 you may retry</span> ' +
                        '<button class="btn btn-primary" onclick="openCertificateModal(' + semIdx + ',' + subjIdx + ')">' +
                        'Resubmit Payment</button>';
                } else if (elig.eligible) {
                    actionHtml = '<button class="btn btn-primary" onclick="openCertificateModal(' + semIdx + ',' + subjIdx + ')">' +
                        '<i class="fa-solid fa-award"></i> Claim Certificate \u2014 \u20B999</button>';
                } else {
                    actionHtml = '<span class="cert-hint">' + escapeHtml(elig.hint) + '</span>';
                }
                card.innerHTML =
                    '<div class="chapter-left"><div class="chapter-details">' +
                    '<div class="chapter-unit-tag">' + escapeHtml(sem.name) + '</div>' +
                    '<div class="chapter-title">' + escapeHtml(subject.name) + ' \u2014 ' + p.done + '/' + p.total + ' units' +
                    (isQuizCleared(semIdx, subjIdx) ? ' \u2022 Quiz cleared' : '') + '</div>' +
                    '<div style="margin-top:8px"><span class="' + badge[0] + '">' + escapeHtml(badge[1]) + '</span></div>' +
                    '</div></div>' +
                    '<div class="chapter-actions">' + actionHtml + '</div>';
                list.appendChild(card);
            });
        });

        // Pull live server status for this user's known submissions (cheap: only stored keys).
        refreshAllCertStatuses(true);
    };

    // Sync locally stored certificate states with the server (owner may have
    // approved/rejected since last visit). Silent unless skipRender is false.
    window.refreshAllCertStatuses = function (skipRender) {
        try {
            var prefix = 'est_cert_' + ((typeof authUsername !== 'undefined' && authUsername) || 'guest') + '_';
            var jobs = [];
            for (var i = 0; i < localStorage.length; i++) {
                var k = localStorage.key(i);
                if (!k || k.indexOf(prefix) !== 0) continue;
                var parts = k.slice(prefix.length).split('-');
                if (parts.length !== 2) continue;
                jobs.push({ sem: Number(parts[0]), subj: Number(parts[1]) });
            }
            if (!jobs.length) return;
            var changed = false;
            var pending = jobs.length;
            jobs.forEach(function (j) {
                fetch('/api/certificate-status?username=' + encodeURIComponent(authUsername || '') +
                    '&sem=' + j.sem + '&subj=' + j.subj)
                    .then(function (r) { return r.json(); })
                    .then(function (data) {
                        if (data && data.ok && data.status && data.status !== 'NONE') {
                            var prev = getCertLocal(j.sem, j.subj);
                            if (!prev || prev.status !== data.status) {
                                setCertLocal(j.sem, j.subj, { status: data.status, submittedAt: data.submittedAt });
                                changed = true;
                            }
                        }
                    })
                    .catch(function () { /* offline: keep local state */ })
                    .finally(function () {
                        pending--;
                        // Re-render once if the owner changed anything (approve/reject).
                        // Converges: the re-render's own refresh finds no further changes.
                        if (pending === 0 && changed) renderCertificatesView();
                    });
            });
        } catch (e) { /* ignore */ }
    };

    function buildManualMailto(courseName, paymentId, studentName) {
        var subject = 'Certificate Rs.99 Payment - ' + courseName + ' - ' + paymentId;
        var body = 'Name: ' + studentName + '\nCourse: ' + courseName +
            '\nRazorpay Payment ID: ' + paymentId +
            '\nUsername: ' + ((typeof authUsername !== 'undefined' && authUsername) || '') +
            '\n\nPlease verify my Rs.99 certificate payment.';
        return 'mailto:' + OWNER_EMAIL +
            '?subject=' + encodeURIComponent(subject) +
            '&body=' + encodeURIComponent(body);
    }

    // ---- Modal ----
    window.openCertificateModal = function (semIdx, subjIdx) {
        var elig = certEligibility(semIdx, subjIdx);
        var st = certStatus(semIdx, subjIdx);
        if (st === 'PAYMENT_SUBMITTED' || st === 'UNDER_VERIFICATION') {
            alert('Certificate Payment Status: Under Verification. Your \u20B999 payment is being verified.');
            return;
        }
        if (st === 'PAYMENT_VERIFIED' || st === 'CERTIFICATE_ISSUED') {
            openCertificateView(semIdx, subjIdx);
            return;
        }
        if (st !== 'REJECTED' && !elig.eligible) {
            alert('Not eligible yet. ' + elig.hint);
            return;
        }
        activeCert = { sem: semIdx, subj: subjIdx };
        var subject = cseAcademicData[semIdx].subjects[subjIdx];
        var courseName = cseAcademicData[semIdx].name + ' \u2014 ' + subject.name;
        document.getElementById('cert-modal-course').textContent = courseName;
        document.getElementById('cert-name').value = currentUserName();
        document.getElementById('cert-email').value = currentUserEmail();
        document.getElementById('cert-error').textContent = '';
        document.getElementById('cert-success').style.display = 'none';
        document.getElementById('cert-form-wrap').style.display = 'block';
        if (st === 'REJECTED') {
            document.getElementById('cert-error').textContent =
                'Your previous payment was rejected by the owner. Please pay again with Razorpay.';
        }
        refreshCertServerStatus();
        document.getElementById('certificate-modal-overlay').classList.add('active');
    };

    window.closeCertificateModal = function () {
        document.getElementById('certificate-modal-overlay').classList.remove('active');
        activeCert = null;
        certSubmitting = false;
        var btn = document.getElementById('cert-submit-btn');
        if (btn) { btn.disabled = false; btn.innerHTML = 'Pay \u20B999 with Razorpay'; }
    };

    function refreshCertServerStatus() {
        if (!activeCert) return;
        var sem = activeCert.sem, subj = activeCert.subj;
        fetch('/api/certificate-status?username=' + encodeURIComponent(authUsername || '') +
            '&sem=' + sem + '&subj=' + subj)
            .then(function (r) { return r.json(); })
            .then(function (data) {
                if (data && data.ok && data.status && data.status !== 'NONE') {
                    setCertLocal(sem, subj, { status: data.status, submittedAt: data.submittedAt });
                    renderCertificatesView();
                    if (data.status === 'UNDER_VERIFICATION' || data.status === 'PAYMENT_SUBMITTED') {
                        showCertSubmitted(data.submittedAt, data.paymentId, data.courseName);
                    } else if (data.status === 'CERTIFICATE_ISSUED' || data.status === 'PAYMENT_VERIFIED') {
                        closeCertificateModal();
                        openCertificateView(sem, subj);
                    } else if (data.status === 'REJECTED') {
                        document.getElementById('cert-error').textContent =
                            'Your previous payment was rejected by the owner. Please pay again with Razorpay.';
                    }
                }
            })
            .catch(function () { /* offline/static preview: rely on local state */ });
    }

    // Copy helper with clipboard API + legacy fallback. Gives inline "Copied" feedback.
    window.copyCertText = function (text, btn) {
        var done = function () {
            try {
                if (btn) {
                    var orig = btn.innerHTML;
                    btn.innerHTML = '<i class="fa-solid fa-check"></i> Copied';
                    btn.disabled = true;
                    setTimeout(function () { btn.innerHTML = orig; btn.disabled = false; }, 1600);
                }
            } catch (e) { /* ignore */ }
        };
        var fallback = function () {
            try {
                var ta = document.createElement('textarea');
                ta.value = text;
                ta.style.position = 'fixed';
                ta.style.opacity = '0';
                document.body.appendChild(ta);
                ta.select();
                document.execCommand('copy');
                document.body.removeChild(ta);
                done();
            } catch (e) { alert(text); }
        };
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(done, fallback);
        } else {
            fallback();
        }
    };

    function showCertSubmitted(submittedAt, paymentId, courseName) {
        document.getElementById('cert-form-wrap').style.display = 'none';
        var box = document.getElementById('cert-success');
        box.style.display = 'block';
        var name = currentUserName();
        var course = courseName || ((activeCert && activeCertCourseName()) || 'Course');
        var pid = paymentId || '';
        var mailto = buildManualMailto(course, pid, name);
        box.innerHTML = '<h4>Payment Recorded Successfully</h4>' +
            '<p>Your \u20B999 Razorpay payment has been recorded for verification. ' +
            'Your certificate will be processed after the owner verifies the payment.</p>' +
            (pid ? '<div class="cert-mail-chip"><span class="cert-mail-label">Payment ID</span>' +
                '<code>' + escapeHtml(pid) + '</code>' +
                '<button class="btn btn-secondary cert-copy-btn" onclick="copyCertText(\'' + escapeHtml(pid) + '\', this)">' +
                '<i class="fa-solid fa-copy"></i> Copy</button></div>' : '') +
            '<div class="cert-manual-box cert-mail-card">' +
            '<div class="cert-mail-title"><i class="fa-solid fa-envelope"></i> Required next step (manual)</div>' +
            '<div class="cert-mail-chip"><span class="cert-mail-label">Send to</span>' +
            '<code>' + escapeHtml(OWNER_EMAIL) + '</code>' +
            '<button class="btn btn-secondary cert-copy-btn" onclick="copyCertText(\'' + escapeHtml(OWNER_EMAIL) + '\', this)">' +
            '<i class="fa-solid fa-copy"></i> Copy</button></div>' +
            '<span class="cert-hint">Include your name, course, and payment ID.</span>' +
            '<div class="cert-mail-actions"><a class="btn btn-primary" href="' + mailto + '">' +
            '<i class="fa-solid fa-envelope"></i> Open Gmail to send payment ID</a></div></div>' +
            '<p class="cert-hint">Certificate Payment Status: Under Verification' +
            (submittedAt ? ' \u2022 Submitted: ' + escapeHtml(submittedAt) : '') + '</p>';
    }

    function activeCertCourseName() {
        try {
            if (!activeCert) return '';
            var s = cseAcademicData[activeCert.sem].subjects[activeCert.subj];
            return cseAcademicData[activeCert.sem].name + ' \u2014 ' + s.name;
        } catch (e) { return ''; }
    }

    // Fetch and display the issued certificate (owner must Approve first).
    window.openCertificateView = function (semIdx, subjIdx) {
        fetch('/api/certificate?username=' + encodeURIComponent(authUsername || '') +
            '&sem=' + semIdx + '&subj=' + subjIdx)
            .then(function (r) { return r.json().then(function (d) { return { http: r.status, body: d }; }); })
            .then(function (out) {
                if (out.http !== 200 || !out.body.ok) {
                    alert('Certificate not available yet. It appears after the owner verifies your \u20B999 payment.');
                    return;
                }
                var c = out.body.certificate;
                document.getElementById('cert-print-name').textContent = c.studentName;
                document.getElementById('cert-print-course').textContent = c.courseName;
                document.getElementById('cert-print-id').textContent = c.certificateId || '';
                document.getElementById('cert-print-date').textContent = (c.issuedAt || '').slice(0, 10);
                document.getElementById('certificate-view-overlay').classList.add('active');
            })
            .catch(function () { alert('Network error. Please retry.'); });
    };

    window.closeCertificateView = function () {
        document.getElementById('certificate-view-overlay').classList.remove('active');
    };

    function recordCertificatePayment(sem, subj, courseName, name, email, paymentId, btn) {
        fetch('/api/certificate-submit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: (typeof authUsername !== 'undefined' && authUsername) || '',
                studentName: name,
                studentEmail: email,
                sem: sem,
                subj: subj,
                courseName: courseName,
                razorpay_payment_id: paymentId
            })
        })
            .then(function (r) { return r.json().then(function (d) { return { http: r.status, body: d }; }); })
            .then(function (out) {
                var d = out.body || {};
                if (d.ok) {
                    setCertLocal(sem, subj, { status: d.status || 'UNDER_VERIFICATION', submittedAt: d.submittedAt });
                    showCertSubmitted(d.submittedAt, d.paymentId || paymentId, courseName);
                    renderCertificatesView();
                } else if (out.http === 409) {
                    setCertLocal(sem, subj, { status: d.status || 'UNDER_VERIFICATION', submittedAt: d.submittedAt });
                    showCertSubmitted(d.submittedAt, null, courseName);
                    renderCertificatesView();
                } else {
                    document.getElementById('cert-error').textContent = d.error || 'Submission failed. Please retry.';
                }
            })
            .catch(function () {
                document.getElementById('cert-error').textContent = 'Network error. Payment succeeded (' + paymentId + ') — please manually email it to ' + OWNER_EMAIL + '.';
                showCertSubmitted(null, paymentId, courseName);
            })
            .finally(function () {
                certSubmitting = false;
                if (btn) { btn.disabled = false; btn.innerHTML = 'Pay \u20B999 with Razorpay'; }
            });
    }

    window.submitCertificatePayment = function (event) {
        if (event) event.preventDefault();
        if (certSubmitting || !activeCert) return;
        var err = document.getElementById('cert-error');
        err.textContent = '';

        var name = document.getElementById('cert-name').value.trim();
        var email = document.getElementById('cert-email').value.trim();

        if (name.length < 2) { err.textContent = 'Student name is required.'; return; }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { err.textContent = 'A valid email address is required.'; return; }
        if (typeof window.Razorpay === 'undefined') {
            err.textContent = 'Payment gateway is not loaded. Please check your connection and retry.';
            return;
        }

        var sem = activeCert.sem, subj = activeCert.subj;
        var subject = cseAcademicData[sem].subjects[subj];
        var courseName = cseAcademicData[sem].name + ' \u2014 ' + subject.name;
        // Single source of truth: RAZORPAY_KEY_ID in server .env via /api/config.
        // getRazorpayKeyId() (app.js) returns the server value, falls back to const.
        var keyId = '';
        try {
            keyId = (typeof getRazorpayKeyId === 'function' && getRazorpayKeyId()) ||
                ((typeof RAZORPAY_KEY_ID !== 'undefined' && RAZORPAY_KEY_ID) || '');
        } catch (e) {
            keyId = (typeof RAZORPAY_KEY_ID !== 'undefined' && RAZORPAY_KEY_ID) || '';
        }
        if (!keyId) { err.textContent = 'Payment key is not configured. Please contact support.'; return; }
        var amount = (typeof CERTIFICATE_AMOUNT !== 'undefined' && CERTIFICATE_AMOUNT) || 9900;

        certSubmitting = true;
        var btn = document.getElementById('cert-submit-btn');
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Opening Razorpay\u2026';

        var rzp = new window.Razorpay({
            key: keyId,
            amount: amount,
            currency: 'INR',
            name: 'Edu Streamix Tech',
            description: 'Certificate Fee Rs.99 - ' + courseName,
            image: window.location.origin + '/favicon.png?v=2',
            prefill: { name: name, email: email },
            theme: { color: '#10b981' },
            handler: function (response) {
                var pid = response && response.razorpay_payment_id ? String(response.razorpay_payment_id) : '';
                if (!pid) {
                    certSubmitting = false;
                    btn.disabled = false;
                    btn.innerHTML = 'Pay \u20B999 with Razorpay';
                    err.textContent = 'Payment ID missing. Please retry.';
                    return;
                }
                btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Recording\u2026';
                recordCertificatePayment(sem, subj, courseName, name, email, pid, btn);
            }
        });
        rzp.on('payment.failed', function (response) {
            certSubmitting = false;
            btn.disabled = false;
            btn.innerHTML = 'Pay \u20B999 with Razorpay';
            var desc = response && response.error && response.error.description ? response.error.description : 'Please try again.';
            err.textContent = 'Payment failed: ' + desc;
        });
        rzp.open();
    };

    // Patch chapter header quiz button area: add "Claim Certificate" next to quiz button
    // when the subject is eligible (non-invasive; quiz/progress logic untouched).
    function maybeInjectChapterClaimButton() {
        try {
            var btn = document.getElementById('chapter-quiz-btn');
            if (!btn || document.getElementById('chapter-cert-btn')) return;
            var semIdx = currentYear * 2 + currentSem;
            var subjIdx = currentSubject;
            if (!cseAcademicData[semIdx] || !cseAcademicData[semIdx].subjects[subjIdx]) return;
            if (!certEligibility(semIdx, subjIdx).eligible) return;
            var b = document.createElement('button');
            b.className = 'btn btn-primary';
            b.id = 'chapter-cert-btn';
            b.style.marginLeft = '8px';
            b.innerHTML = '<i class="fa-solid fa-award"></i> Claim Certificate \u2014 \u20B999';
            b.onclick = function () { openCertificateModal(semIdx, subjIdx); };
            btn.parentNode.insertBefore(b, btn.nextSibling);
        } catch (e) { /* ignore */ }
    }

    // ---- Progress sync (counts only, feeds the admin Dashboard) ----
    // Reports summary study stats. No passwords, emails, notes, or bookmarks.
    var syncInFlight = false;
    window.syncProgressStats = function () {
        try {
            if (typeof authUsername === 'undefined' || !authUsername) return;
            if (typeof cseAcademicData === 'undefined') return;
            if (syncInFlight) return;
            var done = 0, total = 0, started = [];
            cseAcademicData.forEach(function (sem, semIdx) {
                sem.subjects.forEach(function (subject, subjIdx) {
                    var t = subject.units.length, d = 0;
                    for (var i = 0; i < t; i++) {
                        if (progressState[semIdx + '-' + subjIdx + '-' + i]) d++;
                    }
                    total += t;
                    done += d;
                    if (d > 0) {
                        started.push({
                            name: String(subject.name || '').replace(/^\d+\.\s+/, ''),
                            done: d,
                            total: t
                        });
                    }
                });
            });
            var quizzes = 0;
            try {
                var cq = (typeof clearedQuizzesState !== 'undefined' && clearedQuizzesState) || {};
                quizzes = Object.keys(cq).filter(function (k) { return cq[k]; }).length;
            } catch (e) { quizzes = 0; }
            syncInFlight = true;
            fetch('/api/progress-sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username: authUsername,
                    displayName: (typeof authUser !== 'undefined' && authUser) || authUsername,
                    doneUnits: done,
                    totalUnits: total,
                    quizzesCleared: quizzes,
                    startedCourses: started
                })
            }).catch(function () { /* offline: silent */ })
            .finally(function () { syncInFlight = false; });
        } catch (e) { syncInFlight = false; }
    };

    // Wrap switchView so the Certificates menu + auto-refresh work without editing app.js.
    function patchSwitchView() {
        if (typeof switchView !== 'function' || window.__certSwitchPatched) return;
        var orig = switchView;
        window.__certSwitchPatched = true;
        window.switchView = function (viewId) {
            orig(viewId);
            try {
                document.querySelectorAll('.sidebar-menu .menu-item').forEach(function (item) {
                    item.classList.remove('active');
                });
                if (viewId === 'certificates') {
                    var m = document.getElementById('menu-certificates');
                    if (m) m.classList.add('active');
                    renderCertificatesView();
                }
            } catch (e) { /* ignore */ }
        };
    }

    document.addEventListener('DOMContentLoaded', function () {
        patchSwitchView();
        // Report summary stats shortly after load, then periodically. Silent + cheap.
        setTimeout(function () { syncProgressStats(); }, 5000);
        setInterval(function () { syncProgressStats(); }, 120000);
        document.addEventListener('visibilitychange', function () {
            if (!document.hidden) syncProgressStats();
        });
        // Re-check claim button whenever chapters render (poll-free: hook after small delay).
        setInterval(function () {
            var chaptersView = document.getElementById('subject-chapters-view');
            if (chaptersView && chaptersView.classList.contains('active')) maybeInjectChapterClaimButton();
            else {
                var stale = document.getElementById('chapter-cert-btn');
                if (stale) stale.remove();
            }
        }, 1500);
    });
})();
