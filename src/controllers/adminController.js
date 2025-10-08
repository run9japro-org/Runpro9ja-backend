// controllers/adminController.js
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { User } from '../models/User.js';
import { sendEmail } from '../services/emailService.js';
import { ROLES } from '../constants/roles.js';

const SALT_ROUNDS = 12;

// Helper: generate a safe random temporary password
const generateTempPassword = (len = 10) =>
  crypto.randomBytes(Math.ceil(len * 3 / 4)).toString('base64').slice(0, len);

// POST /api/admins  (create new admin) -> only SUPER_ADMIN or ADMIN_HEAD
export const createAdmin = async (req, res, next) => {
  try {
    const creatorUser = req.user; // set by authGuard
    // Only super admin or admin head creates other admins
    if (![ROLES.SUPER_ADMIN, ROLES.ADMIN_HEAD].includes(creatorUser.role)) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    const { email, fullName, role } = req.body;
    if (!email || !fullName || !role) {
      return res.status(400).json({ message: 'Missing required fields: email, fullName, role' });
    }

    // ensure role is an admin role
    const allowedRoles = [ROLES.ADMIN_HEAD, ROLES.ADMIN_AGENT_SERVICE, ROLES.ADMIN_CUSTOMER_SERVICE];
    if (!allowedRoles.includes(role)) {
      return res.status(400).json({ message: 'Invalid role for admin creation' });
    }

    // prevent duplicate accounts
    const existing = await User.findOne({ email });
    if (existing) return res.status(409).json({ message: 'User already exists' });

    // generate temp password and hash
    const tempPassword = generateTempPassword(12);
    const hashed = await bcrypt.hash(tempPassword, SALT_ROUNDS);

    const newAdmin = await User.create({
      email,
      fullName,
      password: hashed,
      role,
      isVerified: true, // admin accounts can be considered verified
    });

    // email the temporary password (or send a link)
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
      // don't fail creation if email fails; log and return the temp password in response in development
      console.error('Failed to send admin creation email:', err.message || err);
    }

    // Return admin info (do not return password)
    return res.status(201).json({
      success: true,
      message: 'Admin created',
      admin: {
        id: newAdmin._id,
        email: newAdmin.email,
        fullName: newAdmin.fullName,
        role: newAdmin.role,
      },
      // for testing/dev you might return tempPassword — remove in production
      tempPassword
    });
  } catch (err) {
    next(err);
  }
};

// PUT /api/admins/:id/reset-password  (force reset by super admin)
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

// PUT /api/admins/me/change-password  (admin changes THEIR own password)
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

// GET /api/admins  (list admins) -> ADMIN_HEAD or SUPER_ADMIN
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
