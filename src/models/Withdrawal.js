import mongoose from "mongoose";

const WithdrawalSchema = new mongoose.Schema(
  {
    agent: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    amount: { type: Number, required: true },
    status: {
      type: String,
      enum: ["pending", "processing", "completed", "failed"],
      default: "pending",
    },
    reference: { type: String, unique: true },
    transferCode: String, // from Paystack
  },
  { timestamps: true }
);

export const Withdrawal = mongoose.model("Withdrawal", WithdrawalSchema);
