const jwt = require("jsonwebtoken");

/**
 * Auth middleware — checks if the user is logged in.
 * Accepts either:
 *   1. JWT in Authorization header:  "Bearer <token>"
 *   2. Active express-session with req.session.user set
 *
 * On failure → 401 with JSON error, request is denied.
 * On success → attaches decoded user to req.user and calls next().
 */
const verifyAuth = (req, res, next) => {
    // ── 1. Try JWT from Authorization header ──────────────────────────────────
    const authHeader = req.headers["authorization"];

    if (authHeader && authHeader.startsWith("Bearer ")) {
        const token = authHeader.split(" ")[1];

        if (!token) {
            return res.status(401).json({
                success: false,
                message: "Access denied. No token provided.",
            });
        }

        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            req.user = decoded;
            return next();
        } catch (err) {
            const message =
                err.name === "TokenExpiredError"
                    ? "Session expired. Please log in again."
                    : "Invalid token. Access denied.";

            return res.status(401).json({ success: false, message });
        }
    }

    // ── 2. Fall back to express-session ───────────────────────────────────────
    if (req.session && req.session.sellerId) {
        req.user = { id: req.session.sellerId };
        return next();
    }

    // ── 3. Neither found → deny ───────────────────────────────────────────────
    return res.status(401).json({
        success: false,
        message: "Unauthorized. Please log in to access this resource.",
    });
};

module.exports = verifyAuth;
