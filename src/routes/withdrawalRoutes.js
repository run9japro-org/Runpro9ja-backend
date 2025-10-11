import express from "express";
import {
  requestWithdrawal,
  approveWithdrawal,
  getMyWithdrawals,
  getAllWithdrawals,
  handlePaystackWebhook,
} from "../controllers/withdrawalController.js";

import { authGuard, requireAdmin, isAgent } from "../middlewares/auth.js";

const router = express.Router();

// ✅ Agent routes
router.post("/request", authGuard, isAgent, requestWithdrawal);
router.get("/my", authGuard, isAgent, getMyWithdrawals);

// ✅ Admin routes
router.get("/", authGuard, requireAdmin, getAllWithdrawals);
router.post("/:id/approve", authGuard, requireAdmin, approveWithdrawal);

// ✅ Webhook (no auth)
router.post("/webhook/paystack", handlePaystackWebhook);

export default router;
