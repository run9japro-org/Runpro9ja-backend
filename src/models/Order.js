// models/Order.js - FIXED VERSION
import mongoose from 'mongoose';

// In models/Order.js - update the status enum
const statusSchema = new mongoose.Schema({
  status: { 
    type: String, 
    enum: [
      'pending_agent_response',
      'requested', 
      'inspection_scheduled', 
      'inspection_completed',
      'quotation_provided', 
      'quotation_accepted',
      'agent_selected',
      'accepted', 
      'rejected', 
      'in-progress', 
      'completed', 
      'cancelled',
      'public'
    ],
    required: true 
  },
  timestamp: { type: Date, default: Date.now },
  note: { type: String }
});

const orderSchema = new mongoose.Schema({
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  agent: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  representative: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  serviceCategory: { type: mongoose.Schema.Types.ObjectId, ref: 'ServiceCategory', required: true },
  details: { type: String },
  price: { type: Number },
  location: { type: String }, // optional old field, can be deprecated later
  pickupLocation: { type: String },
  destinationLocation: { type: String },

  status: {
    type: String,
    enum: [
      'pending_agent_response',
      'requested', 
      'inspection_scheduled', 
      'inspection_completed',
      'quotation_provided', 
      'quotation_accepted',
      'agent_selected',
      'accepted', 
      'rejected', 
      'in-progress', 
      'completed', 
      'cancelled',
      'public' // Add this if you use public status
    ],
    default: 'requested', // Add default value
    required: true
  },
  
  // NEW: Service Scale Field
  serviceScale: {
    type: String,
    enum: ['minimum', 'large_scale'],
    default: 'minimum'
  },
  
  orderType: {
    type: String,
    enum: ['normal', 'professional'],
    default: 'normal'
  },

  // For professional flow
  quotationDetails: { type: String },
  quotationAmount: { type: Number },
  quotationProvidedAt: { type: Date },
  inspectionDate: { type: Date },
  inspectedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  recommendedAgents: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  
  // Schedule information
  scheduledDate: { type: Date }, // When the service is scheduled for
  scheduledTime: { type: String }, // "10:00 AM", "2:30 PM", etc.
  estimatedDuration: { type: Number }, // Duration in minutes
  
  // Completion tracking
  startedAt: { type: Date },
  completedAt: { type: Date },
  
  // Payment status
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'failed', 'refunded'],
    default: 'pending'
  },
  
  // Rating and review
  rating: { type: Number, min: 1, max: 5 },
  review: { type: String },
  reviewedAt: { type: Date },
  
  requestedAgent: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  declinedBy: [{ 
    agent: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    timestamp: { type: Date, default: Date.now },
    reason: { type: String }
  }],
  
  timeline: [statusSchema],
  currentLocation: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], default: [0, 0] }
  },
  deliveryUpdates: [
    {
      location: {
        type: { type: String, enum: ['Point'], default: 'Point' },
        coordinates: { type: [Number], required: true }
      },
      timestamp: { type: Date, default: Date.now }
    }
  ]
}, { 
  timestamps: true 
});

// Index for better query performance
orderSchema.index({ customer: 1, status: 1 });
orderSchema.index({ agent: 1, status: 1 });
orderSchema.index({ scheduledDate: 1 });
orderSchema.index({ status: 1 });
orderSchema.index({ serviceScale: 1 }); // NEW: Index for service scale

export default mongoose.model('Order', orderSchema);