// models/user.model.ts
import { Schema, SchemaType, model, models, Document, Types } from "mongoose";
import bcrypt from "bcryptjs";

// Better Auth (web sign-up, incl. Google/Apple OAuth) assigns UUID string ids
// via `generateId: () => crypto.randomUUID()`. Legacy/mobile accounts use
// standard ObjectIds. The `Document<Types.ObjectId | string>` generic tells
// Mongoose's own typings to accept both, matching the `_id: UserId` schema
// type below — this is what lets findById/findOne/$in/populate calls with a
// UUID-shaped id compile and run without a CastError.
//
// IMPORTANT: `_id` used to be plain `Schema.Types.Mixed`. Mixed's
// `castForQuery` is a no-op identity function (see
// node_modules/mongoose/lib/schema/mixed.js) — unlike `Schema.Types.ObjectId`,
// which auto-casts a 24-char hex string into a real `Types.ObjectId` BSON
// instance before querying. With `_id: Mixed`, `User.findById("<hex string>")`
// built the filter `{ _id: "<hex string>" }` (a JS string), which does NOT
// match legacy documents whose `_id` is stored as a real BSON ObjectId — so
// every `User.findById(rawStringId)` call site silently returned null for
// legacy (pre-UUID-fix) users, even when they existed. Nearly every call site
// in the codebase (withPremium, /api/v1/users/current, Stripe/Apple sync
// routes, etc.) calls `findById`/`findOne` with a raw string id, so fixing
// each call site individually wasn't practical — instead we fix it once here
// with a custom SchemaType (`UserIdSchemaType` below) that casts
// ObjectId-shaped strings/instances to `Types.ObjectId` and leaves anything
// else (UUID strings) untouched, for both document values and query values
// (including `$in`/`$nin`/`$all` arrays, via the inherited base
// `SchemaType.prototype.castForQuery`).
const OBJECT_ID_STRING_RE = /^[0-9a-fA-F]{24}$/;

function looksLikeObjectId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    OBJECT_ID_STRING_RE.test(value) &&
    Types.ObjectId.isValid(value)
  );
}

/**
 * Custom SchemaType for `User._id` that transparently supports both legacy
 * 24-char hex ObjectIds and Better Auth UUID strings.
 *
 * - ObjectId-shaped string or `Types.ObjectId` instance -> cast to `Types.ObjectId`
 *   (so it matches documents whose `_id` is stored as a real BSON ObjectId).
 * - Anything else (UUID string) -> returned unchanged, exactly like `Mixed`.
 *
 * Only `cast()` is overridden; `castForQuery` is inherited from the base
 * `SchemaType`, which calls `cast()` per-element for `$in`/`$nin`/`$all`
 * arrays and for the plain-value case — so `User.find({ _id: { $in: [...] } })`
 * with a mix of ObjectId and UUID ids works correctly too.
 */
class UserIdSchemaType extends SchemaType {
  static schemaName = "UserId";

  constructor(key: string, options?: Record<string, unknown>) {
    super(key, options, "UserId");
  }

  cast(value: unknown): Types.ObjectId | string {
    if (value instanceof Types.ObjectId) {
      return value;
    }
    if (looksLikeObjectId(value)) {
      return new Types.ObjectId(value);
    }
    // UUID string (or any other already-valid `_id` value) — store/query as-is.
    return value as string;
  }
}

// Register under Mongoose's global SchemaType registry so `interpretAsType`
// (schema.js) can resolve `{ type: UserIdSchemaType }` by name. Mongoose's
// own TypeScript types don't model arbitrary custom types on `Schema.Types`,
// hence the cast — this mirrors the pattern from Mongoose's official custom
// schema type docs (https://mongoosejs.com/docs/customschematypes.html).
(Schema.Types as unknown as Record<string, unknown>).UserId = UserIdSchemaType;

