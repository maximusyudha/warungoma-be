const express = require("express");
const router = express.Router();
const { getAllProducts, createProduct, upload, updateProduct, deleteProduct } = require("../controllers/ProductController");
const { verifyAdmin } = require("../middlewares/authMiddleware");

// Get all products
router.get("/", getAllProducts);

// Update product (admin only)
router.put("/:id", verifyAdmin, upload.single("image"), updateProduct);

// Delete product (admin only)
router.delete("/:id", verifyAdmin, deleteProduct);

// Create product with image upload (admin only)
router.post("/", verifyAdmin, upload.single("image"), createProduct);

module.exports = router;