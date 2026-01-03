# PWA Setup Guide

This guide explains how to set up and use the Progressive Web App (PWA) features.

## Prerequisites

1. Icons need to be generated before the PWA can work properly
2. The app must be built in production mode for PWA features to be active

## Generating Icons

1. Place your base icon (recommended: 512x512px or larger) at:
   ```
   public/ui-images/eklan.ai.png
   ```

2. Run the icon generation script:
   ```bash
   npm run generate-icons
   ```

   This will create all required icon sizes in `public/icons/`:
   - icon-72x72.png
   - icon-96x96.png
   - icon-128x128.png
   - icon-144x144.png
   - icon-152x152.png
   - icon-192x192.png
   - icon-384x384.png
   - icon-512x512.png

## Building for Production

PWA features are **disabled in development mode** for better development experience.

To test PWA features:

1. Build the app:
   ```bash
   npm run build
   ```

2. Start the production server:
   ```bash
   npm start
   ```

3. Open the app in your browser and check:
   - Service Worker registration in DevTools > Application > Service Workers
   - Manifest in DevTools > Application > Manifest
   - Install prompt (browser will show "Add to Home Screen" option)

## PWA Features

### ✅ Implemented Features

- **Service Worker**: Automatic caching and offline support
- **Web App Manifest**: App metadata and installability
- **Runtime Caching**: Smart caching strategies for:
  - Fonts (Google Fonts, static fonts)
  - Images (static images, Next.js optimized images)
  - Audio files (TTS audio caching)
  - JavaScript and CSS assets
  - API responses (network-first strategy)
  - Pages (network-first with fallback)

### 📱 Installation

Users can install the app on:
- **Android**: Chrome/Edge will show "Add to Home Screen" prompt
- **iOS**: Safari users can use "Add to Home Screen" from share menu
- **Desktop**: Chrome/Edge will show install button in address bar

### 🔧 Configuration

PWA settings are configured in:
- `next.config.ts` - Service worker and caching strategies
- `public/manifest.json` - App manifest (name, icons, theme, etc.)
- `src/app/layout.tsx` - Metadata and PWA meta tags

## Testing PWA Features

1. **Offline Mode**: 
   - Open DevTools > Network tab
   - Enable "Offline" mode
   - Navigate the app - cached pages should still work

2. **Install Prompt**:
   - Look for install button in browser address bar
   - Or check DevTools > Application > Manifest > "Add to homescreen"

3. **Service Worker**:
   - DevTools > Application > Service Workers
   - Should see registered service worker
   - Can test "Update" and "Unregister" options

## Troubleshooting

### Icons not showing
- Make sure icons are generated: `npm run generate-icons`
- Check that icons exist in `public/icons/` directory
- Verify manifest.json points to correct icon paths

### Service Worker not registering
- PWA is disabled in development mode
- Build and run in production: `npm run build && npm start`
- Check browser console for errors

### App not installable
- Ensure manifest.json is valid (check in DevTools)
- App must be served over HTTPS (or localhost for development)
- Service worker must be registered successfully

## Notes

- PWA features are automatically disabled in `development` mode
- Service worker files are generated during build and placed in `public/`
- These files are gitignored (see `.gitignore`)


