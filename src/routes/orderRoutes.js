// routes/orderRoutes.js
import express from 'express';
import {
  createOrder,
  acceptOrder,
  rejectOrder,
  acceptPublicOrder,
  updateStatus,
  getCustomerOrders,
  getAgentOrders,
  getPublicOrders,
  getDirectOffers,
  getOrderById,
  acceptQuotation,
selectAgentAfterQuotation,
submitQuotation,
  // NEW ROUTES
  scheduleOrder,
  addReview,
  getCustomerServiceHistory,
  getAgentServiceHistory,
  getTodaysSchedule,
  getUpcomingSchedule,
} from '../controllers/orderController.js';
import { authGuard, requireRoles } from '../middlewares/auth.js';
import { ROLES } from '../constants/roles.js';

const router = express.Router();

/// Customer routes
router.post('/', authGuard, requireRoles(ROLES.CUSTOMER), createOrder);
router.get('/my-orders', authGuard, requireRoles(ROLES.CUSTOMER), getCustomerOrders);
router.get('/history', authGuard, requireRoles(ROLES.CUSTOMER), getCustomerServiceHistory);
router.patch('/:id/review', authGuard, requireRoles(ROLES.CUSTOMER), addReview);
// Add this route with other customer routes
router.patch('/:id/select-agent', authGuard, requireRoles(ROLES.CUSTOMER), selectAgentAfterQuotation);
// Agent routes
router.get('/direct-offers', authGuard, requireRoles(ROLES.AGENT), getDirectOffers);
router.get('/public-orders', authGuard, requireRoles(ROLES.AGENT), getPublicOrders);
router.get('/agent/my-orders', authGuard, requireRoles(ROLES.AGENT), getAgentOrders);
router.get('/agent/history', authGuard, requireRoles(ROLES.AGENT), getAgentServiceHistory);
router.get('/agent/schedule/today', authGuard, requireRoles(ROLES.AGENT), getTodaysSchedule);
router.get('/agent/schedule/upcoming', authGuard, requireRoles(ROLES.AGENT), getUpcomingSchedule);
router.patch('/:id/accept-direct', authGuard, requireRoles(ROLES.AGENT), acceptOrder);
router.patch('/:id/reject-direct', authGuard, requireRoles(ROLES.AGENT), rejectOrder);
router.patch('/:id/accept-public', authGuard, requireRoles(ROLES.AGENT), acceptPublicOrder);
router.patch('/:id/status', authGuard, requireRoles(ROLES.AGENT), updateStatus);
router.patch('/:id/schedule', authGuard, requireRoles(ROLES.AGENT), scheduleOrder);

// Company/Admin routes
// Add these routes (probably in admin/company routes)
router.patch('/:id/submit-quotation', authGuard, requireRoles([ROLES.ADMIN, ROLES.REPRESENTATIVE]), submitQuotation);
router.patch('/:id/accept-quotation', authGuard, requireRoles(ROLES.CUSTOMER), acceptQuotation);

// Shared
router.get('/:id', authGuard, getOrderById);

export default router;