import { Router } from 'express';
import { fileURLToPath } from 'url';
import path from 'path';
import { 
  login, 
  me, 
  register, 
  resendOtp, 
  verifyOtp,
  forgotPassword,
  resetPassword
} from '../controllers/authController.js';
import { authGuard } from '../middlewares/auth.js';

const router = Router();

// Get directory name for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Serve reset password page
router.get('/reset-password', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/reset-password.html'));
});

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