const express  = require("express");
const router   = express.Router();
const SellerAcc = require("../models/selleracc.models");
const bcrypt   = require("bcrypt");

// ── POST /api/sellersignup ────────────────────────────────────────────────────
router.post("/sellersignup", async (req, res) => {
    console.log("[sellersignup] body:", JSON.stringify(req.body));
    try {
        const { name, phone, email, shopName, city, address, password } = req.body;

        if (!name || !phone || !email || !shopName || !city || !password) {
            console.warn("[sellersignup] missing fields");
            return res.status(400).json({ success: false, message: "All required fields must be filled." });
        }

        // Check duplicate email
        const exists = await SellerAcc.findOne({ email: email.toLowerCase().trim() }).lean();
        if (exists) {
            console.warn("[sellersignup] duplicate email:", email);
            return res.status(409).json({ success: false, message: "An account with this email already exists." });
        }

        const hashed = await bcrypt.hash(password, 12);

        const seller = await SellerAcc.create({
            name:     name.trim(),
            phone:    phone.trim(),
            email:    email.toLowerCase().trim(),
            shopName: shopName.trim(),
            city:     city.trim(),
            address:  address?.trim() ?? "",
            password: hashed,
        });

        console.log("[sellersignup] created seller:", seller._id.toString());
        return res.status(201).json({
            success: true,
            message: "Account created successfully.",
            sellerId: seller._id,
        });
    } catch (err) {
        console.error("[sellersignup] error:", err.message);
        return res.status(500).json({ success: false, message: "Server error.", detail: err.message });
    }
});

module.exports = router;
