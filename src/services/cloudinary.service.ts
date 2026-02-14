import { v2 as cloudinary } from 'cloudinary';
import config from '@/lib/api/config';
import { logger } from '@/lib/api/logger';
import { Readable } from 'stream';

// Configure Cloudinary
if (config.CLOUDINARY_CLOUD_NAME && config.CLOUDINARY_API_KEY && config.CLOUDINARY_API_SECRET) {
  cloudinary.config({
    cloud_name: config.CLOUDINARY_CLOUD_NAME,
    api_key: config.CLOUDINARY_API_KEY,
    api_secret: config.CLOUDINARY_API_SECRET,
    // Increase timeout for large file uploads (videos)
    // Note: These are in milliseconds
    api_timeout: 600000, // 10 minutes
    upload_timeout: 600000, // 10 minutes
  });
} else {
  logger.warn('Cloudinary credentials not configured. Image uploads will fail.');
}

interface UploadOptions {
  folder?: string;
  publicId?: string;
  transformation?: any;
  resourceType?: 'image' | 'video' | 'raw' | 'auto';
}

/**
 * Upload file buffer to Cloudinary
 */
export async function uploadToCloudinary(
  buffer: Buffer,
  options: UploadOptions = {}
): Promise<{ url: string; publicId: string; secureUrl: string }> {
  try {
    const {
      folder = 'eklan/users',
      publicId,
      transformation,
      resourceType = 'image',
    } = options;

    const uploadOptions: any = {
      folder,
      public_id: publicId,
      resource_type: resourceType,
      transformation: transformation || (resourceType === 'video' ? [
        { quality: 'auto', fetch_format: 'auto' },
      ] : [
        { width: 500, height: 500, crop: 'fill', gravity: 'face' },
        { quality: 'auto', fetch_format: 'auto' },
      ]),
    };

    // Use upload_stream for all resources (including large videos), with extended timeouts for video
    return new Promise((resolve, reject) => {
      // Set timeout for video uploads (10 minutes), images (2 minutes)
      const timeout = resourceType === 'video' ? 600000 : 120000;
      const timeoutId = setTimeout(() => {
        reject(new Error('Upload timeout: File upload took too long'));
      }, timeout);

      logger.info('Starting Cloudinary upload', {
        resourceType,
        bufferSize: buffer.length,
        bufferSizeMB: (buffer.length / 1024 / 1024).toFixed(2),
      });

      const uploadStream = cloudinary.uploader.upload_stream(
        uploadOptions,
        (error, result) => {
          clearTimeout(timeoutId);
          
          if (error) {
            logger.error('Cloudinary upload error', { 
              error: error.message || error,
              http_code: (error as any).http_code,
              name: (error as any).name,
              resourceType,
              bufferSize: buffer.length,
            });
            reject(error);
            return;
          }

          if (!result) {
            reject(new Error('Upload failed: No result from Cloudinary'));
            return;
          }

          logger.info('File uploaded successfully to Cloudinary', {
            publicId: result.public_id,
            resourceType,
          });

          resolve({
            url: result.url,
            publicId: result.public_id,
            secureUrl: result.secure_url,
          });
        }
      );

      // Convert buffer to stream
      const stream = Readable.from(buffer);
      stream.pipe(uploadStream);
      
      // Handle stream errors
      stream.on('error', (error) => {
        clearTimeout(timeoutId);
        logger.error('Stream error during upload', { error: error.message });
        reject(error);
      });
      
      uploadStream.on('error', (error) => {
        clearTimeout(timeoutId);
        logger.error('Upload stream error', { error: error.message });
        reject(error);
      });
    });
  } catch (error: any) {
    logger.error('Error uploading to Cloudinary', { error: error.message });
    throw new Error(`Failed to upload file: ${error.message}`);
  }
}

/**
 * Delete file from Cloudinary
 */
export async function deleteFromCloudinary(publicId: string): Promise<void> {
  try {
    await cloudinary.uploader.destroy(publicId);
    logger.info('File deleted from Cloudinary', { publicId });
  } catch (error: any) {
    logger.error('Error deleting from Cloudinary', { error: error.message, publicId });
    throw new Error(`Failed to delete image: ${error.message}`);
  }
}

/**
 * Extract public ID from Cloudinary URL
 */
export function extractPublicIdFromUrl(url: string): string | null {
  try {
    // Cloudinary URL format: https://res.cloudinary.com/{cloud_name}/image/upload/{version}/{public_id}.{format}
    const match = url.match(/\/upload\/(?:v\d+\/)?(.+?)(?:\.[^.]+)?$/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

