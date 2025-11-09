// models/Chat.js
import mongoose from "mongoose";

const MessageSchema = new mongoose.Schema(
  {
    sender: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    receiver: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    message: { type: String, required: true },
    order: { type: mongoose.Schema.Types.ObjectId, ref: "Order" },
    read: { type: Boolean, default: false },
    readBy: [{ 
      user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      readAt: { type: Date, default: Date.now }
    }],
    
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