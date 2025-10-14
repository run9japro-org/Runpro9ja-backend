import crypto from "crypto";
import { Payment } from "../models/Payment.js";
import { User } from "../models/User.js";
import  Order  from "../models/Order.js";
import { initializePayment, verifyPayment } from "../services/paymentService.js";
import { notifyUser } from "../services/notificationService.js";

// ======================
// 1️⃣ Create Payment
// ======================
export const createPayment = async (req, res) => {
  try {
    const { orderId, amount, agentId, method, paymentMethodId } = req.body;

    if (!orderId || !amount || !agentId) {
      return res.status(400).json({ 
        success: false,
        error: "Missing required fields: orderId, amount, agentId" 
      });
    }

    if (method !== "paystack") {
      return res.status(400).json({ 
        success: false,
        error: "Only Paystack is supported for now" 
      });
    }

    // Check if payment already exists for this order
    const existingPayment = await Payment.findOne({ 
      order: orderId, 
      status: { $in: ["pending", "success"] } 
    });

    if (existingPayment) {
      return res.status(400).json({ 
        success: false,
        error: "Payment already exists for this order",
        existingPayment: {
          id: existingPayment._id,
          status: existingPayment.status,
          reference: existingPayment.reference
        }
      });
    }

    // Initialize payment with your existing service
    const init = await initializePayment({
      amount: amount,
      email: req.user.email,
    });

    // Save pending payment record
    const payment = await Payment.create({
      customer: req.user.id,
      agent: agentId,
      order: orderId,
      amount,
      paymentMethod: method,
      paymentMethodId: paymentMethodId || null,
      reference: init.reference,
      status: "pending",
      authorizationUrl: init.authorizationUrl,
    });

    res.status(201).json({
      success: true,
      message: "Payment initialized successfully",
      payment: {
        id: payment._id,
        amount: payment.amount,
        reference: payment.reference,
        status: payment.status,
        paymentMethod: payment.paymentMethod
      },
      authorizationUrl: init.authorizationUrl,
      reference: init.reference,
    });
  } catch (err) {
    console.error("💥 Create payment error:", err);
    res.status(500).json({ 
      success: false,
      error: err.message || "Internal server error" 
    });
  }
};

// ======================
// 2️⃣ Verify Payment
// ======================
export const verifyPaymentController = async (req, res) => {
  try {
    const { reference } = req.params;

    if (!reference) {
      return res.status(400).json({ 
        success: false,
        error: "Payment reference is required" 
      });
    }

    // Verify payment with your existing service
    const verification = await verifyPayment(reference);

    // Find payment
    const payment = await Payment.findOne({ reference })
      .populate("customer", "name email")
      .populate("agent", "name email");

    if (!payment) {
      return res.status(404).json({ 
        success: false,
        error: "Payment not found" 
      });
    }

    // Update payment status
    payment.status = verification.status;
    payment.verifiedAt = verification.status === "success" ? new Date() : null;
    payment.gatewayResponse = "Verified via API";
    
    if (verification.status === "success") {
      // 💰 Split amount (20% company, 80% agent)
      const companyShare = payment.amount * 0.2;
      const agentShare = payment.amount * 0.8;

      // Update Payment Record
      payment.companyShare = companyShare;
      payment.agentShare = agentShare;
      payment.paidAt = new Date();

      // ✅ Credit agent's wallet with 80%
      await User.findByIdAndUpdate(payment.agent._id, {
        $inc: { walletBalance: agentShare }
      });

      // Update order status if order model exists
      try {
        await Order.findByIdAndUpdate(payment.order, {
          status: "paid",
          paymentStatus: "completed"
        });
      } catch (orderError) {
        console.log("Order update skipped:", orderError.message);
      }

      // Notify agent
      notifyUser(
        payment.agent._id,
        `Payment received: ₦${agentShare.toFixed(2)} (after 20% platform fee) for Order ${payment.order}`
      );

      // Notify customer
      notifyUser(
        payment.customer._id,
        `Payment completed successfully for Order ${payment.order}`
      );
    }

    await payment.save();

    res.json({
      success: true,
      message: `Payment ${verification.status}`,
      payment: {
        id: payment._id,
        amount: payment.amount,
        reference: payment.reference,
        status: payment.status,
        companyShare: payment.companyShare,
        agentShare: payment.agentShare,
        paidAt: payment.paidAt
      },
      verification
    });
  } catch (err) {
    console.error("💥 Verify payment error:", err);
    res.status(500).json({ 
      success: false,
      error: err.message || "Internal server error" 
    });
  }
};

