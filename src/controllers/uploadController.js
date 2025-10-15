// controllers/uploadController.js
import { User } from '../models/User.js';
import { GridFSBucket, ObjectId } from 'mongodb';
import mongoose from 'mongoose';

// Upload profile image
export const uploadProfileImage = async (req, res) => {
  try {
    console.log('📤 Uploading profile image for user:', req.user.id);

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No image file provided'
      });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Delete old profile image if exists
    if (user.profileImageId) {
      await deleteImageFromGridFS(user.profileImageId);
    }

    // Upload new image to GridFS
    const imageId = await uploadToGridFS(req.file, req.user.id);

    // Update user with new image ID and URL
    const updatedUser = await User.findByIdAndUpdate(
      req.user.id,
      { 
        profileImageId: imageId,
        profileImage: `/api/customers/profile-image/${imageId}`,
        avatarUrl: `/api/customers/profile-image/${imageId}`
      },
      { new: true }
    ).select('-password');

    console.log('✅ Profile image uploaded successfully');

    res.json({
      success: true,
      data: {
        profileImage: updatedUser.profileImage,
        avatarUrl: updatedUser.avatarUrl,
        profileImageId: updatedUser.profileImageId,
        message: 'Profile image updated successfully'
      }
    });

  } catch (err) {
    console.error('❌ Upload profile image error:', err);
    res.status(500).json({
      success: false,
      message: 'Server error during image upload'
    });
  }
};

// Remove profile image
export const removeProfileImage = async (req, res) => {
  try {
    console.log('🗑️ Removing profile image for user:', req.user.id);

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Delete image from GridFS if exists
    if (user.profileImageId) {
      await deleteImageFromGridFS(user.profileImageId);
    }

    // Update user to remove image references
    const updatedUser = await User.findByIdAndUpdate(
      req.user.id,
      { 
        profileImageId: null,
        profileImage: null,
        avatarUrl: null
      },
      { new: true }
    ).select('-password');

    console.log('✅ Profile image removed successfully');

    res.json({
      success: true,
      data: {
        profileImage: null,
        avatarUrl: null,
        profileImageId: null,
        message: 'Profile image removed successfully'
      }
    });

  } catch (err) {
    console.error('❌ Remove profile image error:', err);
    res.status(500).json({
      success: false,
      message: 'Server error during image removal'
    });
  }
};

// Serve profile image
export const getProfileImage = async (req, res) => {
  try {
    const { imageId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(imageId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid image ID'
      });
    }

    const db = mongoose.connection.db;
    const bucket = new GridFSBucket(db, {
      bucketName: 'profileImages'
    });

    const fileId = new ObjectId(imageId);
    
    // Check if file exists
    const files = await bucket.find({ _id: fileId }).toArray();
    if (!files || files.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Image not found'
      });
    }

    // Set appropriate headers
    res.set('Content-Type', files[0].contentType);
    res.set('Content-Length', files[0].length);
    res.set('Cache-Control', 'public, max-age=31557600'); // Cache for 1 year

    // Stream file to response
    const downloadStream = bucket.openDownloadStream(fileId);
    
    downloadStream.on('error', (error) => {
      console.error('Error streaming image:', error);
      res.status(404).json({
        success: false,
        message: 'Image not found'
      });
    });

    downloadStream.pipe(res);

  } catch (err) {
    console.error('❌ Get profile image error:', err);
    res.status(500).json({
      success: false,
      message: 'Server error while retrieving image'
    });
  }
};

// Helper function to upload to GridFS
const uploadToGridFS = (file, userId) => {
  return new Promise((resolve, reject) => {
    const db = mongoose.connection.db;
    const bucket = new GridFSBucket(db, {
      bucketName: 'profileImages'
    });

    const uploadStream = bucket.openUploadStream(file.originalname, {
      metadata: {
        userId: userId,
        uploadedAt: new Date(),
        contentType: file.mimetype
      }
    });

    uploadStream.on('error', reject);
    uploadStream.on('finish', () => {
      resolve(uploadStream.id);
    });

    uploadStream.end(file.buffer);
  });
};

// Helper function to delete from GridFS
const deleteImageFromGridFS = (imageId) => {
  return new Promise((resolve, reject) => {
    const db = mongoose.connection.db;
    const bucket = new GridFSBucket(db, {
      bucketName: 'profileImages'
    });

    bucket.delete(new ObjectId(imageId), (err) => {
      if (err) {
        console.error('Error deleting image from GridFS:', err);
        reject(err);
      } else {
        resolve();
      }
    });
  });
};