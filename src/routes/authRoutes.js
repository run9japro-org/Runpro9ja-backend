import { Router } from 'express';
import { login, me, register, resendOtp, verifyOtp } from '../controllers/authController.js';
import { authGuard } from '../middlewares/auth.js';



const router = Router();


router.post('/register', register);
router.post('/login', login);
router.post('/verify-otp', verifyOtp);
router.post('/resend-otp', resendOtp);
// router.get('/me', authGuard, me);




export default router;