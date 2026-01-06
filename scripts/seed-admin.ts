/**
 * Seed script to create an admin user
 * 
 * Creates an admin user with:
 * - Email: vandulinus@gmail.com
 * - Password: Marylin@2000
 * - First Name: Linus
 * - Last Name: Daniel
 * - Role: admin
 * 
 * Run with: npx ts-node scripts/seed-admin.ts
 */

import mongoose from 'mongoose';
import User from '../src/models/user';
import config from '../src/lib/api/config';
import bcrypt from 'bcryptjs';

async function seedAdmin() {
  try {
    console.log('Connecting to database...');
    await mongoose.connect(config.MONGO_URI || process.env.MONGO_URI || process.env.MONGODB_URI || '');
    console.log('Connected to database');

    const adminEmail = 'vandulinus@gmail.com';
    const adminPassword = 'Marylin@2000';
    const adminFirstName = 'Linus';
    const adminLastName = 'Daniel';

    // Check if admin already exists
    const existingAdmin = await User.findOne({ email: adminEmail }).exec();
    if (existingAdmin) {
      console.log(`Admin user with email ${adminEmail} already exists`);
      
      // Update existing admin
      existingAdmin.firstName = adminFirstName;
      existingAdmin.lastName = adminLastName;
      existingAdmin.role = 'admin';
      existingAdmin.isActive = true;
      existingAdmin.isEmailVerified = true;
      existingAdmin.emailVerified = true;
      
      // Update password if needed
      if (adminPassword) {
        existingAdmin.password = await bcrypt.hash(adminPassword, 12);
      }
      
      await existingAdmin.save();
      console.log('Admin user updated successfully');
    } else {
      // Create new admin user
      const hashedPassword = await bcrypt.hash(adminPassword, 12);
      
      const adminUser = await User.create({
        firstName: adminFirstName,
        lastName: adminLastName,
        name: `${adminFirstName} ${adminLastName}`,
        email: adminEmail,
        password: hashedPassword,
        role: 'admin',
        isActive: true,
        isEmailVerified: true,
        emailVerified: true,
        username: adminEmail.split('@')[0],
      });

      console.log('Admin user created successfully!');
      console.log(`Email: ${adminEmail}`);
      console.log(`Password: ${adminPassword}`);
      console.log(`Name: ${adminFirstName} ${adminLastName}`);
      console.log(`Role: admin`);
      console.log(`User ID: ${adminUser._id}`);
    }

    await mongoose.disconnect();
    console.log('\nDisconnected from database');
  } catch (error: any) {
    console.error('Seed failed:', error);
    process.exit(1);
  }
}

// Run seed
seedAdmin();

