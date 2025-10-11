import axios from 'axios';
import { env } from '../config/env.js'; // make sure PAYSTACK_SECRET, PAYSTACK_PUBLIC exist in env

const PAYSTACK_SECRET = env.paystackSecret;
const PAYSTACK_BASE_URL = 'https://api.paystack.co';

export const initializePayment = async ({ amount, email }) => {
  const response = await axios.post(
    `${PAYSTACK_BASE_URL}/transaction/initialize`,
    {
      email,
      amount: amount * 100 // kobo (NGN minor unit)
    },
    {
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET}`,
        'Content-Type': 'application/json'
      }
    }
  );
console.log('Using Paystack Key:', PAYSTACK_SECRET_KEY);

  return {
    authorizationUrl: response.data.data.authorization_url,
    reference: response.data.data.reference
  };
};

export const verifyPayment = async (reference) => {
  const response = await axios.get(`${PAYSTACK_BASE_URL}/transaction/verify/${reference}`, {
    headers: { Authorization: `Bearer ${PAYSTACK_SECRET}` }
  });

  return {
    status: response.data.data.status,
    reference: response.data.data.reference,
    amount: response.data.data.amount / 100
  };
};
