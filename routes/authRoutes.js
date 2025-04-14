const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/database');
const router = express.Router();

const SECRET_KEY = 'secret123'; // Ganti dengan env

router.post('/login', (req, res) => {
    const { username, password } = req.body;

    db.query('SELECT * FROM users WHERE username = ?', [username], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });

        if (results.length === 0) return res.status(401).json({ error: 'User not found' });

        const user = results[0];

        // Bandingkan password (sementara tanpa hashing)
        if (password !== user.password) {
            return res.status(401).json({ error: 'Invalid password' });
        }

        // Buat token JWT
        const token = jwt.sign({ id: user.id, role: user.role }, SECRET_KEY, { expiresIn: '1h' });

        res.json({ token, role: user.role });
    });
});

module.exports = router;
