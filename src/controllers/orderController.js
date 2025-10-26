import Order from '../models/Order.js';
import { notifyUser } from '../services/notificationService.js';

// Step 1: Customer creates order with selected agent
// In your orderController.js - UPDATED createOrder function

export const createOrder = async (req, res) => {
  try {
    const {
      requestedAgent,
      orderType = 'normal',
      serviceCategory,
      details,
      pickup,
      destination,
      serviceScale = 'minimum',
      ...orderData
    } = req.body;

    // Fetch user details from DB
    const user = req.user;

    // 1️⃣ Validate pickup location is provided
    

    // 2️⃣ Validate required professional fields
    if (orderType === 'professional') {
      if (!serviceCategory) {
        return res.status(400).json({
          success: false,
          error: 'serviceCategory is required for professional orders',
        });
      }
      if (!details) {
        return res.status(400).json({
          success: false,
          error: 'details is required for professional orders',
        });
      }
      
    }

    // 3️⃣ Determine initial status
    let initialStatus, timelineNote;
    if (orderType === 'professional') {
      if (serviceScale === 'minimum') {
        initialStatus = 'requested';
        timelineNote = 'Minimum scale service requested. Ready for agent selection.';
      } else {
        initialStatus = 'requested';
        timelineNote = 'Large scale service requested. Representative will inspect before quotation.';
      }
    } else {
      initialStatus = 'pending_agent_response';
      timelineNote = 'Waiting for agent response.';
    }

    // 4️⃣ Create Order
    const order = new Order({
      ...orderData,
      customer: user.id,
      requestedAgent: requestedAgent || null,
      orderType,
      serviceScale,
      serviceCategory,
      details,
      pickup: pickup, // 🚀 No default - must be provided
      destination,
      status: initialStatus,
      paymentStatus: 'pending',
    });

    order.timeline.push({
      status: initialStatus,
      note: timelineNote,
    });

    await order.save();
    await order.populate('serviceCategory', 'name description');

    // 5️⃣ Notify the user
    await notifyUser(
      user.id,
      'ORDER_CREATED',
      [order._id, order.serviceCategory],
      req.io
    );

    // 6️⃣ Notify available agents or representatives
    if (orderType === 'professional' && req.io) {
      const eventData = {
        orderId: order._id,
        serviceCategory: order.serviceCategory?.name || 'Professional Service',
        customerName: user.fullName,
        pickup: order.pickup,
        destination: order.destination,
        serviceScale,
      };

      req.io.emit(
        serviceScale === 'large_scale'
          ? 'new_professional_order'
          : 'new_minimum_scale_order',
        { type: 'ORDER_CREATED', data: eventData }
      );
    }

    // ✅ 7️⃣ Response
    res.status(201).json({
      success: true,
      message:
        orderType === 'professional'
          ? serviceScale === 'minimum'
            ? 'Minimum scale service requested. You can now select an agent.'
            : 'Large scale service requested. A representative will contact you for inspection and quotation.'
          : 'Order created successfully. Waiting for agent response.',
      order,
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


// Step 2: Agent accepts the direct offer - FIXED
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

    console.log('🔍 Order details:', {
      orderId: order._id,
      status: order.status,
      requestedAgent: order.requestedAgent?._id,
      currentUser: req.user.id
    });

    // Check if this agent was the one requested
    if (!order.requestedAgent || order.requestedAgent._id.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: 'This order was not offered to you'
      });
    }

    // Check if order is still waiting for response
    if (order.status !== 'pending_agent_response') {
      return res.status(400).json({
        success: false,
        error: `Order is no longer available. Current status: ${order.status}`
      });
    }

    // Update order - agent accepted!
    order.status = 'accepted';
    order.agent = req.user.id;
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
      nextStep: 'payment'
    });
  } catch (err) {
    console.error('Error accepting direct order:', err);
    res.status(500).json({ 
      success: false,
      error: err.message 
    });
  }
};

