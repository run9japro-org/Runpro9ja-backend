// controllers/chatController.js
import { Message } from "../models/Chat.js";
import { emitNewMessage, emitMessageRead, emitMessagesRead } from "../socket.js";

// Send message
export const sendMessage = async (req, res, next) => {
  try {
    const { receiverId, message, orderId } = req.body;
    
    if (!receiverId || !message) {
      return res.status(400).json({
        success: false,
        message: 'Receiver ID and message are required'
      });
    }

    const msg = await Message.create({
      sender: req.user._id,
      receiver: receiverId,
      message,
      order: orderId || null,
    });

    await msg.populate('sender', 'name email profileImage');
    await msg.populate('receiver', 'name email profileImage');

    // Emit via Socket.io using helper function
    emitNewMessage({
      _id: msg._id,
      sender: msg.sender,
      receiver: msg.receiver,
      message: msg.message,
      order: msg.order,
      read: msg.read,
      readBy: msg.readBy,
      createdAt: msg.createdAt
    });

    res.json({ success: true, msg });
  } catch (err) {
    console.error('Error sending message:', err);
    next(err);
  }
};

// Get conversation
export const getConversation = async (req, res, next) => {
  try {
    const { withUserId } = req.params;
    
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

// Mark message as read
export const markMessageAsRead = async (req, res, next) => {
  try {
    const { messageId } = req.params;
    
    if (!messageId) {
      return res.status(400).json({
        success: false,
        message: 'Message ID is required'
      });
    }

    const message = await Message.findById(messageId);
    
    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found'
      });
    }

    if (message.receiver.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You can only mark your own received messages as read'
      });
    }

    const alreadyRead = message.readBy.some(read => 
      read.user.toString() === req.user._id.toString()
    );

    if (!alreadyRead) {
      message.readBy.push({
        user: req.user._id,
        readAt: new Date()
      });
      
      message.read = true;
      await message.save();
      
      await message.populate('sender', 'name email profileImage');
      await message.populate('receiver', 'name email profileImage');
      
      // Emit read receipt via Socket.io helper
      emitMessageRead(message._id, req.user._id, message.sender._id);
    }

    res.json({ 
      success: true, 
      message: 'Message marked as read',
      msg: message 
    });
  } catch (err) {
    console.error('Error marking message as read:', err);
    next(err);
  }
};

// Mark multiple messages as read
export const markMessagesAsRead = async (req, res, next) => {
  try {
    const { messageIds } = req.body;
    
    if (!messageIds || !Array.isArray(messageIds) || messageIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Message IDs array is required'
      });
    }

    const messages = await Message.find({
      _id: { $in: messageIds },
      receiver: req.user._id
    }).populate('sender', '_id');

    const updatePromises = messages.map(async (message) => {
      const alreadyRead = message.readBy.some(read => 
        read.user.toString() === req.user._id.toString()
      );

      if (!alreadyRead) {
        message.readBy.push({
          user: req.user._id,
          readAt: new Date()
        });
        
        message.read = true;
        await message.save();
        
        // Emit read receipt for each message
        emitMessageRead(message._id, req.user._id, message.sender._id);
        
        return message._id;
      }
      return null;
    });

    const updatedMessageIds = (await Promise.all(updatePromises)).filter(id => id !== null);

    // Alternatively, emit bulk read event
    if (updatedMessageIds.length > 0) {
      const senderIds = [...new Set(messages.map(msg => msg.sender._id.toString()))];
      senderIds.forEach(senderId => {
        const senderMessages = updatedMessageIds.filter((_, index) => 
          messages[index].sender._id.toString() === senderId
        );
        if (senderMessages.length > 0) {
          emitMessagesRead(senderMessages, req.user._id, senderId);
        }
      });
    }

    res.json({ 
      success: true, 
      message: `${updatedMessageIds.length} messages marked as read`,
      updatedMessageIds 
    });
  } catch (err) {
    console.error('Error marking messages as read:', err);
    next(err);
  }
};

// Mark all messages from a user as read
export const markAllAsRead = async (req, res, next) => {
  try {
    const { senderId } = req.params;
    
    if (!senderId) {
      return res.status(400).json({
        success: false,
        message: 'Sender ID is required'
      });
    }

    const unreadMessages = await Message.find({
      sender: senderId,
      receiver: req.user._id,
      'readBy.user': { $ne: req.user._id }
    }).populate('sender', '_id');

    const updatePromises = unreadMessages.map(async (message) => {
      message.readBy.push({
        user: req.user._id,
        readAt: new Date()
      });
      
      message.read = true;
      await message.save();
      
      return message._id;
    });

    const updatedMessageIds = await Promise.all(updatePromises);

    // Emit bulk read event
    if (updatedMessageIds.length > 0) {
      emitMessagesRead(updatedMessageIds, req.user._id, senderId);
    }

    res.json({ 
      success: true, 
      message: `${updatedMessageIds.length} messages marked as read`,
      updatedMessageIds 
    });
  } catch (err) {
    console.error('Error marking all messages as read:', err);
    next(err);
  }
};