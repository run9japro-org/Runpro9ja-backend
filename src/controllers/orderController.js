import Order from '../models/Order.js';
import { notifyUser } from '../services/notificationService.js';

// Step 1: Customer creates order with selected agent
export const createOrder = async (req, res) => {
  try {
    const { requestedAgent, ...orderData } = req.body;
    
    if (!requestedAgent) {
      return res.status(400).json({
        success: false,
        error: 'Please select an agent for this order'
      });
    }

    const order = new Order({ 
      ...orderData,
      customer: req.user.id,
      requestedAgent: requestedAgent,
      status: 'pending_agent_response', // Waiting for agent decision
      paymentStatus: 'pending' // Payment happens after acceptance
    });
    
    order.timeline.push({ 
      status: 'requested', 
      note: `Order created and offered to specific agent` 
    });
    
    await order.save();

    // ✅ Notify the SPECIFIC agent about the direct offer
    await notifyUser(
      requestedAgent,
      'DIRECT_ORDER_OFFER',
      [order._id, req.user.fullName, order.serviceType],
      req.io
    );

    // ✅ Notify customer
    await notifyUser(
      req.user.id,
      'ORDER_CREATED',
      [order._id, order.serviceType],
      req.io
    );

    res.status(201).json({
      success: true,
      message: 'Order created successfully. Waiting for agent response.',
      order
    });
  } catch (err) {
    res.status(500).json({ 
      success: false,
      error: err.message 
    });
  }
};

// Step 2: Agent accepts the direct offer
export const acceptOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('customer', 'fullName email phone')
      .populate('requestedAgent', 'fullName email phone');

    if (!order) {
      return res.status(404).json({ 
        success: false,
        error: 'Order not found' 
      });
    }

    // Check if this agent was the one requested
    if (order.requestedAgent._id.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: 'This order was not offered to you'
      });
    }

    // Check if order is still waiting for response
    if (order.status !== 'pending_agent_response') {
      return res.status(400).json({
        success: false,
        error: 'Order is no longer available'
      });
    }

    // Update order - agent accepted!
    order.status = 'accepted';
    order.agent = req.user.id; // Assign to this agent
    order.timeline.push({ 
      status: 'accepted', 
      note: `Agent ${req.user.fullName} accepted the direct offer` 
    });
    
    await order.save();

    // ✅ Notify customer that agent accepted
    await notifyUser(
      order.customer._id,
      'AGENT_ACCEPTED_DIRECT_OFFER',
      [order._id, req.user.fullName],
      req.io
    );

    // ✅ Notify agent
    await notifyUser(
      req.user.id,
      'DIRECT_ORDER_ACCEPTED',
      [order._id, order.customer.fullName],
      req.io
    );

    res.json({
      success: true,
      message: 'Order accepted successfully. Proceed to payment.',
      order,
      nextStep: 'payment' // Frontend knows to proceed to payment
    });
  } catch (err) {
    res.status(500).json({ 
      success: false,
      error: err.message 
    });
  }
};

// Step 3: Agent rejects the direct offer
export const rejectOrder = async (req, res) => {
  try {
    const { reason } = req.body;
    const order = await Order.findById(req.params.id)
      .populate('customer', 'fullName email phone');

    if (!order) {
      return res.status(404).json({ 
        success: false,
        error: 'Order not found' 
      });
    }

    // Check if this agent was the one requested
    if (order.requestedAgent.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: 'This order was not offered to you'
      });
    }

    // Add to declined list
    order.declinedBy.push({
      agent: req.user.id,
      reason: reason || 'No reason provided'
    });

    // Make order public for other agents
    order.status = 'public';
    order.requestedAgent = null; // Remove specific agent request
    
    order.timeline.push({ 
      status: 'rejected', 
      note: `Requested agent declined. Order now public for all agents.` 
    });
    
    await order.save();

    // ✅ Notify customer that agent declined
    await notifyUser(
      order.customer._id,
      'AGENT_DECLINED_DIRECT_OFFER',
      [order._id, req.user.fullName, reason || 'Agent unavailable'],
      req.io
    );

    // ✅ BROADCAST to all other agents (except the one who declined)
    if (req.io) {
      req.io.emit('new_public_order', {
        type: 'PUBLIC_ORDER_AVAILABLE',
        data: {
          orderId: order._id,
          serviceType: order.serviceType,
          customerName: order.customer.fullName,
          reason: 'Previous agent declined'
        }
      });
    }

    res.json({
      success: true,
      message: 'Order declined. Order is now public for other agents.',
      order
    });
  } catch (err) {
    res.status(500).json({ 
      success: false,
      error: err.message 
    });
  }
};

