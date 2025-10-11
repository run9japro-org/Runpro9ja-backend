import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { ROLES } from '../constants/roles.js';


const UserSchema = new mongoose.Schema(
{
role: {
type: String,
enum: Object.values(ROLES),
required: true,
index: true
},
fullName: { type: String, required: true },
email: { type: String, lowercase: true, trim: true, index: true },
phone: { type: String, trim: true, index: true },
password: { type: String, minlength: 6, required: true, select: false },


// Profile
avatarUrl: { type: String },
addresses: [
{
label: String, // e.g., Home, Office
addressLine: String,
city: String,
state: String,
country: String,
lat: Number,
lng: Number,
isDefault: { type: Boolean, default: false }
}
],

walletBalance: { type: Number, default: 0 },   // running balance
bankAccount: {
  bankName: String,
  accountNumber: String,
  accountName: String,
  bankCode: { type: String },   
  recipientCode: String, // Paystack recipient code after verification
},
// Verification
isVerified: { type: Boolean, default: false },
otpCode: { type: String, select: false }, // store hashed or plain for MVP
otpExpiresAt: { type: Date, select: false }
},
{ timestamps: true }
);


UserSchema.pre('save', async function (next) {
if (!this.isModified('password')) return next();
const salt = await bcrypt.genSalt(10);
this.password = await bcrypt.hash(this.password, salt);
next();
});


UserSchema.methods.comparePassword = async function (candidate) {
return bcrypt.compare(candidate, this.password);
};


export const User = mongoose.model('User', UserSchema);