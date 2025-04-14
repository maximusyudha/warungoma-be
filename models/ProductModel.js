const db = require('../config/database');

const ProductModel = {
    getAll: (callback) => {
        db.query('SELECT * FROM products', callback);
    },
    create: (name, price, stock, img, category, callback) => {
        db.query('INSERT INTO products (name, price, stock, img, category) VALUES (?, ?, ?, ?, ?)', 
        [name, price, stock, img, category], callback);
    }    
};

module.exports = ProductModel;