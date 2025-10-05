import { User } from '../models/User.js';
import { generateNumericOtp } from '../utils/generateOtp.js';
import { sendEmailOtp } from '../services/otpService.js';
import { issueToken } from '../middlewares/auth.js';

const OTP_TTL_MINUTES = 10;

// Generate and send OTP via Email only
const setOtpForUser = async (user) => {
  try {
    const code = generateNumericOtp(6);
    user.otpCode = code;
    user.otpExpiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);
    await user.save();

    // Send OTP through email only
    const emailResult = await sendEmailOtp({
      to: user.email,
      name: user.fullName,
      code: code
    });

    return { email: emailResult };
  } catch (error) {
    console.error('Error in setOtpForUser:', error.message);
    throw error;
  }
};

// REGISTER USER
export const register = async (req, res, next) => {
  try {
    const { role, fullName, email, location, dob, password } = req.body;

    if (!role || !fullName || !password || !location || !dob || !email) {
      return res.status(400).json({
        success: false,
        message: "All required fields must be provided"
      });
    }

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'User with this email already exists'
      });
    }

    const user = await User.create({ role, fullName, email, password, location, dob });

    try {
      const otpResult = await setOtpForUser(user);
      res.status(201).json({
        success: true,
        message: 'Registered successfully. OTP sent to your email.',
        userId: user._id,
        otpDelivery: { email: otpResult.email.success }
      });
    } catch (otpError) {
      console.error('OTP delivery failed:', otpError.message);
      res.status(201).json({
        success: true,
        message: 'Registered successfully, but OTP delivery failed. Please try resending.',
        userId: user._id,
        warning: 'OTP_DELIVERY_FAILED'
      });
    }
  } catch (error) {
    console.error('Registration error:', error.message);
    next(error);
  }
};

// LOGIN
export const login = async (req, res, next) => {
  try {
    const { identifier, password } = req.body;
    if (!identifier || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
    }

    const user = await User.findOne({ email: identifier }).select('+password');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid)
      return res.status(401).json({ success: false, message: 'Invalid credentials' });

    if (!user.isVerified) {
      try {
        const otpResult = await setOtpForUser(user);
        return res.status(403).json({
          success: false,
          message: 'Account not verified. OTP re-sent to your email.',
          needsVerification: true,
          userId: user._id,
          otpDelivery: { email: otpResult.email.success }
        });
      } catch (otpError) {
        console.error('OTP resend failed:', otpError.message);
        return res.status(403).json({
          success: false,
          message: 'Account not verified. Please try resending OTP.',
          needsVerification: true,
          userId: user._id
        });
      }
    }

    const token = issueToken({
      id: user._id,
      role: user.role,
      name: user.fullName
    });

    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        role: user.role,
        name: user.fullName,
        email: user.email
      }
    });
  } catch (error) {
    console.error('Login error:', error.message);
    next(error);
  }
};

// RESEND OTP (Email only)
export const resendOtp = async (req, res, next) => {
  try {
    const { userId } = req.body;
    const user = await User.findById(userId);
    if (!user)
      return res.status(404).json({ success: false, message: 'User not found' });

    const otpResult = await setOtpForUser(user);
    res.json({
      success: otpResult.email.success,
      message: otpResult.email.success
        ? 'OTP re-sent to your email.'
        : 'OTP delivery failed. Please try again.',
      otpDelivery: { email: otpResult.email.success }
    });
  } catch (e) {
    console.error('Resend OTP error:', e.message);
    next(e);
  }
};

// VERIFY OTP
export const verifyOtp = async (req, res, next) => {
  try {
    const { userId, code } = req.body;
    const user = await User.findById(userId).select('+otpCode +otpExpiresAt');
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (!user.otpCode || !user.otpExpiresAt || user.otpExpiresAt < new Date())
      return res.status(400).json({ message: 'OTP expired. Please resend.' });

    if (String(code) !== String(user.otpCode))
      return res.status(400).json({ message: 'Invalid OTP' });

    user.isVerified = true;
    user.otpCode = undefined;
    user.otpExpiresAt = undefined;
    await user.save();

    const token = issueToken({ id: user._id, role: user.role, name: user.fullName });
    res.json({ success: true, message: 'Verification successful', token });
  } catch (e) {
    next(e);
  }
};

// GET CURRENT USER
export const me = async (req, res, next) => {
  try {
    res.json({
      id: req.user.id,
      role: req.user.role,
      name: req.user.name,
      email: req.user.email
    });
  } catch (e) {
    next(e);
  }
};
