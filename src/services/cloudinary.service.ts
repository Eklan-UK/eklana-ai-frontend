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
 * Single attempt to upload a buffer via Cloudinary's upload_stream.
 */
function uploadToCloudinarySingle(
  buffer: Buffer,
  uploadOptions: any,
  resourceType: string,
): Promise<{ url: string; publicId: string; secureUrl: string }> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const settle = (fn: () => void) => {
      if (!settled) {
        settled = true;
        fn();
      }
    };

    // Safety timeout: 10 min for video, 2 min for images
    const timeout = resourceType === 'video' ? 600000 : 120000;
    const timeoutId = setTimeout(() => {
      settle(() => reject(new Error('Upload timeout: File upload took too long')));
    }, timeout);

    logger.info('Starting Cloudinary upload', {
      resourceType,
      bufferSize: buffer.length,
      bufferSizeMB: (buffer.length / 1024 / 1024).toFixed(2),
    });

    const uploadStream = cloudinary.uploader.upload_stream(
      {
        ...uploadOptions,
        // Pass timeout directly so the SDK uses it for the HTTP request
        timeout: timeout,
      },
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
          settle(() => reject(error));
          return;
        }

        if (!result) {
          settle(() => reject(new Error('Upload failed: No result from Cloudinary')));
          return;
        }

        logger.info('File uploaded successfully to Cloudinary', {
          publicId: result.public_id,
          resourceType,
        });

        settle(() =>
          resolve({
            url: result.url,
            publicId: result.public_id,
            secureUrl: result.secure_url,
          }),
        );
      },
    );

    // Convert buffer to stream and pipe
    const stream = Readable.from(buffer);
    stream.pipe(uploadStream);

    // Guard against stream-level errors (settle prevents double-reject)
    stream.on('error', (error) => {
      clearTimeout(timeoutId);
      logger.error('Stream error during upload', { error: error.message });
      settle(() => reject(error));
    });

    uploadStream.on('error', (error) => {
      clearTimeout(timeoutId);
      logger.error('Upload stream error', { error: error.message });
      settle(() => reject(error));
    });
  });
}

/**
 * Upload file buffer to Cloudinary with automatic retry for transient failures.
 */
export async function uploadToCloudinary(
  buffer: Buffer,
  options: UploadOptions = {}
): Promise<{ url: string; publicId: string; secureUrl: string }> {
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

  // Retry up to 3 times for video uploads (transient 499 / timeout errors)
  const maxRetries = resourceType === 'video' ? 3 : 1;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await uploadToCloudinarySingle(buffer, uploadOptions, resourceType);
    } catch (error: any) {
      const isRetryable =
        error.name === 'TimeoutError' ||
        error.message?.includes('Timeout') ||
        error.message?.includes('timeout') ||
        (error as any).http_code === 499 ||
        (error as any).http_code === 500 ||
        (error as any).http_code === 502 ||
        (error as any).http_code === 503;

      if (isRetryable && attempt < maxRetries) {
        const delay = 2000 * attempt; // 2s, 4s back-off
        logger.warn(`Cloudinary upload attempt ${attempt}/${maxRetries} failed, retrying in ${delay}ms...`, {
          error: error.message,
          http_code: (error as any).http_code,
          resourceType,
        });
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }

      logger.error('Error uploading to Cloudinary (all retries exhausted)', {
        error: error.message,
        attempt,
        maxRetries,
      });
      throw new Error(`Failed to upload file: ${error.message}`);
    }
  }

  // Should never reach here, but TypeScript needs it
  throw new Error('Failed to upload file: unexpected error');
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

