import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { ROLES } from '../constants/roles.js';

const UserSchema = new mongoose.Schema(
  {
    role: {
      type: String,
      enum: Object.values(ROLES),
      required: true,
      index: true
    },
    username: { type: String, unique: true, sparse: true },
    fullName: { type: String, required: true },
    email: { type: String, lowercase: true, trim: true, index: true },
    phone: { type: String, trim: true, index: true },
    
    // ADD THESE MISSING FIELDS WITH PROPER VALIDATION:
    location: { 
      type: String, 
      required: function() {
        return this.role === ROLES.AGENT || this.role === ROLES.CUSTOMER;
      } 
    },
    dob: { 
      type: Date, 
      
      // validate: {
      //   validator: function(dob) {
      //     const age = Math.floor((new Date() - new Date(dob)) / (365.25 * 24 * 60 * 60 * 1000));
      //     return age >= 18; // Must be at least 18 years old
      //   },
      //   message: 'User must be at least 18 years old'
      // }
    },
    
    password: { type: String, minlength: 6, required: true, select: false },
    passwordLastRotated: { type: Date, default: Date.now },

    ProfileprofileImageId: { type: mongoose.Schema.Types.ObjectId },
    profileImage: { type: String },
    avatarUrl: { type: String },
    
    addresses: [
      {
        label: String,
        addressLine: String,
        city: String,
        state: String,
        country: String,
        lat: Number,
        lng: Number,
        isDefault: { type: Boolean, default: false }
      }
    ],
    
    resetPasswordToken: String,
    resetPasswordExpires: Date,

    walletBalance: { type: Number, default: 0 },
    bankAccount: {
      bankName: String,
      accountNumber: String,
      accountName: String,
      bankCode: { type: String },
      recipientCode: String,
    },
    
    isVerified: { type: Boolean, default: false },
    otpCode: { type: String, select: false },
    otpExpiresAt: { type: Date, select: false },

    // ✅ ADD THESE FIELDS FOR BETTER USER MANAGEMENT:
    status: {
      type: String,
      enum: ['active', 'inactive', 'suspended', 'pending'],
      default: 'active'
    },
    
    lastLogin: { type: Date },
    loginAttempts: { type: Number, default: 0 },
    lockUntil: { type: Date },
    
    preferences: {
      language: { type: String, default: 'en' },
      currency: { type: String, default: 'NGN' },
      notifications: {
        email: { type: Boolean, default: true },
        sms: { type: Boolean, default: true },
        push: { type: Boolean, default: true }
      }
    },

    // ✅ For agents specifically
    agentProfile: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AgentProfile'
    },

    // ✅ Statistics
    statistics: {
      totalOrders: { type: Number, default: 0 },
      completedOrders: { type: Number, default: 0 },
      cancelledOrders: { type: Number, default: 0 },
      totalSpent: { type: Number, default: 0 }
    }

  },
  { timestamps: true }
);

UserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

UserSchema.methods.comparePassword = async function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

// Method to check if account is locked
UserSchema.methods.isLocked = function() {
  return !!(this.lockUntil && this.lockUntil > Date.now());
};

// Virtual for user age
UserSchema.virtual('age').get(function() {
  if (!this.dob) return null;
  return Math.floor((new Date() - new Date(this.dob)) / (365.25 * 24 * 60 * 60 * 1000));
});

// Index for better query performance
UserSchema.index({ email: 1, role: 1 });
UserSchema.index({ phone: 1, role: 1 });
UserSchema.index({ status: 1, createdAt: -1 });

export const User = mongoose.model('User', UserSchema);