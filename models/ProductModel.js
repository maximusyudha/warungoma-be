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
      },
      
    /**
     * Reduce stock for a product
     * @param {number} productId - The product ID
     * @param {number} quantity - The quantity to reduce
     * @param {function} callback - Callback function(err, result)
     */
    reduceStock: function(productId, quantity, callback) {
      // First get the current stock
      const query = 'SELECT stock FROM products WHERE id = ?';
      
      db.query(query, [productId], (err, results) => {
          if (err) {
              return callback(err);
          }
          
          if (results.length === 0) {
              return callback(new Error(`Product with ID ${productId} not found`));
          }
          
          const currentStock = results[0].stock;
          
          // Check if we have enough stock
          if (currentStock < quantity) {
              return callback(new Error(`Not enough stock for product ID ${productId}. Available: ${currentStock}, Requested: ${quantity}`));
          }
          
          // Update the stock
          const updateQuery = 'UPDATE products SET stock = stock - ? WHERE id = ?';
          
          db.query(updateQuery, [quantity, productId], (updateErr, updateResult) => {
              if (updateErr) {
                  return callback(updateErr);
              }
              
              callback(null, updateResult);
          });
      });
  },

  /**
   * Restore stock for a product (when cancelling an order)
   * @param {number} productId - The product ID
   * @param {number} quantity - The quantity to restore
   * @param {function} callback - Callback function(err, result)
   */
  restoreStock: function(productId, quantity, callback) {
      const query = 'UPDATE products SET stock = stock + ? WHERE id = ?';
      
      db.query(query, [quantity, productId], (err, result) => {
          if (err) {
              return callback(err);
          }
          
          if (result.affectedRows === 0) {
              return callback(new Error(`Product with ID ${productId} not found`));
          }
          
          callback(null, result);
      });
  }
};

module.exports = ProductModel;