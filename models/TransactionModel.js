const db = require('../config/database');

const TransactionModel = {
    // Create a new transaction
    create: (transaction, callback) => {
        // First, create the transaction record
        db.query(
            'INSERT INTO transactions (customer_name, customer_phone, table_number, total_amount, note, status) VALUES (?, ?, ?, ?, ?, ?)',
            [
                transaction.customer.name,
                transaction.customer.phone,
                transaction.customer.table,
                transaction.total,
                transaction.note,
                'pending' // Initial status
            ],
            (err, result) => {
                if (err) return callback(err, null);
                
                const transactionId = result.insertId;
                
                // Then insert all transaction items
                const items = Object.entries(transaction.cart).map(([productName, item]) => {
                    return [
                        transactionId,
                        item.productId,
                        productName,
                        item.qty,
                        item.price,
                        item.qty * item.price
                    ];
                });
                
                if (items.length === 0) {
                    return callback(null, { id: transactionId });
                }
                
                const placeholders = items.map(() => '(?, ?, ?, ?, ?, ?)').join(', ');
                const values = items.flat();
                
                db.query(
                    `INSERT INTO transaction_items 
                    (transaction_id, product_id, product_name, quantity, unit_price, subtotal) 
                    VALUES ${placeholders}`,
                    values,
                    (err) => {
                        if (err) return callback(err, null);
                        callback(null, { id: transactionId });
                    }
                );
            }
        );
    },
    
    // Get all transactions
    getAll: (callback) => {
        db.query(
            `SELECT t.*, 
            COUNT(ti.id) as item_count 
            FROM transactions t 
            LEFT JOIN transaction_items ti ON t.id = ti.transaction_id 
            GROUP BY t.id 
            ORDER BY t.created_at DESC`,
            callback
        );
    },
    
    // Get transaction by ID with its items
    getById: (id, callback) => {
        db.query('SELECT * FROM transactions WHERE id = ?', [id], (err, transactions) => {
            if (err) return callback(err, null);
            if (transactions.length === 0) return callback(null, null);
            
            const transaction = transactions[0];
            
            db.query(
                'SELECT * FROM transaction_items WHERE transaction_id = ?',
                [id],
                (err, items) => {
                    if (err) return callback(err, null);
                    
                    transaction.items = items;
                    callback(null, transaction);
                }
            );
        });
    },
    
    // Update transaction status
    updateStatus: (id, status, callback) => {
        db.query(
            'UPDATE transactions SET status = ? WHERE id = ?',
            [status, id],
            callback
        );
    }
};

module.exports = TransactionModel;