// ======================
// 3️⃣ Cancel Payment
// ======================
export const cancelPayment = async (req, res) => {
  try {
    const { paymentId } = req.params;

    if (!paymentId) {
      return res.status(400).json({ 
        success: false,
        error: "Payment ID is required" 
      });
    }

    // Find payment and check ownership
    const payment = await Payment.findOne({
      _id: paymentId,
      $or: [
        { customer: req.user.id },
        { agent: req.user.id }
      ]
    }).populate("customer", "name email")
      .populate("agent", "name email");

    if (!payment) {
      return res.status(404).json({ 
        success: false,
        error: "Payment not found or access denied" 
      });
    }

    // Only allow cancellation for pending payments
    if (payment.status !== "pending") {
      return res.status(400).json({ 
        success: false,
        error: `Cannot cancel payment with status: ${payment.status}. Only pending payments can be cancelled.` 
      });
    }

    // Update payment status
    payment.status = "cancelled";
    payment.cancelledAt = new Date();
    payment.cancelledBy = req.user.id;
    await payment.save();

    // Update order status if order model exists
    try {
      await Order.findByIdAndUpdate(payment.order, {
        status: "cancelled",
        paymentStatus: "cancelled"
      });
    } catch (orderError) {
      console.log("Order update skipped:", orderError.message);
    }

    // Notify both parties
    const notifyAgent = notifyUser(
      payment.agent._id,
      `Payment was cancelled for Order ${payment.order}`
    );

    const notifyCustomer = notifyUser(
      payment.customer._id,
      `Your payment was cancelled for Order ${payment.order}`
    );

    // Wait for notifications to complete
    await Promise.all([notifyAgent, notifyCustomer]);

    res.json({
      success: true,
      message: "Payment cancelled successfully",
      payment: {
        id: payment._id,
        amount: payment.amount,
        reference: payment.reference,
        status: payment.status,
        cancelledAt: payment.cancelledAt
      }
    });
  } catch (err) {
    console.error("💥 Cancel payment error:", err);
    res.status(500).json({ 
      success: false,
      error: err.message || "Internal server error" 
    });
  }
};

// ======================
// 4️⃣ Handle Paystack Webhook
// ======================
export const handleWebhook = async (req, res) => {
  try {
    const secret = process.env.PAYSTACK_SECRET_KEY;

    // Verify webhook signature
    const hash = crypto
      .createHmac("sha512", secret)
      .update(JSON.stringify(req.body))
      .digest("hex");

    if (hash !== req.headers["x-paystack-signature"]) {
      console.error("❌ Invalid webhook signature");
      return res.status(401).send("Invalid signature");
    }

    const event = req.body;
    console.log(`🔄 Processing webhook event: ${event.event}`);

    // Handle different webhook events
    switch (event.event) {
      case "charge.success":
        await handleSuccessfulCharge(event);
        break;
      
      case "charge.failed":
        await handleFailedCharge(event);
        break;
      
      case "transfer.success":
        console.log("💰 Transfer successful:", event.data.reference);
        break;
      
      default:
        console.log("⚡ Unhandled webhook event:", event.event);
    }

    res.sendStatus(200);
  } catch (err) {
    console.error("💥 Webhook processing error:", err);
    res.status(500).json({ error: err.message });
  }
};

