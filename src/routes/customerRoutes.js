import { Router } from 'express';
import {
getMyProfile,
updateMyProfile,
getMyServiceHistory,

} from '../controllers/authController.js';
import { authGuard } from '../middlewares/auth.js';

import { uploadProfileImage, removeProfileImage } from '../controllers/uploadController.js';
import multer from 'multer';
const router = Router();

// Customer-only routes
const storage = multer.memoryStorage(); // Store file in memory as buffer
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  },
});

router.get('/me', authGuard,  getMyProfile);
router.put('/me', authGuard,  updateMyProfile);
router.get('/me/history', authGuard, getMyServiceHistory);
// Add these new routes for image handling
router.post('/upload-profile', authGuard, upload.single('profileImage'), uploadProfileImage);
router.delete('/remove-profile-image', authGuard, removeProfileImage);
// Add this to your customerRoutes.js

export default router;