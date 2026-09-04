const express  = require("express");
const router   = express.Router();
const SellerAcc = require("../models/selleracc.models");
const bcrypt   = require("bcrypt");
const jwt      = require("jsonwebtoken");
const verifyAuth = require("../config/userauth.config");
const AccountsModel = require("../models/accounts.models");
const multer = require("multer");
const cloudinary = require("../config/cloudinary.config");
const streamifier = require("streamifier");
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowed = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
        allowed.includes(file.mimetype) ? cb(null, true) : cb(new Error("Only JPG, PNG and WEBP allowed."));
    },
});


// ── POST /api/sellerlogin ─────────────────────────────────────────────────────
router.post("/sellerlogin", async (req, res) => {
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
// ── GET /api/seller/profile ───────────────────────────────────────────────────
router.get("/seller/profile", verifyAuth, async (req, res) => {
    try {
        const seller = await SellerAcc.findById(req.user.id).select("-password").lean();
        if (!seller) return res.status(404).json({ success: false, message: "Seller not found." });
        return res.status(200).json({ success: true, seller });
    } catch (err) {
        console.error("[seller/profile GET]", err.message);
        return res.status(500).json({ success: false, message: "Server error." });
    }
});

// ── PATCH /api/sellerprofile ──────────────────────────────────────────────────
router.patch("/seller/profile/update", verifyAuth, async (req, res) => {
    try {
        const allowed = ["name", "phone", "shopName", "city", "address", "profilePic", "bio"];
        const updates = {};
        for (const key of allowed) {
            if (req.body[key] !== undefined) updates[key] = req.body[key];
        }

        if (Object.keys(updates).length === 0) {
            return res.status(400).json({ success: false, message: "No valid fields to update." });
        }

        const seller = await SellerAcc.findByIdAndUpdate(
            req.user.id,
            { $set: updates },
            { new: true }
        ).select("-password").lean();

        return res.status(200).json({ success: true, seller });
    } catch (err) {
        console.error("[sellerprofile patch] error:", err.message);
        return res.status(500).json({ success: false, message: "Server error." });
    }
});

// Logo post
// ── POST /api/seller/logo ─────────────────────────────────────────────────────
router.post("/seller/logo", verifyAuth, async (req, res) => {
    try {
        const { imageBase64 } = req.body;
        if (!imageBase64) return res.status(400).json({ success: false, message: "No image provided." });

        // Destroy old logo
        const existing = await SellerAcc.findById(req.user.id, { profilePic: 1 }).lean();
        if (existing?.profilePic) {
            try {
                const parts    = existing.profilePic.split("/");
                const filename = parts[parts.length - 1].split(".")[0];
                const folder   = parts[parts.length - 2];
                await cloudinary.uploader.destroy(`${folder}/${filename}`);
            } catch (e) {
                console.error("[seller/logo] destroy error:", e.message);
            }
        }

        // Upload base64 to Cloudinary
        const result = await cloudinary.uploader.upload(
            `data:image/jpeg;base64,${imageBase64}`,
            {
                folder: "seller_logos",
                transformation: [
                    { width: 400, height: 400, crop: "fill", gravity: "auto" },
                    { quality: "auto", fetch_format: "auto" },
                ],
            }
        );

        await SellerAcc.findByIdAndUpdate(req.user.id, { profilePic: result.secure_url });
        return res.status(200).json({ success: true, url: result.secure_url });
    } catch (err) {
        console.error("[seller/logo]", err.message);
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
    return res.status(200).json({ success: true, message: "Logged out." });
});

module.exports = router;
