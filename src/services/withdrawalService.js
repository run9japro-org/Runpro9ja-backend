import { Withdrawal } from "../models/Withdrawal.js";
import { User } from "../models/User.js";
import axios from "axios";
import { v4 as uuidv4 } from "uuid";

const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET;

export const WithdrawalService = {
  async initiateWithdrawal(agentId, amount) {
    const agent = await User.findById(agentId);

    if (!agent) throw new Error("Agent not found");
    if (agent.walletBalance < amount)
      throw new Error("Insufficient wallet balance");

    // Deduct immediately to avoid double spending
    agent.walletBalance -= amount;
    await agent.save();

    const reference = `wd_${uuidv4()}`;

    // If recipientCode not set, create it with Paystack
    if (!agent.bankAccount?.recipientCode) {
      const recipientRes = await axios.post(
        "https://api.paystack.co/transferrecipient",
        {
          type: "nuban",
          name: agent.bankAccount.accountName,
          account_number: agent.bankAccount.accountNumber,
          bank_code: agent.bankAccount.bankCode, // you must fetch this via Paystack Banks API
          currency: "NGN",
        },
        { headers: { Authorization: `Bearer ${PAYSTACK_SECRET}` } }
      );

      agent.bankAccount.recipientCode =
        recipientRes.data.data.recipient_code;
      await agent.save();
    }

    // Create withdrawal record
    const withdrawal = await Withdrawal.create({
      agent: agent._id,
      amount,
      reference,
    });

    // Call Paystack transfer
    const transferRes = await axios.post(
      "https://api.paystack.co/transfer",
      {
        source: "balance",
        reason: "Agent Wallet Withdrawal",
        amount: amount * 100, // kobo
        recipient: agent.bankAccount.recipientCode,
        reference,
      },
      { headers: { Authorization: `Bearer ${PAYSTACK_SECRET}` } }
    );

    withdrawal.transferCode = transferRes.data.data.transfer_code;
    withdrawal.status = "processing";
    await withdrawal.save();

    return withdrawal;
  },

  async handleTransferWebhook(event) {
    const { reference, status } = event.data;

    const withdrawal = await Withdrawal.findOne({ reference });
    if (!withdrawal) return;

    if (status === "success") {
      withdrawal.status = "completed";
    } else {
      withdrawal.status = "failed";
      // refund wallet if failed
      const agent = await User.findById(withdrawal.agent);
      agent.walletBalance += withdrawal.amount;
      await agent.save();
    }

    await withdrawal.save();
  },
};
