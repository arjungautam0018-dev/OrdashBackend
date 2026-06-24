const express = require("express");
const router = express.Router();
const multer = require("multer");
const streamifier = require("streamifier");
const cloudinary = require("../config/cloudinary.config");
const HotelProducts = require("../models/products.models");
const auth = require("../config/userauth.config");

// ── Multer — memory storage (buffer sent to Cloudinary, nothing on disk) ──────
const ALLOWED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
    fileFilter: (req, file, cb) => {
        if (ALLOWED_TYPES.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error("Only JPG, PNG and WEBP images are allowed."));
        }
    },
});

// ── Helper: upload buffer to Cloudinary ──────────────────────────────────────
const uploadToCloudinary = (buffer, folder = "products") =>
    new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
            {
                folder,
                transformation: [
                    { width: 400, height: 400, crop: "fill", gravity: "auto" },
                    { quality: "auto", fetch_format: "auto" },
                ],
            },
            (error, result) => {
                if (error) reject(error);
                else resolve(result);
            }
        );
        streamifier.createReadStream(buffer).pipe(stream);
    });

// ── POST /api/product/add ─────────────────────────────────────────────────────
// Accepts multipart/form-data: { name, price, category, type, quantity?, image? }
router.post("/product/add", auth, upload.single("image"), async (req, res) => {
    try {
        const sellerId = req.user.id;
        const { name, price, category, type, quantity } = req.body;

        if (!name || price === undefined || !category || !type) {
            return res.status(400).json({
                success: false,
                message: "name, price, category and type are required.",
            });
        }

        if (!["product", "service"].includes(type)) {
            return res.status(400).json({
                success: false,
                message: "type must be 'product' or 'service'.",
            });
        }

        if (type === "product" && (quantity === undefined || Number(quantity) < 0)) {
            return res.status(400).json({
                success: false,
                message: "quantity is required and must be >= 0 for products.",
            });
        }

        // Upload image to Cloudinary if provided
        let imageUrl = null;
        if (req.file) {
            const result = await uploadToCloudinary(req.file.buffer);
            imageUrl = result.secure_url;
        }

        const newProduct = {
            name:     name.trim(),
            price:    parseFloat(price),
            category: category.trim(),
            type,
            quantity: type === "product" ? Number(quantity) : null,
            image:    imageUrl,
        };

        const hotelDoc = await HotelProducts.findOneAndUpdate(
            { seller: sellerId },
            { $push: { products: newProduct } },
            { new: true, upsert: true }
        );

        const added = hotelDoc.products[hotelDoc.products.length - 1];

        return res.status(201).json({
            success: true,
            message: "Product added successfully.",
            product: added,
        });
    } catch (error) {
        // Multer file type error
        if (error.message && error.message.includes("Only JPG")) {
            return res.status(400).json({ success: false, message: error.message });
        }
        console.error("Add product error:", error.message);
        return res.status(500).json({ success: false, message: "Server error. Please try again." });
    }
});

// ── POST /api/product/category/add ───────────────────────────────────────────
router.post("/product/category/add", auth, async (req, res) => {
    try {
        const sellerId = req.user.id;
        const { name } = req.body;

        if (!name || !name.trim()) {
            return res.status(400).json({ success: false, message: "Category name is required." });
        }

        const trimmed = name.trim();

        const existing = await HotelProducts.findOne({
            seller: sellerId,
            "categories.name": { $regex: new RegExp(`^${trimmed}$`, "i") },
        });

        if (existing) {
            return res.status(409).json({ success: false, message: `Category '${trimmed}' already exists.` });
        }

        const hotelDoc = await HotelProducts.findOneAndUpdate(
            { seller: sellerId },
            { $push: { categories: { name: trimmed } } },
            { new: true, upsert: true }
        );

        return res.status(201).json({ success: true, message: "Category created.", categories: hotelDoc.categories });
    } catch (error) {
        console.error("Add category error:", error.message);
        return res.status(500).json({ success: false, message: "Server error. Please try again." });
    }
});

