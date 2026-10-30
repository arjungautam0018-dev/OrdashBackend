const mongoose = require("mongoose");

/**
 * Stores Expo push tokens and the "scope" they belong to.
 *
 *  - customer scope: one token per device/table-session, keyed by
 *    { seller, tableId, sessionId }. Used to reach the customer who placed an
 *    order even when their app is closed.
 *  - seller scope: one token per logged-in seller/staff device, keyed by
 *    { seller, accountId, role }. Used to reach the restaurant side (admin,
 *    waiter, chef, cashier) on order events.
 *
 * A token is unique globally (one device = one record). Re-registering with a
 * different scope (e.g. a device reused by another account/session) upserts and
 * overwrites the previous scope.
 */
const pushTokenSchema = new mongoose.Schema(
    {
        token: { type: String, required: true, index: true },
        kind:  { type: String, enum: ["customer", "seller"], required: true, index: true },
        seller: { type: mongoose.Schema.Types.ObjectId, ref: "SellerAcc", index: true },

        // ── customer scope ──
        tableId:   { type: mongoose.Schema.Types.ObjectId },
        sessionId: { type: String },

        // ── seller scope ──
        accountId: { type: mongoose.Schema.Types.ObjectId }, // sub-account _id (cid) or null for admin
        role:      { type: String, enum: ["Admin", "Waiter", "Chef", "Cashier"] },
    },
    { timestamps: true }
);

// One device = one token record.
pushTokenSchema.index({ token: 1 }, { unique: true });

const PushToken = mongoose.model("PushToken", pushTokenSchema);
module.exports = PushToken;
