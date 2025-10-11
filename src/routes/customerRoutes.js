import { Router } from 'express';
import {
getMyProfile,
updateMyProfile,
getMyServiceHistory,
addBankAccount 
} from '../controllers/authController.js';
import { authGuard } from '../middlewares/auth.js';
const router = Router();

// Customer-only routes

router.get('/me', authGuard,  getMyProfile);
router.put('/me', authGuard,  updateMyProfile);
router.get('/me/history', authGuard, getMyServiceHistory);
router.post('/add-bank', authGuard, addBankAccount);

export default router;