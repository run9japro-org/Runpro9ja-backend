import { AgentProfile } from '../models/AgentProfile.js';
import { ServiceCategory } from '../models/ServiceCategory.js';
import { User } from '../models/User.js';
import multer from "multer";
import path from "path";

export const createOrUpdateProfile = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const payload = req.body;

    // ✅ Optional: Add validation for services array if needed
    if (payload.services && !Array.isArray(payload.services)) {
      return res.status(400).json({ message: "Services must be an array" });
    }

    let profile = await AgentProfile.findOne({ user: userId });

    if (!profile) {
      profile = await AgentProfile.create({ user: userId, ...payload });
    } else {
      Object.assign(profile, payload);
      await profile.save();
    }

    const populatedProfile = await profile.populate("user services", "fullName email phone");
    res.json(populatedProfile);
  } catch (e) {
    next(e);
  }
};




const storage = multer.diskStorage({
  destination: "./uploads/",
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});

export const upload = multer({ storage });

export const uploadimage = async (req, res) => {
  try {
    const profile = await AgentProfile.findOneAndUpdate(
      { user: req.user.id },
      { profileImage: `/uploads/${req.file.filename}` },
      { new: true, upsert: true }
    ).populate("user services", "fullName email phone"); // ✅ return with user info

    res.json({ message: "Profile image uploaded", profile });
  } catch (err) {
    res.status(500).json({ message: "Upload failed", error: err.message });
  }
};



export const getMyProfile = async (req, res, next) => {
try {
const profile = await AgentProfile.findOne({ user: req.user.id }).populate('services');
if (!profile) return res.status(404).json({ message: 'Profile not found' });
res.json(profile);
} catch (e) { next(e); }
};


export const getAgentProfile = async (req, res, next) => {
try {
const profile = await AgentProfile.findOne({ user: req.params.userId }).populate('services');
if (!profile) return res.status(404).json({ message: 'Profile not found' });
res.json(profile);
} catch (e) { next(e); }
};


export const assignServiceToAgent = async (req, res, next) => {
try {
const { agentUserId } = req.params;
const { categoryId } = req.body;
const profile = await AgentProfile.findOne({ user: agentUserId });
if (!profile) return res.status(404).json({ message: 'Agent profile not found' });
const cat = await ServiceCategory.findById(categoryId);
if (!cat) return res.status(404).json({ message: 'Category not found' });
if (!profile.services.includes(cat._id)) {
profile.services.push(cat._id);
await profile.save();
}
res.json(profile);
} catch (e) { next(e); }
};


export const unassignServiceFromAgent = async (req, res, next) => {
try {
const { agentUserId } = req.params;
const { categoryId } = req.body;
const profile = await AgentProfile.findOne({ user: agentUserId });
if (!profile) return res.status(404).json({ message: 'Agent profile not found' });
profile.services = profile.services.filter(id => String(id) !== String(categoryId));
await profile.save();
res.json(profile);
} catch (e) { next(e); }
};



// Improved price calculation based on your actual data
const calculateDeliveryPrice = (serviceType, yearsOfExperience, servicesOffered) => {
  let basePrice = 2500; // Default base price
  
  // Adjust based on service type
  if (serviceType?.includes('Errand') || serviceType?.includes('Grocery')) {
    basePrice = 3000;
  } else if (serviceType?.includes('Delivery')) {
    basePrice = 2000;
  } else if (serviceType?.includes('Mover')) {
    basePrice = 5000;
  } else if (serviceType?.includes('Clean')) {
    basePrice = 4000;
  } else if (serviceType?.includes('Personal')) {
    basePrice = 3500;
  }
  
  // Adjust based on experience
  if (yearsOfExperience) {
    const experience = parseInt(yearsOfExperience) || 0;
    if (experience > 5) basePrice += 1000;
    if (experience > 10) basePrice += 1000;
  }
  
  return basePrice;
};

// Determine vehicle type based on service
const getVehicleType = (serviceType) => {
  if (!serviceType) return 'Motorcycle';
  
  const service = serviceType.toLowerCase();
  
  if (service.includes('mover')) return 'Truck';
  if (service.includes('delivery') || service.includes('errand') || service.includes('grocery')) 
    return 'Motorcycle';
  if (service.includes('clean') || service.includes('personal')) 
    return 'Car';
    
  return 'Motorcycle';
};

