const express = require("express");
const router = express.Router();
const auth = require("../config/userauth.config");
const PushToken = require("../models/pushToken.models");

/**
 * POST /api/push/register
 * Customer (public) — registers the device's Expo push token against its
 * table-session so status-change pushes reach the right customer.
 * Body: { token, sellerId, tableId, sessionId }
 */
router.post("/push/register", async (req, res) => {
    try {
        const { token, sellerId, tableId, sessionId } = req.body;
        if (!token || !sellerId || !tableId || !sessionId) {
            return res.status(400).json({
                success: false,
                message: "token, sellerId, tableId and sessionId are required.",
            });
        }
        await PushToken.findOneAndUpdate(
            { token },
            {
                kind: "customer",
                seller: sellerId,
                tableId,
                sessionId,
                $unset: { accountId: "", role: "" },
            },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );
        return res.status(200).json({ success: true });
    } catch (err) {
        console.error("[push/register] error:", err.message);
        return res.status(500).json({ success: false, message: "Server error." });
    }
});

/**
 * POST /api/push/register-seller
 * Seller / staff (auth) — registers the device against the logged-in account.
 * sellerId, role and accountId are derived from the JWT so they can't be spoofed.
 * Body: { token }
 */
router.post("/push/register-seller", auth, async (req, res) => {
    try {
        const { token } = req.body;
        if (!token) {
            return res.status(400).json({ success: false, message: "token is required." });
        }

        const sellerId = req.user.id;
        const role = req.user.type === "sub" ? (req.user.role || "Waiter") : "Admin";
        const accountId = req.user.cid || null;

        await PushToken.findOneAndUpdate(
            { token },
            {
                kind: "seller",
                seller: sellerId,
                role,
                accountId,
                $unset: { tableId: "", sessionId: "" },
            },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );
        return res.status(200).json({ success: true });
    } catch (err) {
        console.error("[push/register-seller] error:", err.message);
        return res.status(500).json({ success: false, message: "Server error." });
    }
});

/**
 * POST /api/push/unregister
 * Body: { token } — removes the token (on logout / role switch).
 */
router.post("/push/unregister", async (req, res) => {
    try {
        const { token } = req.body;
        if (token) await PushToken.deleteOne({ token });
        return res.status(200).json({ success: true });
    } catch (err) {
        console.error("[push/unregister] error:", err.message);
        return res.status(500).json({ success: false, message: "Server error." });
    }
});

module.exports = router;
