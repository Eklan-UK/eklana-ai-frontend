// models/user.model.ts
import { Schema, model, models, Document, Types } from "mongoose";
import bcrypt from "bcryptjs";

export interface IUser extends Document {
  _id: Types.ObjectId;
  firstName?: string; // Optional to allow Better Auth users
  lastName?: string; // Optional to allow Better Auth users
  name?: string; // Better Auth uses this field
  username?: string; // Optional to allow Better Auth users
  email: string;
  password?: string; // Optional for OAuth users
  role?: "admin" | "learner" | "tutor";
  isActive?: boolean;
  isEmailVerified?: boolean;
  emailVerified?: boolean; // Better Auth uses this field
  avatar?: string;
  image?: string; // Better Auth uses this field
  phone?: string;
  dateOfBirth?: Date;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    country?: string;
    zipCode?: string;
  };
  socialLinks?: {
    website?: string;
    facebook?: string;
    linkedIn?: string;
    instagram?: string;
    x?: string;
    youtube?: string;
  };
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    firstName: {
      type: String,
      required: function () {
        // Make required only if not created by Better Auth (which uses 'name' field)
        return !this.name;
      },
      maxlength: [50, "First name cannot exceed 50 characters"],
      trim: true,
    },
    lastName: {
      type: String,
      required: function () {
        // Make required only if not created by Better Auth
        return !this.name;
      },
      maxlength: [50, "Last name cannot exceed 50 characters"],
      trim: true,
    },
    // Better Auth uses 'name' field - we'll handle this in a pre-save hook
    name: {
      type: String,
      required: false,
      select: false, // Don't return in queries, we use firstName/lastName
    },
    username: {
      type: String,
      required: function () {
        // Make required only if not created by Better Auth
        return !this.email;
      },
      unique: true,
      sparse: true, // Allow null values for unique index
      maxlength: [50, "Username cannot exceed 50 characters"],
      trim: true,
      lowercase: true,
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, "Please provide a valid email"],
    },
    password: {
      type: String,
      required: false, // Password not required for OAuth users (Better Auth handles this)
      minlength: [8, "Password must be at least 8 characters"],
      select: false, // Don't return password in queries by default
    },
    role: {
      type: String,
      required: false, // Make optional to allow Better Auth to create users first
      enum: {
        values: ["admin", "learner", "tutor"],
        message: "{VALUE} is not a valid role",
      },
      default: "learner",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    // Better Auth uses 'emailVerified' - we'll sync this
    emailVerified: {
      type: Boolean,
      select: false, // Don't return, we use isEmailVerified
    },
    avatar: {
      type: String,
    },
    // Better Auth uses 'image' field for avatar
    image: {
      type: String,
      select: false, // Don't return, we use avatar
    },
    phone: {
      type: String,
      maxlength: 20,
    },
    dateOfBirth: {
      type: Date,
    },
    address: {
      street: String,
      city: String,
      state: String,
      country: String,
      zipCode: String,
    },
    socialLinks: {
      website: {
        type: String,
        maxlength: 200,
      },
      facebook: {
        type: String,
        maxlength: 200,
      },
      linkedIn: {
        type: String,
        maxlength: 200,
      },
      instagram: {
        type: String,
        maxlength: 200,
      },
      x: {
        type: String,
        maxlength: 200,
      },
      youtube: {
        type: String,
        maxlength: 200,
      },
    },
    lastLoginAt: {
      type: Date,
    },
  },
  {
    timestamps: true, // Adds createdAt and updatedAt
  }
);

// Indexes for performance
// Note: email and username already have indexes from unique: true
userSchema.index({ role: 1, isActive: 1 });

// Transform Better Auth fields to User model fields after document is loaded from DB
// This handles documents created directly by Better Auth (bypassing Mongoose)
userSchema.post(["findOne", "find", "findOneAndUpdate"], function (docs: any) {
  if (!docs) return;

  const documents = Array.isArray(docs) ? docs : [docs];

  documents.forEach((doc: any) => {
    if (!doc) return;

    // Sync Better Auth's 'name' field to firstName/lastName if needed
    if (doc.name && (!doc.firstName || !doc.lastName)) {
      const nameParts = doc.name.trim().split(/\s+/);
      if (nameParts.length > 0) {
        doc.firstName = nameParts[0];
        doc.lastName = nameParts.slice(1).join(" ") || nameParts[0];
      }
    }

    // Sync Better Auth's 'emailVerified' to 'isEmailVerified'
    if (doc.emailVerified !== undefined && doc.isEmailVerified === undefined) {
      doc.isEmailVerified = doc.emailVerified;
    }

    // Sync Better Auth's 'image' to 'avatar'
    if (doc.image && !doc.avatar) {
      doc.avatar = doc.image;
    }
  });
});

// Transform Better Auth fields to User model fields before saving
userSchema.pre("save", async function () {
  // Ensure role is set - default to 'learner' if not provided
  if (!this.role) {
    this.role = "learner";
  }

  // Sync Better Auth's 'name' field to firstName/lastName
  if (this.name && (!this.firstName || !this.lastName)) {
    const nameParts = this.name.trim().split(/\s+/);
    if (nameParts.length > 0) {
      this.firstName = nameParts[0];
      this.lastName = nameParts.slice(1).join(" ") || nameParts[0];
    }
  }

  // Sync Better Auth's 'emailVerified' to 'isEmailVerified'
  if (this.emailVerified !== undefined) {
    this.isEmailVerified = this.emailVerified;
  }

  // Sync Better Auth's 'image' to 'avatar'
  if (this.image && !this.avatar) {
    this.avatar = this.image;
  }

  // Generate username from email if not provided (for Better Auth users)
  if (!this.username && this.email) {
    const emailPrefix = this.email.split("@")[0];
    this.username = `${emailPrefix}_${Date.now()}`;
  }

  // Hash password before saving (only if password is provided and modified)
  if (this.isModified("password") && this.password) {
    this.password = await bcrypt.hash(this.password, 12);
  }
});

// Method to compare passwords
userSchema.methods.comparePassword = async function (
  candidatePassword: string
): Promise<boolean> {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Virtual for full name
userSchema.virtual("fullName").get(function () {
  return `${this.firstName} ${this.lastName}`;
});

// Explicitly set collection name to "users" to match Better Auth's plural collection
// Prevent model recompilation in Next.js development
const UserModel = models.User || model<IUser>("User", userSchema, "users");
export default UserModel;
