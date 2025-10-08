// routes/orderRoutes.js
import express from 'express';
import {
  createOrder,
  acceptOrder,           // For direct offers
  rejectOrder,           // For direct offers  
  acceptPublicOrder,     // For public orders
  updateStatus,
  getCustomerOrders,
  getAgentOrders,
  getPublicOrders,       // Get public orders
  getDirectOffers,       // Get direct offers to agent
  getOrderById
} from '../controllers/orderController.js';
import { authGuard, requireRoles } from '../middlewares/auth.js';
import { ROLES } from '../constants/roles.js';

const router = express.Router();

// Customer routes
router.post('/', authGuard, requireRoles(ROLES.CUSTOMER), createOrder);
router.get('/my-orders', authGuard, requireRoles(ROLES.CUSTOMER), getCustomerOrders);

// Agent routes
router.get('/direct-offers', authGuard, requireRoles(ROLES.AGENT), getDirectOffers);
router.get('/public-orders', authGuard, requireRoles(ROLES.AGENT), getPublicOrders);
router.get('/agent/my-orders', authGuard, requireRoles(ROLES.AGENT), getAgentOrders);
router.patch('/:id/accept-direct', authGuard, requireRoles(ROLES.AGENT), acceptOrder);
router.patch('/:id/reject-direct', authGuard, requireRoles(ROLES.AGENT), rejectOrder);
router.patch('/:id/accept-public', authGuard, requireRoles(ROLES.AGENT), acceptPublicOrder);
router.patch('/:id/status', authGuard, requireRoles(ROLES.AGENT), updateStatus);

// Shared routes
router.get('/:id', authGuard, getOrderById);

export default router;