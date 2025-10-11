import express from 'express';
import { createPayment, handleWebhook, getMyPayments } from '../controllers/paymentController.js';
import { authGuard } from '../middlewares/auth.js';

const router = express.Router();

router.post('/create', authGuard, createPayment);
router.post('/webhook', express.raw({ type: 'application/json' }), handleWebhook);
router.get('/my-payments', authGuard, getMyPayments);

export default router;
