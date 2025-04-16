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
            
            // Function to process product IDs and create transaction
            const processCartAndCreateTransaction = () => {
                // Check if cart already has productId for each item
                const productNames = Object.keys(cart);
                if (productNames.length === 0) {
                    return res.status(400).json({ error: 'Cart is empty' });
                }
                
                // If we already have product_id for each item, proceed directly
                const missingProductId = productNames.some(name => 
                    !cart[name].product_id && !cart[name].productId);
                
                if (!missingProductId) {
                    // Ensure consistent property naming (product_id)
                    for (const productName of productNames) {
                        if (cart[productName].productId && !cart[productName].product_id) {
                            cart[productName].product_id = cart[productName].productId;
                        }
                    }
                    
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
                    });
                    return;
                }
                
                // If we need to map product names to IDs
                ProductModel.getAll((err, products) => {
                    if (err) return res.status(500).json({ error: err.message });
                    
                    for (const productName of productNames) {
                        const product = products.find(p => p.name === productName);
                        if (!product) {
                            return res.status(400).json({ error: `Product '${productName}' not found` });
                        }
                        
                        cart[productName].product_id = product.id;
                    }
                    
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
                    });
                });
            };
    
            // Step 1: Generate table number if not provided
            if (!customer.table || customer.table.trim() === "") {
                // Fetch last transaction today
                TransactionModel.getLastTransactionToday((err, lastTrans) => {
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
                    
                    // Process cart and create transaction
                    processCartAndCreateTransaction();
                });
            } else {
                // If table number is already provided, proceed with product mapping
                processCartAndCreateTransaction();
            }
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    },
    
    // Rest of the controller remains the same
    getAllTransactions: (req, res) => {
        TransactionModel.getAll((err, transactions) => {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            
            res.json(transactions);
        });
    },
    
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