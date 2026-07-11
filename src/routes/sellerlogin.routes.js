const express  = require("express");
const router   = express.Router();
const SellerAcc = require("../models/selleracc.models");
const bcrypt   = require("bcrypt");
const jwt      = require("jsonwebtoken");
const verifyAuth = require("../config/userauth.config");

// ── POST /api/sellerlogin ─────────────────────────────────────────────────────
router.post("/sellerlogin", async (req, res) => {
    console.log("[sellerlogin] attempt:", req.body?.email);
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ success: false, message: "Email and password are required." });
        }

        if (req.session.sellerId) {
            console.log("[sellerlogin] already logged in:", req.session.sellerId);
            return res.status(200).json({ success: true, message: "Already logged in." });
        }

        const seller = await SellerAcc.findOne({ email: email.toLowerCase().trim() }).lean();
        if (!seller) {
            return res.status(400).json({ success: false, message: "Invalid email or password." });
        }

        const valid = await bcrypt.compare(password, seller.password);
        if (!valid) {
            return res.status(400).json({ success: false, message: "Invalid email or password." });
        }

        req.session.sellerId = seller._id.toString();
        req.session.save((err) => {
            if (err) console.error("[sellerlogin] session save error:", err);
        });

        // Issue JWT — React Native can't reliably persist cookies cross-origin
        const token = jwt.sign(
            { id: seller._id.toString() },
            process.env.JWT_SECRET,
            { expiresIn: "7d" }
        );

        console.log("[sellerlogin] success:", seller._id.toString());
        return res.status(200).json({
            success: true,
            message: "Login successful.",
            token,
            seller: {
                sellerId: seller._id,
                name:     seller.name,
                email:    seller.email,
                shopName: seller.shopName,
                city:     seller.city,
            },
        });
    } catch (err) {
        console.error("[sellerlogin] error:", err.message);
        return res.status(500).json({ success: false, message: "Server error." });
    }
});

// ── GET /api/sellerprofile ────────────────────────────────────────────────────
router.get("/sellerprofile", verifyAuth, async (req, res) => {
    try {
        const seller = await SellerAcc.findById(req.user.id, { password: 0 }).lean();
        if (!seller) return res.status(404).json({ success: false, message: "Seller not found." });
        return res.status(200).json({ success: true, seller });
    } catch (err) {
        console.error("[sellerprofile] error:", err.message);
        return res.status(500).json({ success: false, message: "Server error." });
    }
});

// ── POST /api/logout ──────────────────────────────────────────────────────────
// For JWT clients, logout is handled client-side (delete token from AsyncStorage).
// We still destroy the server session if one exists.
router.post("/logout", (req, res) => {
    if (req.session?.sellerId) {
        req.session.destroy((err) => {
            if (err) console.error("[logout] session destroy error:", err);
        });
    }
    console.log("[logout] completed");
    return res.status(200).json({ success: true, message: "Logged out." });
});

module.exports = router;
