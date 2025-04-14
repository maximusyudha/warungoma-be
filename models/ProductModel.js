const db = require('../config/database');

const ProductModel = {
    getAll: (callback) => {
        db.query('SELECT * FROM products', callback);
    },
    create: (name, price, stock, img, category, callback) => {
        db.query('INSERT INTO products (name, price, stock, img, category) VALUES (?, ?, ?, ?, ?)', 
        [name, price, stock, img, category], callback);
    },
    update: (id, name, price, stock, img, category, callback) => {
        db.query('UPDATE products SET name = ?, price = ?, stock = ?, img = ?, category = ? WHERE id = ?', 
        [name, price, stock, img, category, id], callback);
    },
    delete: (id, callback) => {
        db.query('DELETE FROM products WHERE id = ?', [id], callback);
    },
    getById: (id, callback) => {
        const query = "SELECT * FROM products WHERE id = ?";
        db.query(query, [id], (err, results) => {
          if (err) {
            return callback(err, null);
          }
          if (results.length === 0) {
            return callback(null, null);
          }
          callback(null, results[0]);
        });
      }
};

module.exports = ProductModel;