import { Server } from 'socket.io';


let io;


export const initSocket = (server) => {
io = new Server(server, {
cors: { origin: '*' }
});


io.on('connection', (socket) => {
console.log('Socket connected:', socket.id);


  // User joins their support room
  socket.on('join_support', (userId) => {
    socket.join(`support_user_${userId}`);
    console.log(`User ${userId} joined support room`);
  });

  // Support agent joins support room
  socket.on('join_support_agent', (agentId) => {
    socket.join(`support_agent_${agentId}`);
    console.log(`Support agent ${agentId} joined support room`);
  });

  // Support agent joins all support room for broadcasts
  socket.on('join_support_broadcast', () => {
    socket.join('support_broadcast');
    console.log(`Socket ${socket.id} joined support broadcast`);
  });

  // Handle support messages
  socket.on('support_message', (data) => {
    const { to, message, from } = data;
    // Broadcast to specific user or agent
    socket.to(`support_user_${to}`).emit('new_support_message', {
      from,
      message,
      timestamp: new Date()
    });
  });
// Customer joins order room to receive location updates
socket.on('subscribeOrder', (orderId) => {
socket.join(`order_${orderId}`);
console.log(`Socket ${socket.id} subscribed to order ${orderId}`);
});


// Customer leaves order room
socket.on('unsubscribeOrder', (orderId) => {
socket.leave(`order_${orderId}`);
console.log(`Socket ${socket.id} unsubscribed from order ${orderId}`);
});


socket.on('disconnect', () => {
console.log('Socket disconnected:', socket.id);
});
});


return io;
};


export { io };