export interface IUser extends Document<Types.ObjectId | string> {
  _id: Types.ObjectId | string;
  firstName: string; // Required for registration
  lastName: string; // Required for registration
  name?: string; // Better Auth uses this field (synced from firstName/lastName)
  username?: string; // Optional
  email: string;
  password?: string; // Optional for OAuth users
  role: "user" | "admin" | "tutor"; // Updated roles
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
  hasProfile?: boolean; // Indicates if user has completed onboarding/profile setup
  // Soft delete
  isDeleted?: boolean;
  deletedAt?: Date | null;
  // Subscription core
  subscriptionPlan?: "free" | "premium";
  subscriptionBillingPeriod?: "monthly" | "quarterly" | "annual" | null;
  subscriptionActivatedAt?: Date | null;
  subscriptionExpiresAt?: Date | null;
  /**
   * Admin/tutor Drill Builder week cap for this learner.
   * Lazily seeded from the prior time-based week count; further weeks are
   * created manually via POST /students/:id/weeks. Null/unset = not seeded yet.
   */
  drillBuilderWeekCount?: number | null;
  /**
   * Optional per-week display date overrides for Drill Builder week cards.
   * Sparse: only weeks the tutor/admin has edited. Unedited weeks keep
   * formula dates from the learner anchor. Does not affect assignment
   * dueDate / assignedAt / builderWeekNumber.
   */
  drillBuilderWeekDates?: Array<{
    weekNumber: number;
    weekStartDate: Date;
    weekEndDate: Date;
  }>;
  /**
   * Admin/tutor Precision Clinic week cap for this learner. Mirrors
   * `drillBuilderWeekCount` but tracked separately so the two builders
   * don't interfere with each other's week counts.
   */
  precisionClinicWeekCount?: number | null;
  // Zero Pause add-on products (admin-assigned). `mastery` is legacy storage only.
  zeroPauseProducts?: ("challenge" | "maintainer" | "mastery")[];
  /** Zero Pause Challenge trial window start. */
  zeroPauseDate?: Date | null;
  /** Zero Pause Challenge trial window end (inclusive). */
  zeroPauseEndDate?: Date | null;
  /** Zero Pause Challenge post-trial window start. */
  zeroPausePostTrialDate?: Date | null;
  /** Zero Pause Challenge post-trial window end (inclusive). */
  zeroPausePostTrialEndDate?: Date | null;
  /**
   * Public Stripe Price ID to restore when leaving Maintainer (→ Challenge).
   * Snapshotted when entering Maintainer from a non-Maintainer cohort.
   */
  zeroPausePriorStripePriceId?: string | null;
  /** Billing period matching `zeroPausePriorStripePriceId`. */
  zeroPausePriorBillingPeriod?: "monthly" | "quarterly" | "annual" | null;
  // Admin-only bookkeeping
  subscriptionMonthsPaidFor?: number | null;
  subscriptionAmountPaid?: number | null;
  subscriptionPaymentMethod?: string | null;
  subscriptionAdminNote?: string | null;
  /** Admin/tutor who last updated subscription bookkeeping (ObjectId or UUID). */
  subscriptionUpdatedBy?: Types.ObjectId | string | null;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  /** Active Stripe Subscription Schedule id (Phase 7 price migration). */
  stripeScheduleId?: string;
  stripeSubscriptionStatus?: string;
  subscriptionProvider?: string | null;
  appleOriginalTransactionId?: string;
  appleLatestTransactionId?: string;
  appleSubscriptionStatus?: string;
  // Purpose-built UUID identifier for Apple StoreKit's appAccountToken.
  // `_id` is unsafe to use directly here since roughly half the user base
  // (legacy/mobile accounts) has a non-UUID ObjectId `_id`. Lazily
  // generated on first login / profile fetch if missing — see
  // verify-id-token and users/current routes.
  iapAccountToken?: string;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    // Explicitly override the default ObjectId _id type so Mongoose accepts
    // Better Auth's UUID string ids (web sign-up/OAuth) alongside legacy
    // ObjectIds (mobile OAuth, pre-Better-Auth accounts). Unlike plain
    // `Mixed`, `UserIdSchemaType` casts ObjectId-shaped values (both on
    // save and on query) to real `Types.ObjectId` instances so lookups by
    // legacy hex-string ids still match BSON ObjectId-keyed documents.
    _id: {
      // Mongoose's `Schema<IUser>` typings only know about `Mixed`/`String`/
      // `ObjectId` as valid `_id` type definitions, so a custom SchemaType
      // needs an escape hatch here. The runtime behavior is unaffected —
      // `interpretAsType` resolves the actual constructor via the
      // `Schema.Types.UserId` registry entry set up above.
      type: UserIdSchemaType as unknown as typeof Schema.Types.Mixed,
    },
    firstName: {
      type: String,
      required: [true, "First name is required"],
      maxlength: [50, "First name cannot exceed 50 characters"],
      trim: true,
    },
    lastName: {
      type: String,
      required: [true, "Last name is required"],
      maxlength: [50, "Last name cannot exceed 50 characters"],
      trim: true,
    },
    // Better Auth uses 'name' field - we'll sync this from firstName/lastName
    name: {
      type: String,
      required: false,
      select: false, // Don't return in queries, we use firstName/lastName
    },
    username: {
      type: String,
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
      required: false,
      enum: {
        values: ["user", "admin", "tutor"],
        message: "{VALUE} is not a valid role",
      },
      default: "user", // Changed default from "learner" to "user"
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
    hasProfile: {
      type: Boolean,
      default: false,
      index: true, // Index for faster queries
    },
    // Soft delete flags
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
    // Subscription core fields
    subscriptionPlan: {
      type: String,
      enum: ["free", "premium"],
      default: "free",
      index: true,
    },
    subscriptionBillingPeriod: {
      type: String,
      enum: ["monthly", "quarterly", "annual"],
      default: null,
    },
    // `mastery` kept in enum so legacy docs still load; not assignable via admin API/UI.
    zeroPauseProducts: {
      type: [{ type: String, enum: ["challenge", "mastery", "maintainer"] }],
      default: [],
    },
    zeroPauseDate: {
      type: Date,
      default: null,
    },
    zeroPauseEndDate: {
      type: Date,
      default: null,
    },
    zeroPausePostTrialDate: {
      type: Date,
      default: null,
    },
    zeroPausePostTrialEndDate: {
      type: Date,
      default: null,
    },
    zeroPausePriorStripePriceId: {
      type: String,
      default: null,
    },
    zeroPausePriorBillingPeriod: {
      type: String,
      enum: ["monthly", "quarterly", "annual"],
      default: null,
    },
    subscriptionActivatedAt: {
      type: Date,
      default: null,
    },
    subscriptionExpiresAt: {
      type: Date,
      default: null,
      index: true,
    },
    drillBuilderWeekCount: {
      type: Number,
      default: null,
      min: 1,
    },
    drillBuilderWeekDates: {
      type: [
        {
          weekNumber: { type: Number, required: true, min: 1 },
          weekStartDate: { type: Date, required: true },
          weekEndDate: { type: Date, required: true },
        },
      ],
      default: undefined,
    },
    precisionClinicWeekCount: {
      type: Number,
      default: null,
      min: 1,
    },
    // Admin-only bookkeeping
    subscriptionMonthsPaidFor: {
      type: Number,
      default: 0,
    },
    subscriptionAmountPaid: {
      type: Number,
      default: 0,
    },
    subscriptionPaymentMethod: {
      type: String,
    },
    subscriptionAdminNote: {
      type: String,
      maxlength: 500,
    },
    subscriptionUpdatedBy: {
      // UserId: Better Auth admin/tutor accounts may have UUID _id values.
      type: UserIdSchemaType as unknown as typeof Schema.Types.Mixed,
      ref: "User",
    },
    stripeCustomerId: {
      type: String,
      index: true,
      sparse: true,
    },
    stripeSubscriptionId: {
      type: String,
      index: true,
      sparse: true,
    },
    stripeScheduleId: {
      type: String,
      index: true,
      sparse: true,
    },
    stripeSubscriptionStatus: {
      type: String,
    },
    subscriptionProvider: {
      type: String,
    },
    appleOriginalTransactionId: {
      type: String,
      index: true,
      sparse: true,
    },
    appleLatestTransactionId: {
      type: String,
    },
    appleSubscriptionStatus: {
      type: String,
    },
    // Sparse + indexed for query performance, but intentionally NOT a hard
    // unique constraint — generation is lazy (crypto.randomUUID()) and
    // UUID v4 collision probability is negligible, so a uniqueness
    // constraint isn't needed here.
    iapAccountToken: {
      type: String,
      index: true,
      sparse: true,
    },
  },
  {
    timestamps: true, // Adds createdAt and updatedAt
  }
);

// Indexes for performance
// Note: email and username already have indexes from unique: true
userSchema.index({ role: 1, isActive: 1 });
userSchema.index({ subscriptionPlan: 1, subscriptionExpiresAt: 1 });

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
  // Ensure role is set - default to 'user' if not provided
  if (!this.role) {
    this.role = "user";
  }

  // Sync firstName/lastName to Better Auth's 'name' field
  if (this.firstName && this.lastName && !this.name) {
    this.name = `${this.firstName} ${this.lastName}`;
  }

  // Sync Better Auth's 'name' field to firstName/lastName if needed (for OAuth users)
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

  // Ensure hasProfile is false for new users (especially OAuth users)
  // Only set to false if this is a new document and hasProfile is not explicitly set
  if (this.isNew && this.hasProfile === undefined) {
    this.hasProfile = false;
  }
  
  // For admin/tutor roles, set hasProfile to true
  if (this.role === 'admin' || this.role === 'tutor') {
    this.hasProfile = true;
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
