import express from "express";
import { authGuard } from "../middlewares/auth.js";
import { sendMessage, getConversation } from "../controllers/chatController.js";

const router = express.Router();

router.post("/", authGuard, sendMessage);
router.get("/:withUserId", authGuard, getConversation);

export default router;
