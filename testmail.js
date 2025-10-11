import mongoose from 'mongoose';
import { ServiceCategory } from './src/models/ServiceCategory.js';
import dotenv from 'dotenv';

dotenv.config();
const professionalCategories = [
  {
    name: "Professional Plumbing",
    description: "Expert plumbing services including installation, repair, and maintenance of pipes, fixtures, and water systems",
    subcategories: [
      { name: "Pipe Installation" },
      { name: "Leak Repair" },
      { name: "Drain Cleaning" },
      { name: "Water Heater Installation" },
      { name: "Bathroom Plumbing" },
      { name: "Kitchen Plumbing" }
    ]
  },
  {
    name: "Electrical Services",
    description: "Professional electrical installation, repair, and maintenance for residential and commercial properties",
    subcategories: [
      { name: "Wiring Installation" },
      { name: "Lighting Installation" },
      { name: "Socket & Switch Repair" },
      { name: "Electrical Panel Upgrade" },
      { name: "Circuit Breaker Repair" },
      { name: "Emergency Electrical" }
    ]
  },
  {
    name: "Mechanical Services",
    description: "Mechanical and engineering services including HVAC, machinery, and equipment maintenance",
    subcategories: [
      { name: "HVAC Installation" },
      { name: "AC Repair & Maintenance" },
      { name: "Generator Installation" },
      { name: "Mechanical Repair" },
      { name: "Equipment Maintenance" }
    ]
  },
  {
    name: "Carpentry Services",
    description: "Professional carpentry and woodworking services including furniture, cabinets, and structural work",
    subcategories: [
      { name: "Furniture Making" },
      { name: "Cabinet Installation" },
      { name: "Door & Window Installation" },
      { name: "Wooden Flooring" },
      { name: "Custom Carpentry" },
      { name: "Repair & Restoration" }
    ]
  },
  {
    name: "Painting Services",
    description: "Professional painting and decoration services for interior and exterior surfaces",
    subcategories: [
      { name: "Interior Painting" },
      { name: "Exterior Painting" },
      { name: "Wallpaper Installation" },
      { name: "Texture Painting" },
      { name: "Commercial Painting" },
      { name: "Decorative Painting" }
    ]
  },
  {
    name: "Fashion Services",
    description: "Professional fashion design, tailoring, and clothing alteration services",
    subcategories: [
      { name: "Custom Tailoring" },
      { name: "Clothing Alteration" },
      { name: "Fashion Design" },
      { name: "Bridal Services" },
      { name: "Corporate Attire" }
    ]
  },
  {
    name: "Beauty Services",
    description: "Professional beauty, grooming, and personal care services",
    subcategories: [
      { name: "Hair Styling" },
      { name: "Makeup Artistry" },
      { name: "Skincare Services" },
      { name: "Nail Care" },
      { name: "Barber Services" },
      { name: "Spa Services" }
    ]
  },
  {
    name: "Errand Services",
    description: "Professional errand running and personal assistance services",
    subcategories: [
      { name: "Grocery Shopping" },
      { name: "Package Delivery" },
      { name: "Document Delivery" },
      { name: "Personal Shopping" },
      { name: "Bill Payments" }
    ]
  },
  {
    name: "Delivery Services",
    description: "Professional package and item delivery services",
    subcategories: [
      { name: "Food Delivery" },
      { name: "Package Delivery" },
      { name: "Document Delivery" },
      { name: "Same-day Delivery" },
      { name: "Express Delivery" }
    ]
  },
  {
    name: "Moving Services",
    description: "Professional moving and relocation services",
    subcategories: [
      { name: "Local Moving" },
      { name: "Interstate Moving" },
      { name: "Office Moving" },
      { name: "Packing Services" },
      { name: "Furniture Assembly" }
    ]
  },
  {
    name: "Cleaning Services",
    description: "Professional cleaning and sanitation services",
    subcategories: [
      { name: "Home Cleaning" },
      { name: "Office Cleaning" },
      { name: "Deep Cleaning" },
      { name: "Post-Construction Cleaning" },
      { name: "Carpet Cleaning" }
    ]
  },
  {
    name: "Babysitting Services",
    description: "Professional childcare and babysitting services",
    subcategories: [
      { name: "Childcare" },
      { name: "After-school Care" },
      { name: "Weekend Babysitting" },
      { name: "Emergency Babysitting" }
    ]
  },
  {
    name: "Personal Assistance",
    description: "Professional personal assistance and concierge services",
    subcategories: [
      { name: "Personal Shopping" },
      { name: "Event Planning" },
      { name: "Travel Arrangements" },
      { name: "Administrative Support" }
    ]
  }
];

// Helper function to generate slug
const generateSlug = (name) => {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
};

const createCategories = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    // Create categories
    const createdCategories = [];
    
    for (const categoryData of professionalCategories) {
      // Generate slug from name
      const slug = generateSlug(categoryData.name);
      
      const existingCategory = await ServiceCategory.findOne({ 
        $or: [{ name: categoryData.name }, { slug: slug }] 
      });
      
      if (!existingCategory) {
        const category = new ServiceCategory({
          name: categoryData.name,
          slug: slug, // Explicitly set the slug
          description: categoryData.description,
          subcategories: categoryData.subcategories,
          createdBy: new mongoose.Types.ObjectId() // Use admin user ID if available
        });
        
        await category.save();
        createdCategories.push(category);
        console.log(`✅ Created category: ${category.name}`);
        console.log(`   Slug: ${category.slug}`);
        console.log(`   ID: ${category._id}`);
        console.log('   ---');
      } else {
        console.log(`⚠️ Category already exists: ${categoryData.name}`);
        createdCategories.push(existingCategory);
      }
    }

    console.log('\n🎉 Successfully created/verified all service categories!');
    console.log(`📋 Total categories: ${createdCategories.length}`);

    // Display all category IDs for Flutter app
    console.log('\n📝 Category IDs for Flutter ServiceMapper:');
    console.log('Copy and paste these into your Flutter ServiceMapper:');
    console.log('=' .repeat(50));
    
    createdCategories.forEach(category => {
      const serviceType = category.slug.split('-')[0]; // Get first part of slug as service type
      console.log(`'${serviceType}': {`);
      console.log(`  'name': '${category.name}',`);
      console.log(`  'slug': '${category.slug}',`);
      console.log(`  'categoryId': '${category._id}',`);
      console.log(`},`);
    });

  } catch (error) {
    console.error('❌ Error creating categories:', error);
    console.error('Error details:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
};

// Run the script
createCategories();