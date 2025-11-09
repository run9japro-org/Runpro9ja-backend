import { Server } from 'socket.io';

let io;

export const initSocket = (server) => {
  io = new Server(server, {
    cors: { origin: '*' }
  });

  io.on('connection', (socket) => {
    console.log('Socket connected:', socket.id);

    // User joins their personal room for private messages
    socket.on('join_user_room', (userId) => {
      socket.join(`user_${userId}`);
      console.log(`User ${userId} joined their personal room`);
    });

    // User joins specific chat room for one-on-one conversations
    socket.on('join_chat_room', (chatId) => {
      socket.join(`chat_${chatId}`);
      console.log(`Socket ${socket.id} joined chat room: ${chatId}`);
    });

    // Handle private messages between users
    socket.on('private_message', (data) => {
      const { to, message, from, messageId, orderId } = data;
      
      // Send to recipient's personal room
      socket.to(`user_${to}`).emit('new_message', {
        id: messageId,
        sender: from,
        receiver: to,
        message: message,
        orderId: orderId,
        createdAt: new Date(),
        read: false
      });
      
      console.log(`Message sent from ${from} to ${to}`);
    });

    // Handle mark message as read
    socket.on('mark_message_read', (data) => {
      const { messageId, readBy, senderId } = data;
      
      // Notify the sender that their message was read
      socket.to(`user_${senderId}`).emit('message_read', {
        messageId: messageId,
        readBy: readBy,
        readAt: new Date()
      });
      
      console.log(`Message ${messageId} marked as read by ${readBy}`);
    });

    // Handle mark multiple messages as read
    socket.on('mark_messages_read', (data) => {
      const { messageIds, readBy, senderId } = data;
      
      // Notify the sender that multiple messages were read
      socket.to(`user_${senderId}`).emit('messages_read', {
        messageIds: messageIds,
        readBy: readBy,
        readAt: new Date()
      });
      
      console.log(`Messages ${messageIds.join(', ')} marked as read by ${readBy}`);
    });

    // Support functionality (your existing code)
    socket.on('join_support', (userId) => {
      socket.join(`support_user_${userId}`);
      console.log(`User ${userId} joined support room`);
    });

    socket.on('join_support_agent', (agentId) => {
      socket.join(`support_agent_${agentId}`);
      console.log(`Support agent ${agentId} joined support room`);
    });

    socket.on('join_support_broadcast', () => {
      socket.join('support_broadcast');
      console.log(`Socket ${socket.id} joined support broadcast`);
    });

    socket.on('support_message', (data) => {
      const { to, message, from } = data;
      socket.to(`support_user_${to}`).emit('new_support_message', {
        from,
        message,
        timestamp: new Date()
      });
    });

    // Order tracking functionality (your existing code)
    socket.on('subscribeOrder', (orderId) => {
      socket.join(`order_${orderId}`);
      console.log(`Socket ${socket.id} subscribed to order ${orderId}`);
    });

    socket.on('unsubscribeOrder', (orderId) => {
      socket.leave(`order_${orderId}`);
      console.log(`Socket ${socket.id} unsubscribed from order ${orderId}`);
    });

    // User online status
    socket.on('user_online', (userId) => {
      socket.join(`user_${userId}`);
      socket.broadcast.emit('user_status_changed', {
        userId: userId,
        status: 'online'
      });
      console.log(`User ${userId} is online`);
    });

    socket.on('user_offline', (userId) => {
      socket.leave(`user_${userId}`);
      socket.broadcast.emit('user_status_changed', {
        userId: userId,
        status: 'offline'
      });
      console.log(`User ${userId} is offline`);
    });

    socket.on('disconnect', () => {
      console.log('Socket disconnected:', socket.id);
    });
  });

  return io;
};

// Helper functions for emitting events from controllers
export const emitNewMessage = (message) => {
  if (io) {
    io.to(`user_${message.receiver}`).emit('new_message', message);
    console.log(`Emitted new message to user_${message.receiver}`);
  }
};

export const emitMessageRead = (messageId, readBy, senderId) => {
  if (io) {
    io.to(`user_${senderId}`).emit('message_read', {
      messageId: messageId,
      readBy: readBy,
      readAt: new Date()
    });
    console.log(`Emitted message read to user_${senderId}`);
  }
};

export const emitMessagesRead = (messageIds, readBy, senderId) => {
  if (io) {
    io.to(`user_${senderId}`).emit('messages_read', {
      messageIds: messageIds,
      readBy: readBy,
      readAt: new Date()
    });
    console.log(`Emitted messages read to user_${senderId}`);
  }
};

export { io };