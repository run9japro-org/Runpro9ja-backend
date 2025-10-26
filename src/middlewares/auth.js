import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { ADMIN_ROLES } from '../constants/roles.js';
import {User} from '../models/User.js' // Import your User model

export const issueToken = (payload) => {
  if (!env.jwtSecret) {
    throw new Error("JWT secret is not defined in env");
  }

  return jwt.sign(
    payload,                  // e.g. { id, role }
    env.jwtSecret,            // secret from your env
    { expiresIn: env.jwtExpires || "1d" } // default to 1 day if not set
  );
};

export const authGuard = async (req, res, next) => {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    
    if (!token) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    // Verify token
    const decoded = jwt.verify(token, env.jwtSecret);
    
    // Fetch user from database
    const user = await User.findById(decoded.id).select('-password');
    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }

    // Attach full user document to request
    req.user = user;
    next();
  } catch (e) {
    console.error('Auth error:', e.message);
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
};

export const requireRoles = (...roles) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ message: 'Forbidden' });
  }
  next();
};

export const requireAdmin = (req, res, next) => {
  console.log('🛡️ RequireAdmin Middleware Debug:');
  console.log('Request user:', req.user);
  console.log('User role:', req.user?.role);
  console.log('User role type:', typeof req.user?.role);
  console.log('ADMIN_ROLES:', ADMIN_ROLES);
  console.log('Has admin role:', ADMIN_ROLES.has(req.user?.role));
  
  if (!req.user) {
    console.log('❌ No user found in request');
    return res.status(403).json({ message: 'Admin only - No user data' });
  }

  if (!ADMIN_ROLES.has(req.user.role)) {
    console.log('❌ Role not allowed. User role:', req.user.role, 'Allowed roles:', Array.from(ADMIN_ROLES));
    return res.status(403).json({ 
      message: 'Admin only',
      userRole: req.user.role,
      allowedRoles: Array.from(ADMIN_ROLES)
    });
  }

  console.log('✅ Admin access granted for role:', req.user.role);
  next();
};

export const isAgent = (req, res, next) => {
  if (!req.user || req.user.role !== "agent") {
    return res.status(403).json({ message: "Agents only" });
  }
  next();
};