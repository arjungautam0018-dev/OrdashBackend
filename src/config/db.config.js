const mongoose = require("mongoose");

// ── Connection pool options ───────────────────────────────────────────────────
// maxPoolSize: keep 10 connections open and reused — no open/close cost per query
// minPoolSize: never drop below 2 idle connections
// serverSelectionTimeoutMS: fail fast if Atlas is unreachable
// socketTimeoutMS: kill stalled sockets after 45 s
// heartbeatFrequencyMS: check server health every 10 s
const POOL_OPTIONS = {
    maxPoolSize: 10,
    minPoolSize: 2,
    serverSelectionTimeoutMS: 30000,  // Atlas needs up to 30s on cold start
    socketTimeoutMS: 45000,
    heartbeatFrequencyMS: 10000,
};

const connectDB = async () => {
    const uri = process.env.MONGO_URI;
    try {
        await mongoose.connect(uri, POOL_OPTIONS);
        console.log("[db] connected — pool size:", POOL_OPTIONS.maxPoolSize);

        // Drop stale orderId_1 index from orders collection if it exists
        try {
            const db = mongoose.connection.db;
            const indexes = await db.collection("orders").indexes();
            const stale = indexes.find(i => i.name === "orderId_1");
            if (stale) {
                await db.collection("orders").dropIndex("orderId_1");
                console.log("[db] dropped stale index: orderId_1");
            }
        } catch (idxErr) {
            console.warn("[db] index cleanup skipped:", idxErr.message);
        }
    } catch (err) {
        console.error("[db] connection failed:", err.message);
        console.log("[db] retrying in 5s...");
        setTimeout(() => connectDB(), 5000);
    }

    // Auto-reconnect on disconnect
    mongoose.connection.on("disconnected", () => {
        console.warn("[db] disconnected — attempting reconnect...");
        setTimeout(() => mongoose.connect(uri, POOL_OPTIONS).catch(() => {}), 3000);
    });

    mongoose.connection.on("error", (err) => {
        console.error("[db] error:", err.message);
    });
};

module.exports = connectDB;
