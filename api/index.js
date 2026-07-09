require("dotenv").config();
const express = require("express");
const cors    = require("cors");
const morgan  = require("morgan");
const path    = require("path");
const session = require("express-session");
const helmet  = require("helmet");

const { generalLimiter, authLimiter, orderLimiter } = require("../src/config/ratelimit.config");

const app = express();

// ── Security ──────────────────────────────────────────────────────────────────
// Disable helmet policies that break React Native / mobile clients
app.use(helmet({
    crossOriginResourcePolicy: false,   // RN fetches are cross-origin
    contentSecurityPolicy: false,       // not a browser app
}));

// ── CORS — allow all origins (mobile app has no origin header) ────────────────
app.use(cors({
    origin: true,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
}));

// ── Body + static ─────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.static(path.join(__dirname, "../public")));

// ── Request timing — logs method, path, status and ms for every request ───────
app.use((req, res, next) => {
    const start = Date.now();
    res.on("finish", () => {
        const ms = Date.now() - start;
        const color = res.statusCode >= 500 ? "\x1b[31m"   // red
                    : res.statusCode >= 400 ? "\x1b[33m"   // yellow
                    : res.statusCode >= 200 ? "\x1b[32m"   // green
                    : "\x1b[0m";
        console.log(
            `${color}[api] ${req.method} ${req.originalUrl} → ${res.statusCode} (${ms}ms)\x1b[0m`
        );
    });
    next();
});

// ── Session ───────────────────────────────────────────────────────────────────
const isProduction = process.env.NODE_ENV === "production";
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: isProduction,           // HTTPS only in prod, HTTP ok in dev
        httpOnly: true,
        sameSite: isProduction ? "none" : "lax",  // "none" needed for cross-origin mobile in prod
        maxAge: 7 * 24 * 60 * 60 * 1000,          // 7 days — matches frontend assumption
    },
}));

// ── DB ────────────────────────────────────────────────────────────────────────
const connectDB = require("../src/config/db.config");
connectDB();

// ── Health check ──────────────────────────────────────────────────────────────
app.get("/", (req, res) => res.json({ status: "ok", ts: Date.now() }));

// ── Rate limiting ─────────────────────────────────────────────────────────────
app.use("/api", generalLimiter);
app.use("/api/sellersignup", authLimiter);
app.use("/api/sellerlogin",  authLimiter);
app.use("/api/order/place",  orderLimiter);

// ── Routes ────────────────────────────────────────────────────────────────────
app.use("/api", require("../src/routes/sellersignup.routes"));
app.use("/api", require("../src/routes/sellerlogin.routes"));
app.use("/api", require("../src/routes/addproduct.routes"));
app.use("/api", require("../src/routes/addtables.routes"));
app.use("/api", require("../src/routes/qrgeneration.routes"));
app.use("/api", require("../src/routes/menu.routes"));
app.use("/api", require("../src/routes/order.routes"));

// ── Global error handler ──────────────────────────────────────────────────────
app.use((err, req, res, next) => {
    console.error("[error]", err.message);
    res.status(500).json({ success: false, message: "Internal server error." });
});

module.exports = app;
