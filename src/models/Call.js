// src/models/Call.js
import mongoose from "mongoose";

const CallSchema = new mongoose.Schema(
  {
    channelName: { type: String, required: true },
    caller: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    receiver: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    participants: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    status: { 
      type: String, 
      enum: ['initiated', 'ringing', 'ongoing', 'completed', 'missed', 'rejected'],
      default: 'initiated'
    },
    duration: { type: Number, default: 0 }, // in seconds
    startedAt: { type: Date },
    endedAt: { type: Date }
  },
  { timestamps: true }
);

export const Call = mongoose.model("Call", CallSchema);