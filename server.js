// Edu Streamix Tech server — static portal + public Razorpay Key ID.
// Rs.49 registration and Rs.99 certificate payments are Razorpay Checkout only.
// Certificates are issued manually by the owner over email — no admin portal,
// no verification/approval flow, no server DB.

require('dotenv').config();
const express = require('express');
const path = require('path');

const PORT = process.env.PORT || 5500;
const ROOT = __dirname;

const app = express();
app.use(express.json({ limit: '1mb' }));

// Block sensitive paths from ever being served statically.
app.use((req, res, next) => {
    const p = decodeURIComponent(req.path || '');
    if (
        p === '/.env' ||
        p.startsWith('/.git')
    ) {
        return res.status(403).send('Forbidden');
    }
    next();
});

// Static portal (index.html, app.js, data.js, style.css, assets/*).
app.use(express.static(ROOT, { index: 'index.html', dotfiles: 'deny' }));

// Public config: reveals the Razorpay KEY_ID only (public by design)
// so Checkout can work. KEY_SECRET never leaves the server (and is not
// even read here anymore — payments are verified manually by the owner
// in the Razorpay Dashboard from the payment ID the student emails).
app.get('/api/config', (req, res) => {
    return res.json({
        ok: true,
        razorpayKeyId: (process.env.RAZORPAY_KEY_ID || '').trim() || null
    });
});

// Fallback to the portal for unknown GET routes (keeps the static-site behavior).
app.get(/.*/, (req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    res.sendFile(path.join(ROOT, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Edu Streamix Tech server running: http://localhost:${PORT}`);
    console.log('[certificates] Rs.99 payments via Razorpay Checkout. Owner sends certificates manually over email.');
});
