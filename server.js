// Edu Streamix Tech server
// Serves the static portal AND the separate Rs.99 certificate verification API.
// The existing Rs.49 registration flow is client-side only (Razorpay Checkout +
// localStorage `est_subscription_*`) and is intentionally NOT touched here.

require('dotenv').config();
const express = require('express');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 5500;
const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, 'data');
const DB_FILE = path.join(DATA_DIR, 'certificate-payments.json');
const USERSTATS_FILE = path.join(DATA_DIR, 'user-stats.json');

// --- Certificate constants: Rs.99 purpose=certificate, fully separate from Rs.49 registration.
// Payment is via Razorpay Checkout (same Key ID as Rs.49). No QR image, no UTR, no screenshot.
// After Checkout the student manually emails the payment ID to the owner for verification.
const CERTIFICATE_AMOUNT_RUPEES = 99;
const CERTIFICATE_PURPOSE = 'certificate';
const OWNER_MANUAL_EMAIL = process.env.OWNER_EMAIL || 't.harinarayana@gmail.com';
const PAYMENT_ID_RE = /^[A-Za-z0-9_\-]{6,60}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, '[]', 'utf8');
}
if (!fs.existsSync(USERSTATS_FILE)) {
    fs.writeFileSync(USERSTATS_FILE, '{}', 'utf8');
}

function readDb() {
    try {
        const raw = fs.readFileSync(DB_FILE, 'utf8');
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
        console.error('Unable to read certificate DB:', err.message);
        return [];
    }
}

function writeDb(records) {
    fs.writeFileSync(DB_FILE, JSON.stringify(records, null, 2), 'utf8');
}

