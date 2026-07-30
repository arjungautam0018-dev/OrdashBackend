const mongoose = require("mongoose");

const accountsData = new mongoose.Schema({
    accountName: {
        type: String,
        trim: true,
        default: null,
    },
    phone: {
        type: String,
        trim: true,
        default: null,
    },
    email: {
        type: String,
        trim: true,
        lowercase: true,
        default: null,
    },
    role: {
        type: String,
        enum: ["Admin", "Waiter", "Chef", "Cashier"],
        required: true,
    },
    password: {
        type: String,
        required: true,
    },
});

const Accounts = new mongoose.Schema({
    seller: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "SellerAcc",
        required: true,
        unique: true,
    },
    accounts: [accountsData],
});

const AccountsModel = mongoose.model("Accounts", Accounts);
module.exports = AccountsModel;
