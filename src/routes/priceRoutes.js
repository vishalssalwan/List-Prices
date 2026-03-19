import express from 'express';
import { getPriceEngineData, getAuthorizedUsers, refreshToken, logoutUser } from '../controllers/priceController.js';
import { verifyToken } from '../middleware/authMiddleware.js';

const router = express.Router();

// Protected Data Route
router.get('/data', verifyToken, getPriceEngineData);

// Authentication Routes
router.post('/auth', getAuthorizedUsers); 
router.post('/auth/refresh', refreshToken);
router.post('/auth/logout', logoutUser);

export default router;
