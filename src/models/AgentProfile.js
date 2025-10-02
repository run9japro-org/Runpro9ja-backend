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
  servicesOffered: { type: String }, // Used by Errand, Professional, Cleaning
  areasOfExpertise: { type: String }, // Used by Errand
  tasksHandled: { type: String }, // Used by Personal Assistance
  skills: { type: String }, // Used by Personal Assistance & Babysitting
  certification: { type: String }, // Used by Professional
  subCategory: { type: String }, // Used by Professional
  ageRange: { type: String }, // Used by Babysitting
  tools: { type: String }, // Used by Cleaning
  
  rating: { type: Number, default: 0 },
  completedJobs: { type: Number, default: 0 },
  isVerified: { type: Boolean, default: false },
  documents: [String],
  location: {
    city: String,
    state: String,
    country: String
  },
}, { timestamps: true });

export const AgentProfile = mongoose.model('AgentProfile', AgentProfileSchema);
