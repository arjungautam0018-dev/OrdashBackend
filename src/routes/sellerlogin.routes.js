const express = require("express");
const router = express.Router();
const SellerAcc = require("../models/selleracc.models");
const bcrypt = require("bcrypt");



router.post("/sellerlogin", async(req,res)=>{
    console.log("Received login request:", req.body);
    try {
        const {email, password} = req.body;
        
        // Validate input
        if (!email || !password) {
            return res.status(400).json({message:"Email and password required"});
        }

        if (req.session.sellerId) {
            return res.status(200).json({message:"Already logged in"});
        }

        const existingSeller = await SellerAcc.findOne({email});
        if(!existingSeller){
            return res.status(400).json({message:"Invalid email or password"});
        }

        const isPasswordValid = await bcrypt.compare(password, existingSeller.password);
        if(!isPasswordValid){
            return res.status(400).json({message:"Invalid email or password"});
        }

        // Create session
        req.session.sellerId = existingSeller._id;
        req.session.save((err) => {
            if (err) console.error("Session save error:", err);
        });

        res.status(200).json({message:"Login successful"});
    } catch (error) {
        console.error("Error occurred while logging in seller:", error);
        res.status(500).json({message:"Server error"});
    }
});

module.exports = router;