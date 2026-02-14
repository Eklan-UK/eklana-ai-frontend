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

  // Return cached connection if available and healthy
  if (cached.conn) {
    const readyState = cached.conn.connection.readyState;
    // 0 = disconnected, 1 = connected, 2 = connecting, 3 = disconnecting
    if (readyState === 1) {
      logger.info("Using cached MongoDB connection", {
        readyState,
      });
      return cached.conn;
    } else if (readyState === 0) {
      // Connection is disconnected, clear cache and reconnect
      logger.warn("Cached MongoDB connection is disconnected, reconnecting...", {
        readyState,
      });
      cached.conn = null;
      cached.promise = null;
    } else {
      // Connection is in transition state, wait a bit and check again
      logger.info("MongoDB connection in transition state, waiting...", {
        readyState,
      });
      await new Promise(resolve => setTimeout(resolve, 100));
      if (cached.conn && cached.conn.connection.readyState === 1) {
        return cached.conn;
      }
      // Still not ready, clear and reconnect
      cached.conn = null;
      cached.promise = null;
    }
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

  // Create connection promise with retry logic
  cached.promise = (async () => {
    const maxRetries = 3;
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const mongooseInstance = await mongoose.connect(config.MONGO_URI!, connectionOptions);
        
        // Verify connection is actually ready
        if (mongooseInstance.connection.readyState === 1) {
          logger.info("MongoDB connected successfully", {
            host: mongooseInstance.connection.host,
            readyState: mongooseInstance.connection.readyState,
            attempt,
          });
          return mongooseInstance;
        } else {
          throw new Error(`Connection established but readyState is ${mongooseInstance.connection.readyState}`);
        }
      } catch (error: any) {
        lastError = error;
        logger.warn(`MongoDB connection attempt ${attempt}/${maxRetries} failed`, {
          error: error.message,
          attempt,
        });
        
        if (attempt < maxRetries) {
          // Wait before retry (exponential backoff)
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }
      }
    }
    
    // All retries failed
    cached.promise = null;
    logger.error("MongoDB connection failed after all retries", {
      error: lastError?.message,
      stack: lastError?.stack,
    });
    throw lastError || new Error("MongoDB connection failed");
  })();

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
