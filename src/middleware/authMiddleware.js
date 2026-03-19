import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_key_123';

export const verifyToken = (req, res, next) => {
    // Read from standard Authorization Bearer header
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Expects "Bearer <token>"

    if (!token) {
        return res.status(401).json({ error: "Access denied: Missing access token" });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded; // Attach validated { email, role, deviation } to request
        next();
    } catch (err) {
        return res.status(401).json({ error: "Access denied: Invalid or expired token" });
    }
};
