import mongoose from 'mongoose';


const AgentProfileSchema = new mongoose.Schema({
user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
bio: { type: String },
services: [{ type: mongoose.Schema.Types.ObjectId, ref: 'ServiceCategory' }],
rating: { type: Number, default: 0 },
completedJobs: { type: Number, default: 0 },
isVerified: { type: Boolean, default: false },
documents: [String], // urls to verification docs
location: {
city: String,
state: String,
country: String
},
}, { timestamps: true });


export const AgentProfile = mongoose.model('AgentProfile', AgentProfileSchema);