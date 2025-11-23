// routes/adminRoutes.js
import express from 'express';
import { authGuard } from '../middlewares/auth.js';
import {
  createAdmin,
  resetAdminPassword,
  changeMyPassword,
  listAdmins,
  deleteAdmin,
  deleteUserAccount,
  getCompanyAnalytics,
  getAllAgents,
  verifyAgent,
  getAllServiceRequests,
  getAllEmployees,
  getPaymentDetails,
  getComplaints,
  getRecentPayments,
  getTopAgents,
  getServiceRequests,
  getActiveDeliveries,
  getDeliveryDetails,
  getPotentialProviders,
  getServiceProviders,
  getSupportEmployees,
  getPendingRequests,
  getPaymentsSummary,
  getPaymentsInflow,
  getSupportMessages,
  getPaymentsOutflow,
  getAccounts,
  deleteAccounts,
  deleteAccount,
  updateAccount,
  getDashboardOverview,
  getDashboardAnalytics,
  getQuickStats,
  getPendingPayments
} from '../controllers/adminController.js';
import {  updateAgentLocation } from '../controllers/agentController.js';

const router = express.Router();

// ==================== DASHBOARD ROUTES ====================
router.get('/dashboard/overview', authGuard, getDashboardOverview);
router.get('/dashboard/analytics', authGuard, getDashboardAnalytics);
router.get('/dashboard/quick-stats', authGuard, getQuickStats);

// ==================== SPECIFIC ROUTES FIRST ====================
// Self-management
router.put('/me/change-password', authGuard, changeMyPassword);

// Account management - MUST come before '/:id' routes
router.get('/accounts', authGuard, getAccounts);
router.delete('/accounts', authGuard, deleteAccounts);  // ✅ Move this UP
router.put('/accounts/:id', authGuard, updateAccount);
router.delete('/accounts/:id', authGuard, deleteAccount);

// Analytics
router.get('/analytics/summary', authGuard, getCompanyAnalytics);

// Agent management
router.get('/agents', authGuard, getAllAgents);
router.get('/top-agents', authGuard, getTopAgents);
router.put('/agents/:id/verify', authGuard, verifyAgent);

// Service requests
router.get('/service-requests', authGuard, getAllServiceRequests);
router.patch('/update-location', authGuard, updateAgentLocation);

// Employee management
router.get('/employees', authGuard, getAllEmployees);
router.get('/delivery-details', authGuard, getDeliveryDetails);
router.get('/active-deliveries', authGuard, getActiveDeliveries);
router.get('/potential-providers', authGuard, getPotentialProviders);
router.get('/service-providers', authGuard, getServiceProviders);
router.get('/support-employees', authGuard, getSupportEmployees);
router.get('/pending-requests', authGuard, getPendingRequests);
router.get('/support-messages', authGuard, getSupportMessages);

// Payment management
router.get('/payments', authGuard, getPaymentDetails);
router.get('/recent-payments', authGuard, getRecentPayments);
router.get('/payments-summary', authGuard, getPaymentsSummary);
router.get('/payments-inflow', authGuard, getPaymentsInflow);
router.get('/payments-outflow', authGuard, getPaymentsOutflow);
router.get('/payments-outflow', authGuard, getPaymentsOutflow);
router.get('/get-payment', authGuard, getPendingPayments);

// Complaint management
router.get('/complaints', authGuard, getComplaints);

// ==================== DYNAMIC ROUTES LAST ====================
// Admin management - MUST come AFTER all specific routes
router.post('/', authGuard, createAdmin);
router.get('/', authGuard, listAdmins);
router.delete('/:id', authGuard, deleteAdmin);  // ✅ This MUST be last!
router.put('/:id/reset-password', authGuard, resetAdminPassword);

export default router;