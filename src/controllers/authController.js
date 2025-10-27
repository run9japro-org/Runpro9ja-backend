import { User } from '../models/User.js';
import { generateNumericOtp } from '../utils/generateOtp.js';
import { sendOtpEmail, sendPasswordResetEmail } from '../services/emailService.js';
import { issueToken } from '../middlewares/auth.js';
import crypto from 'crypto';
import bcrypt from "bcryptjs";

const OTP_TTL_MINUTES = 10;
const SALT_ROUNDS = 10;

// REGISTER USER
export const register = async (req, res, next) => {
  try {
    const { role, fullName, email, location, dob, password, phone } = req.body;

    console.log('📝 Registration attempt:', { role, fullName, email, location, dob, phone });

    // Enhanced validation
    if (!role || !fullName || !password || !location || !dob || !email) {
      return res.status(400).json({
        success: false,
        message: "All required fields must be provided: role, fullName, email, location, dob, password"
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid email address"
      });
    }

    // Validate date of birth (must be at least 18 years old)
    const birthDate = new Date(dob);
    const today = new Date();
    const age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }

    if (age < 18) {
      return res.status(400).json({
        success: false,
        message: "You must be at least 18 years old to register"
      });
    }

    // Check for existing user
    const existing = await User.findOne({ 
      $or: [{ email }, { phone }] 
    });
    
    if (existing) {
      return res.status(409).json({
        success: false,
        message: existing.email === email 
          ? 'User with this email already exists' 
          : 'User with this phone number already exists'
      });
    }

    // Create user data
    const userData = {
      role,
      fullName,
      email,
      password,
      location,
      dob: birthDate,
      phone: phone || null
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
    
    // Handle duplicate key errors
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'User with this email or phone already exists'
      });
    }
    
    // Handle validation errors
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors
      });
    }
    
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
        message: 'Username/Email and password are required'
      });
    }

    // Find user by email OR username OR phone
    const user = await User.findOne({
      $or: [
        { email: identifier }, 
        { username: identifier },
        { phone: identifier }
      ]
    }).select('+password +loginAttempts +lockUntil +status');

    console.log('👤 User lookup result:', {
      found: !!user,
      hasPassword: !!user?.password,
      userRole: user?.role,
      userEmail: user?.email,
      userName: user?.username,
      userStatus: user?.status
    });

    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    // Check if account is locked
    if (user.isLocked && user.isLocked()) {
      const retryAfter = Math.ceil((user.lockUntil - Date.now()) / 1000 / 60);
      return res.status(423).json({
        success: false,
        message: `Account temporarily locked. Try again in ${retryAfter} minutes.`
      });
    }

    // Check account status
    if (user.status === 'suspended') {
      return res.status(423).json({
        success: false,
        message: 'Account suspended. Please contact support.'
      });
    }

    if (user.status === 'inactive') {
      return res.status(423).json({
        success: false,
        message: 'Account inactive. Please contact support.'
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
    if (user.role?.toLowerCase().includes('admin')) {
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
      // Increment login attempts
      user.loginAttempts += 1;
      
      // Lock account after 5 failed attempts for 30 minutes
      if (user.loginAttempts >= 5) {
        user.lockUntil = Date.now() + 30 * 60 * 1000; // 30 minutes
        user.loginAttempts = 0;
        
        await user.save();
        
        return res.status(423).json({
          success: false,
          message: 'Too many failed attempts. Account locked for 30 minutes.'
        });
      }
      
      await user.save();

      return res.status(401).json({ 
        success: false, 
        message: `Invalid credentials. ${5 - user.loginAttempts} attempts remaining.` 
      });
    }

    // Reset login attempts on successful login
    user.loginAttempts = 0;
    user.lockUntil = undefined;
    user.lastLogin = new Date();
    await user.save();

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
        email: user.email || null,
        phone: user.phone || null,
        isVerified: user.isVerified,
        profileImage: user.profileImage || user.avatarUrl
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
    const { userId, email } = req.body;
    
    let user;
    if (userId) {
      user = await User.findById(userId);
    } else if (email) {
      user = await User.findOne({ email });
    } else {
      return res.status(400).json({ 
        success: false, 
        message: 'User ID or Email is required' 
      });
    }
    
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

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
    const { userId, code, email } = req.body;
    
    let user;
    if (userId) {
      user = await User.findById(userId).select('+otpCode +otpExpiresAt');
    } else if (email) {
      user = await User.findOne({ email }).select('+otpCode +otpExpiresAt');
    } else {
      return res.status(400).json({ 
        success: false, 
        message: 'User ID or Email is required' 
      });
    }
    
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    if (!user.otpCode || !user.otpExpiresAt || user.otpExpiresAt < new Date()) {
      return res.status(400).json({ 
        success: false, 
        message: 'OTP expired. Please resend.' 
      });
    }

    if (String(code) !== String(user.otpCode)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid OTP' 
      });
    }

    user.isVerified = true;
    user.otpCode = undefined;
    user.otpExpiresAt = undefined;
    await user.save();

    const token = issueToken({ 
      id: user._id, 
      role: user.role, 
      name: user.fullName,
      email: user.email 
    });
    
    res.json({ 
      success: true, 
      message: 'Verification successful', 
      token,
      user: {
        id: user._id,
        role: user.role,
        name: user.fullName,
        email: user.email,
        isVerified: true
      }
    });
  } catch (e) {
    console.error('Verify OTP error:', e.message);
    next(e);
  }
};