// ── GET /api/product/categories ───────────────────────────────────────────────
router.get("/product/categories", auth, async (req, res) => {
    try {
        const hotelDoc = await HotelProducts.findOne({ seller: req.user.id }, { categories: 1 });
        return res.status(200).json({
            success: true,
            categories: hotelDoc ? hotelDoc.categories : [{ name: "Stock" }],
        });
    } catch (error) {
        console.error("Get categories error:", error.message);
        return res.status(500).json({ success: false, message: "Server error. Please try again." });
    }
});

// ── GET /api/product/all ──────────────────────────────────────────────────────
router.get("/product/all", auth, async (req, res) => {
    try {
        const hotelDoc = await HotelProducts.findOne({ seller: req.user.id });
        return res.status(200).json({ success: true, products: hotelDoc ? hotelDoc.products : [] });
    } catch (error) {
        console.error("Get products error:", error.message);
        return res.status(500).json({ success: false, message: "Server error. Please try again." });
    }
});

// ── PUT /api/product/update/:productId ───────────────────────────────────────
router.put("/product/update/:productId", auth, upload.single("image"), async (req, res) => {
    try {
        const sellerId = req.user.id;
        const { productId } = req.params;
        const { name, price, category, quantity } = req.body;

        const hotelDoc = await HotelProducts.findOne({ seller: sellerId });
        if (!hotelDoc) return res.status(404).json({ success: false, message: "No products found." });

        const product = hotelDoc.products.id(productId);
        if (!product) return res.status(404).json({ success: false, message: "Product not found." });

        if (name)     product.name     = name.trim();
        if (price !== undefined) product.price = parseFloat(price);
        if (category) product.category = category.trim();
        if (quantity !== undefined && product.type === "product") product.quantity = Number(quantity);

        if (req.file) {
            const result = await uploadToCloudinary(req.file.buffer);
            product.image = result.secure_url;
        }

        await hotelDoc.save();
        return res.status(200).json({ success: true, message: "Product updated.", product });
    } catch (error) {
        console.error("Update product error:", error.message);
        return res.status(500).json({ success: false, message: "Server error." });
    }
});

// ── DELETE /api/product/delete/:productId ────────────────────────────────────
router.delete("/product/delete/:productId", auth, async (req, res) => {
    try {
        const sellerId = req.user.id;
        const { productId } = req.params;

        // Fetch the product first to get its image URL before deleting
        const hotelDoc = await HotelProducts.findOne({ seller: sellerId });
        if (!hotelDoc) return res.status(404).json({ success: false, message: "No products found." });

        const product = hotelDoc.products.id(productId);
        if (!product) return res.status(404).json({ success: false, message: "Product not found." });

        // Delete image from Cloudinary if one exists
        if (product.image) {
            try {
                // Extract public_id from the Cloudinary URL
                // URL format: https://res.cloudinary.com/<cloud>/image/upload/v123456/products/filename.ext
                const parts = product.image.split("/");
                const filenameWithExt = parts[parts.length - 1];
                const filename = filenameWithExt.split(".")[0];
                const folder = parts[parts.length - 2];
                const publicId = `${folder}/${filename}`;
                await cloudinary.uploader.destroy(publicId);
            } catch (cloudErr) {
                // Log but don't block the delete if Cloudinary cleanup fails
                console.error("Cloudinary delete error:", cloudErr.message);
            }
        }

        // Remove product from DB
        await HotelProducts.findOneAndUpdate(
            { seller: sellerId },
            { $pull: { products: { _id: productId } } },
            { new: true }
        );

        return res.status(200).json({ success: true, message: "Product deleted." });
    } catch (error) {
        console.error("Delete product error:", error.message);
        return res.status(500).json({ success: false, message: "Server error." });
    }
});

module.exports = router;
