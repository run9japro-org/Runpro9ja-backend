// routes/support.js
import express from "express";
import { authGuard } from "../middlewares/auth.js";
import { Message } from "../models/Chat.js";
import { User } from "../models/User.js"; // Assuming you have a User model

const router = express.Router();

// 1. Start support chat - matches your Flutter app's startSupportChat()
router.post('/start-chat', authGuard, async (req, res, next) => {
  try {
    const { message, category = 'general_support' } = req.body;

    // Find available support agents (you'll need to implement this properly)
    const supportAgents = await User.find({ 
      role: { $in: ['support', 'admin'] },
      isOnline: true 
    }).limit(1);

    if (supportAgents.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'Support chat started',
        supportAgent: {
          id: 'support_system',
          name: 'RunPro Support Team',
          online: true
        }
      });
    }

    const supportAgent = supportAgents[0];

    // Create initial support message
    const supportMessage = await Message.create({
      sender: req.user._id,
      receiver: supportAgent._id,
      message: message || 'Hello, I need help',
      isSupportChat: true,
      supportIssueType: category,
      supportStatus: 'open'
    });

    // Populate user info
    await supportMessage.populate('sender', 'name email profileImage');
    await supportMessage.populate('receiver', 'name email profileImage');

    res.status(201).json({
      success: true,
      message: 'Support chat started successfully',
      supportAgent: {
        id: supportAgent._id,
        name: supportAgent.name,
        online: true,
        role: supportAgent.role
      },
      chatId: supportMessage._id
    });

  } catch (err) {
    console.error('Error starting support chat:', err);
    next(err);
  }
});

// 2. Send support message - matches your sendSupportMessage()
router.post('/send-message', authGuard, async (req, res, next) => {
  try {
    const { message, category = 'general_support', receiverId = null } = req.body;

    // If receiverId is provided, use it (for ongoing conversations)
    // Otherwise, find an available support agent
    let receiver = receiverId;
    
    if (!receiver) {
      const supportAgents = await User.find({ 
        role: { $in: ['support', 'admin'] }
      }).limit(1);
      
      if (supportAgents.length > 0) {
        receiver = supportAgents[0]._id;
      } else {
        // Fallback to system support user
        receiver = await getSystemSupportUser();
      }
    }

    const supportMsg = await Message.create({
      sender: req.user._id,
      receiver: receiver,
      message: message,
      isSupportChat: true,
      supportIssueType: category,
      supportStatus: 'open'
    });

    // Populate user info
    await supportMsg.populate('sender', 'name email profileImage');
    await supportMsg.populate('receiver', 'name email profileImage');

    // Emit via Socket.io for real-time updates
    if (req.io) {
      req.io.to(receiver.toString()).emit("new_support_message", supportMsg);
      // Also emit to user's own room for confirmation
      req.io.to(req.user._id.toString()).emit("support_message_sent", supportMsg);
    }

    res.json({
      success: true,
      message: 'Message sent to support team',
      msg: supportMsg
    });

  } catch (err) {
    console.error('Error sending support message:', err);
    next(err);
  }
});

// 3. Get support agents - matches your getSupportAgents()
router.get('/agents', authGuard, async (req, res, next) => {
  try {
    const supportAgents = await User.find({ 
      role: { $in: ['support', 'admin'] }
    }).select('name email profileImage role isOnline lastSeen');

    // If no support agents in database, return default ones
    if (supportAgents.length === 0) {
      return res.json({
        success: true,
        agents: getDefaultSupportAgents()
      });
    }

    res.json({
      success: true,
      agents: supportAgents.map(agent => ({
        id: agent._id,
        name: agent.name,
        role: agent.role || 'Support Agent',
        online: agent.isOnline || true,
        avatar: agent.profileImage || '',
        lastSeen: agent.lastSeen
      }))
    });

  } catch (err) {
    console.error('Error getting support agents:', err);
    // Return default agents in case of error
    res.json({
      success: true,
      agents: getDefaultSupportAgents()
    });
  }
});

// 4. Get user's support conversations
router.get('/conversations', authGuard, async (req, res, next) => {
  try {
    const supportConversations = await Message.find({
      $or: [
        { sender: req.user._id, isSupportChat: true },
        { receiver: req.user._id, isSupportChat: true }
      ]
    })
    .populate('sender', 'name email profileImage')
    .populate('receiver', 'name email profileImage')
    .sort({ createdAt: -1 })
    .limit(50);

    res.json({
      success: true,
      conversations: supportConversations
    });

  } catch (err) {
    console.error('Error getting support conversations:', err);
    next(err);
  }
});

// 5. Get specific support conversation
router.get('/conversation/:agentId', authGuard, async (req, res, next) => {
  try {
    const { agentId } = req.params;

    const messages = await Message.find({
      $or: [
        { sender: req.user._id, receiver: agentId, isSupportChat: true },
        { sender: agentId, receiver: req.user._id, isSupportChat: true }
      ]
    })
    .populate('sender', 'name email profileImage')
    .populate('receiver', 'name email profileImage')
    .sort({ createdAt: 1 });

    res.json({
      success: true,
      messages: messages
    });

  } catch (err) {
    console.error('Error getting support conversation:', err);
    next(err);
  }
});

// Helper functions
async function getSystemSupportUser() {
  // Create or get a system support user
  let supportUser = await User.findOne({ email: 'support@runpro9ja.com' });
  
  if (!supportUser) {
    supportUser = await User.create({
      name: 'RunPro Support Team',
      email: 'support@runpro9ja.com',
      role: 'support',
      isOnline: true
    });
  }
  
  return supportUser._id;
}

function getDefaultSupportAgents() {
  return [
    {
      id: 'support_system',
      name: 'RunPro Support',
      role: 'Customer Support',
      online: true,
      avatar: '',
      lastSeen: new Date()
    },
    {
      id: 'support_1',
      name: 'Sarah Johnson',
      role: 'Senior Support Agent',
      online: true,
      avatar: '',
      lastSeen: new Date()
    }
  ];
}

export default router;