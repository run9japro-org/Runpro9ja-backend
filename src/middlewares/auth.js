import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { ADMIN_ROLES } from '../constants/roles.js';


export const issueToken = (payload) =>
jwt.sign(payload, env.jwtSecret, { expiresIn: env.jwtExpires });


export const authGuard = (req, res, next) => {
const header = req.headers.authorization || '';
const token = header.startsWith('Bearer ') ? header.slice(7) : null;
if (!token) return res.status(401).json({ message: 'Unauthorized' });
try {
req.user = jwt.verify(token, env.jwtSecret);
next();
} catch (e) {
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
if (!req.user || !ADMIN_ROLES.has(req.user.role)) {
return res.status(403).json({ message: 'Admin only' });
}
next();
};

// ✅ Add this:
export const isAgent = (req, res, next) => {
  if (!req.user || req.user.role !== "agent") {
    return res.status(403).json({ message: "Agents only" });
  }
  next();
};