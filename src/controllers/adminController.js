// controllers/adminController.js
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { User } from '../models/User.js';
import { AgentProfile } from '../models/AgentProfile.js'; // Updated import
import  Order  from '../models/Order.js';
import { Payment } from '../models/Payment.js';
import { sendEmail } from '../services/emailService.js';
import { ROLES } from '../constants/roles.js';

const SALT_ROUNDS = 12;

// Helper: generate a safe random temporary password
const generateTempPassword = (len = 10) =>
  crypto.randomBytes(Math.ceil(len * 3 / 4)).toString('base64').slice(0, len);

// ==================== SUPER ADMIN & ADMIN HEAD ONLY ====================

// POST /api/admins  (create new admin) -> only SUPER_ADMIN or ADMIN_HEAD
export const createAdmin = async (req, res, next) => {
  try {
    const creatorUser = req.user;
    if (![ROLES.SUPER_ADMIN, ROLES.ADMIN_HEAD].includes(creatorUser.role)) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    const { email, fullName, role } = req.body;
    if (!email || !fullName || !role) {
      return res.status(400).json({ message: 'Missing required fields: email, fullName, role' });
    }

    const allowedRoles = [ROLES.ADMIN_HEAD, ROLES.ADMIN_AGENT_SERVICE, ROLES.ADMIN_CUSTOMER_SERVICE];
    if (!allowedRoles.includes(role)) {
      return res.status(400).json({ message: 'Invalid role for admin creation' });
    }

    const existing = await User.findOne({ email });
    if (existing) return res.status(409).json({ message: 'User already exists' });

    const tempPassword = generateTempPassword(12);
    const hashed = await bcrypt.hash(tempPassword, SALT_ROUNDS);

    const newAdmin = await User.create({
      email,
      fullName,
      password: hashed,
      role,
      isVerified: true,
    });

    try {
      await sendEmail({
        to: email,
        subject: 'Admin account created',
        html: `<p>Hello ${fullName},</p>
               <p>An admin account was created for you. Use the temporary password below to log in and change it immediately:</p>
               <p><b>${tempPassword}</b></p>
               <p>Please change your password after first login.</p>`
      });
    } catch (err) {
      console.error('Failed to send admin creation email:', err.message || err);
    }

    return res.status(201).json({
      success: true,
      message: 'Admin created',
      admin: {
        id: newAdmin._id,
        email: newAdmin.email,
        fullName: newAdmin.fullName,
        role: newAdmin.role,
      },
      tempPassword
    });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/admins/:id (delete an admin) -> only SUPER_ADMIN
export const deleteAdmin = async (req, res, next) => {
  try {
    const requester = req.user;
    if (requester.role !== ROLES.SUPER_ADMIN) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    const { id } = req.params;
    const admin = await User.findById(id);
    if (!admin) return res.status(404).json({ message: 'Admin not found' });

    if (![ROLES.ADMIN_HEAD, ROLES.ADMIN_AGENT_SERVICE, ROLES.ADMIN_CUSTOMER_SERVICE].includes(admin.role)) {
      return res.status(400).json({ message: 'Target user is not an admin' });
    }

    await admin.remove();
    return res.json({ success: true, message: 'Admin removed' });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/admins/accounts/:id (delete any user account) -> SUPER_ADMIN & ADMIN_HEAD
export const deleteUserAccount = async (req, res, next) => {
  try {
    const requester = req.user;
    if (![ROLES.SUPER_ADMIN, ROLES.ADMIN_HEAD].includes(requester.role)) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    const { id } = req.params;
    const user = await User.findById(id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    // Prevent deletion of super admin by non-super admin
    if (user.role === ROLES.SUPER_ADMIN && requester.role !== ROLES.SUPER_ADMIN) {
      return res.status(403).json({ message: 'Cannot delete super admin account' });
    }

    await user.remove();
    return res.json({ success: true, message: 'User account deleted' });
  } catch (err) {
    next(err);
  }
};

// ==================== COMPANY ANALYSIS & DASHBOARD ====================

// GET /api/admins/analytics/summary -> SUPER_ADMIN, ADMIN_HEAD, ADMIN_AGENT_SERVICE
export const getCompanyAnalytics = async (req, res, next) => {
  try {
    const requester = req.user;
    const allowedRoles = [ROLES.SUPER_ADMIN, ROLES.ADMIN_HEAD, ROLES.ADMIN_AGENT_SERVICE];
    if (!allowedRoles.includes(requester.role)) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    const { period = 'week' } = req.query; // week, month, year
    const now = new Date();
    let startDate;

    switch (period) {
      case 'week':
        startDate = new Date(now.setDate(now.getDate() - 7));
        break;
      case 'month':
        startDate = new Date(now.setMonth(now.getMonth() - 1));
        break;
      case 'year':
        startDate = new Date(now.setFullYear(now.getFullYear() - 1));
        break;
      default:
        startDate = new Date(now.setDate(now.getDate() - 7));
    }

    // Get total counts
    const totalUsers = await User.countDocuments();
    const totalAgents = await AgentProfile.countDocuments();
    const totalOrders = await Order.countDocuments();
    const totalRevenue = await Payment.aggregate([
      { $match: { status: 'success' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    // Get period-specific data
    const newUsers = await User.countDocuments({ createdAt: { $gte: startDate } });
    const newAgents = await AgentProfile.countDocuments({ createdAt: { $gte: startDate } });
    const periodOrders = await Order.countDocuments({ createdAt: { $gte: startDate } });
    const periodRevenue = await Payment.aggregate([
      { $match: { status: 'success', createdAt: { $gte: startDate } } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    // Service breakdown
    const serviceBreakdown = await Order.aggregate([
      { $match: { createdAt: { $gte: startDate } } },
      { $group: { _id: '$serviceCategory', count: { $sum: 1 } } }
    ]);

    // Weekly services (last 4 weeks)
    const weeklyServices = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: new Date(now.setDate(now.getDate() - 28)) }
        }
      },
      {
        $group: {
          _id: {
            week: { $week: '$createdAt' },
            year: { $year: '$createdAt' }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.week': 1 } }
    ]);

    res.json({
      success: true,
      analytics: {
        period,
        totals: {
          users: totalUsers,
          agents: totalAgents,
          orders: totalOrders,
          revenue: totalRevenue[0]?.total || 0
        },
        periodStats: {
          newUsers,
          newAgents,
          orders: periodOrders,
          revenue: periodRevenue[0]?.total || 0
        },
        serviceBreakdown,
        weeklyServices
      }
    });
  } catch (err) {
    next(err);
  }
};

// ==================== AGENT MANAGEMENT ====================

// GET /api/admins/agents -> SUPER_ADMIN, ADMIN_HEAD, ADMIN_AGENT_SERVICE
export const getAllAgents = async (req, res, next) => {
  try {
    const requester = req.user;
    const allowedRoles = [ROLES.SUPER_ADMIN, ROLES.ADMIN_HEAD, ROLES.ADMIN_AGENT_SERVICE];
    if (!allowedRoles.includes(requester.role)) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    const { page = 1, limit = 20, status, search } = req.query;
    const skip = (page - 1) * limit;

    let query = {};
    if (status) query.verificationStatus = status;
    if (search) {
      query.$or = [
        { bio: { $regex: search, $options: 'i' } },
        { serviceType: { $regex: search, $options: 'i' } },
        { summary: { $regex: search, $options: 'i' } }
      ];
    }

    const agents = await AgentProfile.find(query)
      .populate('user', 'fullName email phone profileImage')
      .populate('services')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await AgentProfile.countDocuments(query);

    res.json({
      success: true,
      agents,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (err) {
    next(err);
  }
};

// PUT /api/admins/agents/:id/verify -> SUPER_ADMIN, ADMIN_HEAD, ADMIN_AGENT_SERVICE
export const verifyAgent = async (req, res, next) => {
  try {
    const requester = req.user;
    const allowedRoles = [ROLES.SUPER_ADMIN, ROLES.ADMIN_HEAD, ROLES.ADMIN_AGENT_SERVICE];
    if (!allowedRoles.includes(requester.role)) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    const { id } = req.params;
    const { status, notes } = req.body; // status: 'verified', 'rejected', 'pending'

    const agent = await AgentProfile.findById(id);
    if (!agent) return res.status(404).json({ message: 'Agent not found' });

    // Add verification fields to AgentProfile
    agent.isVerified = status === 'verified';
    agent.verificationStatus = status;
    agent.verificationNotes = notes || '';
    agent.verifiedAt = status === 'verified' ? new Date() : null;
    agent.verifiedBy = requester.id;

    await agent.save();

    // Notify agent via email
    try {
      const user = await User.findById(agent.user);
      if (user) {
        await sendEmail({
          to: user.email,
          subject: `Agent Verification ${status}`,
          html: `<p>Hello ${user.fullName},</p>
                 <p>Your agent verification has been <b>${status}</b>.</p>
                 ${notes ? `<p>Notes: ${notes}</p>` : ''}
                 <p>Thank you for using our platform.</p>`
        });
      }
    } catch (err) {
      console.error('Failed to send verification email:', err);
    }

    res.json({
      success: true,
      message: `Agent ${status} successfully`,
      agent
    });
  } catch (err) {
    next(err);
  }
};

// ==================== SERVICE REQUEST MANAGEMENT ====================

// GET /api/admins/service-requests -> SUPER_ADMIN, ADMIN_HEAD, ADMIN_AGENT_SERVICE, ADMIN_CUSTOMER_SERVICE
export const getAllServiceRequests = async (req, res, next) => {
  try {
    const requester = req.user;
    const allowedRoles = [ROLES.SUPER_ADMIN, ROLES.ADMIN_HEAD, ROLES.ADMIN_AGENT_SERVICE, ROLES.ADMIN_CUSTOMER_SERVICE];
    if (!allowedRoles.includes(requester.role)) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    const { page = 1, limit = 20, status, serviceType, dateFrom, dateTo } = req.query;
    const skip = (page - 1) * limit;

    let query = {};
    if (status) query.status = status;
    if (serviceType) query.serviceType = serviceType;
    if (dateFrom || dateTo) {
      query.createdAt = {};
      if (dateFrom) query.createdAt.$gte = new Date(dateFrom);
      if (dateTo) query.createdAt.$lte = new Date(dateTo);
    }

    const orders = await Order.find(query)
      .populate('customer', 'fullName email phone')
      .populate('agent', 'user')
      .populate('serviceCategory')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Order.countDocuments(query);

    res.json({
      success: true,
      orders,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (err) {
    next(err);
  }
};

// ==================== EMPLOYEE MANAGEMENT ====================

// GET /api/admins/employees -> SUPER_ADMIN, ADMIN_HEAD
export const getAllEmployees = async (req, res, next) => {
  try {
    const requester = req.user;
    if (![ROLES.SUPER_ADMIN, ROLES.ADMIN_HEAD].includes(requester.role)) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    const { page = 1, limit = 20, role } = req.query;
    const skip = (page - 1) * limit;

    let query = {
      role: { $in: [ROLES.ADMIN_HEAD, ROLES.ADMIN_AGENT_SERVICE, ROLES.ADMIN_CUSTOMER_SERVICE] }
    };
    if (role) query.role = role;

    const employees = await User.find(query)
      .select('-password -otpCode -otpExpiresAt')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await User.countDocuments(query);

    res.json({
      success: true,
      employees,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (err) {
    next(err);
  }
};

// ==================== PAYMENT MANAGEMENT ====================

// GET /api/admins/payments -> SUPER_ADMIN, ADMIN_HEAD
export const getPaymentDetails = async (req, res, next) => {
  try {
    const requester = req.user;
    if (![ROLES.SUPER_ADMIN, ROLES.ADMIN_HEAD].includes(requester.role)) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    const { page = 1, limit = 20, status, dateFrom, dateTo } = req.query;
    const skip = (page - 1) * limit;

    let query = {};
    if (status) query.status = status;
    if (dateFrom || dateTo) {
      query.createdAt = {};
      if (dateFrom) query.createdAt.$gte = new Date(dateFrom);
      if (dateTo) query.createdAt.$lte = new Date(dateTo);
    }

    const payments = await Payment.find(query)
      .populate('user', 'fullName email')
      .populate('order')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Payment.countDocuments(query);

    // Payment statistics
    const totalRevenue = await Payment.aggregate([
      { $match: { status: 'success', ...query } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    const successCount = await Payment.countDocuments({ status: 'success', ...query });
    const failedCount = await Payment.countDocuments({ status: 'failed', ...query });
    const pendingCount = await Payment.countDocuments({ status: 'pending', ...query });

    res.json({
      success: true,
      payments,
      statistics: {
        totalRevenue: totalRevenue[0]?.total || 0,
        successCount,
        failedCount,
        pendingCount,
        totalCount: total
      },
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (err) {
    next(err);
  }
};

// ==================== COMPLAINT MANAGEMENT ====================

// GET /api/admins/complaints -> SUPER_ADMIN, ADMIN_HEAD, ADMIN_CUSTOMER_SERVICE
export const getComplaints = async (req, res, next) => {
  try {
    const requester = req.user;
    const allowedRoles = [ROLES.SUPER_ADMIN, ROLES.ADMIN_HEAD, ROLES.ADMIN_CUSTOMER_SERVICE];
    if (!allowedRoles.includes(requester.role)) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    const { page = 1, limit = 20, status, type } = req.query;
    const skip = (page - 1) * limit;

    let query = {};
    if (status) query.status = status;
    if (type) query.type = type;

    // For now, return empty array until Complaint model is created
    const complaints = [];

    res.json({
      success: true,
      complaints,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(complaints.length / limit),
        total: complaints.length
      }
    });
  } catch (err) {
    next(err);
  }
};

// ==================== EXISTING METHODS ====================

// PUT /api/admins/:id/reset-password
export const resetAdminPassword = async (req, res, next) => {
  try {
    const requester = req.user;
    if (![ROLES.SUPER_ADMIN, ROLES.ADMIN_HEAD].includes(requester.role)) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    const { id } = req.params;
    const admin = await User.findById(id);
    if (!admin) return res.status(404).json({ message: 'Admin not found' });

    const newTemp = generateTempPassword(12);
    admin.password = await bcrypt.hash(newTemp, SALT_ROUNDS);
    await admin.save();

    try {
      await sendEmail({
        to: admin.email,
        subject: 'Your admin password was reset',
        html: `<p>Hello ${admin.fullName || ''},</p>
               <p>Your password was reset by an administrator. Your temporary password is:</p>
               <p><b>${newTemp}</b></p>
               <p>Please change it after login.</p>`
      });
    } catch (err) {
      console.error('Failed to email reset password', err.message || err);
    }

    return res.json({ success: true, message: 'Password reset. Temporary password emailed.' });
  } catch (err) {
    next(err);
  }
};

// PUT /api/admins/me/change-password
export const changeMyPassword = async (req, res, next) => {
  try {
    const adminId = req.user.id;
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Missing current or new password' });
    }
    const admin = await User.findById(adminId).select('+password');
    if (!admin) return res.status(404).json({ message: 'User not found' });

    const ok = await admin.comparePassword(currentPassword);
    if (!ok) return res.status(401).json({ message: 'Current password incorrect' });

    admin.password = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await admin.save();

    return res.json({ success: true, message: 'Password updated' });
  } catch (err) {
    next(err);
  }
};

// GET /api/admins
export const listAdmins = async (req, res, next) => {
  try {
    const requester = req.user;
    if (![ROLES.SUPER_ADMIN, ROLES.ADMIN_HEAD].includes(requester.role)) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    const admins = await User.find({ role: { $in: [ROLES.ADMIN_HEAD, ROLES.ADMIN_AGENT_SERVICE, ROLES.ADMIN_CUSTOMER_SERVICE] } })
      .select('-password -otpCode -otpExpiresAt')
      .sort({ createdAt: -1 });

    return res.json(admins);
  } catch (err) {
    next(err);
  }
};