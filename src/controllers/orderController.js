import Order from '../models/Order.js';
import {notifyUser} from '../services/notificationService.js';



// Customer creates order
export const createOrder = async (req, res) => {
try {
const order = new Order({ ...req.body, customer: req.user.id });
order.timeline.push({ status: 'requested' });
await order.save();
notifyUser(order.agent, `New order requested: ${order._id}`);
res.status(201).json(order);
} catch (err) {
res.status(500).json({ error: err.message });
}
};


// Agent accepts order
export const acceptOrder = async (req, res) => {
try {
const order = await Order.findById(req.params.id);
if (!order) return res.status(404).json({ error: 'Order not found' });
order.status = 'accepted';
order.timeline.push({ status: 'accepted' });
order.agent = req.user.id;
await order.save();
notifyUser(order.customer, `Order ${order._id} accepted`);
res.json(order);
} catch (err) {
res.status(500).json({ error: err.message });
}
}



// Agent rejects order
export const rejectOrder = async (req, res) => {
try {
const order = await Order.findById(req.params.id);
if (!order) return res.status(404).json({ error: 'Order not found' });
order.status = 'rejected';
order.timeline.push({ status: 'rejected' });
await order.save();
notifyUser(order.customer, `Order ${order._id} rejected`);
res.json(order);
} catch (err) {
res.status(500).json({ error: err.message });
}
};


// Update order status (in-progress, completed)
export const updateStatus = async (req, res) => {
try {
const { status } = req.body;
const order = await Order.findById(req.params.id);
if (!order) return res.status(404).json({ error: 'Order not found' });
order.status = status;
order.timeline.push({ status });
await order.save();
notifyUser(order.customer, `Order ${order._id} updated to ${status}`);
res.json(order);
} catch (err) {
res.status(500).json({ error: err.message });
}
};


// Get customer orders
export const getCustomerOrders = async (req, res) => {
try {
const orders = await Order.find({ customer: req.params.id }).populate('serviceCategory agent');
res.json(orders);
} catch (err) {
res.status(500).json({ error: err.message });
}
};


// Get agent orders
export const getAgentOrders = async (req, res) => {
try {
const orders = await Order.find({ agent: req.params.id }).populate('serviceCategory customer');
res.json(orders);
} catch (err) {
res.status(500).json({ error: err.message });
}
};