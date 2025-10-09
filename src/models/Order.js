// models/Order.js
import mongoose from 'mongoose';

const statusSchema = new mongoose.Schema({
  status: { 
    type: String, 
    enum: ['requested', 'accepted', 'rejected', 'in-progress', 'completed', 'cancelled'],
    required: true 
  },
  timestamp: { type: Date, default: Date.now },
  note: { type: String }
});

const orderSchema = new mongoose.Schema({
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  agent: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  serviceCategory: { type: mongoose.Schema.Types.ObjectId, ref: 'ServiceCategory', required: true },
  details: { type: String },
  price: { type: Number },
  location: { type: String },
  
  // Enhanced status system
  status: { 
    type: String, 
    enum: [
      'pending_agent_response',
      'public', 
      'accepted',
      'in-progress', 
      'completed',
      'cancelled',
      'rejected'
    ], 
    default: 'pending_agent_response' 
  },
  
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

export default mongoose.model('Order', orderSchema);