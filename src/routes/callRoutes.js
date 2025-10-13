// src/routes/callRoutes.js
import express from 'express';
import { generateToken, endCall, getCallHistory } from '../controllers/callController.js';
import { authGuard } from '../middlewares/auth.js';

const router = express.Router();

router.post('/generate-token', authGuard, generateToken);
router.post('/end-call', authGuard, endCall);
router.get('/history', authGuard, getCallHistory);

export default router;