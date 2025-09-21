import { User } from '../models/User.js';
import { generateNumericOtp } from '../utils/generateOtp.js';
import { sendEmailOtp, sendSmsOtp } from '../services/otpService.js';
import { issueToken } from '../middlewares/auth.js';

const OTP_TTL_MINUTES = 10;


const setOtpForUser = async (user) => {
const code = generateNumericOtp(6);
user.otpCode = code; // For production, store hashed. MVP keeps plain.
user.otpExpiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);
await user.save();
if (user.email) await sendEmailOtp({ to: user.email, name: user.fullName, code });
if (user.phone) await sendSmsOtp({ to: user.phone, code });
};


export const register = async (req, res, next) => {
try {
const { role, fullName, email,location,dob, phone, password } = req.body;
if (!role || !fullName || !password || !location || !dob || !email || !phone) {
      return res.status(400).json({ message: "Missing required fields" });
    }


const existing = await User.findOne({ $or: [{ email }, { phone }] });
if (existing) return res.status(409).json({ message: 'User already exists' });


const user = await User.create({ role, fullName, email, phone, password,location,dob });
await setOtpForUser(user);


res.status(201).json({
  success: true,
message: 'Registered. OTP sent. Verify to continue.',
userId: user._id
});
} catch (e) { next(e); }
};

export const login = async (req, res, next) => {
try {
const { identifier, password } = req.body; // identifier = email or phone
if (!identifier || !password) return res.status(400).json({ message: 'Missing credentials' });


const user = await User.findOne({ $or: [{ email: identifier }, { phone: identifier }] }).select('+password');
if (!user) return res.status(404).json({ message: 'User not found' });


const ok = await user.comparePassword(password);
if (!ok) return res.status(401).json({ message: 'Invalid credentials' });


if (!user.isVerified) {
await setOtpForUser(user);
return res.status(403).json({ message: 'Account not verified. OTP re-sent.', needsVerification: true, userId: user._id });
}


const token = issueToken({ id: user._id, role: user.role, name: user.fullName });
res.json({ message: 'Login successful', token });
} catch (e) { next(e); }
};


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
res.json({ message: 'Verification successful', token });
} catch (e) { next(e); }
};
export const resendOtp = async (req, res, next) => {
try {
const { userId } = req.body;
const user = await User.findById(userId);
if (!user) return res.status(404).json({ message: 'User not found' });
await setOtpForUser(user);
res.json({ message: 'OTP re-sent' });
} catch (e) { next(e); }
};


export const me = async (req, res, next) => {
try {
res.json({ id: req.user.id, role: req.user.role, name: req.user.name });
} catch (e) { next(e); }
};

// GET /customers/me
export const getMyProfile = async (req, res) => {
  const user = await User.findById(req.user.id).select('-password -otpCode -otpExpiresAt');
  res.json(user);
};

// PUT /customers/me
export const updateMyProfile = async (req, res) => {
  const updates = (({ fullName, phone, avatarUrl, addresses, }) => 
    ({ fullName, phone, avatarUrl, addresses }))(req.body);

  const user = await User.findByIdAndUpdate(req.user.id, updates, { new: true })
    .select('-password -otpCode -otpExpiresAt');

  res.json(user);
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