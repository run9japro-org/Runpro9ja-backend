import  {User } from '../models/User.js';
import { generateNumericOtp } from '../utils/generateOtp.js';
import { sendOtpEmail,sendPasswordResetEmail } from '../services/emailService.js';
import { issueToken } from '../middlewares/auth.js';
import crypto from 'crypto';
import bcrypt from "bcryptjs";
const OTP_TTL_MINUTES = 10;
const SALT_ROUNDS = 10;


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

    // Parse the date properly
    const userData = {
      role,
      fullName,
      email,
      password,
      location,
      dob: new Date(dob) // Convert string to Date object
    };

    const user = await User.create(userData);

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
const generateStrongPassword = (length = 16) => {
  return crypto.randomBytes(length).toString('base64').slice(0, length);
};

export const login = async (req, res, next) => {
  try {
    const { identifier, password } = req.body;
    
    console.log('🔍 Login attempt:', {
      identifier,
      passwordLength: password?.length,
      identifierType: typeof identifier
    });

    if (!identifier || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username or Email and password are required'
      });
    }

    // Find user by email OR username
    const user = await User.findOne({
      $or: [{ email: identifier }, { username: identifier }]
    }).select('+password');

    console.log('👤 User lookup result:', {
      found: !!user,
      hasPassword: !!user?.password,
      userRole: user?.role,
      userEmail: user?.email,
      userName: user?.username
    });

    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    // Check if password field exists
    if (!user.password) {
      console.log('⚠️ User has no password set (might be Google-only account)');
      return res.status(400).json({
        success: false,
        message: 'This account uses Google authentication. Please sign in with Google.'
      });
    }

    // Handle admin password rotation (every 24 hours)
    if (user.role?.toLowerCase().includes('admin')) { // ← Fixed case sensitivity
      const now = new Date();
      const lastRotated = user.passwordLastRotated || user.createdAt;
      const hoursSinceRotation = (now - new Date(lastRotated)) / (1000 * 60 * 60);

      console.log('⏰ Admin password rotation check:', {
        hoursSinceRotation,
        needsRotation: hoursSinceRotation >= 24
      });

      if (hoursSinceRotation >= 24) {
        const newPass = generateStrongPassword(16);
        user.password = await bcrypt.hash(newPass, SALT_ROUNDS);
        user.passwordLastRotated = now;
        await user.save();

        return res.status(403).json({
          success: false,
          message: 'Password rotated automatically. Contact your super admin for your new password.'
        });
      }
    }

    // Validate password
    console.log('🔐 Comparing passwords...');
    const isPasswordValid = await bcrypt.compare(password, user.password);
    
    console.log('✅ Password validation result:', {
      isValid: isPasswordValid,
      providedPasswordLength: password.length,
      hashedPasswordLength: user.password?.length
    });

    if (!isPasswordValid) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid credentials' 
      });
    }

    // Issue token
    const token = issueToken({
      id: user._id,
      role: user.role,
      name: user.fullName || user.username,
      email: user.email || null
    });

    console.log('✅ Login successful for:', user.email || user.username);

    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        role: user.role,
        name: user.fullName || user.username,
        email: user.email || null
      }
    });
  } catch (error) {
    console.error('❌ Login error:', error.message);
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


// POST /api/user/add-bank
export const addBankAccount = async (req, res) => {
  try {
    console.log('🏦 Adding bank account for user:', req.user.id);
    const { accountName, accountNumber, bankName, bankCode } = req.body;

    if (!accountName || !accountNumber || !bankName) {
      return res.status(400).json({
        success: false,
        message: 'Please provide account name, number, and bank name.',
      });
    }

    // Update or add bank details
    const user = await User.findByIdAndUpdate(
      req.user.id,
      {
        bankDetails: {
          accountName,
          accountNumber,
          bankName,
          bankCode: bankCode || '',
        },
      },
      { new: true, runValidators: true }
    ).select('-password -otpCode -otpExpiresAt');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    console.log('✅ Bank account added successfully for:', user.fullName);

    res.status(200).json({
      success: true,
      message: 'Bank account added successfully.',
      bankDetails: user.bankDetails,
    });
  } catch (err) {
    console.error('❌ Add bank error:', err);
    res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
};


// GET /api/customers/me
export const getMyProfile = async (req, res) => {
  try {
    console.log('🔍 Fetching profile for user:', req.user.id);
    
    const user = await User.findById(req.user.id)
      .select('-password -otpCode -otpExpiresAt');
    
    if (!user) {
      return res.status(404).json({ 
        success: false,
        message: 'User not found' 
      });
    }

    console.log('✅ User found:', user.fullName);
    
    // Return the user data with all necessary fields
    const userProfile = {
      _id: user._id,
      fullName: user.fullName,
      email: user.email,
      phone: user.phone || '',
      location: user.location || '',
      dob: user.dob || '',
      role: user.role,
      isVerified: user.isVerified || false,
      avatarUrl: user.avatarUrl || '',
      profileImage: user.profileImage || '',
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    };

    console.log('📤 Sending user profile:', userProfile);
    
    res.json(userProfile);
    
  } catch (err) {
    console.error('❌ Get profile error:', err);
    res.status(500).json({ 
      success: false,
      message: 'Server error' 
    });
  }
};

// PUT /api/customers/me
export const updateMyProfile = async (req, res) => {
  try {
    console.log('🔄 Updating profile for user:', req.user.id);
    console.log('📝 Update data:', req.body);

    const allowedUpdates = ['fullName', 'phone', 'location', 'dob', 'avatarUrl', 'profileImage'];
    const updates = {};
    
    // Only allow specific fields to be updated
    Object.keys(req.body).forEach(key => {
      if (allowedUpdates.includes(key)) {
        updates[key] = req.body[key];
      }
    });

    console.log('✅ Allowed updates:', updates);

    const user = await User.findByIdAndUpdate(
      req.user.id, 
      updates, 
      { new: true, runValidators: true }
    ).select('-password -otpCode -otpExpiresAt');

    if (!user) {
      return res.status(404).json({ 
        success: false,
        message: 'User not found' 
      });
    }

    console.log('✅ Profile updated successfully:', user.fullName);

    res.json({
      _id: user._id,
      fullName: user.fullName,
      email: user.email,
      phone: user.phone,
      location: user.location,
      dob: user.dob,
      role: user.role,
      isVerified: user.isVerified,
      avatarUrl: user.avatarUrl,
      profileImage: user.profileImage,
      updatedAt: user.updatedAt
    });
    
  } catch (err) {
    console.error('❌ Update profile error:', err);
    res.status(500).json({ 
      success: false,
      message: 'Server error' 
    });
  }
};
export const getMyServiceHistory = async (req, res) => {
  try {
    const orders = await Order.find({ customer: req.user.id })
      .populate('agent', 'fullName avatarUrl rating')
      .populate('serviceCategory', 'name description')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      orders: orders,
      count: orders.length
    });
  } catch (err) {
    console.error('Service history error:', err);
    res.status(500).json({ 
      success: false,
      error: err.message 
    });
  }
};




