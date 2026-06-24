const express = require("express");
const router = express.Router();
const Order = require("../models/order.models");
const HotelTables = require("../models/table.models");
const auth = require("../config/userauth.config");

// ── POST /api/order/place ─────────────────────────────────────────────────────
// Public — called by customer. Body: { sellerId, tableId, items, total }
router.post("/order/place", async (req, res) => {
    try {
        const { sellerId, tableId, items, total } = req.body;
        console.log("[order/place] body received:", JSON.stringify({ sellerId, tableId, total, itemCount: items?.length }));

        if (!sellerId || !tableId || !items?.length || total == null) {
            console.warn("[order/place] missing fields — sellerId:", sellerId, "tableId:", tableId, "items:", items?.length, "total:", total);
            return res.status(400).json({ success: false, message: "Missing required fields." });
        }

        const order = await Order.create({ seller: sellerId, tableId, items, total });
        console.log("[order/place] order created:", order._id.toString());
        return res.status(201).json({ success: true, message: "Order placed.", order });
    } catch (err) {
        console.error("[order/place] error:", err.message);
        return res.status(500).json({ success: false, message: "Server error.", detail: err.message });
    }
});

// ── GET /api/order/table ──────────────────────────────────────────────────────
// Public — get all orders for a table. Query: ?sellerId=&tableId=
router.get("/order/table", async (req, res) => {
    try {
        const { sellerId, tableId } = req.query;

        if (!sellerId || !tableId) {
            return res.status(400).json({ success: false, message: "sellerId and tableId are required." });
        }

        const orders = await Order.find({ seller: sellerId, tableId })
            .sort({ createdAt: -1 });

        return res.status(200).json({ success: true, orders });
    } catch (err) {
        console.error("Get orders error:", err.message);
        return res.status(500).json({ success: false, message: "Server error." });
    }
});

// ── GET /api/order/seller ─────────────────────────────────────────────────────
// Auth — seller fetches all their orders, enriched with table names
router.get("/order/seller", auth, async (req, res) => {
    try {
        const sellerId = req.user.id;

        const [orders, hotelDoc] = await Promise.all([
            Order.find({ seller: sellerId }).sort({ createdAt: -1 }).lean(),
            HotelTables.findOne({ seller: sellerId }).lean(),
        ]);

        // Build tableId → tableName lookup
        const tableMap = {};
        if (hotelDoc) {
            hotelDoc.tables.forEach((t) => {
                tableMap[t._id.toString()] = t.name;
            });
        }

        const enriched = orders.map((o) => ({
            ...o,
            tableName: tableMap[o.tableId?.toString()] ?? "Unknown",
        }));

        return res.status(200).json({ success: true, orders: enriched });
    } catch (err) {
        console.error("Seller orders error:", err.message);
        return res.status(500).json({ success: false, message: "Server error." });
    }
});

// ── PATCH /api/order/:orderId/status ─────────────────────────────────────────
// Auth — seller updates order status. Body: { status }
router.patch("/order/:orderId/status", auth, async (req, res) => {
    try {
        const sellerId = req.user.id;
        const { orderId } = req.params;
        const { status } = req.body;

        const VALID = ["pending", "confirmed", "preparing", "ready", "done"];
        if (!VALID.includes(status)) {
            return res.status(400).json({ success: false, message: "Invalid status value." });
        }

        const order = await Order.findOneAndUpdate(
            { _id: orderId, seller: sellerId },
            { status },
            { new: true }
        );

        if (!order) {
            return res.status(404).json({ success: false, message: "Order not found." });
        }

        return res.status(200).json({ success: true, order });
    } catch (err) {
        console.error("Status update error:", err.message);
        return res.status(500).json({ success: false, message: "Server error." });
    }
});

module.exports = router;
