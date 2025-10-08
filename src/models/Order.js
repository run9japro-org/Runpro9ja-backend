import mongoose from 'mongoose';

const statusSchema = new mongoose.Schema({
  status: { type: String, enum: ['requested','accepted','rejected','in-progress','completed'], required: true },
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
  
  // ✅ UPDATED STATUS OPTIONS
  status: { 
    type: String, 
    enum: [
      'pending_agent_response',
      'public', 
      'accepted',
      'rejected', 
      'in-progress', 
      'completed'
    ], 
    default: 'pending_agent_response' 
  },
  
  // ✅ NEW FIELDS
  requestedAgent: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  declinedBy: [{ 
    agent: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    timestamp: { type: Date, default: Date.now },
    reason: { type: String }
  }],
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'failed', 'refunded'],
    default: 'pending'
  },
  
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
}, { timestamps: true });

orderSchema.index({ currentLocation: '2dsphere' });

export default mongoose.model('Order', orderSchema);