// routes/chatRoutes.js
import express from 'express';
import {
  sendMessage,
  getConversation,
  markMessageAsRead,
  markMessagesAsRead,
  markAllAsRead
} from '../controllers/chatController.js';
import { authGuard } from "../middlewares/auth.js";

const router = express.Router();

router.post('/', authGuard, sendMessage);
router.get('/:withUserId', authGuard, getConversation);
router.put('/mark-read/:messageId', authGuard, markMessageAsRead);
router.put('/mark-read-bulk', authGuard, markMessagesAsRead);
router.put('/mark-all-read/:senderId', authGuard, markAllAsRead);

export default router;