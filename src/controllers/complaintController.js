import { Complaint } from "../models/Complaint.js";

// Create complaint
export const createComplaint = async (req, res) => {
  try {
    const { category, complaint, priority } = req.body;
    const user = req.user; // from auth middleware

    if (!user) {
      return res.status(401).json({ message: "Unauthorized. Please log in." });
    }

    const newComplaint = new Complaint({
      user: user._id,
      name: user.fullName,
      email: user.email,
      category: category || "Other",
      priority: priority || "Medium",
      complaint
    });

    await newComplaint.save();
    res.status(201).json({ message: "Complaint submitted successfully.", complaint: newComplaint });
  } catch (error) {
    res.status(400).json({ message: "Error submitting complaint", error: error.message });
  }
};

// Get all complaints (admin only)
export const getComplaints = async (req, res) => {
  try {
    const { status, category, priority, search, page = 1, limit = 10 } = req.query;
    const filter = {};

    if (status && status !== "all") filter.status = status;
    if (category && category !== "all") filter.category = category;
    if (priority && priority !== "all") filter.priority = priority;

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { complaint: { $regex: search, $options: "i" } }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await Complaint.countDocuments(filter);
    const complaints = await Complaint.find(filter)
      .populate("user", "fullName email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    res.json({
      complaints,
      total,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page)
    });
  } catch (error) {
    res.status(500).json({ message: "Error fetching complaints", error: error.message });
  }
};

// Get user's own complaints
export const getUserComplaints = async (req, res) => {
  try {
    const userId = req.user._id;
    const complaints = await Complaint.find({ user: userId }).sort({ createdAt: -1 });
    res.json(complaints);
  } catch (error) {
    res.status(500).json({ message: "Error fetching your complaints", error: error.message });
  }
};

// Update complaint (admin respond)
export const respondToComplaint = async (req, res) => {
  try {
    const { response, status } = req.body;
    const admin = req.user;

    const complaint = await Complaint.findById(req.params.id);
    if (!complaint) return res.status(404).json({ message: "Complaint not found" });

    complaint.response = {
      message: response,
      respondedBy: admin.fullName || "Admin",
      respondedAt: new Date()
    };
    complaint.status = status || "Responded";

    await complaint.save();

    res.json({ message: "Complaint updated successfully", complaint });
  } catch (error) {
    res.status(400).json({ message: "Error updating complaint", error: error.message });
  }
};

// Delete complaint
export const deleteComplaint = async (req, res) => {
  try {
    const complaint = await Complaint.findByIdAndDelete(req.params.id);
    if (!complaint) return res.status(404).json({ message: "Complaint not found" });
    res.json({ message: "Complaint deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Error deleting complaint", error: error.message });
  }
};

// Complaint statistics
export const getComplaintStats = async (req, res) => {
  try {
    const stats = await Complaint.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 } } }
    ]);

    const formattedStats = {
      total: await Complaint.countDocuments(),
      pending: stats.find(s => s._id === "Pending")?.count || 0,
      inProgress: stats.find(s => s._id === "In Progress")?.count || 0,
      responded: stats.find(s => s._id === "Responded")?.count || 0,
      resolved: stats.find(s => s._id === "Resolved")?.count || 0
    };

    res.json(formattedStats);
  } catch (error) {
    res.status(500).json({ message: "Error fetching stats", error: error.message });
  }
};
