import { Router } from 'express';
import {
  getMyProfile,
  updateMyProfile,
  getMyServiceHistory,
} from '../controllers/authController.js';
import { authGuard } from '../middlewares/auth.js';
import { 
  uploadProfileImage, 
  removeProfileImage,
  getProfileImage  // ✅ Import this
} from '../controllers/uploadController.js';
import multer from 'multer';

const router = Router();

const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  },
});

// Profile routes
router.get('/me', authGuard, getMyProfile);
router.put('/me', authGuard, updateMyProfile);
router.get('/me/history', authGuard, getMyServiceHistory);

// Image routes
router.post('/upload-profile', authGuard, upload.single('profileImage'), uploadProfileImage);
router.delete('/remove-profile-image', authGuard, removeProfileImage);
router.get('/profile-image/:imageId', getProfileImage);  // ✅ Add this route

export default router;