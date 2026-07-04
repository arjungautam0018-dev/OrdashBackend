const express  = require("express");
const router   = express.Router();
const Order      = require("../models/order.models");
const HotelTables = require("../models/table.models");
const auth       = require("../config/userauth.config");
const { emitNewOrder, emitOrderStatus, emitTableOrderStatus, emitBillRequest } = require("../config/socket.config");

// ── POST /api/order/place ─────────────────────────────────────────────────────
// Public — called by customer
router.post("/order/place", async (req, res) => {
    try {
        const { sellerId, tableId, items, total } = req.body;
        console.log("[order/place] body:", JSON.stringify({ sellerId, tableId, total, itemCount: items?.length }));

        if (!sellerId || !tableId || !items?.length || total == null) {
            console.warn("[order/place] validation failed");
            return res.status(400).json({ success: false, message: "Missing required fields." });
        }

        const order = await Order.create({ seller: sellerId, tableId, items, total });
        console.log("[order/place] created:", order._id.toString());

        // Get table name to enrich the socket payload for the seller
        const hotelDoc = await HotelTables.findOne({ seller: sellerId }, { tables: 1 }).lean();
        const table = hotelDoc?.tables?.find(t => t._id.toString() === tableId.toString());
        const enriched = { ...order.toObject(), tableName: table?.name ?? "Unknown" };

        // Push to seller's socket room immediately — no polling needed
        emitNewOrder(sellerId, enriched);

        return res.status(201).json({ success: true, message: "Order placed.", order: enriched });
    } catch (err) {
        console.error("[order/place] error:", err.message);
        return res.status(500).json({ success: false, message: "Server error.", detail: err.message });
    }
});

// ── GET /api/order/table ──────────────────────────────────────────────────────
// Public — customer polls their own table's orders
router.get("/order/table", async (req, res) => {
    try {
        const { sellerId, tableId } = req.query;
        if (!sellerId || !tableId) {
            return res.status(400).json({ success: false, message: "sellerId and tableId are required." });
        }

        const orders = await Order
            .find({ seller: sellerId, tableId })
            .sort({ createdAt: -1 })
            .lean();          // plain objects — no Mongoose overhead

        return res.status(200).json({ success: true, orders });
    } catch (err) {
        console.error("[order/table]", err.message);
        return res.status(500).json({ success: false, message: "Server error." });
    }
});

// ── GET /api/order/seller ─────────────────────────────────────────────────────
// Auth — seller initial load (socket handles live updates after this)
router.get("/order/seller", auth, async (req, res) => {
    try {
        const sellerId = req.user.id;

        const [orders, hotelDoc] = await Promise.all([
            Order.find({ seller: sellerId }).sort({ createdAt: -1 }).lean(),
            HotelTables.findOne({ seller: sellerId }, { tables: 1 }).lean(),
        ]);

        const tableMap = {};
        hotelDoc?.tables?.forEach(t => { tableMap[t._id.toString()] = t.name; });

        const enriched = orders.map(o => ({
            ...o,
            tableName: tableMap[o.tableId?.toString()] ?? "Unknown",
        }));

        return res.status(200).json({ success: true, orders: enriched });
    } catch (err) {
        console.error("[order/seller]", err.message);
        return res.status(500).json({ success: false, message: "Server error." });
    }
});

// ── PATCH /api/order/:orderId/status ─────────────────────────────────────────
// Auth — seller updates status; socket pushes change to seller + customer rooms
router.patch("/order/:orderId/status", auth, async (req, res) => {
    try {
        const sellerId  = req.user.id;
        const { orderId } = req.params;
        const { status }  = req.body;

        const VALID = ["pending", "confirmed", "preparing", "ready", "done"];
        if (!VALID.includes(status)) {
            return res.status(400).json({ success: false, message: "Invalid status value." });
        }

        const order = await Order.findOneAndUpdate(
            { _id: orderId, seller: sellerId },
            { status },
            { new: true, lean: true }   // lean: true on findOneAndUpdate
        );

        if (!order) {
            return res.status(404).json({ success: false, message: "Order not found." });
        }

        // Push status change to seller room AND customer table room
        emitOrderStatus(sellerId, orderId, status);
        emitTableOrderStatus(sellerId, order.tableId?.toString(), orderId, status);

        return res.status(200).json({ success: true, order });
    } catch (err) {
        console.error("[order/status]", err.message);
        return res.status(500).json({ success: false, message: "Server error." });
    }
});

module.exports = router;
// Public — customer requests the bill
router.post("/order/:orderId/bill", async (req, res) => {
    try {
        const { orderId } = req.params;
        const order = await Order.findById(orderId).lean();
        if (!order) {
            return res.status(404).json({ success: false, message: "Order not found." });
        }

        const hotelDoc = await HotelTables.findOne({ seller: order.seller }, { tables: 1 }).lean();
        const table = hotelDoc?.tables?.find(t => t._id.toString() === order.tableId?.toString());
        const tableName = table?.name ?? "Unknown";

        emitBillRequest(order.seller.toString(), order.tableId?.toString(), tableName);

        return res.status(200).json({ success: true, message: "Bill requested." });
    } catch (err) {
        console.error("[order/bill]", err.message);
        return res.status(500).json({ success: false, message: "Server error." });
    }
});

module.exports = router;
