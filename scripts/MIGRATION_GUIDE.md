# hasProfile Migration Guide

This guide shows how to migrate existing users to include the `hasProfile` field.

## Option 1: MongoDB Compass Playground (Recommended - Visual)

1. Open MongoDB Compass
2. Connect to your database
3. Click on "Playground" tab (top right)
4. Copy and paste the contents of `migrate-has-profile.mongodb.js`
5. Click "Run" button
6. Review the output

## Option 2: MongoDB Shell (mongosh)

### Method A: Direct execution
```bash
mongosh "mongodb://localhost:27017/your-database-name" < scripts/migrate-has-profile.mongosh.js
```

### Method B: Interactive mode
```bash
# Connect to MongoDB
mongosh "mongodb://localhost:27017/your-database-name"

# Then paste and run the script content
```

### Method C: With connection string from .env
```bash
# If using environment variable
mongosh "$MONGO_URI" < scripts/migrate-has-profile.mongosh.js
```

## Option 3: MongoDB Atlas (Web UI)

1. Go to MongoDB Atlas
2. Click "Browse Collections"
3. Click "..." menu → "Open Playground"
4. Copy and paste the contents of `migrate-has-profile.mongodb.js`
5. Click "Run"

## What the Script Does

1. **For users with role 'user':**
   - Checks if a Profile document exists
   - Sets `hasProfile: true` if Profile exists
   - Sets `hasProfile: false` if Profile doesn't exist

2. **For admins and tutors:**
   - Sets `hasProfile: true` (they don't need Profile documents)

3. **Safety:**
   - Only updates the `hasProfile` field
   - Doesn't modify any other user data
   - Idempotent (safe to run multiple times)

## Verification

After running the migration, verify with:

```javascript
// Check summary
db.users.aggregate([
  {
    $group: {
      _id: "$hasProfile",
      count: { $sum: 1 }
    }
  }
]);

// Check users without profiles
db.users.find({ 
  role: 'user', 
  hasProfile: false 
}).count();

// Verify a specific user
const userId = ObjectId("your-user-id");
const user = db.users.findOne({ _id: userId });
const profile = db.profiles.findOne({ userId: userId });
print(`User: ${user.email}, hasProfile: ${user.hasProfile}, Profile exists: ${!!profile}`);
```

## Rollback (if needed)

If you need to remove the `hasProfile` field:

```javascript
db.users.updateMany(
  {},
  { $unset: { hasProfile: "" } }
);
```

## Troubleshooting

### Error: "collection not found"
- Make sure you're connected to the correct database
- Check that your collections are named `users` and `profiles` (not `user` and `profile`)

### Error: "userId field type mismatch"
- The script assumes `userId` in profiles is ObjectId
- If it's a string, modify the script to convert: `ObjectId(userId)`

### No changes made
- Check if `hasProfile` field already exists and is correct
- The script only updates when values differ (idempotent)






