const express = require("express");
const router = express.Router();
const auth = require("../config/userauth.config");
const HotelTables = require("../models/table.models");
const SellerAcc = require("../models/selleracc.models");

// ── Helper: generate unique 6-char alphanumeric code ─────────────────────────
const generateCode = () => Math.random().toString(36).substring(2, 8).toUpperCase();

// ── POST /api/table/add ───────────────────────────────────────────────────────
router.post("/table/add", auth, async (req, res) => {
    try {
        const sellerId = req.user.id;
        const { name, capacity } = req.body;

        if (!name || !name.trim()) {
            return res.status(400).json({ success: false, message: "Table name is required." });
        }

        const cap = Number(capacity);
        if (!capacity || isNaN(cap) || cap <= 0) {
            return res.status(400).json({ success: false, message: "Capacity must be a number greater than 0." });
        }

        const newTable = { name: name.trim(), capacity: cap, code: generateCode() };

        const hotelDoc = await HotelTables.findOneAndUpdate(
            { seller: sellerId },
            { $push: { tables: newTable } },
            { new: true, upsert: true }
        );

        const added = hotelDoc.tables[hotelDoc.tables.length - 1];
        return res.status(201).json({ success: true, message: "Table added.", table: added });
    } catch (error) {
        console.error("Add table error:", error.message);
        return res.status(500).json({ success: false, message: "Server error." });
    }
});

// ── GET /api/table/all ────────────────────────────────────────────────────────
router.get("/table/all", auth, async (req, res) => {
    try {
        const hotelDoc = await HotelTables.findOne({ seller: req.user.id });
        return res.status(200).json({ success: true, tables: hotelDoc ? hotelDoc.tables : [] });
    } catch (error) {
        console.error("Get tables error:", error.message);
        return res.status(500).json({ success: false, message: "Server error." });
    }
});

// ── POST /api/table/code ──────────────────────────────────────────────────────
// Public — customer/waiter enters code printed on table to identify it
// Body: { code }
// Returns: { sellerId, tableId, tableName, shopName }
router.post("/table/code", async (req, res) => {
    try {
        const { code } = req.body;
        if (!code || !code.trim()) {
            return res.status(400).json({ success: false, message: "Code is required." });
        }

        // Find the HotelTables doc that has a table with this code
        const hotelDoc = await HotelTables.findOne({
            "tables.code": code.trim().toUpperCase(),
        }).lean();

        if (!hotelDoc) {
            return res.status(404).json({ success: false, message: "Invalid code. No table found." });
        }

        const table = hotelDoc.tables.find(
            t => t.code === code.trim().toUpperCase()
        );

        // Get shop name from seller account
        const seller = await SellerAcc.findById(hotelDoc.seller, { shopName: 1 }).lean();

        return res.status(200).json({
            success: true,
            sellerId: hotelDoc.seller,
            tableId: table._id,
            tableName: table.name,
            shopName: seller?.shopName ?? "Restaurant",
        });
    } catch (error) {
        console.error("Table code lookup error:", error.message);
        return res.status(500).json({ success: false, message: "Server error." });
    }
});

// ── PUT /api/table/update/:tableId ───────────────────────────────────────────
router.put("/table/update/:tableId", auth, async (req, res) => {
    try {
        const sellerId = req.user.id;
        const { tableId } = req.params;
        const { name, capacity } = req.body;

        const hotelDoc = await HotelTables.findOne({ seller: sellerId });
        if (!hotelDoc) return res.status(404).json({ success: false, message: "No tables found." });

        const table = hotelDoc.tables.id(tableId);
        if (!table) return res.status(404).json({ success: false, message: "Table not found." });

        if (name) table.name = name.trim();
        if (capacity !== undefined) {
            const cap = Number(capacity);
            if (isNaN(cap) || cap <= 0) {
                return res.status(400).json({ success: false, message: "Capacity must be greater than 0." });
            }
            table.capacity = cap;
        }

        await hotelDoc.save();
        return res.status(200).json({ success: true, message: "Table updated.", table });
    } catch (error) {
        console.error("Update table error:", error.message);
        return res.status(500).json({ success: false, message: "Server error." });
    }
});

// ── DELETE /api/table/delete/:tableId ────────────────────────────────────────
router.delete("/table/delete/:tableId", auth, async (req, res) => {
    try {
        const sellerId = req.user.id;
        const { tableId } = req.params;

        const hotelDoc = await HotelTables.findOneAndUpdate(
            { seller: sellerId },
            { $pull: { tables: { _id: tableId } } },
            { new: true }
        );
        if (!hotelDoc) return res.status(404).json({ success: false, message: "No tables found." });

        return res.status(200).json({ success: true, message: "Table deleted." });
    } catch (error) {
        console.error("Delete table error:", error.message);
        return res.status(500).json({ success: false, message: "Server error." });
    }
});

module.exports = router;
