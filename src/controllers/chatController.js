import { Message } from "../models/Chat.js";

// Send message
export const sendMessage = async (req, res, next) => {
  try {
    const { receiverId, message, orderId } = req.body;
    
    // Add validation
    if (!receiverId || !message) {
      return res.status(400).json({
        success: false,
        message: 'Receiver ID and message are required'
      });
    }

    // Now req.user should be the full user document from database
    const msg = await Message.create({
      sender: req.user._id, // Use _id from the user document
      receiver: receiverId,
      message,
      order: orderId || null,
    });

    // Populate sender info for the response
    await msg.populate('sender', 'name email profileImage');
    await msg.populate('receiver', 'name email profileImage');

    // Emit via Socket.io
    if (req.io) {
      req.io.to(receiverId.toString()).emit("new_message", msg);
    }

    res.json({ success: true, msg });
  } catch (err) {
    console.error('Error sending message:', err);
    next(err);
  }
};

// Get conversation - Fixed version
export const getConversation = async (req, res, next) => {
  try {
    const { withUserId } = req.params;
    
    // Add validation
    if (!withUserId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required'
      });
    }

    const msgs = await Message.find({
      $or: [
        { sender: req.user._id, receiver: withUserId },
        { sender: withUserId, receiver: req.user._id },
      ],
    })
    .populate('sender', 'name email profileImage')
    .populate('receiver', 'name email profileImage')
    .sort({ createdAt: 1 });
    
    res.json({ success: true, msgs });
  } catch (err) {
    console.error('Error getting conversation:', err);
    next(err);
  }
};