const mongoose = require("mongoose");

const sellerAccSchema = new mongoose.Schema({
    name:       { type: String, required: true },
    email:      { type: String, required: true, unique: true },
    phone:      { type: String, required: true },
    shopName:   { type: String, required: true },
    city:       { type: String, required: true },
    address:    { type: String, required: true },
    password:   { type: String, required: true },
    isOpen:     { type: Boolean, default: false },
    profilePic: { type: String, default: "" },
    banner:     { type: String, default: "" },
    bio:        { type: String, default: "" },
}, { timestamps: true });

const SellerAcc = mongoose.model("SellerAcc", sellerAccSchema);
module.exports = SellerAcc;
