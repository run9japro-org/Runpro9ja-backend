import Order from '../models/Order.js';
import { notifyUser } from '../services/notificationService.js';

// Step 1: Customer creates order with selected agent
// Step 1: Customer creates order with selected agent - FIXED VERSION
export const createOrder = async (req, res) => {
  try {
    const { requestedAgent, orderType = 'normal', serviceCategory, details, location, ...orderData } = req.body;

    // Validate required fields for professional orders
    if (orderType === 'professional') {
      if (!serviceCategory) {
        return res.status(400).json({ 
          success: false, 
          error: 'serviceCategory is required for professional orders' 
        });
      }
      if (!details) {
        return res.status(400).json({ 
          success: false, 
          error: 'details is required for professional orders' 
        });
      }
      if (!location) {
        return res.status(400).json({ 
          success: false, 
          error: 'location is required for professional orders' 
        });
      }
    }

    const order = new Order({
      ...orderData,
      customer: req.user.id,
      requestedAgent: requestedAgent || null,
      orderType,
      // Include professional order fields
      serviceCategory: serviceCategory || orderData.serviceCategory,
      details: details || orderData.details,
      location: location || orderData.location,
      status: orderType === 'professional'
        ? 'requested' // Changed from 'inspection_scheduled' to 'requested'
        : 'pending_agent_response',
      paymentStatus: 'pending'
    });

    order.timeline.push({
      status: 'requested',
      note:
        orderType === 'professional'
          ? 'Professional service requested. Representative will inspect before quotation.'
          : 'Waiting for agent response.'
    });

    await order.save();
    await order.populate('serviceCategory', 'name description');

    // Notify accordingly
    await notifyUser(
      req.user.id,
      'ORDER_CREATED',
      [order._id, order.serviceCategory],
      req.io
    );

    // For professional orders, notify representatives
    if (orderType === 'professional' && req.io) {
      req.io.emit('new_professional_order', {
        type: 'PROFESSIONAL_ORDER_CREATED',
        data: {
          orderId: order._id,
          serviceCategory: order.serviceCategory?.name || 'Professional Service',
          customerName: req.user.fullName,
          location: order.location
        }
      });
    }

    res.status(201).json({
      success: true,
      message:
        orderType === 'professional'
          ? 'Professional service request created. A representative will contact you for inspection and quotation.'
          : 'Order created successfully. Waiting for agent response.',
      order
    });
  } catch (err) {
    console.error('Error creating order:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

export const submitQuotation = async (req, res) => {
  try {
    const { quotationAmount, quotationDetails, recommendedAgents } = req.body;

    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, error: 'Order not found' });

    if (order.orderType !== 'professional') {
      return res.status(400).json({ success: false, error: 'Not a professional order' });
    }

    order.quotationAmount = quotationAmount;
    order.quotationDetails = quotationDetails;
    order.recommendedAgents = recommendedAgents || [];
    order.quotationProvidedAt = new Date();
    order.status = 'quotation_provided';

    order.timeline.push({
      status: 'quotation_provided',
      note: `Quotation submitted by ${req.user.fullName}`
    });

    await order.save();

    // Notify customer
    await notifyUser(order.customer, 'QUOTATION_READY', [order._id], req.io);

    res.json({
      success: true,
      message: 'Quotation submitted successfully',
      order
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};


export const acceptQuotation = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, error: 'Order not found' });

    if (order.status !== 'quotation_provided') {
      return res.status(400).json({ success: false, error: 'Quotation not available yet' });
    }

    // Change status to quotation_accepted (NOT awaiting_payment)
    order.status = 'quotation_accepted';
    order.timeline.push({ 
      status: 'quotation_accepted', 
      note: 'Customer accepted quotation. Ready for agent selection.' 
    });

    await order.save();

    await notifyUser(order.customer, 'QUOTATION_ACCEPTED', [order._id], req.io);

    res.json({
      success: true,
      message: 'Quotation accepted. Please select an agent to proceed.',
      nextStep: 'agent_selection', // Frontend knows to show agent selection
      order
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
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
export const updateStatus = async (req, res) => {
  try {
    const { status, note } = req.body;
    const order = await Order.findById(req.params.id)
      .populate('customer', 'fullName email phone')
      .populate('agent', 'fullName email phone');

    if (!order) {
      return res.status(404).json({ 
        success: false,
        error: 'Order not found' 
      });
    }

    const previousStatus = order.status;
    order.status = status;
    
    // Track start and completion times
    if (status === 'in-progress' && previousStatus !== 'in-progress') {
      order.startedAt = new Date();
    }
    
    if (status === 'completed' && previousStatus !== 'completed') {
      order.completedAt = new Date();
    }

    order.timeline.push({ 
      status, 
      note: note || `Status changed from ${previousStatus} to ${status}` 
    });
    
    await order.save();

    // Notify customer about status change
    await notifyUser(
      order.customer._id,
      'ORDER_STATUS_UPDATED',
      [order._id, status, note],
      req.io
    );

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

// Schedule an order
export const scheduleOrder = async (req, res) => {
  try {
    const { scheduledDate, scheduledTime, estimatedDuration } = req.body;
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({ 
        success: false,
        error: 'Order not found' 
      });
    }

    // Check if order is accepted
    if (order.status !== 'accepted') {
      return res.status(400).json({
        success: false,
        error: 'Only accepted orders can be scheduled'
      });
    }

    order.scheduledDate = new Date(scheduledDate);
    order.scheduledTime = scheduledTime;
    order.estimatedDuration = estimatedDuration;
    
    await order.save();

    // Notify both customer and agent
    await notifyUser(
      order.customer._id,
      'ORDER_SCHEDULED',
      [order._id, scheduledDate, scheduledTime],
      req.io
    );

    await notifyUser(
      order.agent._id,
      'ORDER_SCHEDULED_AGENT',
      [order._id, scheduledDate, scheduledTime],
      req.io
    );

    res.json({
      success: true,
      message: 'Order scheduled successfully',
      order
    });
  } catch (err) {
    res.status(500).json({ 
      success: false,
      error: err.message 
    });
  }
};

// Add review and rating
export const addReview = async (req, res) => {
  try {
    const { rating, review } = req.body;
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({ 
        success: false,
        error: 'Order not found' 
      });
    }

    // Check if order is completed
    if (order.status !== 'completed') {
      return res.status(400).json({
        success: false,
        error: 'Only completed orders can be reviewed'
      });
    }

    // Check if customer owns this order
    if (order.customer.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: 'You can only review your own orders'
      });
    }

    order.rating = rating;
    order.review = review;
    order.reviewedAt = new Date();
    
    await order.save();

    // Notify agent about review
    await notifyUser(
      order.agent._id,
      'ORDER_REVIEWED',
      [order._id, rating],
      req.io
    );

    res.json({
      success: true,
      message: 'Review added successfully',
      order
    });
  } catch (err) {
    res.status(500).json({ 
      success: false,
      error: err.message 
    });
  }
};

// 🔥 NEW: Get Customer Service History
export const getCustomerServiceHistory = async (req, res) => {
  try {
    const { status, page = 1, limit = 10, dateFrom, dateTo } = req.query;
    
    const query = { customer: req.user.id };
    
    // Filter by status
    if (status && status !== 'all') {
      if (status === 'ongoing') {
        query.status = { $in: ['accepted', 'in-progress'] };
      } else if (status === 'completed') {
        query.status = 'completed';
      } else {
        query.status = status;
      }
    }
    
    // Filter by date range
    if (dateFrom || dateTo) {
      query.createdAt = {};
      if (dateFrom) query.createdAt.$gte = new Date(dateFrom);
      if (dateTo) query.createdAt.$lte = new Date(dateTo);
    }

    const orders = await Order.find(query)
      .populate('serviceCategory', 'name description')
      .populate('agent', 'fullName profileImage rating')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Order.countDocuments(query);

    // Calculate statistics
    const totalOrders = await Order.countDocuments({ customer: req.user.id });
    const completedOrders = await Order.countDocuments({ 
      customer: req.user.id, 
      status: 'completed' 
    });
    const ongoingOrders = await Order.countDocuments({ 
      customer: req.user.id, 
      status: { $in: ['accepted', 'in-progress'] } 
    });

    res.json({
      success: true,
      orders,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total
      },
      statistics: {
        total: totalOrders,
        completed: completedOrders,
        ongoing: ongoingOrders,
        completionRate: totalOrders > 0 ? (completedOrders / totalOrders * 100).toFixed(1) : 0
      }
    });
  } catch (err) {
    res.status(500).json({ 
      success: false,
      error: err.message 
    });
  }
};

// 🔥 NEW: Get Agent Service History
export const getAgentServiceHistory = async (req, res) => {
  try {
    const { status, page = 1, limit = 10, dateFrom, dateTo } = req.query;
    
    const query = { agent: req.user.id };
    
    // Filter by status
    if (status && status !== 'all') {
      if (status === 'ongoing') {
        query.status = { $in: ['accepted', 'in-progress'] };
      } else if (status === 'completed') {
        query.status = 'completed';
      } else {
        query.status = status;
      }
    }
    
    // Filter by date range
    if (dateFrom || dateTo) {
      query.createdAt = {};
      if (dateFrom) query.createdAt.$gte = new Date(dateFrom);
      if (dateTo) query.createdAt.$lte = new Date(dateTo);
    }

    const orders = await Order.find(query)
      .populate('serviceCategory', 'name description')
      .populate('customer', 'fullName profileImage phone')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Order.countDocuments(query);

    // Calculate agent statistics
    const totalOrders = await Order.countDocuments({ agent: req.user.id });
    const completedOrders = await Order.countDocuments({ 
      agent: req.user.id, 
      status: 'completed' 
    });
    const ongoingOrders = await Order.countDocuments({ 
      agent: req.user.id, 
      status: { $in: ['accepted', 'in-progress'] } 
    });
    const totalEarnings = await Order.aggregate([
      { $match: { agent: req.user.id, status: 'completed' } },
      { $group: { _id: null, total: { $sum: '$price' } } }
    ]);

    res.json({
      success: true,
      orders,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total
      },
      statistics: {
        total: totalOrders,
        completed: completedOrders,
        ongoing: ongoingOrders,
        totalEarnings: totalEarnings[0]?.total || 0,
        completionRate: totalOrders > 0 ? (completedOrders / totalOrders * 100).toFixed(1) : 0,
        averageRating: 4.5 // You can calculate this from reviews
      }
    });
  } catch (err) {
    res.status(500).json({ 
      success: false,
      error: err.message 
    });
  }
};

