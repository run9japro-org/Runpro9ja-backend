import { Router } from 'express';
import {
  createOrUpdateProfile,
  getMyProfile,
  getAgentProfile,
  assignServiceToAgent,
  unassignServiceFromAgent,
  uploadimage,
  upload,
  getAgentsForProfessionalService,
  getAvailableAgents // ✅ Make sure this is imported
} from '../controllers/agentController.js';
import { authGuard, requireRoles } from '../middlewares/auth.js';
import { ROLES } from '../constants/roles.js';
import{addBankAccount } from '../controllers/authController.js'
const router = Router();

// Agent creates/updates their profile
router.post('/me', authGuard, requireRoles(ROLES.AGENT), createOrUpdateProfile);
router.get('/me', authGuard, requireRoles(ROLES.AGENT), getMyProfile);
router.post("/upload-profile", authGuard, upload.single("profileImage"), uploadimage);

router.post('/add-bank', authGuard, requireRoles(ROLES.AGENT), addBankAccount);

// ✅ FIXED: Map /available to getAvailableAgents instead of getAgentProfile
router.get('/available', getAvailableAgents);
router.get('/professional', getAgentsForProfessionalService);
// Public: get agent profile by user id
router.get('/:userId', getAgentProfile);

// Admin or system: assign/unassign services to an agent
router.post('/:agentUserId/assign-service', authGuard, requireRoles(ROLES.ADMIN_HEAD, ROLES.ADMIN_AGENT_SERVICE), assignServiceToAgent);
router.post('/:agentUserId/unassign-service', authGuard, requireRoles(ROLES.ADMIN_HEAD, ROLES.ADMIN_AGENT_SERVICE), unassignServiceFromAgent);

export default router;