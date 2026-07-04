const express = require("express");
const router  = express.Router();
const HotelProducts = require("../models/products.models");

// ── GET /api/menu/products/:sellerId ──────────────────────────────────────────
router.get("/menu/products/:sellerId", async (req, res) => {
    try {
        const { sellerId } = req.params;
        const doc = await HotelProducts
            .findOne({ seller: sellerId }, { products: 1 })
            .lean();

        if (!doc) return res.status(200).json({ success: true, products: [] });

        const available = doc.products.filter(p => p.isAvailable);
        return res.status(200).json({ success: true, products: available });
    } catch (err) {
        console.error("[menu/products]", err.message);
        return res.status(500).json({ success: false, message: "Server error." });
    }
});

// ── GET /api/menu/categories/:sellerId ────────────────────────────────────────
router.get("/menu/categories/:sellerId", async (req, res) => {
    try {
        const { sellerId } = req.params;
        const doc = await HotelProducts
            .findOne({ seller: sellerId }, { categories: 1 })
            .lean();

        if (!doc) return res.status(200).json({ success: true, categories: [] });

        return res.status(200).json({ success: true, categories: doc.categories });
    } catch (err) {
        console.error("[menu/categories]", err.message);
        return res.status(500).json({ success: false, message: "Server error." });
    }
});

module.exports = router;
