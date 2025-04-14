
const express = require('express');
const router = express.Router();
const TransactionController = require('../controllers/TransactionController');
const { verifyToken, verifyAdmin } = require('../middlewares/authMiddleware');

// Public routes
router.post('/', TransactionController.createTransaction);
router.get('/public/:id', TransactionController.getPublicTransactionById);

// Admin routes - Require admin authentication
router.get('/', verifyAdmin, TransactionController.getAllTransactions);
router.get('/:id', verifyAdmin, TransactionController.getTransactionById);
router.patch('/:id/status', verifyAdmin, TransactionController.updateTransactionStatus);

module.exports = router;