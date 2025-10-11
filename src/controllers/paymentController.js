import crypto from "crypto";
import { Payment } from "../models/Payment.js";
import { User } from "../models/User.js";
import { initializePayment, verifyPayment } from "../services/paymentService.js";
import { notifyUser } from "../services/notificationService.js";

// ======================
// 1️⃣  Create Payment
// ======================
export const createPayment = async (req, res) => {
  try {
    const { orderId, amount, agentId, method } = req.body;

    if (!orderId || !amount || !agentId) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    if (method !== "paystack") {
      return res.status(400).json({ error: "Only Paystack is supported for now" });
    }

    // Initialize payment on Paystack
    const init = await initializePayment({
      amount,
      email: req.user.email,
    });

    // Save pending payment record
    const payment = await Payment.create({
      customer: req.user.id,
      agent: agentId,
      order: orderId,
      amount,
      paymentMethod: method,
      reference: init.reference,
      status: "pending",
    });

    res.status(201).json({
      success: true,
      payment,
      authorizationUrl: init.authorizationUrl,
    });
  } catch (err) {
    console.error("💥 Create payment error:", err);
    res.status(500).json({ error: err.message });
  }
};

// ======================
// 2️⃣  Handle Paystack Webhook
// ======================
export const handleWebhook = async (req, res) => {
  try {
    const secret = process.env.PAYSTACK_SECRET_KEY;

    const hash = crypto
      .createHmac("sha512", secret)
      .update(JSON.stringify(req.body))
      .digest("hex");

    if (hash !== req.headers["x-paystack-signature"]) {
      return res.status(401).send("Invalid signature");
    }

    const event = req.body;
    if (event.event !== "charge.success") return res.sendStatus(200);

    const reference = event.data.reference;
    const verification = await verifyPayment(reference);

    const payment = await Payment.findOneAndUpdate(
      { reference },
      { status: verification.status },
      { new: true }
    );

    if (payment && verification.status === "success") {
      // 💰 Split amount (20% company, 80% agent)
      const companyShare = payment.amount * 0.2;
      const agentShare = payment.amount * 0.8;

      // Update Payment Record
      payment.companyShare = companyShare;
      payment.agentShare = agentShare;
      await payment.save();

      // ✅ Credit only agent’s wallet with 80%
      await User.findByIdAndUpdate(payment.agent, {
        $inc: { walletBalance: agentShare }
      });

      notifyUser(
        payment.agent,
        `Payment received: ₦${agentShare} (after 20% platform fee) for Order ${payment.order}`
      );
    }

    res.sendStatus(200);
  } catch (err) {
    console.error("Webhook error:", err);
    res.status(500).json({ error: err.message });
  }
};

// ======================
// 3️⃣  Get My Payment History
// ======================
export const getMyPayments = async (req, res) => {
  try {
    const payments = await Payment.find({
      $or: [{ customer: req.user.id }, { agent: req.user.id }],
    })
      .populate("order agent customer", "name email")
      .sort({ createdAt: -1 });

    res.json({ success: true, payments });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
