import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import http from "http";
import rateLimit from "express-rate-limit";

import { env } from "./src/config/env.js";
import { errorHandler, notFound } from "./src/middlewares/errorHandler.js";

// ✅ Routes
import authRoutes from "./src/routes/authRoutes.js";
import serviceRoutes from "./src/routes/serviceRoutes.js";
import agentRoutes from "./src/routes/agentRoutes.js";
import orderRoutes from "./src/routes/orderRoutes.js";
import deliveryRoutes from "./src/routes/deliveryRoutes.js";
// import profileRoutes from "./src/routes/profileRoutes.js";
import paymentRoutes from "./src/routes/paymentRoutes.js";
import withdrawalRoutes from "./src/routes/withdrawalRoutes.js";
import chatRoutes from "./src/routes/chatRoutes.js";
// import notificationRoutes from "./src/routes/notificationRoutes.js";
import adminRoutes from "./src/routes/adminRoutes.js";

// ✅ Socket.io
import { initSocket } from "./src/socket.js";

const app = express();
const server = http.createServer(app);

// Init Socket.io
initSocket(server);

// Security & utils
app.use(helmet());
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
  })
);
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
// app.use("/api/profile", profileRoutes);
app.use("/api/payments", paymentRoutes);
// app.use("/api/withdrawals", withdrawalRoutes);
app.use("/api/chat", chatRoutes);
// app.use("/api/notifications", notificationRoutes);
app.use("/api/admin", adminRoutes);

// ✅ Error handlers
app.use(notFound);
app.use(errorHandler);

export default server;
