import { Payment } from '../models/Payment.js';
import { User } from '../models/User.js';
import { initializePayment, verifyPayment } from '../services/paymentService.js';
import { notifyUser } from '../services/notificationService.js';

// Customer initiates payment
export const createPayment = async (req, res) => {
  try {
    const { orderId, amount, agentId, method } = req.body;

    if (method !== 'paystack') {
      return res.status(400).json({ error: 'Only Paystack supported for now' });
    }

    const init = await initializePayment({
      amount,
      email: req.user.email
    });

    const payment = await Payment.create({
      customer: req.user.id,
      agent: agentId,
      order: orderId,
      amount,
      paymentMethod: method,
      reference: init.reference,
      status: 'pending'
    });

    res.status(201).json({ payment, authorizationUrl: init.authorizationUrl });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Webhook (Paystack → server)

export const handleWebhook = async (req, res) => {
  try {
    const secret = process.env.PAYSTACK_SECRET_KEY;

    // Verify Paystack signature
    const hash = crypto
      .createHmac('sha512', secret)
      .update(JSON.stringify(req.body))
      .digest('hex');

    if (hash !== req.headers['x-paystack-signature']) {
      return res.status(401).send('Invalid signature');
    }

    const event = req.body;

    if (event.event !== 'charge.success') {
      return res.sendStatus(200);
    }

    const reference = event.data.reference;
    const verification = await verifyPayment(reference);

    const payment = await Payment.findOneAndUpdate(
      { reference },
      { status: verification.status },
      { new: true }
    );

    if (payment && verification.status === 'success') {
      // Increment agent wallet balance
      await User.findByIdAndUpdate(payment.agent, {
        $inc: { walletBalance: verification.amount },
      });

      notifyUser(payment.agent, `Payment received: ₦${verification.amount} for Order ${payment.order}`);
    }

    res.sendStatus(200);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
// Logged-in user payment history
export const getMyPayments = async (req, res) => {
  try {
    const payments = await Payment.find({
      $or: [{ customer: req.user.id }, { agent: req.user.id }]
    }).populate('order agent customer');
    res.json(payments);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
