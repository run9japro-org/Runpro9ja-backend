// services/notificationService.js
import { createNotification } from "../controllers/notificationController.js";

// Notification templates for common scenarios
export const NotificationTemplates = {
  // Add to your NotificationTemplates in notificationService.js

DIRECT_ORDER_OFFER: (orderId, customerName, serviceType) => ({
  title: 'Direct Order Offer!',
  message: `${customerName} has specifically requested you for a ${serviceType} order.`,
  type: 'order_update',
  priority: 'high',
  data: { orderId, customerName, serviceType },
  actionUrl: `/agent/orders/${orderId}`
}),

AGENT_ACCEPTED_DIRECT_OFFER: (orderId, agentName) => ({
  title: 'Agent Accepted!',
  message: `${agentName} has accepted your order. Please proceed with payment.`,
  type: 'order_update',
  priority: 'high',
  data: { orderId, agentName },
  actionUrl: `/orders/${orderId}/payment`
}),

AGENT_DECLINED_DIRECT_OFFER: (orderId, agentName, reason) => ({
  title: 'Agent Declined',
  message: `${agentName} declined your order. ${reason}. Your order is now available to other agents.`,
  type: 'order_update',
  priority: 'medium',
  data: { orderId, agentName, reason },
  actionUrl: `/orders/${orderId}`
}),

AGENT_ACCEPTED_PUBLIC_ORDER: (orderId, agentName) => ({
  title: 'Order Accepted!',
  message: `${agentName} has accepted your order from the public pool. Please proceed with payment.`,
  type: 'order_update',
  priority: 'high',
  data: { orderId, agentName },
  actionUrl: `/orders/${orderId}/payment`
}),
  // Order-related notifications
  ORDER_CREATED: (orderId, serviceType) => ({
    title: 'Order Confirmed',
    message: `Your ${serviceType} order #${orderId} has been confirmed and is being processed.`,
    type: 'order_update',
    priority: 'medium',
    data: { orderId, serviceType },
    actionUrl: `/orders/${orderId}`
  }),

  AGENT_ASSIGNED: (orderId, agentName) => ({
    title: 'Agent Assigned',
    message: `${agentName} has been assigned to your order and will contact you shortly.`,
    type: 'agent_assigned',
    priority: 'high',
    data: { orderId, agentName },
    actionUrl: `/orders/${orderId}`
  }),

  ORDER_COMPLETED: (orderId) => ({
    title: 'Order Completed',
    message: `Your order #${orderId} has been successfully completed. Thank you for using our service!`,
    type: 'order_update',
    priority: 'medium',
    data: { orderId },
    actionUrl: `/orders/${orderId}/review`
  }),

  // Payment notifications
  PAYMENT_SUCCESS: (amount, orderId) => ({
    title: 'Payment Successful',
    message: `Payment of ₦${amount} for order #${orderId} was successful.`,
    type: 'payment',
    priority: 'high',
    data: { amount, orderId },
    actionUrl: `/orders/${orderId}`
  }),

  PAYMENT_FAILED: (orderId) => ({
    title: 'Payment Failed',
    message: `Payment for order #${orderId} failed. Please try again or use a different payment method.`,
    type: 'payment',
    priority: 'urgent',
    data: { orderId },
    actionUrl: `/orders/${orderId}/payment`
  }),

  // System notifications
  WELCOME: () => ({
    title: 'Welcome to RunPro 9ja!',
    message: 'Thank you for joining us. We are excited to serve you with reliable errand services.',
    type: 'system',
    priority: 'low',
    actionUrl: '/services'
  }),

  PROMOTION: (offer) => ({
    title: 'Special Offer!',
    message: offer,
    type: 'promotion',
    priority: 'low'
  }),

  // Agent notifications
  NEW_ORDER_ASSIGNED: (orderId, customerName) => ({
    title: 'New Order Assigned',
    message: `You have been assigned a new order from ${customerName}.`,
    type: 'order_update',
    priority: 'high',
    data: { orderId, customerName },
    actionUrl: `/agent/orders/${orderId}`
  })
};

// Service functions for common notification scenarios
export const notifyUser = async (userId, templateKey, templateData, io = null) => {
  try {
    const template = NotificationTemplates[templateKey];
    if (!template) {
      throw new Error(`Notification template ${templateKey} not found`);
    }

    const notificationData = typeof template === 'function' 
      ? template(...templateData) 
      : template;

    return await createNotification(userId, notificationData, io);
  } catch (error) {
    console.error('Error in notifyUser:', error);
    throw error;
  }
};

// Batch notifications for multiple users
export const notifyMultipleUsers = async (userIds, templateKey, templateData, io = null) => {
  try {
    const notifications = await Promise.all(
      userIds.map(userId => notifyUser(userId, templateKey, templateData, io))
    );
    return notifications;
  } catch (error) {
    console.error('Error in notifyMultipleUsers:', error);
    throw error;
  }
};

// Clean up old notifications (run as cron job)
export const cleanupOldNotifications = async (daysOld = 30) => {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const result = await Notification.deleteMany({
      createdAt: { $lt: cutoffDate },
      type: { $in: ['system', 'promotion'] }, // Only delete non-critical notifications
      isRead: true
    });

    console.log(`🧹 Cleaned up ${result.deletedCount} old notifications`);
    return result;
  } catch (error) {
    console.error('Error cleaning up notifications:', error);
    throw error;
  }
};