// Step 3: Agent rejects the direct offer - FIXED
export const rejectOrder = async (req, res) => {
  try {
    const { reason } = req.body;
    const order = await Order.findById(req.params.id)
      .populate('customer', 'fullName email phone')
      .populate('requestedAgent', 'fullName email phone');

    if (!order) {
      return res.status(404).json({ 
        success: false,
        error: 'Order not found' 
      });
    }

    console.log('🔍 Reject order details:', {
      orderId: order._id,
      status: order.status,
      requestedAgent: order.requestedAgent?._id,
      currentUser: req.user.id
    });

    // Check if this agent was the one requested
    if (!order.requestedAgent || order.requestedAgent._id.toString() !== req.user.id) {
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
      status: 'public', 
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
          pickup: order.pickup,
          destination: order.destination,
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
    console.error('Error rejecting direct order:', err);
    res.status(500).json({ 
      success: false,
      error: err.message 
    });
  }
};

// Step 4: Any agent can accept public orders - FIXED
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

    console.log('🔍 Accept public order details:', {
      orderId: order._id,
      status: order.status,
      currentUser: req.user.id,
      declinedBy: order.declinedBy.map(d => d.agent?._id)
    });

    // Check if order is public or available for acceptance
    if (order.status !== 'public') {
      return res.status(400).json({
        success: false,
        error: `Order is not available for public acceptance. Current status: ${order.status}`
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

    // Check if order already has an agent
    if (order.agent) {
      return res.status(400).json({
        success: false,
        error: 'This order already has an assigned agent'
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
    console.error('Error accepting public order:', err);
    res.status(500).json({ 
      success: false,
      error: err.message 
    });
  }
};

// Get available public orders for agents - FIXED
export const getPublicOrders = async (req, res) => {
  try {
    const { serviceType } = req.query;
    
    const query = {
      status: 'public',
      agent: { $exists: false }, // No agent assigned yet
      'declinedBy.agent': { $ne: req.user.id } // Exclude orders this agent already declined
    };
    
    if (serviceType) {
      query.serviceType = serviceType;
    }

    const orders = await Order.find(query)
      .populate('customer', 'fullName email phone location')
      .populate('serviceCategory', 'name description')
      .populate('declinedBy.agent', 'fullName')
      .populate('requestedAgent', 'fullName')
      .sort({ createdAt: -1 });

    console.log(`🔍 Found ${orders.length} public orders for agent ${req.user.id}`);

    res.json({
      success: true,
      orders,
      count: orders.length
    });
  } catch (err) {
    console.error('Error getting public orders:', err);
    res.status(500).json({ 
      success: false,
      error: err.message 
    });
  }
};

// Get orders specifically offered to an agent - FIXED
export const getDirectOffers = async (req, res) => {
  try {
    const orders = await Order.find({
      requestedAgent: req.user.id,
      status: 'pending_agent_response',
      agent: { $exists: false } // No agent assigned yet
    })
      .populate('customer', 'fullName email phone location')
      .populate('serviceCategory', 'name description')
      .populate('requestedAgent', 'fullName email phone')
      .sort({ createdAt: -1 });

    console.log(`🔍 Found ${orders.length} direct offers for agent ${req.user.id}`);

    res.json({
      success: true,
      orders,
      count: orders.length
    });
  } catch (err) {
    console.error('Error getting direct offers:', err);
    res.status(500).json({ 
      success: false,
      error: err.message 
    });
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



// NEW: Customer selects agent after accepting quotation
export const selectAgentAfterQuotation = async (req, res) => {
  try {
    const { agentId } = req.body;

    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ 
        success: false,
        error: 'Order not found' 
      });
    }

    // Check if order is in the correct state
    if (order.status !== 'quotation_accepted') {
      return res.status(400).json({
        success: false,
        error: 'Quotation must be accepted before selecting an agent'
      });
    }

    // Validate agent is in recommended agents (optional)
    if (order.recommendedAgents && order.recommendedAgents.length > 0) {
      const isRecommended = order.recommendedAgents.some(
        recAgent => recAgent.toString() === agentId
      );
      
      if (!isRecommended) {
        return res.status(400).json({
          success: false,
          error: 'Selected agent is not in the recommended list'
        });
      }
    }

    // Assign the selected agent
    order.agent = agentId;
    order.status = 'agent_selected';
    
    order.timeline.push({
      status: 'agent_selected',
      note: `Customer selected agent for the service`
    });

    await order.save();

    // Populate for response
    await order.populate('agent', 'fullName email phone');
    await order.populate('customer', 'fullName email phone');

    // Notify the selected agent
    await notifyUser(
      agentId,
      'AGENT_SELECTED_FOR_QUOTATION',
      [order._id, order.customer.fullName, order.quotationAmount],
      req.io
    );

    // Notify customer
    await notifyUser(
      order.customer._id,
      'AGENT_SELECTED_CONFIRMED',
      [order._id, order.agent.fullName],
      req.io
    );

    res.json({
      success: true,
      message: 'Agent selected successfully. Order is now ready to proceed.',
      order,
      nextStep: 'scheduling' // Frontend knows to proceed to scheduling
    });
  } catch (err) {
    res.status(500).json({ 
      success: false,
      error: err.message 
    });
  }
};

export const getProfessionalOrders = async (req, res) => {
  try {
    const orders = await Order.find({
      orderType: 'professional',
      status: 'requested' // Only show orders waiting for quotation
    })
      .populate('customer', 'fullName email phone')
      .populate('serviceCategory', 'name description')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      orders,
      count: orders.length
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// NEW: For minimum scale professional orders - direct agent selection
export const selectAgentForMinimumScale = async (req, res) => {
  try {
    const { agentId } = req.body;

    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ 
        success: false,
        error: 'Order not found' 
      });
    }

    // Validate this is a minimum scale professional order
    if (order.orderType !== 'professional' || order.serviceScale !== 'minimum') {
      return res.status(400).json({
        success: false,
        error: 'This order is not eligible for direct agent selection'
      });
    }

    // Validate order is in correct status
    if (order.status !== 'requested') {
      return res.status(400).json({
        success: false,
        error: 'Order is not in the correct status for agent selection'
      });
    }

    // Assign the agent directly
    order.agent = agentId;
    order.status = 'agent_selected';
    
    order.timeline.push({
      status: 'agent_selected',
      note: `Agent selected for minimum scale service`
    });

    await order.save();

    // Populate for response
    await order.populate('agent', 'fullName email phone');
    await order.populate('customer', 'fullName email phone');

    // Notify the selected agent
    await notifyUser(
      agentId,
      'AGENT_SELECTED_MINIMUM_SCALE',
      [order._id, order.customer.fullName],
      req.io
    );

    // Notify customer
    await notifyUser(
      order.customer._id,
      'AGENT_SELECTED_MINIMUM_CONFIRMED',
      [order._id, order.agent.fullName],
      req.io
    );

    res.json({
      success: true,
      message: 'Agent selected successfully. You can now proceed to scheduling and payment.',
      order,
      nextStep: 'scheduling' // Frontend knows to proceed to scheduling
    });
  } catch (err) {
    res.status(500).json({ 
      success: false,
      error: err.message 
    });
  }
};
// controllers/orderController.js - ADD THIS METHOD
export const getOrderById = async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log(`🔍 Fetching order by ID: ${id}`);
    console.log(`👤 Request user: ${req.user.id}, Role: ${req.user.role}`);

    // Find the order and populate all necessary fields
    const order = await Order.findById(id)
      .populate('customer', 'fullName email phone profileImage')
      .populate('agent', 'fullName email phone profileImage rating')
      .populate('requestedAgent', 'fullName email phone')
      .populate('serviceCategory', 'name description')
      .populate('recommendedAgents', 'fullName email phone rating')
      .populate('representative', 'fullName email phone')
      .populate('declinedBy.agent', 'fullName');

    if (!order) {
      console.log(`❌ Order not found: ${id}`);
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }

    // Authorization check - users can only see their own orders or orders they're involved with
    const isCustomer = order.customer && order.customer._id.toString() === req.user.id;
    const isAgent = order.agent && order.agent._id.toString() === req.user.id;
    const isRequestedAgent = order.requestedAgent && order.requestedAgent._id.toString() === req.user.id;
    const isRepresentative = req.user.role === ROLES.REPRESENTATIVE || req.user.role === ROLES.ADMIN;
    
    console.log(`🔐 Authorization check - Customer: ${isCustomer}, Agent: ${isAgent}, RequestedAgent: ${isRequestedAgent}, Representative: ${isRepresentative}`);

    if (!isCustomer && !isAgent && !isRequestedAgent && !isRepresentative) {
      console.log(`❌ User ${req.user.id} not authorized to view order ${id}`);
      return res.status(403).json({
        success: false,
        error: 'You are not authorized to view this order'
      });
    }

    console.log(`✅ Order found and user authorized: ${order._id}`);

    // Format the response
    const orderResponse = {
      success: true,
      order: {
        _id: order._id,
        orderType: order.orderType,
        serviceType: order.serviceType,
        serviceCategory: order.serviceCategory,
        serviceScale: order.serviceScale,
        details: order.details,
        location: order.location,
        price: order.price,
        status: order.status,
        paymentStatus: order.paymentStatus,
        customer: order.customer,
        agent: order.agent,
        requestedAgent: order.requestedAgent,
        isPublic: order.isPublic,
        isDirectOffer: order.isDirectOffer,
        
        // Professional service fields
        quotationDetails: order.quotationDetails,
        quotationAmount: order.quotationAmount,
        quotationProvidedAt: order.quotationProvidedAt,
        recommendedAgents: order.recommendedAgents,
        representative: order.representative,
        
        // Scheduling
        scheduledDate: order.scheduledDate,
        scheduledTime: order.scheduledTime,
        estimatedDuration: order.estimatedDuration,
        
        // Timestamps
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
        startedAt: order.startedAt,
        completedAt: order.completedAt,
        
        // Timeline
        timeline: order.timeline || [],
        
        // Delivery tracking (if applicable)
        currentLocation: order.currentLocation,
        deliveryUpdates: order.deliveryUpdates || [],
        
        // Reviews
        rating: order.rating,
        review: order.review,
        reviewedAt: order.reviewedAt,
        
        // Additional fields
        urgency: order.urgency,
        declinedBy: order.declinedBy || []
      }
    };

    res.json(orderResponse);

  } catch (error) {
    console.error('❌ Error fetching order by ID:', error);
    
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        error: 'Invalid order ID format'
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Internal server error while fetching order'
    });
  }
};