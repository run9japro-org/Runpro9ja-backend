import { Router } from 'express';
import { login, me, register, resendOtp, verifyOtp } from '../controllers/authController.js';
import { authGuard } from '../middlewares/auth.js';

import {
getMyProfile,
updateMyProfile,
getMyServiceHistory
} from '../controllers/authController.js';

const router = Router();


router.post('/register', register);
router.post('/login', login);
router.post('/verify-otp', verifyOtp);
router.post('/resend-otp', resendOtp);
router.get('/me', authGuard, me);


// Customer-only routes
router.get('/me', authGuard,  getMyProfile);
router.put('/me', authGuard,  updateMyProfile);
router.get('/me/history', authGuard, getMyServiceHistory);

export default router;