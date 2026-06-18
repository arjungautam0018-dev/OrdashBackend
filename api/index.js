require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const morgan = require("morgan");
const path = require("path");
const session = require("express-session");

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(morgan("dev"));
app.use(express.static(path.join(__dirname, "../public")));

// Session configuration
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: {
        secure: process.env.NODE_ENV === "production",
        httpOnly: true,
        sameSite: "strict",
        maxAge: 1000 * 60 * 60 * 24
    }
}));

// MongoDB connection
const connectDB = require("../src/config/db.config");
connectDB();

app.get("/", (req, res) => {
    res.send("Welcome to the API");
});

// APIS
app.use("/api", require("../src/routes/sellersignup.routes"));
app.use("/api", require("../src/routes/sellerlogin.routes"));

module.exports = app;
