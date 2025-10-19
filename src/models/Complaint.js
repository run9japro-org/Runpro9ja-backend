import mongoose from "mongoose";

const complaintSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      trim: true,
      lowercase: true
    },
    complaint: {
      type: String,
      required: [true, "Complaint description is required"],
      trim: true
    },
    category: {
      type: String,
      enum: ["Laundry", "Cleaning", "Maintenance", "Delivery", "Beauty", "Other"],
      default: "Other"
    },
    priority: {
      type: String,
      enum: ["Low", "Medium", "High", "Urgent"],
      default: "Medium"
    },
    status: {
      type: String,
      enum: ["Pending", "In Progress", "Responded", "Resolved"],
      default: "Pending"
    },
    response: {
      message: String,
      respondedBy: { type: String, default: null },
      respondedAt: { type: Date, default: null }
    }
  },
  { timestamps: true }
);

// Improve performance for admin dashboard queries
complaintSchema.index({ status: 1, createdAt: -1 });
complaintSchema.index({ user: 1, createdAt: -1 });

export const Complaint = mongoose.model("Complaint", complaintSchema);
