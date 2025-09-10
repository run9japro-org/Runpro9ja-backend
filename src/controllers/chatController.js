import { Message } from "../models/Chat.js";

// Send message
export const sendMessage = async (req, res, next) => {
  try {
    const { receiverId, message, orderId } = req.body;
    const msg = await Message.create({
      sender: req.user.id,
      receiver: receiverId,
      message,
      order: orderId || null,
    });

    // Emit via Socket.io
    req.io.to(receiverId.toString()).emit("new_message", msg);

    res.json({ success: true, msg });
  } catch (err) {
    next(err);
  }
};

// Get conversation
export const getConversation = async (req, res, next) => {
  try {
    const { withUserId } = req.params;
    const msgs = await Message.find({
      $or: [
        { sender: req.user.id, receiver: withUserId },
        { sender: withUserId, receiver: req.user.id },
      ],
    }).sort({ createdAt: 1 });
    res.json({ success: true, msgs });
  } catch (err) {
    next(err);
  }
};
