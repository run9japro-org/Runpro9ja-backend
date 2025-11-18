import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import http from "http";
import rateLimit from "express-rate-limit";

import path from "path";
import { fileURLToPath } from "url";
import { env } from "./src/config/env.js";
import { errorHandler, notFound } from "./src/middlewares/errorHandler.js";
import { startCronJobs } from "./src/utils/cronJobs.js";
import { handleWebhook } from "./src/controllers/paymentController.js";

// ✅ Import routes
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
import searchRoutes from './src/routes/searchRoutes.js';
import customerRoutes from './src/routes/customerRoutes.js';
import supportRoutes from './src/routes/supportRoutes.js';
import adminSupportRoutes from './src/routes/adminSupportRoutes.js';
import complaints from "./src/routes/complaintRoutes.js";
import qoreidRoutes from "./src/routes/qoreidRoutes.js";
// ✅ Socket.io
import { initSocket } from "./src/socket.js";
import mongoSanitize from "express-mongo-sanitize";
import xss from "xss-clean";
import hpp from "hpp";


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
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true, 
    legacyHeaders: false,
  })
);
app.use(mongoSanitize());
app.use(xss());
app.use(hpp());
// ✅ CRITICAL: Webhook route MUST come BEFORE express.json()
app.post("/api/payments/webhook", express.raw({ type: "application/json" }), handleWebhook);

// ✅ CORS
app.use(
  cors({
    origin: [
      "http://localhost:3000",
      "http://localhost:5173",
      "http://localhost:5174",
      "https://www.runpro9ja.com",
      "https://www.run9japro.com"
    ],
    credentials: true,
  })
);

app.use(morgan("dev"));

// ✅ JSON parsing MUST come before routes (except webhook)
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// ✅ Static files

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use("/uploads", express.static(path.resolve("uploads")));


app.use(express.static('public'));

// ✅ Health check
app.get("/", (req, res) =>
  res.json({ status: "ok", message: "Marketplace API v1" })
);

// ✅ Mount routes (AFTER express.json)
startCronJobs();

app.use("/api/auth", authRoutes);
app.use("/api/services", serviceRoutes);
app.use("/api/agents", agentRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/delivery", deliveryRoutes);
app.use('/api/customers', customerRoutes);  // ✅ Now it will work!
app.use("/api/payments", paymentRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/withdrawals", withdrawalRoutes);
app.use('/api/complaints', complaints);
app.use('/api', searchRoutes);
app.use('/api/support', supportRoutes);
app.use('/api/admin/support', adminSupportRoutes);
app.use("/api/qoreid", qoreidRoutes);
// ✅ Error handlers (MUST be last)
app.use(notFound);
app.use(errorHandler);

export default server;