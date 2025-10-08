// routes/adminRoutes.js
import { Router } from 'express';
import {
  createAdmin,
  resetAdminPassword,
  changeMyPassword,
  listAdmins,
  deleteAdmin
} from '../controllers/adminController.js';
import { authGuard, requireRoles } from '../middlewares/auth.js';
import { ROLES } from '../constants/roles.js';

const router = Router();

// Create admin (super admin or admin head)
router.post('/', authGuard, requireRoles(ROLES.SUPER_ADMIN, ROLES.ADMIN_HEAD), createAdmin);

// List admins
router.get('/', authGuard, requireRoles(ROLES.SUPER_ADMIN, ROLES.ADMIN_HEAD), listAdmins);

// Delete admin (only super admin)
router.delete('/:id', authGuard, requireRoles(ROLES.SUPER_ADMIN), deleteAdmin);

// Reset another admin password (super/admin head)
router.put('/:id/reset-password', authGuard, requireRoles(ROLES.SUPER_ADMIN, ROLES.ADMIN_HEAD), resetAdminPassword);

// Change own password (any admin or user)
router.put('/me/change-password', authGuard, changeMyPassword);

export default router;
