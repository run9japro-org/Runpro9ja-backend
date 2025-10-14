// models/Payment.js
import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema({
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  agent: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  order: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Order",
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  paymentMethod: {
    type: String,
    enum: ["paystack", "flutterwave", "bank_transfer"],
    default: "paystack"
  },
  paymentMethodId: {
    type: String, // Reference to saved payment method
  },
  reference: {
    type: String,
    required: true,
    unique: true
  },
  status: {
    type: String,
    enum: ["pending", "success", "failed", "cancelled", "refunded"],
    default: "pending"
  },
  companyShare: {
    type: Number,
    default: 0
  },
  agentShare: {
    type: Number,
    default: 0
  },
  authorizationUrl: String,
  gatewayResponse: String,
  paidAt: Date,
  verifiedAt: Date,
  cancelledAt: Date,
  cancelledBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  }
}, {
  timestamps: true
});

// Index for better performance
paymentSchema.index({ customer: 1, createdAt: -1 });
paymentSchema.index({ agent: 1, createdAt: -1 });
paymentSchema.index({ reference: 1 });
paymentSchema.index({ order: 1 });

export const Payment = mongoose.model("Payment", paymentSchema);