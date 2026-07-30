const express  = require("express");
const router   = express.Router();
const SellerAcc = require("../models/selleracc.models");
const bcrypt   = require("bcrypt");
const jwt      = require("jsonwebtoken");
const verifyAuth = require("../config/userauth.config");
const AccountsModel = require("../models/accounts.models");

// ── POST /api/sellerlogin ─────────────────────────────────────────────────────
router.post("/sellerlogin", async (req, res) => {
    console.log("[sellerlogin] attempt:", req.body?.email || req.body?.name);
    try {
        const { email, phone, password } = req.body;

        if ((!email && !phone) || !password) {
            return res.status(400).json({ success: false, message: "Credentials and password are required." });
        }

        // ── 1. Try seller (admin) login first — only via email ───────────────
        if (email) {
            const seller = await SellerAcc.findOne({ email: email.toLowerCase().trim() }).lean();
            if (seller) {
                const valid = await bcrypt.compare(password, seller.password);
                if (!valid) {
                    return res.status(400).json({ success: false, message: "Invalid email or password." });
                }

                req.session.sellerId = seller._id.toString();
                req.session.save((err) => {
                    if (err) console.error("[sellerlogin] session save error:", err);
                });

                const token = jwt.sign(
                    { id: seller._id.toString(), type: "admin" },
                    process.env.JWT_SECRET,
                    { expiresIn: "7d" }
                );

                console.log("[sellerlogin] admin success:", seller._id.toString());
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
                        type:     "admin",
                    },
                });
            }
        }
        const identifier = email || phone;
        if (identifier) {
            const isEmail = identifier.includes("@");
            const query = isEmail
                ? { "accounts.email": identifier.toLowerCase().trim() }
                : { "accounts.phone": identifier.trim() };

            const accountsDoc = await AccountsModel.findOne(query);

            if (!accountsDoc) {
                return res.status(400).json({ success: false, message: "Invalid credentials." });
            }

            const subAccount = accountsDoc.accounts.find((a) =>
                isEmail
                    ? a.email === identifier.toLowerCase().trim()
                    : a.phone === identifier.trim()
            );

            if (!subAccount) {
                return res.status(400).json({ success: false, message: "Invalid credentials." });
            }

            const valid = await bcrypt.compare(password, subAccount.password);
            if (!valid) {
                return res.status(400).json({ success: false, message: "Invalid credentials." });
            }

            const sellerId = accountsDoc.seller.toString();
            const sellerInfo = await SellerAcc.findById(sellerId, { password: 0 }).lean();

            const token = jwt.sign(
                {
                    id:   sellerId,
                    cid:  subAccount._id.toString(),
                    role: subAccount.role,
                    type: "sub",
                },
                process.env.JWT_SECRET,
                { expiresIn: "7d" }
            );

            console.log("[sellerlogin] sub-account success:", subAccount._id.toString(), "→ seller:", sellerId);
            return res.status(200).json({
                success: true,
                message: "Login successful.",
                token,
                seller: {
                    sellerId:    sellerId,
                    name:        subAccount.accountName,
                    shopName:    sellerInfo?.shopName,
                    city:        sellerInfo?.city,
                    role:        subAccount.role,
                    cid:         subAccount._id,
                    type:        "sub",
                },
            });
        }

        return res.status(400).json({ success: false, message: "Invalid credentials." });

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
