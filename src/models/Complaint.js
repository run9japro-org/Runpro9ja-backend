import mongoose from "mongoose";
const complaintSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    trim: true,
    lowercase: true
  },
  date: {
    type: Date,
    default: Date.now
  },
  complaint: {
    type: String,
    required: [true, 'Complaint description is required'],
    trim: true
  },
  status: {
    type: String,
    enum: ['Pending', 'Responded', 'In Progress', 'Resolved'],
    default: 'Pending'
  },
  category: {
    type: String,
    enum: ['Laundry', 'Cleaning', 'Maintenance', 'Other'],
    default: 'Other'
  },
  priority: {
    type: String,
    enum: ['Low', 'Medium', 'High', 'Urgent'],
    default: 'Medium'
  },
  response: {
    message: String,
    respondedBy: String,
    respondedAt: Date
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Index for better query performance
complaintSchema.index({ status: 1, createdAt: -1 });
complaintSchema.index({ userId: 1, createdAt: -1 });
export const Complaint = mongoose.model('Complaint', complaintSchema);