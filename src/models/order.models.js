const mongoose = require("mongoose");

const orderItemSchema = new mongoose.Schema({
    productId: { type: mongoose.Schema.Types.ObjectId, required: true },
    name:      { type: String, required: true },
    price:     { type: Number, required: true },
    quantity:  { type: Number, required: true, min: 1 },
}, { _id: false });

const orderSchema = new mongoose.Schema({
    seller:  { type: mongoose.Schema.Types.ObjectId, ref: "SellerAcc", required: true },
    tableId: { type: mongoose.Schema.Types.ObjectId, required: true },
    items:   { type: [orderItemSchema], required: true },
    total:   { type: Number, required: true },
    status:  {
        type: String,
        enum: ["pending", "confirmed", "preparing", "ready", "done"],
        default: "pending",
    },
}, { timestamps: true });

const Order = mongoose.model("Order", orderSchema);
module.exports = Order;
