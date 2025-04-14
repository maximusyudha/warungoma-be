const TransactionModel = require('../models/TransactionModel');
const ProductModel = require('../models/ProductModel');

const TransactionController = {
    // Create a new transaction
    createTransaction: async (req, res) => {
        try {
            const { customer, cart, note, total } = req.body;
            
            // Validate required fields
            if (!customer || !customer.name || !customer.table || !cart || Object.keys(cart).length === 0) {
                return res.status(400).json({ error: 'Missing required fields' });
            }
            
            // Get product IDs for each cart item
            const productNames = Object.keys(cart);
            if (productNames.length === 0) {
                return res.status(400).json({ error: 'Cart is empty' });
            }
            
            // Enhanced cart with product IDs
            const enhancedCart = { ...cart };
            
            // Get all products to match IDs
            ProductModel.getAll((err, products) => {
                if (err) {
                    return res.status(500).json({ error: err.message });
                }
                
                // Map product names to their IDs
                for (const productName of productNames) {
                    const product = products.find(p => p.name === productName);
                    if (!product) {
                        return res.status(400).json({ error: `Product '${productName}' not found` });
                    }
                    
                    enhancedCart[productName].productId = product.id;
                }
                
                // Create transaction with enhanced cart
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
                        transactionId: result.id
                    });
                });
            });
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
    
    // Update transaction status
    updateTransactionStatus: (req, res) => {
        const { id } = req.params;
        const { status } = req.body;
        
        const validStatuses = ['pending', 'processing', 'completed', 'cancelled'];
        
        if (!validStatuses.includes(status)) {
            return res.status(400).json({
                error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
            });
        }
        
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

module.exports = TransactionController;