import mongoose from "mongoose";

const AuditLogSchema = new mongoose.Schema(
  {
    admin: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    action: String,
    target: { type: mongoose.Schema.Types.ObjectId, refPath: "targetModel" },
    targetModel: String,
  },
  { timestamps: true }
);

export const AuditLog = mongoose.model("AuditLog", AuditLogSchema);
