import express from 'express';
import { getPriceEngineData, getAuthorizedUsers } from '../controllers/priceController.js';

const router = express.Router();

router.get('/data', getPriceEngineData);
router.get('/auth', getAuthorizedUsers);

export default router;
