const express  = require("express");
const router   = express.Router();
const Order        = require("../models/order.models");
const HotelTables  = require("../models/table.models");
const HotelProducts = require("../models/products.models");
const auth         = require("../config/userauth.config");
const {redisPublish} = require("../config/redis.config");


// ── POST /api/order/place ─────────────────────────────────────────────────────
// Public — called by customer
router.post("/order/place", async (req, res) => {
    try {
        const { sellerId, tableId, items } = req.body;
        console.log("[order/place] received:", { sellerId, tableId, items, sessionId: req.body.sessionId });
        if (!sellerId || !tableId || !items?.length) {
            return res.status(400).json({ success: false, message: "Missing required fields." });
        }

        // sessionId is optional — staff-placed orders use sentinel "staff"
        const sessionId = req.body.sessionId || "staff";

        // Validate that the table belongs to this seller
        const hotelDoc = await HotelTables.findOne({ seller: sellerId }, { tables: 1 }).lean();
        const table = hotelDoc?.tables?.find(t => t._id.toString() === tableId.toString());
        if (!table) {
            return res.status(400).json({ success: false, message: "Invalid tableId for this seller." });
        }

        // Fetch products and recalculate total server-side — never trust client price
        const productIds = items.map(i => i.productId);
        const hotelProducts = await HotelProducts.findOne(
            { seller: sellerId },
            { products: 1 }
        ).lean();

        const productMap = {};
        hotelProducts?.products?.forEach(p => { productMap[p._id.toString()] = p.price; });

        let total = 0;
        for (const item of items) {
            const realPrice = productMap[item.productId?.toString()];
            if (realPrice == null) {
                return res.status(400).json({ success: false, message: `Product not found: ${item.productId}` });
            }
            total += realPrice * item.quantity;
        }

        const order = await Order.create({ seller: sellerId, tableId, tableName: table.name, items, total, sessionId });

        // Get table name to enrich the payload for the seller
        const enriched = { ...order.toObject(), tableName: table.name };

        // Publish to redis channels for seller and table
        redisPublish(`seller:${sellerId}` , {event: "order:new", order:enriched});
        redisPublish(`table:${sellerId}:${tableId}`, {event:"order:new", order:enriched});


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
        const { sellerId, tableId, sessionId} = req.query;
        if (!sellerId || !tableId || !sessionId) {
            return res.status(400).json({ success: false, message: "sellerId and tableId and sessionId are required." });
        }

        const orders = await Order
            .find({ seller: sellerId, tableId, sessionId })
            .sort({ createdAt: -1 })
            .lean();


        return res.status(200).json({ success: true, orders });
    } catch (err) {
        console.error("[order/table]", err.message);
        return res.status(500).json({ success: false, message: "Server error." });
    }
});

// ── GET /api/order/seller ─────────────────────────────────────────────────────
// Auth — seller fetches all their orders on initial load
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
// Auth — seller updates status; Redis SSE pushes change to seller + customer
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

        redisPublish(`seller:${sellerId}`, {event:"order:status", orderId , status});
        redisPublish(`table:${sellerId}:${order.tableId}`, {event:"order:status", orderId , status});


        return res.status(200).json({ success: true, order });
    } catch (err) {
        console.error("[order/status]", err.message);
        return res.status(500).json({ success: false, message: "Server error." });
    }
});

// ── POST /api/order/:orderId/bill ─────────────────────────────────────────────
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

        redisPublish(`seller:${order.seller}`, { event: "order:bill", tableId: order.tableId, tableName });

        return res.status(200).json({ success: true, message: "Bill requested." });
    } catch (err) {
        console.error("[order/bill]", err.message);
        return res.status(500).json({ success: false, message: "Server error." });
    }
});

module.exports = router;
