import axios from "axios";

const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY;

export const createTransferRecipient = async (name, bankCode, accountNumber) => {
  const response = await axios.post(
    "https://api.paystack.co/transferrecipient",
    {
      type: "nuban",
      name,
      account_number: accountNumber,
      bank_code: bankCode,
      currency: "NGN",
    },
    {
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET}`,
        "Content-Type": "application/json",
      },
    }
  );

  return response.data.data.recipient_code;
};

export const initiateTransfer = async (amount, reason, recipientCode, reference) => {
  const response = await axios.post(
    "https://api.paystack.co/transfer",
    {
      source: "balance",
      amount: Math.round(amount * 100), // Paystack works in kobo
      recipient: recipientCode,
      reason,
      reference,
    },
    {
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET}`,
        "Content-Type": "application/json",
      },
    }
  );

  return response.data.data;
};
