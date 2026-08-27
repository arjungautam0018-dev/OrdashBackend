const express  = require("express");
const router   = express.Router();
const SellerAcc = require("../models/selleracc.models");
const bcrypt   = require("bcrypt");

// ── POST /api/sellersignup ────────────────────────────────────────────────────
router.post("/sellersignup", async (req, res) => {
    try {
        const { name, phone, email, shopName, city, address, password } = req.body;

        if (!name || !phone || !email || !shopName || !city || !password) {
            return res.status(400).json({ success: false, message: "All required fields must be filled." });
        }

        // Check duplicate email
        const exists = await SellerAcc.findOne({ email: email.toLowerCase().trim() }).lean();
        if (exists) {
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