// Create a descriptive bio from agent data
const createAgentBio = (agent) => {
  const parts = [];
  
  if (agent.yearsOfExperience) {
    parts.push(`${agent.yearsOfExperience} years experience`);
  }
  
  if (agent.servicesOffered) {
    parts.push(`Specializes in ${agent.servicesOffered.toLowerCase()}`);
  }
  
  if (agent.areasOfExpertise) {
    parts.push(`Expert in ${agent.areasOfExpertise.toLowerCase()}`);
  }
  
  if (agent.summary) {
    parts.push(agent.summary);
  }
  
  return parts.join(' • ') || 'Professional service provider';
};
// Get available agents for customers to choose from
export const getAvailableAgents = async (req, res, next) => {
  try {
    const { serviceType, categoryId } = req.query;
    
    console.log('🔍 Finding available agents for service:', serviceType);

    // Build query based on service type
    let query = {};

    // Filter by service type if provided
    if (serviceType) {
      query.serviceType = new RegExp(serviceType, 'i'); // Case-insensitive search
    }

    // Alternative: Filter by service category ID if provided
    if (categoryId) {
      query.services = categoryId;
    }

    // Find available agents and populate user data
    const agents = await AgentProfile.find(query)
      .populate('user', 'fullName email phone')
      .populate('services', 'name description');

    console.log(`✅ Found ${agents.length} agents for service: ${serviceType}`);

    // Format the response for customers
    const availableAgents = agents.map(agent => {
      // Calculate realistic price based on service type and experience
      const price = calculateDeliveryPrice(
        agent.serviceType, 
        agent.yearsOfExperience,
        agent.servicesOffered
      );
      
      // Determine vehicle type based on service
      const vehicleType = getVehicleType(agent.serviceType);
      
      // Create agent bio from available data
      const bio = createAgentBio(agent);

      return {
        _id: agent._id,
        user: {
          _id: agent.user?._id || 'unknown',
          fullName: agent.user?.fullName || 'Unknown Agent',
          email: agent.user?.email || '',
          phone: agent.user?.phone || ''
        },
        profileImage: agent.profileImage,
        rating: agent.rating || 4.5,
        completedJobs: agent.completedJobs || 0,
        isVerified: agent.isVerified || false,
        serviceType: agent.serviceType,
        yearsOfExperience: agent.yearsOfExperience,
        servicesOffered: agent.servicesOffered,
        areasOfExpertise: agent.areasOfExpertise,
        availability: agent.availability,
        summary: agent.summary,
        bio: agent.bio || bio,
        location: agent.location,
        distance: (Math.random() * 5 + 1).toFixed(1),
        price: price,
        vehicleType: vehicleType,
        // Include service categories for filtering
        serviceCategories: agent.services || []
      };
    });

    res.json({
      success: true,
      agents: availableAgents,
      count: availableAgents.length,
      message: `Found ${availableAgents.length} available agents${serviceType ? ` for ${serviceType}` : ''}`
    });

  } catch (e) {
    console.error('Error fetching available agents:', e);
    next(e);
  }
};
// Add this to your agent controller
export const getAgentsForProfessionalService = async (req, res, next) => {
  try {
    const { categoryId, serviceType } = req.query;
    
    let query = { 
      isVerified: true,
      availability: 'available'
    };

    // Filter by service category
    if (categoryId) {
      query.services = categoryId;
    }

    // Filter by service type
    if (serviceType) {
      query.serviceType = new RegExp(serviceType, 'i');
    }

    const agents = await AgentProfile.find(query)
      .populate('user', 'fullName email phone profileImage')
      .populate('services', 'name description')
      .sort({ rating: -1, completedJobs: -1 }) // Sort by rating and experience
      .limit(10); // Limit to top 10 agents

    res.json({
      success: true,
      agents: agents,
      count: agents.length,
      message: `Found ${agents.length} professional agents`
    });

  } catch (e) {
    console.error('Error fetching professional agents:', e);
    next(e);
  }
};
export const updateAgentLocation = async (req, res) => {
  try {
    const { lat, lng } = req.body;
    const userId = req.user.id; // from JWT token

    if (!lat || !lng) {
      return res.status(400).json({ message: "Latitude and Longitude required" });
    }

    const agent = await AgentProfile.findOneAndUpdate(
      { user: userId },
      { currentLocation: { lat, lng, lastUpdated: new Date() } },
      { new: true }
    );

    if (!agent) return res.status(404).json({ message: "Agent not found" });

    // ✅ Emit real-time update
    req.io.emit("agentLocationUpdate", {
      agentId: agent._id,
      lat,
      lng,
    });

    res.json({ success: true, message: "Location updated", agent });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};


// Get all agents for admin assignment (with filtering and pagination)
export const getAgentsForAdmin = async (req, res, next) => {
  try {
    const { page = 1, limit = 50, status = '', search = '' } = req.query;
    
    // Build query for admin
    let query = {};
    
    // Filter by status
    if (status) {
      if (status === 'active') {
        query.availability = 'available';
      } else if (status === 'inactive') {
        query.availability = 'unavailable';
      } else if (status === 'verified') {
        query.isVerified = true;
      } else if (status === 'unverified') {
        query.isVerified = false;
      }
    }
    
    // Search filter
    if (search) {
      query.$or = [
        { 'user.fullName': { $regex: search, $options: 'i' } },
        { serviceType: { $regex: search, $options: 'i' } },
        { servicesOffered: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (page - 1) * limit;
    
    const agents = await AgentProfile.find(query)
      .populate('user', 'fullName email phone')
      .populate('services', 'name description')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await AgentProfile.countDocuments(query);

    res.json({
      success: true,
      agents: agents.map(agent => ({
        id: agent._id,
        userId: agent.user?._id,
        name: agent.user?.fullName || 'Unknown',
        email: agent.user?.email || '',
        phone: agent.user?.phone || '',
        serviceType: agent.serviceType,
        servicesOffered: agent.servicesOffered,
        yearsOfExperience: agent.yearsOfExperience,
        rating: agent.rating || 0,
        completedJobs: agent.completedJobs || 0,
        isVerified: agent.isVerified || false,
        availability: agent.availability || 'unknown',
        profileImage: agent.profileImage,
        location: agent.location,
        currentWorkload: agent.currentWorkload || 0,
        maxWorkload: agent.maxWorkload || 10,
        specialization: agent.services?.map(s => s.name) || [],
        createdAt: agent.createdAt,
        lastActive: agent.updatedAt
      })),
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / limit)
    });

  } catch (e) {
    console.error('Error fetching agents for admin:', e);
    next(e);
  }
};

// Get potential/new agents for admin
export const getPotentialAgents = async (req, res, next) => {
  try {
    const { limit = 20 } = req.query;
    
    // Find new agents (created in last 30 days) with low completed jobs
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const potentialAgents = await AgentProfile.find({
      $or: [
        { completedJobs: { $lt: 5 } }, // Less than 5 completed jobs
        { createdAt: { $gte: thirtyDaysAgo } }, // Created in last 30 days
        { isVerified: false } // Not yet verified
      ]
    })
    .populate('user', 'fullName email phone')
    .populate('services', 'name description')
    .sort({ createdAt: -1 })
    .limit(parseInt(limit));

    res.json({
      success: true,
      potentialAgents: potentialAgents.map(agent => ({
        id: agent._id,
        name: agent.user?.fullName || 'Unknown',
        email: agent.user?.email || '',
        phone: agent.user?.phone || '',
        serviceType: agent.serviceType,
        completedJobs: agent.completedJobs || 0,
        isVerified: agent.isVerified || false,
        createdAt: agent.createdAt,
        status: agent.completedJobs < 5 ? 'New' : 
                !agent.isVerified ? 'Unverified' : 'Active',
        potentialScore: calculatePotentialScore(agent)
      })),
      count: potentialAgents.length
    });

  } catch (e) {
    console.error('Error fetching potential agents:', e);
    next(e);
  }
};

// Helper function to calculate agent potential score
const calculatePotentialScore = (agent) => {
  let score = 0;
  
  // Experience points
  if (agent.yearsOfExperience) {
    score += Math.min(agent.yearsOfExperience * 5, 25);
  }
  
  // Verification points
  if (agent.isVerified) score += 20;
  
  // Rating points
  if (agent.rating) score += agent.rating * 10;
  
  // Service diversity points
  if (agent.services && agent.services.length > 0) {
    score += Math.min(agent.services.length * 5, 15);
  }
  
  return Math.min(score, 100);
};

// Assign service request to agent
export const assignRequestToAgent = async (req, res, next) => {
  try {
    const { requestId, agentId, note } = req.body;
    
    if (!requestId || !agentId) {
      return res.status(400).json({
        success: false,
        message: 'Request ID and Agent ID are required'
      });
    }

    // Find the agent
    const agent = await AgentProfile.findById(agentId).populate('user');
    if (!agent) {
      return res.status(404).json({
        success: false,
        message: 'Agent not found'
      });
    }

    // Check if agent can take more work
    if (agent.currentWorkload >= agent.maxWorkload) {
      return res.status(400).json({
        success: false,
        message: 'Agent is at maximum workload capacity'
      });
    }

    // In a real app, you would update the service request here
    // For now, we'll simulate the assignment
    
    // Update agent workload
    agent.currentWorkload += 1;
    await agent.save();

    // Create assignment record (you might want to create a separate Assignment model)
    const assignment = {
      requestId,
      agentId,
      agentName: agent.user?.fullName,
      assignedAt: new Date(),
      note: note || '',
      status: 'assigned'
    };

    res.json({
      success: true,
      message: `Request ${requestId} assigned to ${agent.user?.fullName} successfully`,
      assignment,
      agent: {
        id: agent._id,
        name: agent.user?.fullName,
        currentWorkload: agent.currentWorkload,
        maxWorkload: agent.maxWorkload
      }
    });

  } catch (e) {
    console.error('Error assigning request to agent:', e);
    next(e);
  }
};

// Update agent workload (for admin)
export const updateAgentWorkload = async (req, res, next) => {
  try {
    const { agentId } = req.params;
    const { currentWorkload, maxWorkload } = req.body;

    const agent = await AgentProfile.findById(agentId);
    if (!agent) {
      return res.status(404).json({
        success: false,
        message: 'Agent not found'
      });
    }

    if (currentWorkload !== undefined) agent.currentWorkload = currentWorkload;
    if (maxWorkload !== undefined) agent.maxWorkload = maxWorkload;

    await agent.save();

    res.json({
      success: true,
      message: 'Agent workload updated successfully',
      agent: {
        id: agent._id,
        currentWorkload: agent.currentWorkload,
        maxWorkload: agent.maxWorkload
      }
    });

  } catch (e) {
    console.error('Error updating agent workload:', e);
    next(e);
  }
};

// Get agent workload statistics for admin
export const getAgentWorkloadStats = async (req, res, next) => {
  try {
    const stats = await AgentProfile.aggregate([
      {
        $group: {
          _id: null,
          totalAgents: { $sum: 1 },
          availableAgents: {
            $sum: {
              $cond: [
                { $and: [
                  { $eq: ['$availability', 'available'] },
                  { $lt: ['$currentWorkload', '$maxWorkload'] }
                ]}, 1, 0
              ]
            }
          },
          averageWorkload: { $avg: '$currentWorkload' },
          maxWorkload: { $avg: '$maxWorkload' },
          totalCapacity: { $sum: '$maxWorkload' },
          usedCapacity: { $sum: '$currentWorkload' }
        }
      }
    ]);

    const agentWorkload = await AgentProfile.find({})
      .populate('user', 'fullName')
      .select('currentWorkload maxWorkload availability rating completedJobs')
      .sort({ currentWorkload: -1 });

    res.json({
      success: true,
      stats: stats[0] || {
        totalAgents: 0,
        availableAgents: 0,
        averageWorkload: 0,
        maxWorkload: 0,
        totalCapacity: 0,
        usedCapacity: 0
      },
      agentWorkload: agentWorkload.map(agent => ({
        id: agent._id,
        name: agent.user?.fullName,
        currentWorkload: agent.currentWorkload,
        maxWorkload: agent.maxWorkload,
        availability: agent.availability,
        utilization: ((agent.currentWorkload / agent.maxWorkload) * 100).toFixed(1),
        rating: agent.rating,
        completedJobs: agent.completedJobs
      }))
    });

  } catch (e) {
    console.error('Error getting agent workload stats:', e);
    next(e);
  }
};

// Verify/Unverify agent (admin only)
export const updateAgentVerification = async (req, res, next) => {
  try {
    const { agentId } = req.params;
    const { isVerified } = req.body;

    const agent = await AgentProfile.findById(agentId);
    if (!agent) {
      return res.status(404).json({
        success: false,
        message: 'Agent not found'
      });
    }

    agent.isVerified = isVerified;
    await agent.save();

    res.json({
      success: true,
      message: `Agent ${isVerified ? 'verified' : 'unverified'} successfully`,
      agent: {
        id: agent._id,
        isVerified: agent.isVerified,
        name: agent.user?.fullName
      }
    });

  } catch (e) {
    console.error('Error updating agent verification:', e);
    next(e);
  }
};