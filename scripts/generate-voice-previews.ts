/**
 * Generate short ElevenLabs TTS samples for every accent voice and upload to
 * Cloudinary (eklan/voice-previews/{key}). Patches previewAudioUrl into
 * src/services/tts-accent-voices.ts.
 *
 * Usage:
 *   npx tsx scripts/generate-voice-previews.ts
 *   npm run generate:voice-previews
 *
 * Requires ELEVEN_LABS_API_KEY + Cloudinary credentials in .env / .env.local.
 */
import '../src/scripts/load-env';
import fs from 'fs';
import path from 'path';
import { v2 as cloudinary } from 'cloudinary';
import { Readable } from 'stream';
import {
  ACCENT_VOICE_OPTIONS,
  VOICE_PREVIEW_SAMPLE_TEXT,
  type AccentVoiceKey,
} from '../src/services/tts-accent-voices';
import { generateElevenLabsAudio } from '../src/services/tts-provider.service';

const CATALOG_PATH = path.resolve(
  process.cwd(),
  'src/services/tts-accent-voices.ts',
);
const FOLDER = 'eklan/voice-previews';

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

function uploadAudioBuffer(
  buffer: Buffer,
  publicId: string,
): Promise<{ secureUrl: string; publicId: string }> {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: FOLDER,
        public_id: publicId,
        resource_type: 'video',
        overwrite: true,
        invalidate: true,
        format: 'mp3',
      },
      (error, result) => {
        if (error) {
          reject(error);
          return;
        }
        if (!result?.secure_url) {
          reject(new Error('Cloudinary upload returned no secure_url'));
          return;
        }
        resolve({
          secureUrl: result.secure_url,
          publicId: result.public_id,
        });
      },
    );
    Readable.from(buffer).pipe(uploadStream);
  });
}

function patchCatalog(urlByKey: Record<AccentVoiceKey, string>): void {
  let source = fs.readFileSync(CATALOG_PATH, 'utf8');

  for (const [key, url] of Object.entries(urlByKey)) {
    const escapedUrl = url.replace(/'/g, "\\'");
    // Replace existing previewAudioUrl on the option line, or insert before closing }.
    const withExisting = new RegExp(
      `(\\{[^}]*key:\\s*'${key}'[^}]*?),\\s*previewAudioUrl:\\s*'[^']*'(\\s*\\})`,
      'm',
    );
    if (withExisting.test(source)) {
      source = source.replace(
        withExisting,
        `$1, previewAudioUrl: '${escapedUrl}'$2`,
      );
      continue;
    }

    const withoutUrl = new RegExp(
      `(\\{[^}]*key:\\s*'${key}'[^}]*group:\\s*'[^']+')(\\s*\\})`,
      'm',
    );
    if (!withoutUrl.test(source)) {
      console.warn(`⚠️  Could not patch catalog entry for ${key}`);
      continue;
    }
    source = source.replace(
      withoutUrl,
      `$1, previewAudioUrl: '${escapedUrl}'$2`,
    );
  }

  fs.writeFileSync(CATALOG_PATH, source, 'utf8');
  console.log(`\n📝 Patched ${CATALOG_PATH}`);
}

async function main() {
  const cloudName = requireEnv('CLOUDINARY_CLOUD_NAME');
  const apiKey = requireEnv('CLOUDINARY_API_KEY');
  const apiSecret = requireEnv('CLOUDINARY_API_SECRET');
  requireEnv('ELEVEN_LABS_API_KEY');

  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
  });

  console.log(
    `Generating ${ACCENT_VOICE_OPTIONS.length} voice previews…\nSample: "${VOICE_PREVIEW_SAMPLE_TEXT}"\n`,
  );

  const urlByKey = {} as Record<AccentVoiceKey, string>;
  let success = 0;
  let failed = 0;

  for (let i = 0; i < ACCENT_VOICE_OPTIONS.length; i++) {
    const option = ACCENT_VOICE_OPTIONS[i];
    const label = `[${i + 1}/${ACCENT_VOICE_OPTIONS.length}] ${option.key}`;
    try {
      process.stdout.write(`${label} — TTS… `);
      const arrayBuffer = await generateElevenLabsAudio({
        text: VOICE_PREVIEW_SAMPLE_TEXT,
        voiceId: option.voiceId,
      });
      const buffer = Buffer.from(arrayBuffer);
      process.stdout.write(`upload (${buffer.length} bytes)… `);
      const uploaded = await uploadAudioBuffer(buffer, option.key);
      urlByKey[option.key] = uploaded.secureUrl;
      success += 1;
      console.log(`OK\n  ${uploaded.secureUrl}`);
      // Avoid ElevenLabs rate limits
      await new Promise((r) => setTimeout(r, 250));
    } catch (err) {
      failed += 1;
      const message = err instanceof Error ? err.message : String(err);
      console.log(`FAIL\n  ${message}`);
    }
  }

  if (Object.keys(urlByKey).length > 0) {
    patchCatalog(urlByKey);
  }

  console.log(`\nDone. success=${success} failed=${failed}`);
  if (failed > 0) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