// --- Aggregated study stats for the admin Dashboard (counts only: no
// passwords, emails, notes, or bookmarks ever leave the browser).
function readUserStats() {
    try {
        const parsed = JSON.parse(fs.readFileSync(USERSTATS_FILE, 'utf8'));
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (err) {
        console.error('Unable to read user stats:', err.message);
        return {};
    }
}

function writeUserStats(stats) {
    fs.writeFileSync(USERSTATS_FILE, JSON.stringify(stats, null, 2), 'utf8');
}

function sanitizeText(value, maxLen) {
    const s = String(value == null ? '' : value).trim();
    if (!s) return '';
    return s.slice(0, maxLen);
}

function newId() {
    if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
    return crypto.randomBytes(16).toString('hex');
}

function newCertificateId() {
    return `EST-${new Date().getFullYear()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
}

// --- Owner admin auth (panel login). Credentials live ONLY in .env, never in code/frontend.
function adminCreds() {
    return {
        username: (process.env.ADMIN_USERNAME || '').trim(),
        key: (process.env.ADMIN_KEY || '').trim()
    };
}

function safeEqual(a, b) {
    const ba = Buffer.from(String(a));
    const bb = Buffer.from(String(b));
    if (ba.length !== bb.length) return false;
    try {
        return crypto.timingSafeEqual(ba, bb);
    } catch (err) {
        return false;
    }
}

function readAdminAuth(req) {
    const body = req.body || {};
    return {
        username: sanitizeText(req.headers['x-admin-user'] || body.username || req.query.user, 120),
        key: String(req.headers['x-admin-key'] || body.password || body.key || req.query.key || '')
    };
}

function isAdmin(req) {
    const creds = adminCreds();
    if (!creds.username || !creds.key) return false;
    if (verifyAdminToken(req.headers['x-admin-token'], creds)) return true;
    const got = readAdminAuth(req);
    return safeEqual(got.username, creds.username) && safeEqual(got.key, creds.key);
}

function requireAdmin(req, res, next) {
    if (!isAdmin(req)) {
        return res.status(401).json({ ok: false, error: 'Admin login required.' });
    }
    next();
}

// --- Stateless admin session tokens (so the in-app admin login never exposes
// ADMIN_KEY to the browser). Token = base64url(payload).base64url(hmac),
// payload = { u: username, exp: epoch_ms }. Signed with ADMIN_KEY, 12h expiry.
const ADMIN_TOKEN_TTL_MS = 12 * 60 * 60 * 1000;

function b64urlEncode(buf) {
    return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function b64urlDecodeToBuffer(s) {
    let b64 = String(s || '').replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4) b64 += '=';
    return Buffer.from(b64, 'base64');
}

function issueAdminToken(username, creds) {
    const payload = JSON.stringify({ u: username, exp: Date.now() + ADMIN_TOKEN_TTL_MS });
    const body = b64urlEncode(payload);
    const sig = b64urlEncode(crypto.createHmac('sha256', creds.key).update(body).digest());
    return `${body}.${sig}`;
}

function verifyAdminToken(token, creds) {
    try {
        if (!token || typeof token !== 'string') return false;
        const parts = token.split('.');
        if (parts.length !== 2) return false;
        const [body, sig] = parts;
        const expected = b64urlEncode(crypto.createHmac('sha256', creds.key).update(body).digest());
        const a = Buffer.from(sig);
        const b = Buffer.from(expected);
        if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;
        const payload = JSON.parse(b64urlDecodeToBuffer(body).toString('utf8'));
        if (!payload || payload.u !== creds.username) return false;
        if (!Number.isFinite(payload.exp) || payload.exp <= Date.now()) return false;
        return true;
    } catch (err) {
        return false;
    }
}

const app = express();
app.use(express.json({ limit: '1mb' }));

// Block sensitive paths from ever being served statically.
app.use((req, res, next) => {
    const p = decodeURIComponent(req.path || '');
    if (
        p.startsWith('/data/') ||
        p === '/.env' ||
        p.startsWith('/.git')
    ) {
        return res.status(403).send('Forbidden');
    }
    next();
});

// Static portal (index.html, app.js, data.js, style.css, assets/*).
app.use(express.static(ROOT, { index: 'index.html', dotfiles: 'deny' }));

// --- Simple in-memory rate limits.
const submitHitsByIp = new Map();
function rateLimited(map, ip, maxHits, windowMs) {
    const now = Date.now();
    const hits = (map.get(ip) || []).filter((t) => now - t < windowMs);
    hits.push(now);
    map.set(ip, hits);
    return hits.length > maxHits;
}
function submitRateLimited(ip) {
    return rateLimited(submitHitsByIp, ip, 10, 60 * 1000);
}
const adminHitsByIp = new Map();
function adminRateLimited(ip) {
    return rateLimited(adminHitsByIp, ip, 30, 60 * 1000);
}
const syncHitsByIp = new Map();
function syncRateLimited(ip) {
    return rateLimited(syncHitsByIp, ip, 30, 60 * 1000);
}

function findPending(records, username, sem, subj) {
    return records.find(
        (r) =>
            r.username === username &&
            Number(r.sem) === Number(sem) &&
            Number(r.subj) === Number(subj) &&
            ['PAYMENT_SUBMITTED', 'UNDER_VERIFICATION', 'PAYMENT_VERIFIED', 'CERTIFICATE_ISSUED'].includes(r.status)
    );
}

// POST /api/certificate-submit — Razorpay Checkout intake for the Rs.99 certificate fee.
// Body is JSON: { username, studentName, studentEmail, sem, subj, courseName, razorpay_payment_id }.
// No email is sent by the server. The student manually emails the payment ID to
// OWNER_MANUAL_EMAIL; the owner verifies in the Razorpay Dashboard + Verifications view.
app.post('/api/certificate-submit', (req, res) => {
    if (submitRateLimited(req.ip)) {
        return res.status(429).json({ ok: false, error: 'Too many requests. Please wait a minute and retry.' });
    }
    try {
        const body = req.body || {};
        const username = sanitizeText(body.username, 120);
        const studentName = sanitizeText(body.studentName, 120);
        const studentEmail = sanitizeText(body.studentEmail, 160);
        const paymentId = sanitizeText(body.razorpay_payment_id || body.paymentId, 60).replace(/\s+/g, '');
        const sem = Number(body.sem);
        const subj = Number(body.subj);
        const courseName = sanitizeText(body.courseName, 220);

        if (!username) return res.status(400).json({ ok: false, error: 'Missing user identity. Please log in again.' });
        if (studentName.length < 2) return res.status(400).json({ ok: false, error: 'Student name is required.' });
        if (!EMAIL_RE.test(studentEmail)) return res.status(400).json({ ok: false, error: 'A valid email address is required.' });
        if (!PAYMENT_ID_RE.test(paymentId)) {
            return res.status(400).json({ ok: false, error: 'Valid Razorpay payment ID is required. Please complete the Rs.99 payment first.' });
        }
        if (!Number.isInteger(sem) || sem < 0 || sem > 7) {
            return res.status(400).json({ ok: false, error: 'Invalid course reference.' });
        }
        if (!Number.isInteger(subj) || subj < 0 || subj > 30) {
            return res.status(400).json({ ok: false, error: 'Invalid course reference.' });
        }

        const records = readDb();
        const existing = findPending(records, username, sem, subj);
        if (existing) {
            // Duplicate-submission protection: surface current status instead of duplicating.
            return res.status(409).json({
                ok: false,
                error: 'A verification request for this course is already under verification.',
                status: existing.status,
                submittedAt: existing.submittedAt
            });
        }

        const submittedAt = new Date().toISOString();
        const record = {
            id: newId(),
            username,
            studentName,
            studentEmail,
            sem,
            subj,
            courseName: courseName || `Semester ${sem + 1} / Subject ${subj + 1}`,
            amount: CERTIFICATE_AMOUNT_RUPEES,
            purpose: CERTIFICATE_PURPOSE,
            paymentId,
            // Legacy fields (UTR/screenshot era) kept for old rows; new rows omit them.
            utr: paymentId,
            status: 'UNDER_VERIFICATION',
            submittedAt
        };

        records.push(record);
        writeDb(records);

        return res.json({
            ok: true,
            status: record.status,
            submittedAt: record.submittedAt,
            paymentId: record.paymentId,
            manualEmail: OWNER_MANUAL_EMAIL,
            message:
                'Your \u20B999 certificate payment has been recorded. ' +
                `Please manually email your payment ID to ${OWNER_MANUAL_EMAIL} for verification. ` +
                'Your certificate will be processed after the payment is verified.'
        });
    } catch (err) {
        console.error('Certificate submit failed:', err);
        return res.status(500).json({ ok: false, error: 'Unable to submit right now. Please retry.' });
    }
});

// GET /api/certificate-status?username=&sem=&subj= — lets the UI show Under Verification
// instead of creating duplicates. Never exposes other users' records.
app.get('/api/certificate-status', (req, res) => {
    const username = sanitizeText(req.query.username, 120);
    const sem = Number(req.query.sem);
    const subj = Number(req.query.subj);
    if (!username || !Number.isInteger(sem) || !Number.isInteger(subj)) {
        return res.status(400).json({ ok: false, error: 'username, sem, and subj are required.' });
    }
    const records = readDb();
    const match = records
        .filter((r) => r.username === username && Number(r.sem) === sem && Number(r.subj) === subj)
        .sort((a, b) => String(b.submittedAt).localeCompare(String(a.submittedAt)))[0];
    if (!match) return res.json({ ok: true, status: 'NONE' });
    return res.json({
        ok: true,
        status: match.status,
        submittedAt: match.submittedAt,
        courseName: match.courseName,
        amount: match.amount,
        purpose: match.purpose,
        paymentId: match.paymentId || match.utr || null,
        manualEmail: OWNER_MANUAL_EMAIL,
        certificateId: match.certificateId || null,
        issuedAt: match.issuedAt || null
    });
});

// GET /api/certificate?username=&sem=&subj= — downloadable certificate data for the
// student's OWN approved record only. Nothing is issued automatically; the owner
// must Approve in the Verifications view first.
app.get('/api/certificate', (req, res) => {
    const username = sanitizeText(req.query.username, 120);
    const sem = Number(req.query.sem);
    const subj = Number(req.query.subj);
    if (!username || !Number.isInteger(sem) || !Number.isInteger(subj)) {
        return res.status(400).json({ ok: false, error: 'username, sem, and subj are required.' });
    }
    const records = readDb();
    const match = records
        .filter((r) => r.username === username && Number(r.sem) === sem && Number(r.subj) === subj)
        .sort((a, b) => String(b.submittedAt).localeCompare(String(a.submittedAt)))[0];
    if (!match || (match.status !== 'PAYMENT_VERIFIED' && match.status !== 'CERTIFICATE_ISSUED')) {
        return res.status(404).json({ ok: false, error: 'No issued certificate for this course yet.' });
    }
    return res.json({
        ok: true,
        certificate: {
            certificateId: match.certificateId,
            studentName: match.studentName,
            courseName: match.courseName,
            amount: match.amount,
            purpose: match.purpose,
            issuedAt: match.issuedAt,
            submittedAt: match.submittedAt
        }
    });
});

// POST /api/progress-sync — student browsers report summary study stats for the
// admin Dashboard. Self-reported (overview only, never used for certificate
// decisions). Rate-limited. Counts only — no PII beyond display username.
app.post('/api/progress-sync', (req, res) => {
    if (syncRateLimited(req.ip)) {
        return res.status(429).json({ ok: false, error: 'Too many requests.' });
    }
    const body = req.body || {};
    const username = sanitizeText(body.username, 120);
    const displayName = sanitizeText(body.displayName, 120);
    const doneUnits = Number(body.doneUnits);
    const totalUnits = Number(body.totalUnits);
    const quizzesCleared = Number(body.quizzesCleared);
    if (!username) return res.status(400).json({ ok: false, error: 'username is required.' });
    if (!Number.isInteger(doneUnits) || doneUnits < 0 || doneUnits > 100000) {
        return res.status(400).json({ ok: false, error: 'Invalid doneUnits.' });
    }
    if (!Number.isInteger(totalUnits) || totalUnits < 0 || totalUnits > 100000) {
        return res.status(400).json({ ok: false, error: 'Invalid totalUnits.' });
    }
    if (!Number.isInteger(quizzesCleared) || quizzesCleared < 0 || quizzesCleared > 10000) {
        return res.status(400).json({ ok: false, error: 'Invalid quizzesCleared.' });
    }
    // startedCourses: [{ name, done, total }] — only subjects with progress, capped.
    let startedCourses = [];
    if (Array.isArray(body.startedCourses)) {
        startedCourses = body.startedCourses.slice(0, 80).map((c) => ({
            name: sanitizeText(c && c.name, 160),
            done: Math.max(0, Math.min(10000, Number(c && c.done) || 0)),
            total: Math.max(0, Math.min(10000, Number(c && c.total) || 0))
        })).filter((c) => c.name && c.total > 0);
    }
    const stats = readUserStats();
    stats[username] = {
        displayName: displayName || username,
        doneUnits,
        totalUnits,
        quizzesCleared,
        startedCourses,
        lastSeen: new Date().toISOString()
    };
    // Cap total tracked users to avoid unbounded growth.
    const keys = Object.keys(stats);
    if (keys.length > 5000) {
        const oldest = keys
            .map((k) => ({ k, t: stats[k].lastSeen || '' }))
            .sort((a, b) => String(a.t).localeCompare(String(b.t)))[0];
        if (oldest) delete stats[oldest.k];
    }
    writeUserStats(stats);
    return res.json({ ok: true });
});

// --- Owner admin API (all key/token-gated; credentials only in .env).
// Public: reveals the admin USERNAME + Razorpay KEY_ID only (both public by design)
// so the in-app login + Checkout can work. ADMIN_KEY and RAZORPAY_KEY_SECRET
// NEVER leave the server.
app.get('/api/config', (req, res) => {
    const creds = adminCreds();
    return res.json({
        ok: true,
        adminUsername: creds.username || null,
        razorpayKeyId: (process.env.RAZORPAY_KEY_ID || '').trim() || null
    });
});

app.post('/api/admin/login', (req, res) => {
    if (adminRateLimited(req.ip)) {
        return res.status(429).json({ ok: false, error: 'Too many attempts. Wait a minute and retry.' });
    }
    if (!isAdmin(req)) {
        return res.status(401).json({ ok: false, error: 'Invalid admin username or password.' });
    }
    // Issue a stateless session token so the browser never holds ADMIN_KEY.
    const creds = adminCreds();
    const got = readAdminAuth(req);
    return res.json({ ok: true, token: issueAdminToken(got.username || creds.username, creds) });
});

app.get('/api/admin/submissions', requireAdmin, (req, res) => {
    const records = readDb()
        .slice()
        .sort((a, b) => String(b.submittedAt).localeCompare(String(a.submittedAt)))
        .map((r) => ({
            id: r.id,
            username: r.username,
            studentName: r.studentName,
            studentEmail: r.studentEmail,
            sem: r.sem,
            subj: r.subj,
            courseName: r.courseName,
            amount: r.amount,
            purpose: r.purpose,
            paymentId: r.paymentId || r.utr || null,
            utr: r.paymentId || r.utr || null,
            status: r.status,
            submittedAt: r.submittedAt,
            hasScreenshot: !!r.screenshotFile,
            certificateId: r.certificateId || null,
            issuedAt: r.issuedAt || null,
            decidedAt: r.decidedAt || null
        }));
    return res.json({ ok: true, count: records.length, submissions: records });
});

// GET /api/admin/users — aggregated study stats for the admin Dashboard.
// Overview only (self-reported by browsers, never used for decisions).
app.get('/api/admin/users', requireAdmin, (req, res) => {
    const stats = readUserStats();
    const users = Object.keys(stats)
        .map((username) => {
            const s = stats[username] || {};
            const done = Number(s.doneUnits) || 0;
            const total = Number(s.totalUnits) || 0;
            return {
                username,
                displayName: s.displayName || username,
                doneUnits: done,
                totalUnits: total,
                percent: total > 0 ? Math.round((done / total) * 100) : 0,
                quizzesCleared: Number(s.quizzesCleared) || 0,
                startedCourses: Array.isArray(s.startedCourses) ? s.startedCourses : [],
                lastSeen: s.lastSeen || null
            };
        })
        .sort((a, b) => String(b.lastSeen || '').localeCompare(String(a.lastSeen || '')));
    return res.json({ ok: true, count: users.length, users });
});

// Legacy screenshot viewer (UTR/screenshot era). New Razorpay records have no screenshotFile.
app.get('/api/admin/screenshot/:id', requireAdmin, (req, res) => {
    const records = readDb();
    const match = records.find((r) => r.id === req.params.id);
    if (!match || !match.screenshotFile) return res.status(404).send('Not found');
    const legacyDir = path.join(DATA_DIR, 'uploads');
    const filePath = path.join(legacyDir, path.basename(match.screenshotFile));
    if (!filePath.startsWith(legacyDir) || !fs.existsSync(filePath)) {
        return res.status(404).send('Not found');
    }
    const ext = path.extname(filePath).toLowerCase();
    const mime = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
    res.setHeader('Content-Type', mime);
    res.setHeader('Cache-Control', 'no-store');
    fs.createReadStream(filePath).pipe(res);
});

app.post('/api/admin/decision', requireAdmin, (req, res) => {
    const id = sanitizeText(req.body.id, 80);
    const decision = sanitizeText(req.body.decision, 20).toUpperCase();
    if (!id || (decision !== 'APPROVE' && decision !== 'REJECT')) {
        return res.status(400).json({ ok: false, error: 'id and decision (APPROVE|REJECT) are required.' });
    }
    const records = readDb();
    const match = records.find((r) => r.id === id);
    if (!match) return res.status(404).json({ ok: false, error: 'Submission not found.' });
    if (decision === 'APPROVE') {
        match.status = 'CERTIFICATE_ISSUED';
        if (!match.certificateId) match.certificateId = newCertificateId();
        match.issuedAt = new Date().toISOString();
        match.decidedAt = match.issuedAt;
    } else {
        // REJECTED is intentionally NOT in the pending list, so the student may retry.
        match.status = 'REJECTED';
        match.decidedAt = new Date().toISOString();
    }
    writeDb(records);
    return res.json({
        ok: true,
        status: match.status,
        certificateId: match.certificateId || null,
        issuedAt: match.issuedAt || null
    });
});

// Fallback to the portal for unknown GET routes (keeps the static-site behavior).
app.get(/.*/, (req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    res.sendFile(path.join(ROOT, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Edu Streamix Tech server running: http://localhost:${PORT}`);
    const creds = adminCreds();
    if (!creds.username || !creds.key) {
        console.warn('[certificates] ADMIN_USERNAME/ADMIN_KEY not set — /admin login is disabled until configured.');
    } else {
        console.log('[certificates] In-app admin login enabled (Verifications menu after admin sign-in).');
    }
    console.log(`[certificates] Rs.99 payments via Razorpay Checkout. Manual verification inbox: ${OWNER_MANUAL_EMAIL}`);
    console.log('[certificates] No auto-email configured — students manually email their Razorpay payment ID to the owner.');
});
