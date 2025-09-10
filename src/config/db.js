import mongoose from 'mongoose';
import { env } from './env.js';


export const connectDB = async () => {
try {
mongoose.set('strictQuery', true);
await mongoose.connect(env.mongoUri, { dbName: 'marketplace_db' });
console.log('✅ MongoDB connected');
} catch (err) {
console.error('❌ MongoDB connection error:', err.message);
process.exit(1);
}
};