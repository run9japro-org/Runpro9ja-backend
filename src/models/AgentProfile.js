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
  availability: { 
    type: String,
    default: 'available' 
  },
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

  // ✅ ADD THESE FIELDS FOR WORKLOAD MANAGEMENT:
  currentWorkload: { 
    type: Number, 
    default: 0,
    min: 0
  },
  maxWorkload: { 
    type: Number, 
    default: 10, // Default maximum workload
    min: 1
  },
  workloadHistory: [{
    date: Date,
    workload: Number,
    completedTasks: Number
  }],

  // ✅ ADD THESE FIELDS FOR ASSIGNMENT TRACKING:
  assignedRequests: [{
    requestId: { type: mongoose.Schema.Types.ObjectId, ref: 'ServiceRequest' },
    assignedAt: { type: Date, default: Date.now },
    status: {
      type: String,
      enum: ['assigned', 'in-progress', 'completed', 'cancelled'],
      default: 'assigned'
    },
    completedAt: Date,
    customerRating: Number,
    customerFeedback: String
  }],

  // ✅ Performance metrics
  performance: {
    averageRating: { type: Number, default: 0 },
    responseTime: { type: Number, default: 0 }, // in minutes
    completionRate: { type: Number, default: 0 }, // percentage
    onTimeDelivery: { type: Number, default: 0 } // percentage
  },

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
  },

  // ✅ ADD THESE FIELDS FOR SPECIALIZATION:
  specialization: [{
    category: String,
    skills: [String],
    experience: Number, // years
    rating: Number
  }],

  // ✅ Availability schedule
  availabilitySchedule: {
    monday: { available: Boolean, start: String, end: String },
    tuesday: { available: Boolean, start: String, end: String },
    wednesday: { available: Boolean, start: String, end: String },
    thursday: { available: Boolean, start: String, end: String },
    friday: { available: Boolean, start: String, end: String },
    saturday: { available: Boolean, start: String, end: String },
    sunday: { available: Boolean, start: String, end: String }
  },

  // ✅ Contact preferences
  contactPreferences: {
    email: { type: Boolean, default: true },
    sms: { type: Boolean, default: true },
    push: { type: Boolean, default: true }
  },

  // ✅ Statistics
  statistics: {
    totalEarnings: { type: Number, default: 0 },
    jobsThisMonth: { type: Number, default: 0 },
    jobsThisWeek: { type: Number, default: 0 },
    averageJobTime: { type: Number, default: 0 } // in minutes
  }

}, { timestamps: true });

// Index for better query performance
AgentProfileSchema.index({ 'currentLocation': '2dsphere' });
AgentProfileSchema.index({ availability: 1, currentWorkload: 1 });
AgentProfileSchema.index({ isVerified: 1, rating: -1 });

// Virtual for utilization percentage
AgentProfileSchema.virtual('utilization').get(function() {
  return this.maxWorkload > 0 ? (this.currentWorkload / this.maxWorkload) * 100 : 0;
});

// Method to check if agent can accept more work
AgentProfileSchema.methods.canAcceptWork = function() {
  return this.availability === 'available' && this.currentWorkload < this.maxWorkload;
};

// Method to update workload
AgentProfileSchema.methods.updateWorkload = function(change) {
  this.currentWorkload += change;
  if (this.currentWorkload < 0) this.currentWorkload = 0;
  if (this.currentWorkload > this.maxWorkload) this.currentWorkload = this.maxWorkload;
  
  // Update availability based on workload
  if (this.currentWorkload >= this.maxWorkload) {
    this.availability = 'busy';
  } else if (this.availability === 'busy' && this.currentWorkload < this.maxWorkload) {
    this.availability = 'available';
  }
};

export const AgentProfile = mongoose.model('AgentProfile', AgentProfileSchema);