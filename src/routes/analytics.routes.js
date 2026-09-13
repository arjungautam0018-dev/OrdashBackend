const express = require("express");
const router  = require("express").Router();
const auth    = require("../config/userauth.config");

const PYTHON_URL = process.env.PYTHON_SERVICE_URL;

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
router.get("/analytics/revenue",    auth, (req, res) => proxy(res, `/analytics/revenue/${req.user.id}?range=${req.query.range || "today"}`));
router.get("/analytics/top-items",  auth, (req, res) => proxy(res, `/analytics/top-items/${req.user.id}?range=${req.query.range || "today"}`));
router.get("/analytics/peak-hours", auth, (req, res) => proxy(res, `/analytics/peak-hours/${req.user.id}`));
router.get("/analytics/demand",     auth, (req, res) => proxy(res, `/predict/demand/${req.user.id}`));
router.get("/analytics/today", auth, (req, res) => {
    res.set("Cache-Control", "no-store");
    proxy(res, `/analytics/today/${req.user.id}`);
});
router.get("/analytics/categories", auth, (req, res) => proxy(res, `/analytics/categories/${req.user.id}?range=${req.query.range || "today"}`));
router.get("/analytics/table-revenue", auth, (req, res) => proxy(res, `/analytics/table-revenue/${req.user.id}?range=${req.query.range || "today"}`));
router.get("/analytics/table-orders",  auth, (req, res) => proxy(res, `/analytics/table-orders/${req.user.id}?range=${req.query.range || "today"}`));
router.get("/analytics/active-tables",      auth, (req, res) => proxy(res, `/analytics/active-tables/${req.user.id}?range=${req.query.range || "today"}`));
router.get("/analytics/avg-order-by-table", auth, (req, res) => proxy(res, `/analytics/avg-order-by-table/${req.user.id}?range=${req.query.range || "today"}`));
router.get("/analytics/most-ordered",     auth, (req, res) => proxy(res, `/analytics/most-ordered/${req.user.id}?range=${req.query.range || "today"}`));
router.get("/analytics/highest-revenue",  auth, (req, res) => proxy(res, `/analytics/highest-revenue/${req.user.id}?range=${req.query.range || "today"}`));
router.get("/analytics/fastest-growing",  auth, (req, res) => proxy(res, `/analytics/fastest-growing/${req.user.id}?range=${req.query.range || "week"}`));
router.get("/analytics/declining",        auth, (req, res) => proxy(res, `/analytics/declining/${req.user.id}?range=${req.query.range || "week"}`));

module.exports = router;
