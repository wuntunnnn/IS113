const express = require("express");
const router = express.Router();

const mongoose = require("mongoose");

// create schema
const userSchema = new mongoose.Schema({
    username: String,
    email: String,
    password: String,
    role: String,
    createdAt: String
});

const User = mongoose.model("User", userSchema, "users");

// GET all users
router.get("/", async (req, res) => {
    const users = await User.find();
    res.json(users);
});

module.exports = router;