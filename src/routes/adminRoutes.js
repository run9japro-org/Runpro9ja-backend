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
  // Add the new dashboard functions
  getDashboardOverview,
  getDashboardAnalytics,
  getQuickStats
} from '../controllers/adminController.js';
import {  updateAgentLocation } from '../controllers/agentController.js';

const router = express.Router();

// ==================== DASHBOARD ROUTES ====================
// Dashboard overview (Super Admin, Admin Head, Admin Agent Service, Admin Customer Service)
router.get('/dashboard/overview', authGuard, getDashboardOverview);

// Dashboard analytics (Super Admin, Admin Head, Admin Agent Service)
router.get('/dashboard/analytics', authGuard, getDashboardAnalytics);

// Quick stats (Super Admin, Admin Head, Admin Agent Service, Admin Customer Service)
router.get('/dashboard/quick-stats', authGuard, getQuickStats);

// Admin management (Super Admin & Admin Head only)
router.post('/', authGuard, createAdmin);
router.get('/', authGuard, listAdmins);
router.delete('/:id', authGuard, deleteAdmin);
router.put('/:id/reset-password', authGuard, resetAdminPassword);

// Account management (Super Admin & Admin Head only)
router.delete('/accounts/:id', authGuard, deleteUserAccount);

// Analytics (Super Admin, Admin Head, Admin Agent Service)
router.get('/analytics/summary', authGuard, getCompanyAnalytics);

// Agent management (Super Admin, Admin Head, Admin Agent Service)
router.get('/agents', authGuard, getAllAgents);
router.get('/top-agents', authGuard, getTopAgents );
router.put('/agents/:id/verify', authGuard, verifyAgent);

// Service requests (All admins except specific restrictions)
router.get('/service-requests', authGuard, getAllServiceRequests);
router.patch('/update-location', authGuard, updateAgentLocation);

// Employee management (Super Admin & Admin Head only)
router.get('/employees', authGuard, getAllEmployees);
router.get('/delivery-details', authGuard, getDeliveryDetails);
router.get('/active-deliveries', authGuard, getActiveDeliveries);
router.get('/service-requests', authGuard, getServiceRequests);
router.get('/potential-providers', authGuard, getPotentialProviders);
router.get('/service-providers', authGuard, getServiceProviders);
router.get('/support-employees', authGuard, getSupportEmployees);
router.get('/pending-requests', authGuard, getPendingRequests);
router.get('/support-messages', authGuard, getSupportMessages);

// Payment management (Super Admin & Admin Head only)
router.get('/payments', authGuard, getPaymentDetails);
router.get('/recent-payments', authGuard, getRecentPayments);
router.get('/payments-summary', authGuard, getPaymentsSummary);
router.get('/payments-inflow', authGuard, getPaymentsInflow);
router.get('/payments-outflow', authGuard, getPaymentsOutflow);

// Account management
router.get('/accounts', authGuard, getAccounts);
router.put('/accounts/:id', authGuard, updateAccount);
router.delete('/accounts', authGuard, deleteAccounts);
router.delete('/accounts/:id', authGuard, deleteAccount);
// Complaint management (Super Admin, Admin Head, Admin Customer Service)
router.get('/complaints', authGuard, getComplaints);

// Self-management
router.put('/me/change-password', authGuard, changeMyPassword);

export default router;