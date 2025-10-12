// scripts/getCategoryIds.js
import mongoose from 'mongoose';
import { ServiceCategory } from './src/models/ServiceCategory.js';
import dotenv from 'dotenv';

dotenv.config();

const getCategoryIds = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    const categories = await ServiceCategory.find().sort('name');
    
    console.log('\n📋 ACTUAL CATEGORY IDs FOR FLUTTER:');
    console.log('Copy and paste these into your ServiceMapper:');
    console.log('=' .repeat(50));
    
    categories.forEach(category => {
      const serviceType = category.slug.split('-')[0];
      console.log(`'${serviceType}': {`);
      console.log(`  'name': '${category.name}',`);
      console.log(`  'slug': '${category.slug}',`);
      console.log(`  'categoryId': '${category._id}',`); // This is the actual ObjectId
      console.log(`},`);
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
  }
};

getCategoryIds();