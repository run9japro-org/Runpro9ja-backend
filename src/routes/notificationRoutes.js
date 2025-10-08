// routes/notificationRoutes.js
import { Router } from 'express';
import {
  getMyNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  getUnreadCount
} from '../controllers/notificationController.js';
import { authGuard } from '../middlewares/auth.js';

const router = Router();

// All routes require authentication
router.use(authGuard);

router.get('/', getMyNotifications);
router.get('/unread-count', getUnreadCount);
router.patch('/:notificationId/read', markAsRead);
router.patch('/read-all', markAllAsRead);
router.delete('/:notificationId', deleteNotification);

export default router;