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
  getComplaints
} from '../controllers/adminController.js';

const router = express.Router();

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
router.put('/agents/:id/verify', authGuard, verifyAgent);

// Service requests (All admins except specific restrictions)
router.get('/service-requests', authGuard, getAllServiceRequests);

// Employee management (Super Admin & Admin Head only)
router.get('/employees', authGuard, getAllEmployees);

// Payment management (Super Admin & Admin Head only)
router.get('/payments', authGuard, getPaymentDetails);

// Complaint management (Super Admin, Admin Head, Admin Customer Service)
router.get('/complaints', authGuard, getComplaints);

// Self-management
router.put('/me/change-password', authGuard, changeMyPassword);

export default router;