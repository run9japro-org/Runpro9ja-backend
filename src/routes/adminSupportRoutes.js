// routes/adminSupport.js
import express from "express";
import { authGuard } from "../middlewares/auth.js";
import { Message } from "../models/Chat.js";
import { User } from "../models/User.js";

const router = express.Router();

// Middleware to check if user is admin/support
const isAdminOrSupport = (req, res, next) => {
  if (!['admin', 'support'].includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Admin or support role required.'
    });
  }
  next();
};

// 1. Get all support conversations for admin dashboard
router.get('/conversations', authGuard, isAdminOrSupport, async (req, res, next) => {
  try {
    // Get unique customers who have support conversations
    const supportConversations = await Message.aggregate([
      { $match: { isSupportChat: true } },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: "$sender",
          lastMessage: { $first: "$message" },
          lastMessageTime: { $first: "$createdAt" },
          unreadCount: {
            $sum: {
              $cond: [{ $eq: ["$read", false] }, 1, 0]
            }
          }
        }
      },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "customer"
        }
      },
      { $unwind: "$customer" },
      {
        $project: {
          id: "$customer._id",
          name: "$customer.name",
          email: "$customer.email",
          phone: "$customer.phone",
          lastMessage: "$lastMessage",
          lastActive: "$lastMessageTime",
          unread: "$unreadCount",
          avatar: { $substr: ["$customer.name", 0, 1] }
        }
      }
    ]);

    res.json({
      success: true,
      customers: supportConversations
    });

  } catch (err) {
    console.error('Error getting support conversations:', err);
    next(err);
  }
});

// 2. Get messages between admin and specific customer
router.get('/conversation/:customerId', authGuard, isAdminOrSupport, async (req, res, next) => {
  try {
    const { customerId } = req.params;

    const messages = await Message.find({
      $or: [
        { sender: req.user._id, receiver: customerId, isSupportChat: true },
        { sender: customerId, receiver: req.user._id, isSupportChat: true }
      ]
    })
    .populate('sender', 'name email profileImage')
    .populate('receiver', 'name email profileImage')
    .sort({ createdAt: 1 });

    // Format messages for React frontend
    const formattedMessages = messages.map(msg => ({
      id: msg._id,
      sender: msg.sender._id.toString() === req.user._id.toString() ? 'admin' : msg.sender.name,
      text: msg.message,
      time: new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      timestamp: msg.createdAt,
      status: 'delivered',
      type: msg.sender._id.toString() === req.user._id.toString() ? 'outgoing' : 'incoming'
    }));

    res.json({
      success: true,
      messages: formattedMessages
    });

  } catch (err) {
    console.error('Error getting conversation:', err);
    next(err);
  }
});

// 3. Admin sends message to customer
router.post('/send-to-customer', authGuard, isAdminOrSupport, async (req, res, next) => {
  try {
    const { customerId, message } = req.body;

    const supportMsg = await Message.create({
      sender: req.user._id,
      receiver: customerId,
      message: message,
      isSupportChat: true,
      supportStatus: 'in_progress'
    });

    // Populate user info
    await supportMsg.populate('sender', 'name email profileImage');
    await supportMsg.populate('receiver', 'name email profileImage');

    // Emit via Socket.io
    if (req.io) {
      req.io.to(customerId.toString()).emit("new_support_message", supportMsg);
    }

    res.json({
      success: true,
      message: 'Message sent to customer',
      msg: supportMsg
    });

  } catch (err) {
    console.error('Error sending message to customer:', err);
    next(err);
  }
});

// 4. Get support statistics for dashboard
router.get('/stats', authGuard, isAdminOrSupport, async (req, res, next) => {
  try {
    const totalSupportChats = await Message.countDocuments({ isSupportChat: true });
    const openTickets = await Message.countDocuments({ 
      isSupportChat: true, 
      supportStatus: 'open' 
    });
    const inProgressTickets = await Message.countDocuments({ 
      isSupportChat: true, 
      supportStatus: 'in_progress' 
    });
    const closedTickets = await Message.countDocuments({ 
      isSupportChat: true, 
      supportStatus: 'closed' 
    });

    res.json({
      success: true,
      stats: {
        totalChats: totalSupportChats,
        openTickets,
        inProgressTickets,
        closedTickets
      }
    });

  } catch (err) {
    console.error('Error getting support stats:', err);
    next(err);
  }
});

export default router;