// utils/viewPasswords.js
import passwordLogger from './passwordLogger.js';

async function viewRecentPasswords(limit = 5) {
  try {
    const rotations = await passwordLogger.getRecentRotations(limit);
    
    console.log('\n📋 RECENT ADMIN PASSWORD ROTATIONS:');
    console.log('====================================');
    
    rotations.forEach((rotation, index) => {
      console.log(`\n${index + 1}. ${rotation.timestamp}`);
      console.log(`   Email: ${rotation.user.email}`);
      console.log(`   Role: ${rotation.user.role}`);
      console.log(`   Password: ${rotation.newPassword}`);
      console.log(`   Host: ${rotation.system.hostname}`);
    });
    
    if (rotations.length === 0) {
      console.log('No recent password rotations found.');
    }
  } catch (error) {
    console.error('❌ Failed to view passwords:', error);
  }
}

// Run this when you need to see recent passwords
viewRecentPasswords(10);