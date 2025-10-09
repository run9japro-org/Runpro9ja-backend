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
// Get notifications with filters
export const getMyNotifications = async (req, res, next) => {
  try {
    const { type, isRead, page = 1, limit = 20 } = req.query;
    
    const query = { user: req.user.id };
    
    // Apply filters
    if (type && type !== 'all') {
      query.type = type;
    }
    
    if (isRead !== undefined) {
      query.isRead = isRead === 'true';
    }

    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .populate('user', 'fullName email phone');

    const total = await Notification.countDocuments(query);
    const unreadCount = await Notification.countDocuments({ 
      user: req.user.id, 
      isRead: false 
    });

    res.json({
      success: true,
      notifications,
      pagination: {
        current: parseInt(page),
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
    ).populate('user', 'fullName email phone');

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    // Emit real-time update if socket is available
    if (req.io) {
      req.io.to(req.user.id.toString()).emit('notification_read', {
        notificationId: notification._id
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

    // Emit real-time update
    if (req.io) {
      req.io.to(req.user.id.toString()).emit('all_notifications_read');
    }

    res.json({
      success: true,
      message: 'All notifications marked as read',
      unreadCount
    });
  } catch (err) {
    next(err);
  }
};

// Get unread count for badge
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


