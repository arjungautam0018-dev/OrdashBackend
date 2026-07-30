const mongoose = require("mongoose");

const accountsData = new mongoose.Schema({
    name:{
        type:String,
        required:true,
        trim:true,
    },
    role:{
        type:String,
        enum:["Admin", "Waiter", "Chef", "Cashier"],
        required:true,
    },
    password:{
        type:String,
        required:true,
    },
});

const Accounts = new mongoose.Schema({
    seller:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"SellerAcc",
        required:true,
        unique:true,
    },
    accounts:[accountsData],
});

const AccountsModel = mongoose.model("Accounts", Accounts);
module.exports = AccountsModel;