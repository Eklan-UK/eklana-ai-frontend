/**
 * Script to generate PWA icons from a base image
 * Run: node scripts/generate-icons.js
 * 
 * Note: This script requires sharp to be installed
 * npm install sharp --save-dev
 */

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];
const iconsDir = path.join(__dirname, '../public/icons');

// Create icons directory if it doesn't exist
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// Base icon path - you should place your base icon here
const baseIconPath = path.join(__dirname, '../public/ui-images/eklan.ai.png');

if (!fs.existsSync(baseIconPath)) {
  console.error(`Base icon not found at: ${baseIconPath}`);
  console.log('Please place your base icon (eklan.ai.png) in the public/ui-images/ directory');
  process.exit(1);
}

async function generateIcons() {
  console.log('Generating PWA icons...');
  
  for (const size of sizes) {
    try {
      await sharp(baseIconPath)
        .resize(size, size, {
          fit: 'contain',
          background: { r: 255, g: 255, b: 255, alpha: 1 }
        })
        .png({
          compressionLevel: 9,
          quality: 100
        })
        .toFile(path.join(iconsDir, `icon-${size}x${size}.png`));
      
      console.log(`✓ Generated icon-${size}x${size}.png`);
    } catch (error) {
      console.error(`✗ Failed to generate icon-${size}x${size}.png:`, error.message);
      // Create a placeholder if generation fails
      try {
        await sharp({
          create: {
            width: size,
            height: size,
            channels: 4,
            background: { r: 34, g: 197, b: 94, alpha: 1 } // Green background
          }
        })
        .png()
        .toFile(path.join(iconsDir, `icon-${size}x${size}.png`));
        console.log(`  → Created placeholder icon-${size}x${size}.png`);
      } catch (placeholderError) {
        console.error(`  → Failed to create placeholder:`, placeholderError.message);
      }
    }
  }
  
  console.log('\nIcon generation completed!');
}

generateIcons().catch(console.error);

