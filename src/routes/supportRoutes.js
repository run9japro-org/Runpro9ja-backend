// routes/support.js
import express from "express";
import { authGuard } from "../middlewares/auth.js";
import { Message } from "../models/Chat.js";

const router = express.Router();

// Support-specific middleware
const isSupportAgent = (req, res, next) => {
  // Assuming you have user roles in your user model
  if (req.user.role !== 'support' && req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Support agent role required.'
    });
  }
  next();
};

// 1. Start support chat (for users)
router.post('/start-support', authGuard, async (req, res, next) => {
  try {
    const { message, issueType = 'general' } = req.body;
    
    if (!message) {
      return res.status(400).json({
        success: false,
        message: 'Message is required'
      });
    }

    // Find available support agent (you'll need to implement this logic)
    const supportAgent = await findAvailableSupportAgent();
    
    if (!supportAgent) {
      return res.status(503).json({
        success: false,
        message: 'No support agents available at the moment. Please try again later.'
      });
    }

    // Create support message
    const supportMsg = await Message.create({
      sender: req.user._id,
      receiver: supportAgent._id, // Send to support agent
      message: `[SUPPORT - ${issueType.toUpperCase()}] ${message}`,
      isSupportChat: true,
      supportIssueType: issueType,
      supportStatus: 'open'
    });

    // Populate user info
    await supportMsg.populate('sender', 'name email profileImage');
    await supportMsg.populate('receiver', 'name email profileImage');

    // Emit via Socket.io
    if (req.io) {
      req.io.to(supportAgent._id.toString()).emit("new_support_ticket", supportMsg);
    }

    res.json({ 
      success: true, 
      msg: supportMsg,
      assignedAgent: {
        id: supportAgent._id,
        name: supportAgent.name
      }
    });
  } catch (err) {
    console.error('Error starting support chat:', err);
    next(err);
  }
});

// 2. Get all support tickets (for support agents)
router.get('/support/tickets', authGuard, isSupportAgent, async (req, res, next) => {
  try {
    const { status = 'open' } = req.query;
    
    const supportTickets = await Message.find({
      isSupportChat: true,
      supportStatus: status
    })
    .populate('sender', 'name email profileImage')
    .populate('receiver', 'name email profileImage')
    .sort({ createdAt: -1 });

    res.json({ success: true, tickets: supportTickets });
  } catch (err) {
    console.error('Error getting support tickets:', err);
    next(err);
  }
});

// 3. Support agent replies to ticket
router.post('/support/reply/:ticketId', authGuard, isSupportAgent, async (req, res, next) => {
  try {
    const { ticketId } = req.params;
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({
        success: false,
        message: 'Message is required'
      });
    }

    // Find the original support ticket
    const originalTicket = await Message.findById(ticketId);
    
    if (!originalTicket) {
      return res.status(404).json({
        success: false,
        message: 'Support ticket not found'
      });
    }

    // Create reply message
    const replyMsg = await Message.create({
      sender: req.user._id, // Support agent
      receiver: originalTicket.sender, // Send back to original user
      message: `[SUPPORT REPLY] ${message}`,
      isSupportChat: true,
      supportIssueType: originalTicket.supportIssueType,
      supportStatus: 'in_progress',
      parentTicket: ticketId
    });

    // Update original ticket status
    originalTicket.supportStatus = 'in_progress';
    await originalTicket.save();

    // Populate user info
    await replyMsg.populate('sender', 'name email profileImage');
    await replyMsg.populate('receiver', 'name email profileImage');

    // Emit via Socket.io
    if (req.io) {
      req.io.to(originalTicket.sender.toString()).emit("support_reply", replyMsg);
    }

    res.json({ success: true, msg: replyMsg });
  } catch (err) {
    console.error('Error replying to support ticket:', err);
    next(err);
  }
});

// 4. Close support ticket
router.patch('/support/close/:ticketId', authGuard, isSupportAgent, async (req, res, next) => {
  try {
    const { ticketId } = req.params;
    const { resolution } = req.body;

    const ticket = await Message.findById(ticketId);
    
    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Support ticket not found'
      });
    }

    ticket.supportStatus = 'closed';
    if (resolution) {
      ticket.supportResolution = resolution;
    }
    
    await ticket.save();

    // Notify user that ticket is closed
    if (req.io) {
      req.io.to(ticket.sender.toString()).emit("support_ticket_closed", {
        ticketId,
        resolution
      });
    }

    res.json({ 
      success: true, 
      message: 'Support ticket closed successfully',
      ticket 
    });
  } catch (err) {
    console.error('Error closing support ticket:', err);
    next(err);
  }
});

// Helper function to find available support agent
async function findAvailableSupportAgent() {
  // Implement your logic to find available support agents
  // This is a simplified version - you'll want to add proper agent availability logic
  const User = mongoose.model('User');
  return await User.findOne({ 
    role: 'support', 
    isAvailable: true 
  }).select('name email _id');
}

export default router;