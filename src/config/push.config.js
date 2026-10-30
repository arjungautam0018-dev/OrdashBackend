const axios = require("axios");
const PushToken = require("../models/pushToken.models");

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

/**
 * Which seller-side roles care about each order status. The customer is always
 * notified on a status change; this map defines the *additional* seller-side
 * roles to notify per status ("concerned ones only").
 */
const STATUS_AUDIENCE = {
    pending:   ["Admin", "Waiter"],
    confirmed: ["Admin", "Waiter"],
    preparing: ["Admin", "Chef"],
    ready:     ["Admin", "Waiter"],   // waiter serves / customer collects
    done:      ["Admin", "Cashier"],  // cashier finalises the bill
};

const STATUS_MESSAGES = {
    confirmed: { title: "👍 Order Confirmed",   body: "Your order has been confirmed." },
    preparing: { title: "👨‍🍳 Preparing Your Order", body: "Your order is being prepared. Sit tight!" },
    ready:     { title: "✅ Order Ready!",     body: "Your order is ready. Enjoy your meal!" },
    done:      { title: "🙏 Order Complete",   body: "Your order has been finalized. Thank you!" },
    pending:   { title: "👍 Order Confirmed",   body: "Your order has been confirmed." },
};

/**
 * Send a push to a list of Expo tokens. Failures are logged and never thrown —
 * push is a best-effort side-channel that must never break the order flow.
 *
 * Invalid tokens ("DeviceNotRegistered", e.g. after app uninstall/logout) are
 * pruned from the DB automatically using the per-ticket responses Expo returns.
 */
async function sendPush(tokens, { title, body, data }) {
    const list = (tokens || []).filter(Boolean);
    if (!list.length) return;

    for (let i = 0; i < list.length; i += 100) {
        const chunk = list.slice(i, i + 100);
        const messages = chunk.map((to) => ({
            to,
            title,
            body,
            data: data || {},
            sound: "default",
            priority: "high",          // wake the device even if the app is killed
            channelId: "orders",       // matches the channel created client-side
        }));

        try {
            const res = await axios.post(EXPO_PUSH_URL, messages, {
                headers: { "Content-Type": "application/json" },
                timeout: 10000,
            });
            // Expo returns one ticket per message, in order.
            const tickets = res.data?.data || [];
            tickets.forEach((t, idx) => {
                if (t.status === "error") {
                    const tk = chunk[idx];
                    console.error("[push] ticket error:", t.message, "token:", tk);
                    const code = t.details?.ERROR || t.details?.error;
                    if ((code === "DeviceNotRegistered" || code === "InvalidCredentials") && tk) {
                        PushToken.deleteOne({ token: tk }).catch(() => {});
                    }
                }
            });
        } catch (e) {
            console.error("[push] send failed:", e?.response?.data || e?.message);
        }
    }
}

// ── Token lookups ────────────────────────────────────────────────────────────
async function getCustomerTokens(sellerId, tableId, sessionId) {
    if (!sessionId || sessionId === "staff") return [];
    const docs = await PushToken.find({
        kind: "customer", seller: sellerId, tableId, sessionId,
    }).lean();
    return docs.map((d) => d.token);
}

async function getSellerTokens(sellerId, roles) {
    const q = { kind: "seller", seller: sellerId };
    if (roles && roles.length) q.role = { $in: roles };
    const docs = await PushToken.find(q).lean();
    return docs.map((d) => d.token);
}

// ── Order lifecycle notifications ────────────────────────────────────────────

/** Order placed by a customer → notify everyone on the seller side. */
async function notifyOrderPlaced({ sellerId, orderId }) {
    const sellerTokens = await getSellerTokens(sellerId); // all roles
    await sendPush(sellerTokens, {
        title: "🛎️ New Order",
        body: "A new order has been placed.",
        data: { type: "order:new", sellerId: String(sellerId), orderId: String(orderId) },
    });
}

/** Order status changed → notify the specific customer + the concerned seller roles. */
async function notifyOrderStatus({ sellerId, tableId, sessionId, orderId, status, tableName }) {
    const msg = STATUS_MESSAGES[status] || { title: "Order Update", body: `Your order is now ${status}.` };

    const customerTokens = await getCustomerTokens(sellerId, tableId, sessionId);
    await sendPush(customerTokens, {
        title: msg.title,
        body: msg.body,
        data: { type: "order:status", sellerId: String(sellerId), tableId: String(tableId), orderId: String(orderId), status },
    });

    const roles = STATUS_AUDIENCE[status] || ["Admin"];
    const sellerTokens = await getSellerTokens(sellerId, roles);
    await sendPush(sellerTokens, {
        title: msg.title,
        body: `${tableName ? tableName + " — " : ""}order is now ${status}`,
        data: { type: "order:status", sellerId: String(sellerId), tableId: String(tableId), orderId: String(orderId), status },
    });
}

/** Customer requested the bill → notify cashier + admin. */
async function notifyBillRequested({ sellerId, tableId, tableName }) {
    const sellerTokens = await getSellerTokens(sellerId, ["Admin", "Cashier"]);
    await sendPush(sellerTokens, {
        title: "🧾 Bill Requested",
        body: `${tableName || "A table"} has requested the bill`,
        data: { type: "order:bill", sellerId: String(sellerId), tableId: String(tableId) },
    });
}

module.exports = {
    sendPush,
    getCustomerTokens,
    getSellerTokens,
    notifyOrderPlaced,
    notifyOrderStatus,
    notifyBillRequested,
    STATUS_AUDIENCE,
    STATUS_MESSAGES,
};
