// models/AgentProfile.js
import mongoose from 'mongoose';

const AgentProfileSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  bio: { type: String },
  profileImage: { type: String },
  services: [{ type: mongoose.Schema.Types.ObjectId, ref: 'ServiceCategory' }],

  // ✅ Common fields for all services
  serviceType: { type: String },
  yearsOfExperience: { type: String },
  availability: { type: String },
  summary: { type: String },

  // ✅ Service-specific fields
  servicesOffered: { type: String },
  areasOfExpertise: { type: String },
  tasksHandled: { type: String },
  skills: { type: String },
  certification: { type: String },
  subCategory: { type: String },
  ageRange: { type: String },
  tools: { type: String },

  rating: { type: Number, default: 0 },
  completedJobs: { type: Number, default: 0 },
  isVerified: { type: Boolean, default: false },

  // ✅ Verification details
  verificationStatus: {
    type: String,
    enum: ['pending', 'verified', 'rejected'],
    default: 'pending'
  },
  verificationNotes: { type: String, default: '' },
  verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  verifiedAt: { type: Date },

  documents: [String],

  location: {
    city: String,
    state: String,
    country: String
  },

  // ✅ Correct way to store real-time coordinates
  currentLocation: {
    lat: { type: Number },
    lng: { type: Number },
    lastUpdated: { type: Date, default: Date.now }
  }

}, { timestamps: true });

export const AgentProfile = mongoose.model('AgentProfile', AgentProfileSchema);
