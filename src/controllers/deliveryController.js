import Order from '../models/Order.js';
import { notifyUser } from '../services/notificationService.js';
import { io } from '../socket.js';


// Agent updates current delivery location
export const updateLocation = async (req, res) => {
try {
const { lng, lat } = req.body;
const order = await Order.findByIdAndUpdate(
req.params.id,
{
currentLocation: { type: 'Point', coordinates: [lng, lat] },
$push: { deliveryUpdates: { location: { type: 'Point', coordinates: [lng, lat] } } }
},
{ new: true }
);
notifyUser(order.customer, `Order ${order._id} location updated.`);


// Emit socket event to customers subscribed to this order
io.to(`order_${order._id}`).emit('locationUpdate', {
orderId: order._id,
coordinates: order.currentLocation.coordinates
});


res.json(order);
} catch (err) {
res.status(500).json({ error: err.message });
}
};


// Customer fetches live location (fallback if no sockets)
export const getLiveLocation = async (req, res) => {
try {
const order = await Order.findById(req.params.id).select('currentLocation deliveryUpdates status');
res.json(order);
} catch (err) {
res.status(500).json({ error: err.message });
}
};