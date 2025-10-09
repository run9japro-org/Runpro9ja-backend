// services/notificationService.js
import { createNotification } from "../controllers/notificationController.js";
import { Notification } from "../models/Notification.js";

// ✅ UPDATED: Correct Notification Templates
export const NotificationTemplates = {
  // Order-related notifications
  ORDER_CREATED: (orderId, serviceType) => ({
    title: 'Order Confirmed',
    message: `Your ${serviceType} order #${orderId} has been confirmed and is being processed.`,
    type: 'order_update', // ✅ This must match your enum
    priority: 'medium',
    data: { orderId, serviceType },
    actionUrl: `/orders/${orderId}`
  }),

  DIRECT_ORDER_OFFER: (orderId, customerName, serviceType) => ({
    title: 'Direct Order Offer!',
    message: `${customerName} has specifically requested you for a ${serviceType} order.`,
    type: 'order_update', // ✅ This must match your enum
    priority: 'high',
    data: { orderId, customerName, serviceType },
    actionUrl: `/agent/orders/${orderId}`
  }),

  AGENT_ACCEPTED_DIRECT_OFFER: (orderId, agentName) => ({
    title: 'Agent Accepted!',
    message: `${agentName} has accepted your order. Please proceed with payment.`,
    type: 'order_update', // ✅ This must match your enum
    priority: 'high',
    data: { orderId, agentName },
    actionUrl: `/orders/${orderId}/payment`
  }),

  AGENT_DECLINED_DIRECT_OFFER: (orderId, agentName, reason) => ({
    title: 'Agent Declined',
    message: `${agentName} declined your order. ${reason}. Your order is now available to other agents.`,
    type: 'order_update', // ✅ This must match your enum
    priority: 'medium',
    data: { orderId, agentName, reason },
    actionUrl: `/orders/${orderId}`
  }),

  AGENT_ACCEPTED_PUBLIC_ORDER: (orderId, agentName) => ({
    title: 'Order Accepted!',
    message: `${agentName} has accepted your order from the public pool. Please proceed with payment.`,
    type: 'order_update', // ✅ This must match your enum
    priority: 'high',
    data: { orderId, agentName },
    actionUrl: `/orders/${orderId}/payment`
  }),

  DIRECT_ORDER_ACCEPTED: (orderId, customerName) => ({
    title: 'Order Accepted',
    message: `You have accepted order from ${customerName}.`,
    type: 'order_update', // ✅ This must match your enum
    priority: 'medium',
    data: { orderId, customerName },
    actionUrl: `/agent/orders/${orderId}`
  }),

  PUBLIC_ORDER_ACCEPTED: (orderId, customerName) => ({
    title: 'Public Order Accepted',
    message: `You have accepted public order from ${customerName}.`,
    type: 'order_update', // ✅ This must match your enum
    priority: 'medium',
    data: { orderId, customerName },
    actionUrl: `/agent/orders/${orderId}`
  }),

  // Payment notifications
  PAYMENT_SUCCESS: (amount, orderId) => ({
    title: 'Payment Successful',
    message: `Payment of ₦${amount} for order #${orderId} was successful.`,
    type: 'payment', // ✅ This must match your enum
    priority: 'high',
    data: { amount, orderId },
    actionUrl: `/orders/${orderId}`
  }),

  PAYMENT_FAILED: (orderId) => ({
    title: 'Payment Failed',
    message: `Payment for order #${orderId} failed. Please try again or use a different payment method.`,
    type: 'payment', // ✅ This must match your enum
    priority: 'urgent',
    data: { orderId },
    actionUrl: `/orders/${orderId}/payment`
  }),

  // System notifications
  WELCOME: () => ({
    title: 'Welcome to RunPro 9ja!',
    message: 'Thank you for joining us. We are excited to serve you with reliable errand services.',
    type: 'system', // ✅ This must match your enum
    priority: 'low',
    actionUrl: '/services'
  }),
// Add to your notificationService.js
ORDER_STATUS_UPDATED: (orderId, status, note) => ({
  title: 'Order Status Updated',
  message: `Order #${orderId} is now ${status}. ${note || ''}`,
  type: 'order_update',
  priority: 'medium',
  data: { orderId, status, note },
  actionUrl: `/orders/${orderId}`
}),

ORDER_SCHEDULED: (orderId, date, time) => ({
  title: 'Order Scheduled',
  message: `Your order #${orderId} has been scheduled for ${date} at ${time}.`,
  type: 'order_update',
  priority: 'medium',
  data: { orderId, date, time },
  actionUrl: `/orders/${orderId}`
}),

ORDER_SCHEDULED_AGENT: (orderId, date, time) => ({
  title: 'Order Scheduled',
  message: `Order #${orderId} has been scheduled for ${date} at ${time}.`,
  type: 'order_update',
  priority: 'medium',
  data: { orderId, date, time },
  actionUrl: `/agent/orders/${orderId}`
}),

ORDER_REVIEWED: (orderId, rating) => ({
  title: 'New Review',
  message: `You received a ${rating} star rating for order #${orderId}.`,
  type: 'review',
  priority: 'low',
  data: { orderId, rating },
  actionUrl: `/agent/orders/${orderId}`
}),
  PROMOTION: (offer) => ({
    title: 'Special Offer!',
    message: offer,
    type: 'promotion', // ✅ This must match your enum
    priority: 'low'
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