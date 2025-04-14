const jwt = require('jsonwebtoken');
const SECRET_KEY = 'secret123';

// Verify token (without role check)
const verifyToken = (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized - Token required' });
    }

    const token = authHeader.split(" ")[1];

    jwt.verify(token, SECRET_KEY, (err, decoded) => {
        if (err) return res.status(403).json({ error: 'Invalid or expired token' });

        req.user = decoded;
        next();
    });
};

// Verify admin role (requires token verification first)
const verifyAdmin = (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized - Token required' });
    }

    const token = authHeader.split(" ")[1];

    jwt.verify(token, SECRET_KEY, (err, decoded) => {
        if (err) return res.status(403).json({ error: 'Invalid or expired token' });
        
        if (decoded.role !== 'admin') {
            return res.status(403).json({ error: 'Access denied - Admin role required' });
        }

        req.user = decoded;
        next();
    });
};

module.exports = { verifyToken, verifyAdmin };