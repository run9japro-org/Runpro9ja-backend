// routes/paymentRoutes.js
import express from "express";
import {
  createPayment,
  verifyPaymentController,
  cancelPayment,
  handleWebhook,
  getPaymentDetails,
  getMyPayments,
  getPaymentsByOrder
} from "../controllers/paymentController.js";
import { authGuard } from "../middlewares/auth.js";

const router = express.Router();

// Webhook (no authentication needed)
router.post("/webhook", handleWebhook);

// Protected routes
router.use(authGuard);

router.post("/create", createPayment);
router.get("/verify/:reference", verifyPaymentController); // Note: renamed to avoid conflict
router.put("/cancel/:paymentId", cancelPayment);
router.get("/my-payments", getMyPayments);
router.get("/details/:paymentId", getPaymentDetails);
router.get("/order/:orderId", getPaymentsByOrder);

export default router;