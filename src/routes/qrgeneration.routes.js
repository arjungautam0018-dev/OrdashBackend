const express = require("express");
const router = express.Router();
const streamifier = require("streamifier");
const cloudinary = require("../config/cloudinary.config");
const auth = require("../config/userauth.config");
const QRTables = require("../models/qr.models");
const HotelTables = require("../models/table.models");
const { generateQRBuffer } = require("../config/QRgenerate.config");

// ── Helper: upload buffer to Cloudinary ──────────────────────────────────────
const uploadToCloudinary = (buffer, publicId) =>
    new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
            {
                public_id: publicId,
                folder: "qrcodes",
                overwrite: true,
                transformation: [{ quality: "auto", fetch_format: "auto" }],
            },
            (error, result) => {
                if (error) reject(error);
                else resolve(result);
            }
        );
        streamifier.createReadStream(buffer).pipe(stream);
    });

// ── POST /api/qr/generate ─────────────────────────────────────────────────────
// Body: { tableId }
// - If QR already exists for this table → return existing image URL
// - If not → generate QR, upload to Cloudinary, store in DB, return URL
router.post("/qr/generate", auth, async (req, res) => {
    try {
        const sellerId = req.user.id;
        const { tableId } = req.body;

        if (!tableId) {
            return res.status(400).json({ success: false, message: "tableId is required." });
        }

        // Verify table belongs to this seller
        const hotelDoc = await HotelTables.findOne({ seller: sellerId });
        if (!hotelDoc) {
            return res.status(404).json({ success: false, message: "No tables found for this seller." });
        }
        const table = hotelDoc.tables.id(tableId);
        if (!table) {
            return res.status(404).json({ success: false, message: "Table not found." });
        }

        // Check if QR already exists for this table
        const qrDoc = await QRTables.findOne({ seller: sellerId });
        if (qrDoc) {
            const existing = qrDoc.tables.find(
                (t) => t.tableId.toString() === tableId.toString()
            );
            if (existing && existing.image) {
                return res.status(200).json({
                    success: true,
                    exists: true,
                    message: "QR already exists.",
                    image: existing.image,
                    tableId,
                });
            }
        }

        // Generate QR — encode sellerId + tableId as JSON payload
        const payload = JSON.stringify({ sellerId: sellerId.toString(), tableId });
        const qrBuffer = await generateQRBuffer(payload);

        // Upload to Cloudinary
        const publicId = `seller_${sellerId}_table_${tableId}`;
        const uploadResult = await uploadToCloudinary(qrBuffer, publicId);
        const imageUrl = uploadResult.secure_url;

        // Save to DB
        if (qrDoc) {
            // Doc exists — push new table entry
            qrDoc.tables.push({ tableId, image: imageUrl });
            await qrDoc.save();
        } else {
            // Create new doc
            await QRTables.create({
                seller: sellerId,
                tables: [{ tableId, image: imageUrl }],
            });
        }

        // Also update the qrcode field on the table subdocument
        table.qrcode = imageUrl;
        await hotelDoc.save();

        return res.status(201).json({
            success: true,
            exists: false,
            message: "QR generated successfully.",
            image: imageUrl,
            tableId,
        });
    } catch (error) {
        console.error("QR generation error:", error.message);
        return res.status(500).json({ success: false, message: "Server error." });
    }
});

// ── GET /api/qr/:tableId ──────────────────────────────────────────────────────
// Returns QR image URL if it exists for this table
router.get("/qr/:tableId", auth, async (req, res) => {
    try {
        const sellerId = req.user.id;
        const { tableId } = req.params;

        const qrDoc = await QRTables.findOne({ seller: sellerId });
        if (!qrDoc) {
            return res.status(200).json({ success: true, image: null });
        }

        const entry = qrDoc.tables.find(
            (t) => t.tableId.toString() === tableId.toString()
        );

        return res.status(200).json({
            success: true,
            image: entry ? entry.image : null,
        });
    } catch (error) {
        console.error("Get QR error:", error.message);
        return res.status(500).json({ success: false, message: "Server error." });
    }
});

// ── POST /api/qr/scan ─────────────────────────────────────────────────────────
// Public — called by customer scanner. Body: { sellerId, tableId }
router.post("/qr/scan", async (req, res) => {
    try {
        const { sellerId, tableId } = req.body;

        if (!sellerId || !tableId) {
            return res.status(400).json({ success: false, message: "Invalid QR code." });
        }

        // Verify the table exists under this seller
        const hotelDoc = await HotelTables.findOne({ seller: sellerId });
        if (!hotelDoc) {
            return res.status(404).json({ success: false, message: "Seller not found." });
        }

        const table = hotelDoc.tables.id(tableId);
        if (!table) {
            return res.status(404).json({ success: false, message: "Table not found." });
        }

        return res.status(200).json({
            success: true,
            message: `Welcome to ${table.name}!`,
            tableName: table.name,
            tableId: table._id.toString(),
            sellerId: sellerId,
            capacity: table.capacity,
        });
    } catch (error) {
        console.error("QR scan error:", error.message);
        return res.status(500).json({ success: false, message: "Server error." });
    }
});

module.exports = router;
