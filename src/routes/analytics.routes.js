const express = require("express");
const router  = require("express").Router();
const auth    = require("../config/userauth.config");

const PYTHON_URL = process.env.PYTHON_SERVICE_URL || "http://localhost:8000";

// ── Proxy helper ──────────────────────────────────────────────────────────────
const proxy = async (res, path) => {
    try {
        const r    = await fetch(`${PYTHON_URL}${path}`);
        const data = await r.json();
        return res.json(data);
    } catch (err) {
        console.error("[analytics proxy]", err.message);
        return res.status(502).json({ success: false, message: "Analytics service unavailable." });
    }
};

// ── Routes — all auth protected ───────────────────────────────────────────────
router.get("/analytics/revenue",    auth, (req, res) => proxy(res, `/analytics/revenue/${req.user.id}`));
router.get("/analytics/top-items",  auth, (req, res) => proxy(res, `/analytics/top-items/${req.user.id}`));
router.get("/analytics/peak-hours", auth, (req, res) => proxy(res, `/analytics/peak-hours/${req.user.id}`));
router.get("/analytics/demand",     auth, (req, res) => proxy(res, `/predict/demand/${req.user.id}`));
router.get("/analytics/today", auth, (req, res) => {
    res.set("Cache-Control", "no-store");
    proxy(res, `/analytics/today/${req.user.id}`);
});

module.exports = router;
