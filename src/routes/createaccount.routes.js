const express = require("express");
const router = express.Router();
const auth = require("../config/userauth.config");
const AccountsModel = require("../models/accounts.models");
const bcrypt = require("bcrypt");

// Post /api/createaccount 

router.post("/account/create", auth, async(req,res)=>{
    console.log("Create account request received", req.body);
    try{
        const sellerId = req.user.id;
        const { name, role, password } = req.body;

        if(!name || !name.trim()){
            return res.status(400).json({message: "Name is required"});
        }
        if(!role || !["Admin", "Waiter", "Chef", "Cashier"].includes(role)){
            return res.status(400).json({message: "Invalid role"});
        }
        if(!password || password.length < 6){
            return res.status(400).json({message: "Password must be at least 6 characters"});
        }

        const newAccount = { name: name.trim(), role, password };

        const crypted_pass = await bcrypt.hash(password, 10);
        const accountWithHashedPassword = { ...newAccount, password: crypted_pass };

        // Check if the seller already has an account document
        let accountsDoc = await AccountsModel.findOne({seller:sellerId});

        // If yes , update
        if(accountsDoc){
            accountsDoc.accounts.push(accountWithHashedPassword);
            await accountsDoc.save();
            console.log("New account added for seller:", sellerId);

        }
        else{
            // If no, create a new document
            accountsDoc = new AccountsModel({
                seller: sellerId,
                accounts: [accountWithHashedPassword]
            });
            await accountsDoc.save();
            console.log("New account document created for seller:", sellerId);
        }
        return res.status(201).json({message: "Account created successfully", account: {name, role}});

    }
    catch(error){
        console.error("Error creating account:", error.message);
        res.status(500).json({message: "Error creating account"});
    }
});

// Fetch the data
router.get("/account/all", auth , async(req,res)=>{
    console.log("Fetch all accounts request received");
    try{
        const sellerId = req.user.id;
        const accountsDoc = await AccountsModel.findOne({seller:sellerId});
        if(!accountsDoc){
            return res.status(404).json({message: "No accounts found for this seller"});
        }
        const accounts = accountsDoc.accounts.map(acc => ({name: acc.name, role: acc.role}));
        return res.status(200).json({accounts});
        
    }
    catch(error){
        console.error("Error fetching accounts:", error.message);
        res.status(500).json({message: "Error fetching accounts"});
    }
})
module.exports = router;

