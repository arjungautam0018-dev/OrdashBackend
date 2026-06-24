const express = require("express");
const router = express.Router();
const HotelProducts = require("../models/products.models");

// ── GET /api/menu/products/:sellerId ──────────────────────────────────────────
// Public — returns all available products for a seller
router.get("/menu/products/:sellerId", async (req, res) => {
    try {
        const { sellerId } = req.params;
        const doc = await HotelProducts.findOne({ seller: sellerId });
        if (!doc) {
            return res.status(200).json({ success: true, products: [] });
        }
        const available = doc.products.filter(p => p.isAvailable);
        return res.status(200).json({ success: true, products: available });
    } catch (err) {
        console.error("Menu products error:", err.message);
        return res.status(500).json({ success: false, message: "Server error." });
    }
});

// ── GET /api/menu/categories/:sellerId ────────────────────────────────────────
// Public — returns all categories for a seller
router.get("/menu/categories/:sellerId", async (req, res) => {
    try {
        const { sellerId } = req.params;
        const doc = await HotelProducts.findOne({ seller: sellerId });
        if (!doc) {
            return res.status(200).json({ success: true, categories: [] });
        }
        return res.status(200).json({ success: true, categories: doc.categories });
    } catch (err) {
        console.error("Menu categories error:", err.message);
        return res.status(500).json({ success: false, message: "Server error." });
    }
});

module.exports = router;
