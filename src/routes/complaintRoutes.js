import express from "express";
import {
  createComplaint,
  getComplaints,
  getUserComplaints,
  respondToComplaint,
  deleteComplaint,
  getComplaintStats
} from "../controllers/complaintController.js";
import { authGuard, requireAdmin} from "../middlewares/auth.js";

const router = express.Router();

// User submits complaint
router.post("/", authGuard, createComplaint);

// User views their complaints
router.get("/my", authGuard, getUserComplaints);

// Admin routes
router.get("/", requireAdmin, getComplaints);
router.put("/:id", requireAdmin, respondToComplaint);
router.delete("/:id", requireAdmin, deleteComplaint);
router.get("/stats/summary", requireAdmin, getComplaintStats);

export default router;
