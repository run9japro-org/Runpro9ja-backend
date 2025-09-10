import { User } from "../models/User.js";

// View all users
export const getAllUsers = async (req, res, next) => {
  try {
    const users = await User.find().select("-password");
    res.json({ success: true, users });
  } catch (err) {
    next(err);
  }
};

// Block a user
export const blockUser = async (req, res, next) => {
  try {
    await User.findByIdAndUpdate(req.params.id, { isBlocked: true });
    res.json({ success: true, message: "User blocked" });
  } catch (err) {
    next(err);
  }
};
