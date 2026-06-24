const mongoose = require("mongoose");

const TablesList = new mongoose.Schema({
    tableId:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"HotelTables",
        required:true,
    },
    image:{
        type:String,
        required:true,
    }
});

const QRSchema = new mongoose.Schema({
    seller: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "SellerAcc",
        required: true,
        unique: true,
    },
    tables:[TablesList],
});

const QRTables = mongoose.model("QRTables", QRSchema);
module.exports = QRTables;