// GET CURRENT USER
export const me = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id)
      .select('-password -otpCode -otpExpiresAt -resetPasswordToken -resetPasswordExpires');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      user: {
        id: user._id,
        role: user.role,
        name: user.fullName,
        email: user.email,
        phone: user.phone,
        location: user.location,
        dob: user.dob,
        isVerified: user.isVerified,
        profileImage: user.profileImage,
        avatarUrl: user.avatarUrl,
        status: user.status,
        createdAt: user.createdAt
      }
    });
  } catch (e) {
    console.error('Get current user error:', e.message);
    next(e);
  }
};

// ADD BANK ACCOUNT
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

    // Validate account number (Nigerian account numbers are typically 10 digits)
    if (!/^\d{10}$/.test(accountNumber)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid 10-digit account number.'
      });
    }

    // Update or add bank details
    const user = await User.findByIdAndUpdate(
      req.user.id,
      {
        bankAccount: {
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
      bankAccount: user.bankAccount,
    });
  } catch (err) {
    console.error('❌ Add bank error:', err);
    
    if (err.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid bank account data',
        errors: Object.values(err.errors).map(error => error.message)
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Server error while adding bank account',
    });
  }
};

// GET USER PROFILE
export const getMyProfile = async (req, res) => {
  try {
    console.log('🔍 Fetching profile for user:', req.user.id);
    
    const user = await User.findById(req.user.id)
      .select('-password -otpCode -otpExpiresAt -resetPasswordToken -resetPasswordExpires');
    
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
      bankAccount: user.bankAccount || null,
      status: user.status || 'active',
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    };

    console.log('📤 Sending user profile');
    
    res.json({
      success: true,
      user: userProfile
    });
    
  } catch (err) {
    console.error('❌ Get profile error:', err);
    res.status(500).json({ 
      success: false,
      message: 'Server error while fetching profile' 
    });
  }
};

// UPDATE USER PROFILE
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
      success: true,
      message: 'Profile updated successfully',
      user: {
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
      }
    });
    
  } catch (err) {
    console.error('❌ Update profile error:', err);
    
    if (err.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: Object.values(err.errors).map(error => error.message)
      });
    }
    
    res.status(500).json({ 
      success: false,
      message: 'Server error while updating profile' 
    });
  }
};

// FORGOT PASSWORD
export const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }

    const user = await User.findOne({ email });
    if (!user) {
      // Return success even if user not found for security
      return res.json({
        success: true,
        message: 'If an account exists, a reset link has been sent'
      });
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = Date.now() + 3600000; // 1 hour
    await user.save();

    // IMPORTANT: This URL should match your frontend reset password page
    const baseUrl = process.env.FRONTEND_URL || process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;
    const resetUrl = `${baseUrl}/reset-password?token=${resetToken}`;
    
    await sendPasswordResetEmail({
      to: user.email,
      name: user.fullName,
      resetUrl: resetUrl
    });

    console.log('✅ Password reset email sent to:', user.email);

    res.json({
      success: true,
      message: 'Password reset link sent to your email'
    });
  } catch (error) {
    console.error('Forgot password error:', error.message);
    next(error);
  }
};

// RESET PASSWORD
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

    // Hash the new password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

    // Update password and clear reset token
    user.password = hashedPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    user.passwordLastRotated = new Date();
    user.loginAttempts = 0; // Reset login attempts
    user.lockUntil = undefined; // Unlock account if it was locked
    
    await user.save();

    console.log('✅ Password reset successfully for user:', user.email);

    // Send confirmation email
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

// CHANGE PASSWORD (for logged-in users)
export const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Current password and new password are required'
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 6 characters long'
      });
    }

    const user = await User.findById(req.user.id).select('+password');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isCurrentPasswordValid) {
      return res.status(400).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    // Check if new password is different from current
    if (currentPassword === newPassword) {
      return res.status(400).json({
        success: false,
        message: 'New password must be different from current password'
      });
    }

    // Hash and save new password
    const saltRounds = 12;
    user.password = await bcrypt.hash(newPassword, saltRounds);
    user.passwordLastRotated = new Date();
    await user.save();

    console.log('✅ Password changed successfully for user:', user.email);

    res.json({
      success: true,
      message: 'Password changed successfully'
    });

  } catch (error) {
    console.error('Change password error:', error.message);
    next(error);
  }
};

// OTP HELPER FUNCTION
const setOtpForUser = async (user) => {
  try {
    const code = generateNumericOtp(6);
    user.otpCode = code;
    user.otpExpiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);
    await user.save();

    // Send OTP through email
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