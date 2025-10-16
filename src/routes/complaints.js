import express from "express";

import {Complaint} from "../models/Complaint.js";


const router = express.Router();
// GET all complaints with filtering and pagination
router.get('/', async (req, res) => {
  try {
    const { 
      status, 
      category, 
      priority, 
      page = 1, 
      limit = 10,
      search 
    } = req.query;

    // Build filter object
    const filter = {};
    
    if (status && status !== 'all') {
      filter.status = status;
    }
    
    if (category && category !== 'all') {
      filter.category = category;
    }
    
    if (priority && priority !== 'all') {
      filter.priority = priority;
    }

    // Search functionality
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { complaint: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      sort: { createdAt: -1 }
    };

    const complaints = await Complaint.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Complaint.countDocuments(filter);

    res.json({
      complaints,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// GET single complaint
router.get('/:id', async (req, res) => {
  try {
    const complaint = await Complaint.findById(req.params.id);
    
    if (!complaint) {
      return res.status(404).json({ message: 'Complaint not found' });
    }
    
    res.json(complaint);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// POST new complaint
router.post('/', async (req, res) => {
  try {
    const { name, email, complaint, category, priority } = req.body;

    const newComplaint = new Complaint({
      name,
      email,
      complaint,
      category: category || 'Other',
      priority: priority || 'Medium'
    });

    const savedComplaint = await newComplaint.save();
    res.status(201).json(savedComplaint);
  } catch (error) {
    res.status(400).json({ message: 'Error creating complaint', error: error.message });
  }
});

// PUT update complaint (respond to complaint)
router.put('/:id', async (req, res) => {
  try {
    const { response, status, respondedBy } = req.body;
    
    const updateData = {};
    
    if (response) {
      updateData.response = {
        message: response,
        respondedBy: respondedBy || 'Admin',
        respondedAt: new Date()
      };
    }
    
    if (status) {
      updateData.status = status;
    }

    const updatedComplaint = await Complaint.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!updatedComplaint) {
      return res.status(404).json({ message: 'Complaint not found' });
    }

    res.json(updatedComplaint);
  } catch (error) {
    res.status(400).json({ message: 'Error updating complaint', error: error.message });
  }
});

// DELETE complaint
router.delete('/:id', async (req, res) => {
  try {
    const complaint = await Complaint.findByIdAndDelete(req.params.id);
    
    if (!complaint) {
      return res.status(404).json({ message: 'Complaint not found' });
    }
    
    res.json({ message: 'Complaint deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// GET complaints statistics
router.get('/stats/summary', async (req, res) => {
  try {
    const total = await Complaint.countDocuments();
    const pending = await Complaint.countDocuments({ status: 'Pending' });
    const responded = await Complaint.countDocuments({ status: 'Responded' });
    const inProgress = await Complaint.countDocuments({ status: 'In Progress' });
    const resolved = await Complaint.countDocuments({ status: 'Resolved' });

    res.json({
      total,
      pending,
      responded,
      inProgress,
      resolved
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

export default router;
