import { Router } from 'express';
import { 
  login, 
  me, 
  register, 
  resendOtp, 
  verifyOtp,
  googleAuth,
  linkGoogleAccount,
  unlinkGoogleAccount,
  forgotPassword,
  resetPassword
} from '../controllers/authController.js';
import { authGuard } from '../middlewares/auth.js';

const router = Router();

// Basic Authentication Routes
router.post('/register', register);
router.post('/login', login);
router.post('/verify-otp', verifyOtp);
router.post('/resend-otp', resendOtp);

// Password Reset Routes
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

// Protected Routes
router.get('/me', authGuard, me);

export default router;