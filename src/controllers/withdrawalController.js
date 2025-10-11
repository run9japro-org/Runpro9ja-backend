import crypto from "crypto";
import { Withdrawal } from "../models/Withdrawal.js";
import { User } from "../models/User.js";
import { notifyUser } from "../services/notificationService.js";
import { createTransferRecipient, initiateTransfer } from "../services/paystackTransferService.js";

/**
 * 🧾 Agent requests a withdrawal
 * - Locks 80% of the wallet for agent (20% belongs to company)
 */
export const requestWithdrawal = async (req, res) => {
  try {
    const { amount } = req.body;
    const agent = await User.findById(req.user.id);

    if (!agent) return res.status(404).json({ error: "Agent not found" });
    if (amount <= 0) return res.status(400).json({ error: "Invalid withdrawal amount" });

    // ✅ Agent can only withdraw 80% (Company keeps 20%)
    const available = agent.walletBalance * 0.8;
    if (amount > available)
      return res
        .status(400)
        .json({ error: `Insufficient balance. You can withdraw up to ₦${available.toFixed(2)}` });

    // Lock funds (deduct from wallet)
    agent.walletBalance -= amount;
    await agent.save();

    // Create withdrawal record
    const withdrawal = await Withdrawal.create({
      agent: agent._id,
      amount,
      status: "pending",
      reference: crypto.randomBytes(6).toString("hex"),
    });

    // ✅ Notify agent
    await notifyUser(agent._id, "WITHDRAWAL_REQUESTED", [amount]);

    // ✅ Notify admin(s)
    const admins = await User.find({ role: "admin" }).select("_id fullname");
    await Promise.all(
      admins.map((admin) =>
        notifyUser(admin._id, "NEW_WITHDRAWAL_REQUEST_ADMIN", [agent.fullname, amount])
      )
    );

    res.status(201).json({
      success: true,
      message: "Withdrawal request submitted for admin approval.",
      withdrawal,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * 👨‍💼 Admin approves withdrawal
 * - Automatically sends funds using Paystack
 */
export const approveWithdrawal = async (req, res) => {
  try {
    const { id } = req.params;
    const withdrawal = await Withdrawal.findById(id).populate("agent");
    if (!withdrawal) return res.status(404).json({ error: "Withdrawal not found" });
    if (withdrawal.status !== "pending")
      return res.status(400).json({ error: "Already processed" });

    const agent = withdrawal.agent;
    if (!agent.accountName || !agent.bankCode || !agent.accountNumber)
      return res.status(400).json({ error: "Agent bank details missing" });

    // ✅ Step 1: Create Paystack recipient
    const recipientCode = await createTransferRecipient(
      agent.accountName,
      agent.bankCode,
      agent.accountNumber
    );

    // ✅ Step 2: Initiate transfer
    const transfer = await initiateTransfer(
      withdrawal.amount,
      `Withdrawal for ${agent.fullname}`,
      recipientCode,
      withdrawal.reference
    );

    withdrawal.status = "processing";
    withdrawal.transferCode = transfer.transfer_code;
    await withdrawal.save();

    // ✅ Notify agent
    await notifyUser(agent._id, "WITHDRAWAL_APPROVED", [withdrawal.amount]);

    res.json({
      success: true,
      message: "Withdrawal approved and transfer initiated.",
      withdrawal,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * 📦 Paystack webhook (transfer.success / transfer.failed)
 */
export const handlePaystackWebhook = async (req, res) => {
  try {
    const secret = process.env.PAYSTACK_SECRET_KEY;

    const hash = crypto
      .createHmac("sha512", secret)
      .update(JSON.stringify(req.body))
      .digest("hex");

    if (hash !== req.headers["x-paystack-signature"])
      return res.status(401).send("Invalid signature");

    const event = req.body;

    if (event.event === "transfer.success") {
      const withdrawal = await Withdrawal.findOneAndUpdate(
        { transferCode: event.data.transfer_code },
        { status: "completed" },
        { new: true }
      );
      if (withdrawal) {
        await notifyUser(withdrawal.agent, "WITHDRAWAL_COMPLETED", [withdrawal.amount]);
      }
    } else if (event.event === "transfer.failed") {
      const withdrawal = await Withdrawal.findOneAndUpdate(
        { transferCode: event.data.transfer_code },
        { status: "failed" },
        { new: true }
      );
      if (withdrawal) {
        // Refund the agent if failed
        await User.findByIdAndUpdate(withdrawal.agent, {
          $inc: { walletBalance: withdrawal.amount },
        });
        await notifyUser(withdrawal.agent, "WITHDRAWAL_FAILED", [withdrawal.amount]);
      }
    }

    res.sendStatus(200);
  } catch (err) {
    console.error("Webhook Error:", err);
    res.status(500).json({ error: err.message });
  }
};

/**
 * 👤 Agent: View their withdrawals
 */
export const getMyWithdrawals = async (req, res) => {
  const withdrawals = await Withdrawal.find({ agent: req.user.id }).sort({ createdAt: -1 });
  res.json(withdrawals);
};

/**
 * 👨‍💼 Admin: View all withdrawals
 */
export const getAllWithdrawals = async (req, res) => {
  const withdrawals = await Withdrawal.find()
    .populate("agent", "fullname email")
    .sort({ createdAt: -1 });
  res.json(withdrawals);
};
