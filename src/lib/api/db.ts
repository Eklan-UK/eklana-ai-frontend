// Database connection for Next.js API routes
import mongoose from "mongoose";
import config from "./config";
import { logger } from "./logger";

const clientOptions: mongoose.ConnectOptions = {
  dbName: "elkan-db",
  appName: "Elkan Next.js API",
  serverApi: {
    version: "1",
    strict: true,
    deprecationErrors: true,
  },
};

let isConnected = false;

export const connectToDatabase = async (): Promise<void> => {
  if (!config.MONGO_URI) {
    throw new Error("MONGO_URI is not defined in the configuration.");
  }

  if (isConnected && mongoose.connection.readyState === 1) {
    return; // Already connected
  }

  try {
    await mongoose.connect(config.MONGO_URI, clientOptions);
    isConnected = true;
    logger.info("Connected to MongoDB successfully", {
      uri: config.MONGO_URI,
    });
  } catch (error) {
    isConnected = false;
    if (error instanceof Error) {
      throw error;
    }
    logger.error("Error connecting to MongoDB:", error);
    throw new Error("Error connecting to MongoDB");
  }
};

export const disconnectFromDatabase = async (): Promise<void> => {
  try {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
      isConnected = false;
      logger.info("Disconnected from MongoDB successfully");
    }
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(error.message);
    }
    logger.error("Error disconnecting from MongoDB:", error);
    throw new Error("Error disconnecting from MongoDB");
  }
};
