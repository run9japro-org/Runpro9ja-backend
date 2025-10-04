import { User } from '../models/User.js';
import { generateNumericOtp } from '../utils/generateOtp.js';
import { sendOtpBothChannels, sendSmsOtp, sendEmailOtp } from '../services/otpService.js';
import { issueToken } from '../middlewares/auth.js';

const OTP_TTL_MINUTES = 10;

// Generate and send OTP via both SMS and Email
const setOtpForUser = async (user) => {
  try {
    const code = generateNumericOtp(6);
    user.otpCode = code;
    user.otpExpiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);
    await user.save();

    // Send OTP through both channels
    const otpResults = await sendOtpBothChannels({
      to: user.email,
      name: user.fullName,
      code: code,
      phone: user.phone
    });

    return otpResults;
  } catch (error) {
    console.error('Error in setOtpForUser:', error.message);
    throw error;
  }
};

export const register = async (req, res, next) => {
  try {
    const { role, fullName, email, location, dob, phone, password } = req.body;
    
    console.log('🔍 Registration attempt:', { 
      email: email, 
      phone: phone, 
      fullName: fullName 
    });

    if (!role || !fullName || !password || !location || !dob || !phone || !email) {
      console.log('❌ Missing required fields');
      return res.status(400).json({ 
        success: false,
        message: "All required fields must be provided" 
      });
    }

    console.log('🔎 Checking for existing user...');
    const existing = await User.findOne({ $or: [{ email }, { phone }] });
    
    if (existing) {
      console.log('❌ User already exists:', {
        existingEmail: existing.email,
        existingPhone: existing.phone,
        existingId: existing._id,
        inputEmail: email,
        inputPhone: phone
      });
      
      return res.status(409).json({ 
        success: false,
        message: 'User with this email or phone already exists',
        existingUser: {
          email: existing.email,
          phone: existing.phone
        }
      });
    }

    console.log('✅ No existing user found, creating new user...');
    const user = await User.create({ role, fullName, email, phone, password, location, dob });
    console.log('✅ User created successfully:', user._id);
    
    try {
      console.log('🔄 Generating and sending OTP...');
      const otpResults = await setOtpForUser(user);
      
      console.log('📊 OTP Results:', otpResults);
      
      let message = 'Registered successfully. ';
      
      if (otpResults.allSuccessful) {
        message += 'OTP sent via both SMS and email.';
      } else if (otpResults.partialSuccess) {
        if (otpResults.email.success && !otpResults.sms.success) {
          message += 'OTP sent via email. SMS delivery failed.';
        } else if (otpResults.sms.success && !otpResults.email.success) {
          message += 'OTP sent via SMS. Email delivery failed.';
        }
      } else {
        message += 'OTP delivery failed for both channels. Please try resending OTP.';
      }

      res.status(201).json({
        success: true,
        message: message,
        userId: user._id,
        otpDelivery: {
          email: otpResults.email.success,
          sms: otpResults.sms.success
        }
      });
    } catch (otpError) {
      console.error('OTP delivery failed:', otpError.message);
      res.status(201).json({
        success: true,
        message: 'Registered successfully, but OTP delivery failed. Please try logging in to resend OTP.',
        userId: user._id,
        warning: 'OTP_DELIVERY_FAILED'
      });
    }
    
  } catch (error) {
    console.error('Registration error:', error.message);
    next(error);
  }
};

export const login = async (req, res, next) => {
  try {
    const { identifier, password } = req.body;
    
    if (!identifier || !password) {
      return res.status(400).json({ 
        success: false,
        message: 'Email/phone and password are required' 
      });
    }

    const user = await User.findOne({ 
      $or: [{ email: identifier }, { phone: identifier }] 
    }).select('+password');
    
    if (!user) {
      return res.status(404).json({ 
        success: false,
        message: 'User not found' 
      });
    }

    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({ 
        success: false,
        message: 'Invalid credentials' 
      });
    }

    if (!user.isVerified) {
      try {
        const otpResults = await setOtpForUser(user);
        
        let message = 'Account not verified. ';
        
        if (otpResults.allSuccessful) {
          message += 'OTP re-sent via both SMS and email.';
        } else if (otpResults.partialSuccess) {
          if (otpResults.email.success && !otpResults.sms.success) {
            message += 'OTP re-sent via email. SMS delivery failed.';
          } else if (otpResults.sms.success && !otpResults.email.success) {
            message += 'OTP re-sent via SMS. Email delivery failed.';
          }
        } else {
          message += 'OTP delivery failed. Please try resending.';
        }

        return res.status(403).json({
          success: false,
          message: message,
          needsVerification: true,
          userId: user._id,
          otpDelivery: {
            email: otpResults.email.success,
            sms: otpResults.sms.success
          }
        });
      } catch (otpError) {
        console.error('OTP resend failed during login:', otpError.message);
        return res.status(403).json({
          success: false,
          message: 'Account not verified. Please try resending OTP.',
          needsVerification: true,
          userId: user._id,
          warning: 'OTP_SEND_FAILED'
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
        email: user.email,
        phone: user.phone
      }
    });
    
  } catch (error) {
    console.error('Login error:', error.message);
    next(error);
  }
};

export const resendOtp = async (req, res, next) => {
  try {
    const { userId } = req.body;
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({ 
        success: false,
        message: 'User not found' 
      });
    }

    const otpResults = await setOtpForUser(user);
    
    let message = '';
    
    if (otpResults.allSuccessful) {
      message = 'OTP re-sent via both SMS and email.';
    } else if (otpResults.partialSuccess) {
      if (otpResults.email.success && !otpResults.sms.success) {
        message = 'OTP re-sent via email. SMS delivery failed.';
      } else if (otpResults.sms.success && !otpResults.email.success) {
        message = 'OTP re-sent via SMS. Email delivery failed.';
      }
    } else {
      message = 'OTP delivery failed for both channels. Please try again.';
    }

    res.json({
      success: otpResults.partialSuccess || otpResults.allSuccessful,
      message: message,
      otpDelivery: {
        email: otpResults.email.success,
        sms: otpResults.sms.success
      }
    });
  } catch (e) {
    console.error('Resend OTP error:', e.message);
    next(e);
  }
};

// ... keep your existing verifyOtp, me, getMyProfile, etc. functions

export const verifyOtp = async (req, res, next) => {
  try {
    const { userId, code } = req.body;
    const user = await User.findById(userId).select('+otpCode +otpExpiresAt');
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (!user.otpCode || !user.otpExpiresAt || user.otpExpiresAt < new Date()) {
      return res.status(400).json({ message: 'OTP expired. Please resend.' });
    }

    if (String(code) !== String(user.otpCode)) {
      return res.status(400).json({ message: 'Invalid OTP' });
    }

    user.isVerified = true;
    user.otpCode = undefined;
    user.otpExpiresAt = undefined;
    await user.save();

    const token = issueToken({ id: user._id, role: user.role, name: user.fullName });
    res.json({
      success: true,
      message: 'Verification successful',
      token
    });
  } catch (e) { next(e); }
};

export const me = async (req, res, next) => {
  try {
    res.json({ id: req.user.id, role: req.user.role, name: req.user.name,email: req.user.email});
  } catch (e) { next(e); }
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

// GET /customers/me/history
export const getMyServiceHistory = async (req, res) => {
  try {
    const orders = await Order.find({ customer: req.user.id })
      .populate('agent', 'fullName role avatarUrl')
      .sort({ createdAt: -1 });

    res.json(orders);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
