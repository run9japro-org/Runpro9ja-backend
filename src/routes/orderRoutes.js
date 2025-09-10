import express from 'express';
import { authGuard } from '../middlewares/auth.js';
import * as orderController from '../controllers/orderController.js';


const router = express.Router();


router.post('/', authGuard, orderController.createOrder);
router.get('/customer/:id', authGuard, orderController.getCustomerOrders);
router.get('/agent/:id', authGuard, orderController.getAgentOrders);
router.patch('/:id/accept', authGuard, orderController.acceptOrder);
router.patch('/:id/reject', authGuard, orderController.rejectOrder);
router.patch('/:id/status', authGuard, orderController.updateStatus);


export default router;