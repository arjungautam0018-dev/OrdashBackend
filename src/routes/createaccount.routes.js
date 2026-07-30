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
        const { accountName, phone, email, role, password } = req.body;

        if (!accountName || !accountName.trim()) {
            return res.status(400).json({ message: "Account name is required" });
        }
        if (!phone && !email) {
            return res.status(400).json({ message: "Phone number or email is required" });
        }
        if (!role || !["Admin", "Waiter", "Chef", "Cashier"].includes(role)) {
            return res.status(400).json({ message: "Invalid role" });
        }
        if (!password || password.length < 6) {
            return res.status(400).json({ message: "Password must be at least 6 characters" });
        }

        const crypted_pass = await bcrypt.hash(password, 10);
        const accountWithHashedPassword = {
            accountName: accountName.trim(),
            phone: phone?.trim() || null,
            email: email?.trim().toLowerCase() || null,
            role,
            password: crypted_pass,
        };

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
        return res.status(201).json({ message: "Account created successfully", account: { accountName, role } });

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
        const accounts = accountsDoc.accounts.map(acc => ({
            id:          acc._id,
            accountName: acc.accountName,
            phone:       acc.phone,
            email:       acc.email,
            role:        acc.role,
        }));
        return res.status(200).json({accounts});
        
    }
    catch(error){
        console.error("Error fetching accounts:", error.message);
        res.status(500).json({message: "Error fetching accounts"});
    }
});

// Delete an account
router.delete("/account/delete/:id", auth , async(req,res)=>{
    console.log("Delete account request received for ID:", req.params.id);
    try{
        const sellerId = req.user.id;
        const accountId = req.params.id;

        const result = await AccountsModel.updateOne(
            {seller:sellerId},
            {
                $pull: { accounts: { _id: accountId } }

            }
        )
        if(result.modifiedCount === 0){
            return res.status(404).json({message: "Account not found"});
        }
        return res.status(200).json({message: "Account deleted successfully"});

    }
    catch(error){
        console.error("Error deleting account:", error.message);
        res.status(500).json({message: "Error deleting account"});
    }

})
// Update an account
router.put("/account/update/:id", auth, async (req, res) => {
    console.log("Update account request received for ID:", req.params.id);
    try {
        const sellerId = req.user.id;
        const accountId = req.params.id;
        const { accountName, role, phone, password } = req.body;

        if (!accountName || !accountName.trim()) {
            return res.status(400).json({ message: "Account name is required" });
        }
        if (!role || !["Admin", "Waiter", "Chef", "Cashier"].includes(role)) {
            return res.status(400).json({ message: "Invalid role" });
        }
        if (password && password.length < 6) {
            return res.status(400).json({ message: "Password must be at least 6 characters" });
        }

        const fields = {
            "accounts.$.accountName": accountName.trim(),
            "accounts.$.role": role,
            ...(phone && { "accounts.$.phone": phone.trim() }),
        };

        if (password) {
            fields["accounts.$.password"] = await bcrypt.hash(password, 10);
        }

        const result = await AccountsModel.updateOne(
            { seller: sellerId, "accounts._id": accountId },
            { $set: fields }
        );

        if (result.modifiedCount === 0) {
            return res.status(404).json({ message: "Account not found" });
        }
        return res.status(200).json({ message: "Account updated successfully" });
    } catch (error) {
        console.error("Error updating account:", error.message);
        res.status(500).json({ message: "Error updating account" });
    }
});

module.exports = router;

