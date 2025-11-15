import { Router } from 'express';
import {
  getMyProfile,
  updateMyProfile,
  getMyServiceHistory,
  getCustomerProfile,
  deleteMyAccount // Add this import
} from '../controllers/authController.js';
import { authGuard } from '../middlewares/auth.js';
import {customerUpload, uploadCustomerProfileImage} from "../controllers/uploadController.js"
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
router.delete('/me', authGuard, deleteMyAccount); // Add this route
router.get('/me/history', authGuard, getMyServiceHistory);
router.get("/:id",authGuard, getCustomerProfile);

// Image routes
router.post(
  "/upload-profile",
  authGuard,
  customerUpload.single("profileImage"),
  uploadCustomerProfileImage
);

export default router;