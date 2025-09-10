import mongoose from 'mongoose';


const statusSchema = new mongoose.Schema({
status: { type: String, enum: ['requested','accepted','rejected','in-progress','completed'], required: true },
timestamp: { type: Date, default: Date.now }
});


const orderSchema = new mongoose.Schema({
customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
agent: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
serviceCategory: { type: mongoose.Schema.Types.ObjectId, ref: 'ServiceCategory', required: true },
details: { type: String },
price: { type: Number },
location: { type: String },
status: { type: String, enum: ['requested','accepted','rejected','in-progress','completed'], default: 'requested' },
timeline: [statusSchema],
currentLocation: {
type: { type: String, enum: ['Point'], default: 'Point' },
coordinates: { type: [Number], default: [0, 0] }
},
deliveryUpdates: [
{
location: {
type: { type: String, enum: ['Point'], default: 'Point' },
coordinates: { type: [Number], required: true }
},
timestamp: { type: Date, default: Date.now }
}
]
}, { timestamps: true });


orderSchema.index({ currentLocation: '2dsphere' });


export default mongoose.model('Order', orderSchema);