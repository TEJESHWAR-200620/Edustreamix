// Certificate flow (Rs.99) — manual issuance by owner.
// Registration (Rs.49): Razorpay Checkout + localStorage `est_subscription_*`. Untouched.
// Certificate (Rs.99): Razorpay Checkout (same Key ID), then student manually emails
// the payment ID to the owner. Owner sends the certificate file back manually
// (email/WhatsApp). No server DB, no verification page, no approve/reject,
// no in-app download. No auto-email, no QR, no UTR, no screenshot.

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

    function certPaidKey(sem, subj) {
        var user = (typeof authUsername !== 'undefined' && authUsername) || 'guest';
        return 'est_cert_paid_' + user + '_' + sem + '-' + subj;
    }

    function getCertPaid(sem, subj) {
        try {
            return JSON.parse(localStorage.getItem(certPaidKey(sem, subj))) || null;
        } catch (e) {
            return null;
        }
    }

    function setCertPaid(sem, subj, data) {
        localStorage.setItem(certPaidKey(sem, subj), JSON.stringify(data));
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
        if (typeof hasActiveSubscription === 'function' && !hasActiveSubscription()) {
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
                var paid = getCertPaid(semIdx, subjIdx);
                var card = document.createElement('div');
                card.className = 'chapter-item cert-card';
                var actionHtml;
                if (paid && paid.paymentId) {
                    actionHtml = '<span class="cert-badge ready">Paid \u2014 email sent? Contact owner for certificate</span> ' +
                        '<button class="btn btn-secondary" onclick="openCertificateModal(' + semIdx + ',' + subjIdx + ')">' +
                        'View payment details</button>';
                } else if (elig.eligible) {
                    actionHtml = '<button class="btn btn-primary" onclick="openCertificateModal(' + semIdx + ',' + subjIdx + ')">' +
                        '<i class="fa-solid fa-award"></i> Claim Certificate \u2014 \u20B999</button>';
                } else {
                    actionHtml = '<span class="cert-hint">' + escapeHtml(elig.hint) + '</span>';
                }
                var badge = paid && paid.paymentId
                    ? '<span class="cert-badge ready">Paid \u2014 owner will send certificate manually</span>'
                    : (elig.eligible
                        ? '<span class="cert-badge ready">Eligible to claim</span>'
                        : '<span class="cert-badge muted">Not eligible</span>');
                card.innerHTML =
                    '<div class="chapter-left"><div class="chapter-details">' +
                    '<div class="chapter-unit-tag">' + escapeHtml(sem.name) + '</div>' +
                    '<div class="chapter-title">' + escapeHtml(subject.name) + ' \u2014 ' + p.done + '/' + p.total + ' units' +
                    (isQuizCleared(semIdx, subjIdx) ? ' \u2022 Quiz cleared' : '') + '</div>' +
                    '<div style="margin-top:8px">' + badge + '</div>' +
                    '</div></div>' +
                    '<div class="chapter-actions">' + actionHtml + '</div>';
                list.appendChild(card);
            });
        });
    };

    function buildManualMailto(courseName, paymentId, studentName) {
        var subject = 'Certificate Rs.99 Payment - ' + courseName + ' - ' + paymentId;
        var body = 'Name: ' + studentName + '\nCourse: ' + courseName +
            '\nRazorpay Payment ID: ' + paymentId +
            '\nUsername: ' + ((typeof authUsername !== 'undefined' && authUsername) || '') +
            '\n\nPlease send my certificate. My Rs.99 payment ID is above.';
        return 'mailto:' + OWNER_EMAIL +
            '?subject=' + encodeURIComponent(subject) +
            '&body=' + encodeURIComponent(body);
    }

    function activeCertCourseName() {
        try {
            if (!activeCert) return '';
            var s = cseAcademicData[activeCert.sem].subjects[activeCert.subj];
            return cseAcademicData[activeCert.sem].name + ' \u2014 ' + s.name;
        } catch (e) { return ''; }
    }

    // ---- Modal ----
    window.openCertificateModal = function (semIdx, subjIdx) {
        var elig = certEligibility(semIdx, subjIdx);
        if (!elig.eligible) {
            alert('Not eligible yet. ' + elig.hint);
            return;
        }
        activeCert = { sem: semIdx, subj: subjIdx };
        var courseName = activeCertCourseName();
        document.getElementById('cert-modal-course').textContent = courseName;
        document.getElementById('cert-name').value = currentUserName();
        document.getElementById('cert-email').value = currentUserEmail();
        document.getElementById('cert-error').textContent = '';
        var paid = getCertPaid(semIdx, subjIdx);
        if (paid && paid.paymentId) {
            showCertSubmitted(paid.paidAt, paid.paymentId, courseName);
        } else {
            document.getElementById('cert-success').style.display = 'none';
            document.getElementById('cert-form-wrap').style.display = 'block';
        }
        document.getElementById('certificate-modal-overlay').classList.add('active');
    };

    window.closeCertificateModal = function () {
        document.getElementById('certificate-modal-overlay').classList.remove('active');
        activeCert = null;
        certSubmitting = false;
        var btn = document.getElementById('cert-submit-btn');
        if (btn) { btn.disabled = false; btn.innerHTML = 'Pay \u20B999 with Razorpay'; }
    };

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

    function showCertSubmitted(paidAt, paymentId, courseName) {
        document.getElementById('cert-form-wrap').style.display = 'none';
        var box = document.getElementById('cert-success');
        box.style.display = 'block';
        var name = currentUserName();
        var course = courseName || (activeCertCourseName() || 'Course');
        var pid = paymentId || '';
        var mailto = pid ? buildManualMailto(course, pid, name) : ('mailto:' + OWNER_EMAIL);
        box.innerHTML = '<h4>Payment Successful</h4>' +
            '<p>Your \u20B999 Razorpay payment is done. ' +
            'Now email your payment ID to the owner. The owner will send your certificate manually.</p>' +
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
            '<i class="fa-solid fa-envelope"></i> Open Gmail to send payment ID</a></div></div>';
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
        var courseName = activeCertCourseName();
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
                // Local only — no server. Owner verifies in Razorpay Dashboard
                // when the student emails the payment ID, then sends cert manually.
                setCertPaid(sem, subj, { paymentId: pid, paidAt: new Date().toISOString(), courseName: courseName });
                certSubmitting = false;
                btn.disabled = false;
                btn.innerHTML = 'Pay \u20B999 with Razorpay';
                showCertSubmitted(new Date().toISOString(), pid, courseName);
                renderCertificatesView();
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

    // Wrap switchView so the Certificates menu works without editing app.js.
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
