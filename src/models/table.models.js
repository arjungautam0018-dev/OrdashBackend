const mongoose = require("mongoose");

const tableSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
    },
    capacity: {
        type: Number,
        required: true,
    }
});

const hotelTablesSchema = new mongoose.Schema({
    seller: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "SellerAcc",
        required: true,
        unique: true,
    },
    tables: [tableSchema],
});

const HotelTables = mongoose.model("HotelTables", hotelTablesSchema);
module.exports = HotelTables;