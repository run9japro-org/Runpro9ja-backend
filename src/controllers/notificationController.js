// controllers/notificationController.js
import { Notification } from "../models/Notification.js";

// Create and send notification
export const createNotification = async (userId, data, io = null) => {
  try {
    const notification = await Notification.create({ 
      user: userId, 
      ...data 
    });

    // Populate user data if needed
    await notification.populate('user', 'fullName email phone');

    // Emit real-time notification if socket is provided
    if (io) {
      io.to(userId.toString()).emit("new_notification", {
        type: 'NEW_NOTIFICATION',
        data: notification
      });

      // Also emit for admin dashboard if it's a system notification
      if (data.type === 'system' || data.priority === 'urgent') {
        io.emit("admin_notification", {
          type: 'ADMIN_ALERT',
          data: notification
        });
      }
    }

    console.log(`📢 Notification sent to user ${userId}: ${data.title}`);
    return notification;
  } catch (error) {
    console.error('Error creating notification:', error);
    throw error;
  }
};

// Get user notifications with pagination
export const getMyNotifications = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const notifications = await Notification.find({ user: req.user.id })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('user', 'fullName email phone');

    const total = await Notification.countDocuments({ user: req.user.id });
    const unreadCount = await Notification.countDocuments({ 
      user: req.user.id, 
      isRead: false 
    });

    res.json({
      success: true,
      notifications,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total,
        unreadCount
      }
    });
  } catch (err) {
    next(err);
  }
};

// Mark notification as read
export const markAsRead = async (req, res, next) => {
  try {
    const { notificationId } = req.params;

    const notification = await Notification.findOneAndUpdate(
      { _id: notificationId, user: req.user.id },
      { isRead: true },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    res.json({
      success: true,
      message: 'Notification marked as read',
      notification
    });
  } catch (err) {
    next(err);
  }
};

// Mark all notifications as read
export const markAllAsRead = async (req, res, next) => {
  try {
    await Notification.updateMany(
      { user: req.user.id, isRead: false },
      { isRead: true }
    );

    const unreadCount = await Notification.countDocuments({ 
      user: req.user.id, 
      isRead: false 
    });

    res.json({
      success: true,
      message: 'All notifications marked as read',
      unreadCount
    });
  } catch (err) {
    next(err);
  }
};

// Delete notification
export const deleteNotification = async (req, res, next) => {
  try {
    const { notificationId } = req.params;

    const notification = await Notification.findOneAndDelete({
      _id: notificationId,
      user: req.user.id
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    res.json({
      success: true,
      message: 'Notification deleted successfully'
    });
  } catch (err) {
    next(err);
  }
};

// Get unread count
export const getUnreadCount = async (req, res, next) => {
  try {
    const count = await Notification.countDocuments({ 
      user: req.user.id, 
      isRead: false 
    });

    res.json({
      success: true,
      unreadCount: count
    });
  } catch (err) {
    next(err);
  }
};