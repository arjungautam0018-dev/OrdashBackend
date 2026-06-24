const mongoose = require("mongoose");

// ── Product subdocument ───────────────────────────────────────────────────────
const productSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
        },
        price: {
            type: Number,
            required: true,
            min: 0,
        },
        // name of the category this product belongs to (matches a name in the categories array)
        category: {
            type: String,
            required: true,
            trim: true,
        },
        type: {
            type: String,
            enum: ["product", "service"],
            default: "product",
        },
        // only relevant when type === "product"
        quantity: {
            type: Number,
            default: null,
            min: 0,
        },
        isAvailable: {
            type: Boolean,
            default: true,
        },
        image: {
            type: String,
            default: null,
        },
    },
    { timestamps: true }   // createdAt + updatedAt per product
);

// ── Category subdocument ──────────────────────────────────────────────────────
const categorySchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
        },
    },
    { _id: false }
);

// ── Root hotel document ───────────────────────────────────────────────────────
const hotelProductsSchema = new mongoose.Schema(
    {
        // one document per seller/hotel
        seller: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "SellerAcc",
            required: true,
            unique: true,
        },
        // user-created categories  e.g. ["Stock", "Beverages", "Desserts"]
        categories: {
            type: [categorySchema],
            default: [{ name: "Stock" }],   // Stock is always present by default
        },
        products: [productSchema],
    },
    { timestamps: true }   // createdAt + updatedAt on the hotel document itself
);

const HotelProducts = mongoose.model("HotelProducts", hotelProductsSchema);
module.exports = HotelProducts;
