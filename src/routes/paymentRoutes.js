import express from 'express';
import { authGuard } from '../middlewares/auth.js';
import { createPayment, handleWebhook, getMyPayments } from '../controllers/paymentController.js';

const router = express.Router();

router.post('/', authGuard, createPayment);
router.post('/webhook', handleWebhook); // Paystack will call this
router.get('/me', authGuard, getMyPayments);

export default router;
