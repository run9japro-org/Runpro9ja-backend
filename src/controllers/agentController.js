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