const express = require("express");
const router = express.Router();
const SellerAcc = require("../models/selleracc.models");
const bcrypt = require("bcrypt");

router.post("/sellerlogin", async(req,res)=>{
    console.log("Received login request:", req.body);
    try {
        const {email, password} = req.body;
        
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

// ✅ NEW: Fetch seller profile (includes shopName)
router.get("/sellerprofile", async(req,res)=>{
    console.log("Received profile request:", req.session.sellerId);
    
    if (!req.session.sellerId) {
        return res.status(401).json({message:"Not logged in"});
    }

    try {
        const seller = await SellerAcc.findById(req.session.sellerId);
        
        if (!seller) {
            return res.status(404).json({message:"Seller not found"});
        }

        res.status(200).json({
            message:"Profile fetched successfully",
            seller: {
                id: seller._id,
                name: seller.name,
                email: seller.email,
                phone: seller.phone,
                shopName: seller.shopName,  // ← Hotel/store name
                city: seller.city,
                address: seller.address,
                profilePic: seller.profilePic,
                banner: seller.banner,
                bio: seller.bio,
                isOpen: seller.isOpen
            }
        });
    } catch (error) {
        console.error("Error fetching profile:", error);
        res.status(500).json({message:"Server error"});
    }
});


router.post("/logout", async(req,res)=>{
    console.log("Logout request received");
    try{
        if(!req.session.sellerId){
            return res.status(401).json({message:"Not logged in"});
        }
        req.session.destroy((err) =>{
            if(err){
                console.error("Session destroy error:", err)
                return res.status(500).json({message:"Server error"});
            }
               res.status(200).json({message:"Logout successful"});
        });
    }
    catch(err){
        console.log("Error in destroting", err);
        return res.status(401).json({message:"Error logging out. Try again!"})
    }
})
module.exports = router;