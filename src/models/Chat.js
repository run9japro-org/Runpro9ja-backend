import mongoose from "mongoose";

const MessageSchema = new mongoose.Schema(
  {
    sender: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    receiver: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    message: { type: String, required: true },
    order: { type: mongoose.Schema.Types.ObjectId, ref: "Order" }, // optional link to job
    read: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const Message = mongoose.model("Message", MessageSchema);
