const multer = require("multer");
const path = require("path");
const crypto = require("crypto");
const fs = require("fs");
const ProductModel = require("../models/ProductModel");

// Create uploads directory if it doesn't exist
const uploadDir = "./public/images";
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure multer with filename hashing
const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (req, file, cb) => {
    // Create a hash of the original filename + timestamp
    const fileHash = crypto
      .createHash("md5")
      .update(file.originalname + Date.now().toString())
      .digest("hex");
    
    // Use the hash as the filename with the original extension
    const extension = path.extname(file.originalname);
    cb(null, `${fileHash}${extension}`);
  },
});

// Set up file filter to only accept images
const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith("image/")) {
    cb(null, true);
  } else {
    cb(new Error("Only image files are allowed"), false);
  }
};

const upload = multer({ 
  storage, 
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

// Get all products
const getAllProducts = (req, res) => {
  ProductModel.getAll((err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    
    // Add the full URL to each image
    const products = results.map(product => ({
      ...product,
      imgUrl: product.img ? `${req.protocol}://${req.get('host')}${product.img}` : null
    }));
    
    res.json(products);
  });
};

// Add product with image upload
const createProduct = (req, res) => {
  const { name, price, stock, category } = req.body;
  const img = req.file ? `/images/${req.file.filename}` : null;

  if (!name || !price || !stock || !category) {
    return res.status(400).json({ error: "Semua field harus diisi" });
  }

  ProductModel.create(name, price, stock, img, category, (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    
    // Return the full image URL in the response
    const imgUrl = img ? `${req.protocol}://${req.get('host')}${img}` : null;
    
    res.status(201).json({
      message: "Product added",
      id: result.insertId,
      name,
      price,
      stock,
      img,
      imgUrl,
      category,
      created_at: new Date()
    });
  });
};

module.exports = { getAllProducts, createProduct, upload };