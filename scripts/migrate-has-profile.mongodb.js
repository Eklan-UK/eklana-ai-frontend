// MongoDB Playground Migration Script
// Run this in MongoDB Compass Playground or mongosh
// This script sets hasProfile field for all users based on Profile existence

// Step 1: Update users with role 'user' - check if they have a Profile
print("Step 1: Checking users with role 'user'...");

const users = db.users.find({ role: 'user' }).toArray();
print(`Found ${users.length} users with role "user"`);

let updatedCount = 0;
for (const user of users) {
  const profile = db.profiles.findOne({ userId: user._id });
  const hasProfile = !!profile;
  
  if (user.hasProfile !== hasProfile) {
    db.users.updateOne(
      { _id: user._id },
      { $set: { hasProfile: hasProfile } }
    );
    updatedCount++;
    print(`  Updated user ${user._id} (${user.email}): hasProfile ${user.hasProfile || false} → ${hasProfile}`);
  }
}
print(`✅ Updated ${updatedCount} users with role "user"`);

// Step 2: Admins and tutors always have profile (they don't need Profile document)
print("\nStep 2: Updating admins and tutors...");

const adminTutorResult = db.users.updateMany(
  { role: { $in: ['admin', 'tutor'] } },
  { $set: { hasProfile: true } }
);
print(`✅ Updated ${adminTutorResult.modifiedCount} admins/tutors to hasProfile: true`);

// Step 3: Summary
print("\n📊 Summary:");
const totalUsers = db.users.countDocuments({});
const usersWithProfile = db.users.countDocuments({ hasProfile: true });
const usersWithoutProfile = db.users.countDocuments({ hasProfile: false });
const usersWithNull = db.users.countDocuments({ hasProfile: null });

print(`- Total users: ${totalUsers}`);
print(`- Users with hasProfile: true: ${usersWithProfile}`);
print(`- Users with hasProfile: false: ${usersWithoutProfile}`);
print(`- Users with hasProfile: null: ${usersWithNull}`);

// Step 4: Verification - check a few sample users
print("\n🔍 Sample verification:");
const sampleUsers = db.users.find({ role: 'user' }).limit(5).toArray();
for (const user of sampleUsers) {
  const profile = db.profiles.findOne({ userId: user._id });
  const expectedHasProfile = !!profile;
  const actualHasProfile = user.hasProfile || false;
  const status = expectedHasProfile === actualHasProfile ? '✅' : '❌';
  print(`  ${status} ${user.email}: hasProfile=${actualHasProfile}, Profile exists=${!!profile}`);
}

print("\n✅ Migration complete!");