// 🔥 NEW: Get Today's Schedule
export const getTodaysSchedule = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const query = {
      agent: req.user.id,
      scheduledDate: {
        $gte: today,
        $lt: tomorrow
      },
      status: { $in: ['accepted', 'in-progress'] }
    };

    const schedule = await Order.find(query)
      .populate('customer', 'fullName phone location')
      .populate('serviceCategory', 'name')
      .sort({ scheduledTime: 1 });

    // Group by time slots
    const morning = schedule.filter(order => 
      order.scheduledTime && order.scheduledTime.includes('AM')
    );
    const afternoon = schedule.filter(order => 
      order.scheduledTime && order.scheduledTime.includes('PM')
    );

    res.json({
      success: true,
      schedule: {
        morning,
        afternoon,
        all: schedule
      },
      date: today.toISOString().split('T')[0]
    });
  } catch (err) {
    res.status(500).json({ 
      success: false,
      error: err.message 
    });
  }
};

// 🔥 NEW: Get Upcoming Schedule
export const getUpcomingSchedule = async (req, res) => {
  try {
    const { days = 7 } = req.query;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const futureDate = new Date(today);
    futureDate.setDate(futureDate.getDate() + parseInt(days));

    const query = {
      agent: req.user.id,
      scheduledDate: {
        $gte: today,
        $lt: futureDate
      },
      status: { $in: ['accepted', 'in-progress'] }
    };

    const schedule = await Order.find(query)
      .populate('customer', 'fullName phone location')
      .populate('serviceCategory', 'name')
      .sort({ scheduledDate: 1, scheduledTime: 1 });

    // Group by date
    const scheduleByDate = schedule.reduce((acc, order) => {
      const date = order.scheduledDate.toISOString().split('T')[0];
      if (!acc[date]) {
        acc[date] = [];
      }
      acc[date].push(order);
      return acc;
    }, {});

    res.json({
      success: true,
      schedule: scheduleByDate,
      dateRange: {
        from: today.toISOString().split('T')[0],
        to: futureDate.toISOString().split('T')[0]
      }
    });
  } catch (err) {
    res.status(500).json({ 
      success: false,
      error: err.message 
    });
  }
};

export const createProfessionalOrder = async (req, res) => {
  try {
    const { serviceCategory, details, location, ...orderData } = req.body;

    const order = new Order({
      ...orderData,
      customer: req.user.id,
      serviceCategory,
      details,
      location,
      orderType: 'professional',
      status: 'requested',
      paymentStatus: 'pending'
    });

    order.timeline.push({
      status: 'requested',
      note: 'Professional service requested. Waiting for representative inspection and quotation.'
    });

    await order.save();
    await order.populate('serviceCategory', 'name description');

    // Notify admin/representatives about new professional order
    // You might want to notify all representatives here
    if (req.io) {
      req.io.emit('new_professional_order', {
        type: 'PROFESSIONAL_ORDER_CREATED',
        data: {
          orderId: order._id,
          serviceCategory: order.serviceCategory.name,
          customerName: req.user.fullName,
          location: order.location
        }
      });
    }

    res.status(201).json({
      success: true,
      message: 'Professional service request created. A representative will contact you for inspection and quotation.',
      order
    });
  } catch (err) {
    res.status(500).json({ 
      success: false,
      error: err.message 
    });
  }
};

