import { Withdrawal } from "../models/Withdrawal.js";
import { WithdrawalService } from "../services/WithdrawalService.js";
import { User } from "../models/User.js";

// ✅ Request Withdrawal
export const requestWithdrawal = async (req, res, next) => {
  try {
    const { amount } = req.body;
    const withdrawal = await WithdrawalService.initiateWithdrawal(
      req.user.id,
      amount
    );
    res.json({ success: true, withdrawal });
  } catch (err) {
    next(err);
  }
};

// ✅ Webhook from Paystack
export const withdrawalWebhook = async (req, res) => {
  const event = req.body;
  if (
    event.event === "transfer.success" ||
    event.event === "transfer.failed"
  ) {
    await WithdrawalService.handleTransferWebhook(event);
  }
  res.sendStatus(200);
};

// ✅ Agent: Get Withdrawal History
export const getMyWithdrawals = async (req, res, next) => {
  try {
    const withdrawals = await Withdrawal.find({ agent: req.user.id })
      .sort({ createdAt: -1 })
      .lean();
    res.json({ success: true, withdrawals });
  } catch (err) {
    next(err);
  }
};

// ✅ Agent: Check Wallet Balance
export const getMyWalletBalance = async (req, res, next) => {
  try {
    const agent = await User.findById(req.user.id).select("walletBalance");
    res.json({ success: true, balance: agent.walletBalance });
  } catch (err) {
    next(err);
  }
};