// FORGOT PASSWORD - Enhanced version
export const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.json({
        success: true,
        message: 'If an account exists, a reset link has been sent'
      });
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = Date.now() + 3600000;
    await user.save();

    // IMPORTANT: This URL should match your route
    const baseUrl = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;
    const resetUrl = `${baseUrl}/api/auth/reset-password?token=${resetToken}`;
    
    await sendPasswordResetEmail({
      to: user.email,
      name: user.fullName,
      resetUrl: resetUrl
    });

    res.json({
      success: true,
      message: 'Password reset link sent to your email'
    });
  } catch (error) {
    next(error);
  }
};
// RESET PASSWORD - Enhanced version
export const resetPassword = async (req, res, next) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Token and new password are required'
      });
    }

    // Validate password strength
    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long'
      });
    }

    console.log('🔄 Processing password reset for token:', token.substring(0, 10) + '...');

    // Find user by valid reset token
    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() }
    });

    if (!user) {
      console.log('❌ Invalid or expired reset token');
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired reset token. Please request a new reset link.'
      });
    }

    // Check if new password is different from current one
    const isSamePassword = await bcrypt.compare(newPassword, user.password);
    if (isSamePassword) {
      return res.status(400).json({
        success: false,
        message: 'New password must be different from current password'
      });
    }

    // Update password and clear reset token
    user.password = newPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    user.passwordLastRotated = new Date(); // Update rotation timestamp
    
    await user.save();

    console.log('✅ Password reset successfully for user:', user.email);

    // Optional: Send confirmation email
    try {
      await sendPasswordResetEmail({
        to: user.email,
        name: user.fullName || 'User',
        isConfirmation: true
      });
    } catch (emailError) {
      console.log('⚠️ Password reset confirmation email failed, but password was reset');
    }

    res.json({
      success: true,
      message: 'Password reset successfully. You can now login with your new password.'
    });

  } catch (error) {
    console.error('❌ Reset password error:', error.message);
    next(error);
  }
};



// Update your existing OTP function to use the new email service
const setOtpForUser = async (user) => {
  try {
    const code = generateNumericOtp(6);
    user.otpCode = code;
    user.otpExpiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);
    await user.save();

    // Send OTP through email using your existing service
    const emailResult = await sendOtpEmail({
      to: user.email,
      name: user.fullName,
      code: code
    });

    return { 
      email: {
        success: emailResult.success,
        message: emailResult.success ? 'OTP sent successfully' : 'Failed to send OTP'
      } 
    };
  } catch (error) {
    console.error('Error in setOtpForUser:', error.message);
    throw error;
  }
};