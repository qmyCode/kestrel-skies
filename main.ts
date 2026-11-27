/** Kestrel Skies - Build Script for make.fun */
import { copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { buildDossier } from './vendor/makefun-game.ts';

const __dirname = resolve('.');
const OUTPUT_DIR = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
const GAME_DIR = join(__dirname, 'game');
const SCREENSHOTS_DIR = join(__dirname, 'screenshots');

function main() {
  console.log('Building Kestrel Skies dossier...');
  console.log(`Output directory: ${OUTPUT_DIR}`);
  console.log(`Game directory: ${GAME_DIR}`);
  console.log(`Screenshots directory: ${SCREENSHOTS_DIR}`);

  // Ensure output directory exists
  mkdirSync(OUTPUT_DIR, { recursive: true });

  // Copy game/ to output/game/
  const outGameDir = join(OUTPUT_DIR, 'game');
  if (existsSync(outGameDir)) {
    rmSync(outGameDir, { recursive: true, force: true });
  }
  cpSync(GAME_DIR, outGameDir, { recursive: true });
  console.log('Copied game/ to output/game/');

  // Copy screenshots/ to output/screenshots/ (create empty if missing)
  const outScreenshotsDir = join(OUTPUT_DIR, 'screenshots');
  if (existsSync(SCREENSHOTS_DIR)) {
    if (existsSync(outScreenshotsDir)) {
      rmSync(outScreenshotsDir, { recursive: true, force: true });
    }
    cpSync(SCREENSHOTS_DIR, outScreenshotsDir, { recursive: true });
    console.log('Copied screenshots/ to output/screenshots/');
  } else {
    // Create empty screenshots directory (allowed - buildDossier will handle empty dir)
    mkdirSync(outScreenshotsDir, { recursive: true });
    console.log('Created empty screenshots/ directory');
  }

  // Build dossier.json with exact caps from brief
  const caps = {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  };

  try {
    const dossierBytes = buildDossier(OUTPUT_DIR, caps);
    const dossierPath = join(OUTPUT_DIR, 'dossier.json');
    writeFileSync(dossierPath, dossierBytes);
    console.log(`Wrote dossier.json (${dossierBytes.length} bytes)`);

    // Verify dossier is valid JSON
    const dossier = JSON.parse(new TextDecoder().decode(dossierBytes));
    console.log(`Dossier schema: ${dossier.schema}`);
    console.log(`Cover image index: ${dossier.cover}`);
    console.log(`Images: ${dossier.images.length}`);
    console.log(`Text length: ${dossier.text.length} chars`);

    console.log('Build successful!');
  } catch (err) {
    console.error('Build failed:', err);
    process.exit(1);
  }
}

main();