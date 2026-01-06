// lib/api/db.ts - Serverless-optimized MongoDB connection
import mongoose from "mongoose";
import config from "./config";
import { logger } from "./logger";

// CRITICAL: Cache connection across serverless invocations using global
interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

// Extend global namespace
declare global {
  var mongooseCache: MongooseCache | undefined;
}

// Initialize cache
let cached: MongooseCache = global.mongooseCache || {
  conn: null,
  promise: null,
};

if (!global.mongooseCache) {
  global.mongooseCache = cached;
}

/**
 * Serverless-optimized MongoDB connection with caching
 * Reuses connections across serverless function invocations
 */
export const connectToDatabase = async (): Promise<typeof mongoose> => {
  // Validate MONGO_URI
  if (!config.MONGO_URI) {
    throw new Error("MONGO_URI is not defined in the configuration.");
  }

  // Return cached connection if available
  if (cached.conn) {
    logger.info("Using cached MongoDB connection", {
      readyState: cached.conn.connection.readyState,
    });
    return cached.conn;
  }

  // If already connecting, wait for that promise
  if (cached.promise) {
    logger.info("Waiting for pending MongoDB connection");
    try {
      cached.conn = await cached.promise;
      return cached.conn;
    } catch (error) {
      // Reset promise on error so next request can retry
      cached.promise = null;
      throw error;
    }
  }

  // Create new connection with serverless-optimized settings
  const connectionOptions: mongoose.ConnectOptions = {
    dbName: "elkan-db",
    appName: "Elkan Next.js API",

    // CRITICAL: Serverless connection pool settings
    maxPoolSize: 10, // Limit concurrent connections (default 100 is too high)
    minPoolSize: 2, // Maintain minimum connections
    maxIdleTimeMS: 10000, // Close idle connections after 10s
    serverSelectionTimeoutMS: 5000, // Fail fast if can't connect
    socketTimeoutMS: 45000, // Socket timeout
    family: 4, // Force IPv4 (faster DNS resolution)

    // Connection stability
    retryWrites: true,
    retryReads: true,

    // Server API version (your existing config)
    serverApi: {
      version: "1",
      strict: true,
      deprecationErrors: true,
    },
  };

  // Create connection promise and cache it
  cached.promise = mongoose
    .connect(config.MONGO_URI, connectionOptions)
    .then((mongooseInstance) => {
      logger.info("MongoDB connected successfully", {
        host: mongooseInstance.connection.host,
        readyState: mongooseInstance.connection.readyState,
      });
      return mongooseInstance;
    })
    .catch((error) => {
      // Reset promise on connection failure
      cached.promise = null;
      logger.error("MongoDB connection failed", {
        error: error.message,
        stack: error.stack,
      });
      throw error;
    });

  try {
    cached.conn = await cached.promise;
    return cached.conn;
  } catch (error) {
    cached.promise = null; // Reset on error
    throw error;
  }
};

/**
 * Get current connection status
 * Useful for health checks
 */
export const getConnectionStatus = () => {
  if (!cached.conn) {
    return { connected: false, readyState: 0 };
  }

  return {
    connected: cached.conn.connection.readyState === 1,
    readyState: cached.conn.connection.readyState,
    host: cached.conn.connection.host,
  };
};

/**
 * Disconnect from database
 * NOTE: In serverless, you typically DON'T want to disconnect
 * Let the connection pool manage connections automatically
 */
export const disconnectFromDatabase = async (): Promise<void> => {
  try {
    if (cached.conn && cached.conn.connection.readyState !== 0) {
      await cached.conn.disconnect();
      cached.conn = null;
      cached.promise = null;
      logger.info("Disconnected from MongoDB successfully");
    }
  } catch (error) {
    logger.error("Error disconnecting from MongoDB:", error);
    // Reset cache even on error
    cached.conn = null;
    cached.promise = null;
    throw error;
  }
};

/**
 * Health check endpoint helper
 */
export const checkDatabaseHealth = async (): Promise<boolean> => {
  try {
    const mongoose = await connectToDatabase();
    return mongoose.connection.readyState === 1;
  } catch (error) {
    logger.error("Database health check failed", { error });
    return false;
  }
};
