import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import http from "http";
import rateLimit from "express-rate-limit";

import { env } from "./src/config/env.js";
import { errorHandler, notFound } from "./src/middlewares/errorHandler.js";
import path from "path"; // ✅ ADD THIS IMPORT
// ✅ Routes

import { handleWebhook } from "./src/controllers/paymentController.js";
import authRoutes from "./src/routes/authRoutes.js";
import serviceRoutes from "./src/routes/serviceRoutes.js";
import agentRoutes from "./src/routes/agentRoutes.js";
import orderRoutes from "./src/routes/orderRoutes.js";
import deliveryRoutes from "./src/routes/deliveryRoutes.js";
import paymentRoutes from "./src/routes/paymentRoutes.js";
import withdrawalRoutes from "./src/routes/withdrawalRoutes.js";
import chatRoutes from "./src/routes/chatRoutes.js";
import notificationRoutes from "./src/routes/notificationRoutes.js";
import adminRoutes from "./src/routes/adminRoutes.js";
// In your main server file, add call routes:
// import callRoutes from "./src/routes/callRoutes.js";
import customerRoutes from './src/routes/customerRoutes.js';
// ✅ Socket.io
import { initSocket } from "./src/socket.js";

const app = express();
const server = http.createServer(app);

// Init Socket.io
initSocket(server);

// ✅ Trust Render / proxy
app.set("trust proxy", 1);
// Security & utils
app.use(helmet());
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP
  standardHeaders: true, 
  legacyHeaders: false,
  })
);

// ✅ But the webhook route must come BEFORE express.json
app.post("/api/payments/webhook", express.raw({ type: "application/json" }), handleWebhook);
app.use(express.json({ limit: "1mb" }));
app.use(cors({ origin: env.clientOrigin, credentials: true }));
app.use(morgan("dev"));

// ✅ Health check
app.get("/", (req, res) =>
  res.json({ status: "ok", message: "Marketplace API v1" })
);

// ✅ Mount routes
app.use("/api/auth", authRoutes);
app.use("/api/services", serviceRoutes);
app.use("/api/agents", agentRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/delivery", deliveryRoutes);
app.use('/api/customers', customerRoutes); 
// ✅ ADD THIS LINE - Serve static files from uploads directory
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));
// app.use("/api/profile", profileRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/withdrawals", withdrawalRoutes);


// Add to your routes section:
// app.use("/api/calls", callRoutes);
// ✅ Error handlers
app.use(notFound);
app.use(errorHandler);

export default server;
