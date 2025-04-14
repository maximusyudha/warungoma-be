const express = require("express");
const router = express.Router();
const { getAllProducts, createProduct, upload } = require("../controllers/ProductController");
const { verifyAdmin } = require("../middlewares/authMiddleware");

// Get all products
router.get("/", getAllProducts);

// Create product with image upload (admin only)
router.post("/", verifyAdmin, upload.single("image"), createProduct);

module.exports = router;