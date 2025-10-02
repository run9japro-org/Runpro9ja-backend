import { AgentProfile } from '../models/AgentProfile.js';
import { ServiceCategory } from '../models/ServiceCategory.js';
import { User } from '../models/User.js';
import multer from "multer";
import path from "path";

export const createOrUpdateProfile = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const payload = req.body;

    // ✅ Optional: Add validation for services array if needed
    if (payload.services && !Array.isArray(payload.services)) {
      return res.status(400).json({ message: "Services must be an array" });
    }

    let profile = await AgentProfile.findOne({ user: userId });

    if (!profile) {
      profile = await AgentProfile.create({ user: userId, ...payload });
    } else {
      Object.assign(profile, payload);
      await profile.save();
    }

    const populatedProfile = await profile.populate("user services", "fullName email phone");
    res.json(populatedProfile);
  } catch (e) {
    next(e);
  }
};




const storage = multer.diskStorage({
  destination: "./uploads/",
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});

export const upload = multer({ storage });

export const uploadimage = async (req, res) => {
  try {
    const profile = await AgentProfile.findOneAndUpdate(
      { user: req.user.id },
      { profileImage: `/uploads/${req.file.filename}` },
      { new: true, upsert: true }
    ).populate("user services", "fullName email phone"); // ✅ return with user info

    res.json({ message: "Profile image uploaded", profile });
  } catch (err) {
    res.status(500).json({ message: "Upload failed", error: err.message });
  }
};



export const getMyProfile = async (req, res, next) => {
try {
const profile = await AgentProfile.findOne({ user: req.user.id }).populate('services');
if (!profile) return res.status(404).json({ message: 'Profile not found' });
res.json(profile);
} catch (e) { next(e); }
};


export const getAgentProfile = async (req, res, next) => {
try {
const profile = await AgentProfile.findOne({ user: req.params.userId }).populate('services');
if (!profile) return res.status(404).json({ message: 'Profile not found' });
res.json(profile);
} catch (e) { next(e); }
};


export const assignServiceToAgent = async (req, res, next) => {
try {
const { agentUserId } = req.params;
const { categoryId } = req.body;
const profile = await AgentProfile.findOne({ user: agentUserId });
if (!profile) return res.status(404).json({ message: 'Agent profile not found' });
const cat = await ServiceCategory.findById(categoryId);
if (!cat) return res.status(404).json({ message: 'Category not found' });
if (!profile.services.includes(cat._id)) {
profile.services.push(cat._id);
await profile.save();
}
res.json(profile);
} catch (e) { next(e); }
};


export const unassignServiceFromAgent = async (req, res, next) => {
try {
const { agentUserId } = req.params;
const { categoryId } = req.body;
const profile = await AgentProfile.findOne({ user: agentUserId });
if (!profile) return res.status(404).json({ message: 'Agent profile not found' });
profile.services = profile.services.filter(id => String(id) !== String(categoryId));
await profile.save();
res.json(profile);
} catch (e) { next(e); }
};