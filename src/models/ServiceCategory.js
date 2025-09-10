import mongoose from 'mongoose';


const ServiceCategorySchema = new mongoose.Schema({
name: { type: String, required: true, unique: true },
slug: { type: String, required: true, unique: true },
description: { type: String },
subcategories: [{ name: String }],
createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });


export const ServiceCategory = mongoose.model('ServiceCategory', ServiceCategorySchema);