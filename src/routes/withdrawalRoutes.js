import express from "express";
import {
  requestWithdrawal,
  withdrawalWebhook,
  getMyWithdrawals,
  getMyWalletBalance,
} from "../controllers/withdrawalController.js";
import { authGuard, isAgent } from "../middlewares/auth.js"; // ✅ fix path

const router = express.Router();

// Agent requests withdrawal
router.post("/", authGuard, isAgent, requestWithdrawal);

// Agent views withdrawal history
router.get("/me", authGuard, isAgent, getMyWithdrawals);

// Agent checks wallet balance
router.get("/balance", authGuard, isAgent, getMyWalletBalance);

// Paystack webhook (public, but verify signature in controller)
router.post("/webhook", express.json({ type: "*/*" }), withdrawalWebhook);

export default router;