// Step 4: Any agent can accept public orders
export const acceptPublicOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('customer', 'fullName email phone')
      .populate('declinedBy.agent', 'fullName');

    if (!order) {
      return res.status(404).json({ 
        success: false,
        error: 'Order not found' 
      });
    }

    // Check if order is public
    if (order.status !== 'public') {
      return res.status(400).json({
        success: false,
        error: 'Order is not available for public acceptance'
      });
    }

    // Check if this agent already declined this order
    const alreadyDeclined = order.declinedBy.some(
      decline => decline.agent && decline.agent._id.toString() === req.user.id
    );
    
    if (alreadyDeclined) {
      return res.status(400).json({
        success: false,
        error: 'You have already declined this order'
      });
    }

    // Assign to this agent
    order.status = 'accepted';
    order.agent = req.user.id;
    order.timeline.push({ 
      status: 'accepted', 
      note: `Agent ${req.user.fullName} accepted from public pool` 
    });
    
    await order.save();

    // ✅ Notify customer
    await notifyUser(
      order.customer._id,
      'AGENT_ACCEPTED_PUBLIC_ORDER',
      [order._id, req.user.fullName],
      req.io
    );

    // ✅ Notify agent
    await notifyUser(
      req.user.id,
      'PUBLIC_ORDER_ACCEPTED',
      [order._id, order.customer.fullName],
      req.io
    );

    res.json({
      success: true,
      message: 'Public order accepted successfully. Proceed to payment.',
      order,
      nextStep: 'payment'
    });
  } catch (err) {
    res.status(500).json({ 
      success: false,
      error: err.message 
    });
  }
};

// Get available public orders for agents
export const getPublicOrders = async (req, res) => {
  try {
    const { serviceType } = req.query;
    
    const query = {
      status: 'public',
      'declinedBy.agent': { $ne: req.user.id } // Exclude orders this agent already declined
    };
    
    if (serviceType) {
      query.serviceType = serviceType;
    }

    const orders = await Order.find(query)
      .populate('customer', 'fullName email phone location')
      .populate('serviceCategory', 'name description')
      .populate('declinedBy.agent', 'fullName')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      orders,
      count: orders.length
    });
  } catch (err) {
    res.status(500).json({ 
      success: false,
      error: err.message 
    });
  }
};

// Get orders specifically offered to an agent
export const getDirectOffers = async (req, res) => {
  try {
    const orders = await Order.find({
      requestedAgent: req.user.id,
      status: 'pending_agent_response'
    })
      .populate('customer', 'fullName email phone location')
      .populate('serviceCategory', 'name description')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      orders,
      count: orders.length
    });
  } catch (err) {
    res.status(500).json({ 
      success: false,
      error: err.message 
    });
  }
};

// Get customer orders - FIXED
export const getCustomerOrders = async (req, res) => {
  try {
    const orders = await Order.find({ customer: req.user.id })
      .populate('serviceCategory agent')
      .populate('requestedAgent', 'fullName')
      .sort({ createdAt: -1 });
    
    res.json({
      success: true,
      orders,
      count: orders.length
    });
  } catch (err) {
    res.status(500).json({ 
      success: false,
      error: err.message 
    });
  }
};

// Get agent orders - FIXED
export const getAgentOrders = async (req, res) => {
  try {
    const orders = await Order.find({ agent: req.user.id })
      .populate('serviceCategory customer')
      .populate('requestedAgent', 'fullName')
      .sort({ createdAt: -1 });
    
    res.json({
      success: true,
      orders,
      count: orders.length
    });
  } catch (err) {
    res.status(500).json({ 
      success: false,
      error: err.message 
    });
  }
};

// Update order status
export const updateStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const order = await Order.findById(req.params.id);
    
    if (!order) {
      return res.status(404).json({ 
        success: false,
        error: 'Order not found' 
      });
    }

    order.status = status;
    order.timeline.push({ status });
    await order.save();

    res.json({
      success: true,
      message: `Order status updated to ${status}`,
      order
    });
  } catch (err) {
    res.status(500).json({ 
      success: false,
      error: err.message 
    });
  }
};

// Get order by ID
export const getOrderById = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('customer', 'fullName email phone')
      .populate('agent', 'fullName email phone')
      .populate('serviceCategory')
      .populate('requestedAgent', 'fullName');

    if (!order) {
      return res.status(404).json({ 
        success: false,
        error: 'Order not found' 
      });
    }

    res.json({
      success: true,
      order
    });
  } catch (err) {
    res.status(500).json({ 
      success: false,
      error: err.message 
    });
  }
};