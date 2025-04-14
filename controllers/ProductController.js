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

const updateProduct = (req, res) => {
  const { id } = req.params;
  const { name, price, stock, category } = req.body;
  
  // First, get the current product to check if it has an image
  ProductModel.getById(id, (err, product) => {
    if (err) return res.status(500).json({ error: err.message });
    
    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }
    
    // If a new image is uploaded, use that. Otherwise keep the existing image.
    const img = req.file ? `/images/${req.file.filename}` : product.img;
    
    ProductModel.update(id, name, price, stock, img, category, (err, result) => {
      if (err) return res.status(500).json({ error: err.message });
      
      // Return the full image URL in the response
      const imgUrl = img ? `${req.protocol}://${req.get('host')}${img}` : null;
      
      res.json({
        message: "Product updated",
        id,
        name,
        price,
        stock,
        img,
        imgUrl,
        category,
        updated_at: new Date()
      });
    });
  });
};

const deleteProduct = (req, res) => {
  const { id } = req.params;
  
  ProductModel.delete(id, (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    
    res.json({ message: "Product deleted", id });
  });
};

module.exports = { getAllProducts, createProduct, upload, updateProduct, deleteProduct };