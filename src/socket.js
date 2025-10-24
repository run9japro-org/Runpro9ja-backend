import { Server } from 'socket.io';


let io;


export const initSocket = (server) => {
io = new Server(server, {
cors: { origin: '*' }
});


io.on('connection', (socket) => {
console.log('Socket connected:', socket.id);


 // Support agent joins their personal room
  socket.on('joinSupportRoom', (agentId) => {
    socket.join(`support_agent_${agentId}`);
    console.log(`Support agent ${agentId} joined their room`);
  });

  // User joins their support room
  socket.on('joinSupportRoom', (userId) => {
    socket.join(`user_support_${userId}`);
    console.log(`User ${userId} joined support room`);
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