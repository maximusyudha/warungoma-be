const TransactionModel = require('../models/TransactionModel');
const ProductModel = require('../models/ProductModel');

const TransactionController = {
    // Create a new transaction
    createTransaction: async (req, res) => {
        try {
            let { customer, cart, note, total } = req.body;
    
            if (!customer || !customer.name || !cart || Object.keys(cart).length === 0) {
                return res.status(400).json({ error: 'Missing required fields' });
            }
    
            // Step 1: Generate table number if not provided
            if (!customer.table || customer.table.trim() === "") {
                // Fetch last transaction today
                TransactionModel.getLastTransactionToday(async (err, lastTrans) => {
                    if (err) {
                        return res.status(500).json({ error: err.message });
                    }
    
                    let newTableNumber = 'M01';
    
                    if (lastTrans && lastTrans.customer && lastTrans.customer.table) {
                        const lastTable = lastTrans.customer.table;
                        const lastNum = parseInt(lastTable.replace('M', '')) || 0;
                        const nextNum = lastNum + 1;
                        newTableNumber = `M${nextNum.toString().padStart(2, '0')}`;
                    }
    
                    customer.table = newTableNumber;
    
                    // Continue with product name -> ID mapping
                    const productNames = Object.keys(cart);
                    if (productNames.length === 0) {
                        return res.status(400).json({ error: 'Cart is empty' });
                    }
    
                    const enhancedCart = { ...cart };
    
                    ProductModel.getAll((err, products) => {
                        if (err) return res.status(500).json({ error: err.message });
    
                        for (const productName of productNames) {
                            const product = products.find(p => p.name === productName);
                            if (!product) {
                                return res.status(400).json({ error: `Product '${productName}' not found` });
                            }
    
                            enhancedCart[productName].productId = product.id;
                        }
    
                        const transaction = {
                            customer,
                            cart: enhancedCart,
                            note,
                            total
                        };
    
                        TransactionModel.create(transaction, (err, result) => {
                            if (err) {
                                return res.status(500).json({ error: err.message });
                            }
    
                            res.status(201).json({
                                message: 'Transaction created successfully',
                                transactionId: result.id,
                                tableNumber: customer.table
                            });
                        });
                    });
                });
    
            } else {
                // Jika table number sudah diberikan, langsung lanjut
                // ... (bisa salin logic product mapping & create transaction dari atas ke sini)
                const transaction = {
                    customer,
                    cart,
                    note,
                    total
                };
    
                TransactionModel.create(transaction, (err, result) => {
                    if (err) {
                        return res.status(500).json({ error: err.message });
                    }
    
                    res.status(201).json({
                        message: 'Transaction created successfully',
                        transactionId: result.id,
                        tableNumber: customer.table
                    });
                })
            }
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    },
    
    
    // Get all transactions
    getAllTransactions: (req, res) => {
        TransactionModel.getAll((err, transactions) => {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            
            res.json(transactions);
        });
    },
    
    // Get transaction by ID - ADMIN access
    getTransactionById: (req, res) => {
        const { id } = req.params;
        
        TransactionModel.getById(id, (err, transaction) => {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            
            if (!transaction) {
                return res.status(404).json({ error: 'Transaction not found' });
            }
            
            res.json(transaction);
        });
    },
    
    // Get transaction by ID - PUBLIC access with limited info
    getPublicTransactionById: (req, res) => {
        const { id } = req.params;
        
        TransactionModel.getById(id, (err, transaction) => {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            
            if (!transaction) {
                return res.status(404).json({ error: 'Transaction not found' });
            }
            
            // Return only necessary information for public view
            const publicTransaction = {
                id: transaction.id,
                status: transaction.status,
                timestamp: transaction.created_at,
                customerDetails: {
                    table: transaction.table_number
                },
                estimatedTime: calculateEstimatedTime(transaction.items || [])
            };
            
            res.json(publicTransaction);
        });
    },
    
    // Update transaction status with stock reduction when processing
    updateTransactionStatus: (req, res) => {
        const { id } = req.params;
        const { status } = req.body;
        
        const validStatuses = ['pending', 'processing', 'completed', 'cancelled'];
        
        if (!validStatuses.includes(status)) {
            return res.status(400).json({
                error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
            });
        }
        
        // First, get the current transaction to check its status
        TransactionModel.getById(id, (err, transaction) => {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            
            if (!transaction) {
                return res.status(404).json({ error: 'Transaction not found' });
            }
            
            // If updating to processing and current status is not already processing
            if (status === 'processing' && transaction.status !== 'processing') {
                // Reduce stock for each item in the transaction
                reduceStockForTransaction(transaction, (stockErr) => {
                    if (stockErr) {
                        return res.status(500).json({ error: stockErr.message });
                    }
                    
                    // Now update the transaction status
                    updateStatus();
                });
            } 
            // If cancelling a processing order, restore stock
            else if (status === 'cancelled' && transaction.status === 'processing') {
                // Restore stock for each item in the transaction
                restoreStockForTransaction(transaction, (stockErr) => {
                    if (stockErr) {
                        return res.status(500).json({ error: stockErr.message });
                    }
                    
                    // Now update the transaction status
                    updateStatus();
                });
            }
            else {
                // For other status changes, just update the status
                updateStatus();
            }
        });
        
        function updateStatus() {
            TransactionModel.updateStatus(id, status, (err, result) => {
                if (err) {
                    return res.status(500).json({ error: err.message });
                }
                
                if (result.affectedRows === 0) {
                    return res.status(404).json({ error: 'Transaction not found' });
                }
                
                res.json({
                    message: 'Transaction status updated',
                    id,
                    status
                });
            });
        }
    }
};

// Helper function to calculate estimated preparation time
function calculateEstimatedTime(items) {
    // Basic calculation - 5 minutes base + 2 minutes per item
    // This is just an example - you can customize based on your business logic
    const baseTime = 5;
    const perItemTime = 2;
    
    // Calculate total quantity of all items
    const totalQuantity = items.reduce((total, item) => total + item.quantity, 0);
    
    return baseTime + (perItemTime * totalQuantity);
}

// Helper function to reduce stock when a transaction is processed
function reduceStockForTransaction(transaction, callback) {
    try {
        // Check if transaction has items
        if (!transaction.items || transaction.items.length === 0) {
            return callback(new Error('Transaction has no items'));
        }
        
        // Prepare batch updates
        const stockUpdates = [];
        
        transaction.items.forEach(item => {
            stockUpdates.push({
                productId: item.product_id,
                quantity: item.quantity
            });
        });
        
        // Process stock reduction for all items
        let completed = 0;
        let hasError = false;
        
        stockUpdates.forEach(update => {
            ProductModel.reduceStock(update.productId, update.quantity, (err) => {
                if (hasError) return; // Skip if already has error
                
                if (err) {
                    hasError = true;
                    return callback(err);
                }
                
                completed++;
                
                // All updates completed successfully
                if (completed === stockUpdates.length) {
                    callback(null);
                }
            });
        });
        
        // Handle empty updates array case
        if (stockUpdates.length === 0) {
            callback(null);
        }
        
    } catch (error) {
        callback(error);
    }
}

// Helper function to restore stock when a processing transaction is cancelled
function restoreStockForTransaction(transaction, callback) {
    try {
        // Check if transaction has items
        if (!transaction.items || transaction.items.length === 0) {
            return callback(new Error('Transaction has no items'));
        }
        
        // Prepare batch updates
        const stockUpdates = [];
        
        transaction.items.forEach(item => {
            stockUpdates.push({
                productId: item.product_id,
                quantity: item.quantity
            });
        });
        
        // Process stock restoration for all items
        let completed = 0;
        let hasError = false;
        
        stockUpdates.forEach(update => {
            ProductModel.restoreStock(update.productId, update.quantity, (err) => {
                if (hasError) return; // Skip if already has error
                
                if (err) {
                    hasError = true;
                    return callback(err);
                }
                
                completed++;
                
                // All updates completed successfully
                if (completed === stockUpdates.length) {
                    callback(null);
                }
            });
        });
        
        // Handle empty updates array case
        if (stockUpdates.length === 0) {
            callback(null);
        }
        
    } catch (error) {
        callback(error);
    }
}

module.exports = TransactionController;