// Helper function for successful charges
const handleSuccessfulCharge = async (event) => {
  try {
    const reference = event.data.reference;
    console.log(`✅ Processing successful charge for reference: ${reference}`);
    
    const payment = await Payment.findOne({ reference })
      .populate("agent", "name email")
      .populate("customer", "name email");

    if (!payment) {
      console.error(`❌ Payment not found for reference: ${reference}`);
      return;
    }

    // Update payment status
    payment.status = "success";
    payment.paidAt = new Date();
    payment.gatewayResponse = event.data.gateway_response;

    // 💰 Split amount (20% company, 80% agent)
    const companyShare = payment.amount * 0.2;
    const agentShare = payment.amount * 0.8;

    // Update Payment Record
    payment.companyShare = companyShare;
    payment.agentShare = agentShare;
    await payment.save();

    // ✅ Credit agent's wallet with 80%
    await User.findByIdAndUpdate(payment.agent._id, {
      $inc: { walletBalance: agentShare }
    });

    // Update order status
    try {
      await Order.findByIdAndUpdate(payment.order, {
        status: "paid",
        paymentStatus: "completed",
        paidAt: new Date()
      });
    } catch (orderError) {
      console.log("📦 Order update skipped:", orderError.message);
    }

    // Notify agent
    await notifyUser(
      payment.agent._id,
      `💰 Payment received: ₦${agentShare.toFixed(2)} (after 20% platform fee) for Order ${payment.order}`
    );

    console.log(`✅ Successfully processed payment for reference: ${reference}`);
  } catch (error) {
    console.error("💥 Error handling successful charge:", error);
  }
};

// Helper function for failed charges
const handleFailedCharge = async (event) => {
  try {
    const reference = event.data.reference;
    console.log(`❌ Processing failed charge for reference: ${reference}`);
    
    const payment = await Payment.findOneAndUpdate(
      { reference },
      { 
        status: "failed",
        gatewayResponse: event.data.gateway_response
      },
      { new: true }
    ).populate("customer", "name email");

    if (payment) {
      await notifyUser(
        payment.customer._id,
        `❌ Payment failed for Order ${payment.order}. Reason: ${event.data.gateway_response || 'Please try again.'}`
      );
      console.log(`❌ Payment failed for reference: ${reference}`);
    }
  } catch (error) {
    console.error("💥 Error handling failed charge:", error);
  }
};

// ======================
// 5️⃣ Get Payment Details
// ======================
export const getPaymentDetails = async (req, res) => {
  try {
    const { paymentId } = req.params;

    const payment = await Payment.findById(paymentId)
      .populate("customer", "name email phone")
      .populate("agent", "name email phone")
      .populate("order", "orderNumber description status");

    if (!payment) {
      return res.status(404).json({ 
        success: false,
        error: "Payment not found" 
      });
    }

    // Check if user has permission to view this payment
    const isOwner = payment.customer._id.toString() === req.user.id || 
                   payment.agent._id.toString() === req.user.id;
    const isAdmin = req.user.role === "admin";

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ 
        success: false,
        error: "Access denied" 
      });
    }

    res.json({
      success: true,
      payment
    });
  } catch (err) {
    console.error("💥 Get payment details error:", err);
    res.status(500).json({ 
      success: false,
      error: err.message || "Internal server error" 
    });
  }
};

// ======================
// 6️⃣ Get My Payment History
// ======================
export const getMyPayments = async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;
    
    const filter = {
      $or: [{ customer: req.user.id }, { agent: req.user.id }]
    };

    if (status && status !== "all") {
      filter.status = status;
    }

    const payments = await Payment.find(filter)
      .populate("order", "orderNumber description")
      .populate("agent", "name email")
      .populate("customer", "name email")
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Payment.countDocuments(filter);

    res.json({
      success: true,
      payments,
      pagination: {
        totalPages: Math.ceil(total / limit),
        currentPage: parseInt(page),
        totalPayments: total,
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1
      }
    });
  } catch (err) {
    console.error("💥 Get my payments error:", err);
    res.status(500).json({ 
      success: false,
      error: err.message || "Internal server error" 
    });
  }
};

// ======================
// 7️⃣ Get Payments by Order
// ======================
export const getPaymentsByOrder = async (req, res) => {
  try {
    const { orderId } = req.params;

    const payments = await Payment.find({ order: orderId })
      .populate("customer", "name email")
      .populate("agent", "name email")
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      payments
    });
  } catch (err) {
    console.error("💥 Get payments by order error:", err);
    res.status(500).json({ 
      success: false,
      error: err.message || "Internal server error" 
    });
  }
};