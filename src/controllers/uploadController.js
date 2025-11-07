// controllers/uploadController.js
import path from "path";
import multer from "multer";
import {User} from "../models/User.js"; // change to your actual model

const storage = multer.diskStorage({
  destination: "./uploads/",
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});

export const customerUpload = multer({ storage });

export const uploadCustomerProfileImage = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "No image uploaded" });

    const profile = await User.findOneAndUpdate(
      { user: req.user.id },
      { profileImage: `/uploads/${req.file.filename}` },
      { new: true, upsert: true }
    ).populate("user", "fullName email phone");

    res.json({ message: "Customer profile image uploaded", profile });
  } catch (err) {
    res.status(500).json({ message: "Upload failed", error: err.message });
  }
};
