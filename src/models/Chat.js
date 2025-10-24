import mongoose from "mongoose";

// models/Chat.js - Add these fields to your existing schema
const MessageSchema = new mongoose.Schema(
  {
    sender: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    receiver: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    message: { type: String, required: true },
    order: { type: mongoose.Schema.Types.ObjectId, ref: "Order" },
    read: { type: Boolean, default: false },
    
    // Support-specific fields
    isSupportChat: { type: Boolean, default: false },
    supportIssueType: { 
      type: String, 
      enum: ['technical', 'billing', 'general', 'order_issue', 'other'],
      default: 'general'
    },
    supportStatus: {
      type: String,
      enum: ['open', 'in_progress', 'closed', 'resolved'],
      default: 'open'
    },
    supportResolution: { type: String },
    parentTicket: { type: mongoose.Schema.Types.ObjectId, ref: "Message" }
  },
  { timestamps: true }
);

export const Message = mongoose.model("Message", MessageSchema);
