const rateLimit = require("express-rate-limit");

// ── General API limit — 100 req / 15 min per IP ───────────────────────────────
const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: "Too many requests, please try again later." },
});

// ── Auth limit — 10 attempts / 15 min per IP (login / signup) ────────────────
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: "Too many login attempts, please try again in 15 minutes." },
});

// ── Order place limit — 30 orders / 5 min per IP ─────────────────────────────
const orderLimiter = rateLimit({
    windowMs: 5 * 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: "Too many orders, please slow down." },
});

module.exports = { generalLimiter, authLimiter, orderLimiter };
