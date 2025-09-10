import { Notification } from "../models/Notification.js";

// Create notification
export const createNotification = async (userId, data, io) => {
  const notif = await Notification.create({ user: userId, ...data });
  io.to(userId.toString()).emit("notification", notif);
  return notif;
};

// Get my notifications
export const getMyNotifications = async (req, res, next) => {
  try {
    const notifs = await Notification.find({ user: req.user.id })
      .sort({ createdAt: -1 })
      .limit(50);
    res.json({ success: true, notifs });
  } catch (err) {
    next(err);
  }
};
