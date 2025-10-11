// services/paymentService.js
import axios from 'axios';
import { env } from '../config/env.js';

const PAYSTACK_SECRET = env.PAYSTACK_SECRET_KEY; // ✅ fixed key
const PAYSTACK_BASE_URL = 'https://api.paystack.co';

export const initializePayment = async ({ amount, email }) => {
  try {
    console.log('Using Paystack Key:', PAYSTACK_SECRET); // ✅ correct variable

    const response = await axios.post(
      `${PAYSTACK_BASE_URL}/transaction/initialize`,
      {
        email,
        amount: amount * 100, // Paystack uses kobo
      },
      {
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET}`,
          'Content-Type': 'application/json',
        },
      }
    );

    return {
      authorizationUrl: response.data.data.authorization_url,
      reference: response.data.data.reference,
    };
  } catch (error) {
    console.error('Initialize Payment Error:', error.response?.data || error.message);
    throw new Error('Failed to initialize payment');
  }
};

export const verifyPayment = async (reference) => {
  try {
    const response = await axios.get(`${PAYSTACK_BASE_URL}/transaction/verify/${reference}`, {
      headers: { Authorization: `Bearer ${PAYSTACK_SECRET}` },
    });

    return {
      status: response.data.data.status,
      reference: response.data.data.reference,
      amount: response.data.data.amount / 100,
    };
  } catch (error) {
    console.error('Verify Payment Error:', error.response?.data || error.message);
    throw new Error('Failed to verify payment');
  }
};
