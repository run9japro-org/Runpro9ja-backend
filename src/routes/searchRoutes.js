import express from 'express';
import Order from '../models/Order.js';
import { Payment } from '../models/Payment.js';
import { User } from '../models/User.js';

const router = express.Router();

// Unified search endpoint
router.get('/search', async (req, res) => {
  try {
    const { q } = req.query;
    
    if (!q || q.trim() === '') {
      return res.json({ 
        success: true,
        results: [],
        message: 'Please enter a search term'
      });
    }

    const searchTerm = q.trim();
    const searchRegex = new RegExp(searchTerm, 'i');

    // Search across all collections in parallel
    const [orders, payments, users] = await Promise.all([
      // Search Orders
      Order.find({
        $or: [
          { details: searchRegex },
          { pickupLocation: searchRegex },
          { destinationLocation: searchRegex },
          { location: searchRegex },
          { quotationDetails: searchRegex },
          { 'timeline.note': searchRegex }
        ]
      })
      .populate('customer', 'fullName email phone')
      .populate('agent', 'fullName email phone')
      .populate('representative', 'fullName email phone')
      .populate('serviceCategory', 'name')
      .limit(8)
      .sort({ createdAt: -1 })
      .lean(),

      // Search Payments
      Payment.find({
        $or: [
          { reference: searchRegex },
          { paymentMethod: searchRegex },
          { status: searchRegex }
        ]
      })
      .populate('customer', 'fullName email')
      .populate('agent', 'fullName email')
      .populate('order')
      .limit(8)
      .sort({ createdAt: -1 })
      .lean(),

      // Search Users
      User.find({
        $or: [
          { fullName: searchRegex },
          { email: searchRegex },
          { phone: searchRegex },
          { username: searchRegex },
          { role: searchRegex },
          { 'addresses.addressLine': searchRegex },
          { 'addresses.city': searchRegex }
        ]
      })
      .select('fullName email phone role profileImage avatarUrl createdAt')
      .limit(8)
      .sort({ createdAt: -1 })
      .lean()
    ]);

    // Format results
    const results = [];

    // Format orders
    orders.forEach(order => {
      const currentStatus = order.timeline && order.timeline.length > 0 
        ? order.timeline[order.timeline.length - 1].status 
        : 'requested';

      results.push({
        id: order._id,
        title: `Order #${order._id.toString().slice(-6)}`,
        description: getOrderDescription(order),
        type: 'Order',
        status: currentStatus,
        customerName: order.customer?.fullName,
        amount: order.price || order.quotationAmount,
        route: `/delivery/${order._id}`,
        timestamp: order.createdAt,
        icon: '📦'
      });
    });

    // Format payments
    payments.forEach(payment => {
      results.push({
        id: payment._id,
        title: `Payment ${payment.reference}`,
        description: getPaymentDescription(payment),
        type: 'Payment',
        status: payment.status,
        customerName: payment.customer?.fullName,
        amount: payment.amount,
        route: `/payments/${payment._id}`,
        timestamp: payment.createdAt,
        icon: '💳'
      });
    });

    // Format users
    users.forEach(user => {
      results.push({
        id: user._id,
        title: user.fullName,
        description: getUserDescription(user),
        type: 'User',
        status: user.isVerified ? 'verified' : 'pending',
        role: user.role,
        email: user.email,
        route: `/accounts/${user._id}`,
        timestamp: user.createdAt,
        icon: getRoleIcon(user.role)
      });
    });

    // Sort by timestamp (most recent first)
    results.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    res.json({
      success: true,
      results: results.slice(0, 15), // Limit total results
      count: results.length,
      breakdown: {
        orders: orders.length,
        payments: payments.length,
        users: users.length
      }
    });

  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({
      success: false,
      message: 'Search failed',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Helper functions
function getOrderDescription(order) {
  const parts = [];
  
  if (order.customer?.fullName) {
    parts.push(`Customer: ${order.customer.fullName}`);
  }
  
  if (order.serviceCategory?.name) {
    parts.push(`Service: ${order.serviceCategory.name}`);
  }
  
  const currentStatus = order.timeline && order.timeline.length > 0 
    ? order.timeline[order.timeline.length - 1].status 
    : 'requested';
  parts.push(`Status: ${formatStatus(currentStatus)}`);
  
  if (order.price || order.quotationAmount) {
    parts.push(`Amount: ₦${(order.price || order.quotationAmount).toLocaleString()}`);
  }
  
  return parts.join(' • ');
}

function getPaymentDescription(payment) {
  const parts = [];
  
  if (payment.customer?.fullName) {
    parts.push(`Customer: ${payment.customer.fullName}`);
  }
  
  parts.push(`Method: ${payment.paymentMethod}`);
  parts.push(`Status: ${payment.status}`);
  
  if (payment.amount) {
    parts.push(`Amount: ₦${payment.amount.toLocaleString()}`);
  }
  
  return parts.join(' • ');
}

function getUserDescription(user) {
  const parts = [];
  
  parts.push(`${user.role}`);
  
  if (user.email) {
    parts.push(user.email);
  }
  
  if (user.phone) {
    parts.push(user.phone);
  }
  
  return parts.join(' • ');
}

function formatStatus(status) {
  return status.split('_').map(word => 
    word.charAt(0).toUpperCase() + word.slice(1)
  ).join(' ');
}

function getRoleIcon(role) {
  const icons = {
    customer: '👤',
    agent: '🚚',
    admin: '⚙️',
    representative: '👔'
  };
  return icons[role] || '👤';
}

// Advanced search by type
router.get('/search/:type', async (req, res) => {
  try {
    const { type } = req.params;
    const { q, status, page = 1, limit = 10 } = req.query;
    
    if (!q) {
      return res.status(400).json({
        success: false,
        message: 'Search query is required'
      });
    }

    const searchRegex = new RegExp(q.trim(), 'i');
    let query = { $or: [] };
    let results = [];

    switch (type) {
      case 'orders':
        query.$or = [
          { details: searchRegex },
          { pickupLocation: searchRegex },
          { destinationLocation: searchRegex },
          { location: searchRegex }
        ];
        
        if (status) {
          // For orders, we need to check the latest timeline status
          const orders = await Order.find(query)
            .populate('customer', 'fullName email phone')
            .populate('agent', 'fullName email phone')
            .populate('serviceCategory', 'name')
            .sort({ createdAt: -1 })
            .lean();

          results = orders.filter(order => {
            const currentStatus = order.timeline && order.timeline.length > 0 
              ? order.timeline[order.timeline.length - 1].status 
              : 'requested';
            return currentStatus === status;
          });
        } else {
          results = await Order.find(query)
            .populate('customer', 'fullName email phone')
            .populate('agent', 'fullName email phone')
            .populate('serviceCategory', 'name')
            .limit(parseInt(limit))
            .skip((parseInt(page) - 1) * parseInt(limit))
            .sort({ createdAt: -1 })
            .lean();
        }
        break;

      case 'payments':
        query.$or = [
          { reference: searchRegex },
          { paymentMethod: searchRegex }
        ];
        
        if (status) query.status = status;
        
        results = await Payment.find(query)
          .populate('customer', 'fullName email')
          .populate('agent', 'fullName email')
          .populate('order')
          .limit(parseInt(limit))
          .skip((parseInt(page) - 1) * parseInt(limit))
          .sort({ createdAt: -1 })
          .lean();
        break;

      case 'users':
        query.$or = [
          { fullName: searchRegex },
          { email: searchRegex },
          { phone: searchRegex },
          { username: searchRegex }
        ];
        
        if (status === 'verified') query.isVerified = true;
        if (status && status !== 'verified') query.role = status;
        
        results = await User.find(query)
          .select('fullName email phone role profileImage avatarUrl isVerified createdAt')
          .limit(parseInt(limit))
          .skip((parseInt(page) - 1) * parseInt(limit))
          .sort({ createdAt: -1 })
          .lean();
        break;

      default:
        return res.status(400).json({
          success: false,
          message: 'Invalid search type. Use: orders, payments, or users'
        });
    }

    res.json({
      success: true,
      results: results,
      count: results.length,
      type: type,
      page: parseInt(page),
      limit: parseInt(limit)
    });

  } catch (error) {
    console.error('Advanced search error:', error);
    res.status(500).json({
      success: false,
      message: 'Advanced search failed'
    });
  }
});

export default router;