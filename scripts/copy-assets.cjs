/** Copies signing HTML pages into dist/ after tsc compilation. */
const { cpSync, mkdirSync, existsSync } = require('fs');
const { join } = require('path');

const SIGNING_DIST_DIR = 'dist/src/signing';
const ASSETS = [
  'src/signing/page.html',
  'src/signing/scout-page.html',
];

mkdirSync(SIGNING_DIST_DIR, { recursive: true });

for (const asset of ASSETS) {
  if (!existsSync(asset)) {
    console.error(`[copy-assets] Missing source file: ${asset}`);
    process.exit(1);
  }
  cpSync(asset, join('dist', asset));
}
