const QRCode = require("qrcode");

/**
 * Generates a QR code as a PNG buffer.
 * @param {string} data  - The string to encode (e.g. JSON payload)
 * @returns {Promise<Buffer>} PNG buffer
 */
const generateQRBuffer = (data) =>
    QRCode.toBuffer(data, {
        type: "png",
        width: 400,
        margin: 2,
        color: { dark: "#1E3A8A", light: "#FFFFFF" },
    });

module.exports = { generateQRBuffer };
