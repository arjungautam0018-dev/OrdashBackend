const { Server } = require("socket.io");

let io = null;

// ── Initialize socket server ──────────────────────────────────────────────────
const initSocket = (httpServer) => {
    io = new Server(httpServer, {
        cors: { origin: "*", methods: ["GET", "POST"] },
        // Tune for mobile — prefer polling first then upgrade
        transports: ["polling", "websocket"],
        pingTimeout: 30000,
        pingInterval: 10000,
    });

    io.on("connection", (socket) => {
        console.log("[socket] client connected:", socket.id);

        // Seller joins their private room to receive order updates
        // Client emits: { sellerId: "..." }
        socket.on("join:seller", ({ sellerId }) => {
            if (!sellerId) return;
            socket.join(`seller:${sellerId}`);
            console.log(`[socket] seller ${sellerId} joined room seller:${sellerId}`);
        });

        // Customer joins a table room to get status updates on their orders
        // Client emits: { sellerId: "...", tableId: "..." }
        socket.on("join:table", ({ sellerId, tableId }) => {
            if (!sellerId || !tableId) return;
            const room = `table:${sellerId}:${tableId}`;
            socket.join(room);
            console.log(`[socket] table client joined room ${room}`);
        });

        socket.on("disconnect", (reason) => {
            console.log(`[socket] client ${socket.id} disconnected: ${reason}`);
        });
    });

    return io;
};

// ── Emit helpers (called from route handlers) ─────────────────────────────────

// Notify seller room of a new order
const emitNewOrder = (sellerId, order) => {
    if (!io) return;
    io.to(`seller:${sellerId}`).emit("order:new", order);
    console.log(`[socket] emitted order:new to seller:${sellerId}`);
};

// Notify seller room of a status change
const emitOrderStatus = (sellerId, orderId, status) => {
    if (!io) return;
    io.to(`seller:${sellerId}`).emit("order:status", { orderId, status });
    console.log(`[socket] emitted order:status to seller:${sellerId} — ${orderId} → ${status}`);
};

// Notify customer table room of their order's status change
const emitTableOrderStatus = (sellerId, tableId, orderId, status) => {
    if (!io) return;
    const room = `table:${sellerId}:${tableId}`;
    io.to(room).emit("order:status", { orderId, status });
    console.log(`[socket] emitted order:status to ${room} — ${orderId} → ${status}`);
};

// Notify seller room that a customer requested the bill
const emitBillRequest = (sellerId, tableId, tableName) => {
    if (!io) return;
    io.to(`seller:${sellerId}`).emit("order:bill", { tableId, tableName });
    console.log(`[socket] emitted order:bill to seller:${sellerId} — table: ${tableName}`);
};

const getIO = () => io;

module.exports = { initSocket, emitNewOrder, emitOrderStatus, emitTableOrderStatus, emitBillRequest, getIO };
