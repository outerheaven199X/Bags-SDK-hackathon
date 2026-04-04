/** Copies signing HTML pages into dist/ after tsc compilation. */
const { cpSync, mkdirSync } = require('fs');

const SIGNING_DIST_DIR = 'dist/src/signing';
const ASSETS = [
  'src/signing/page.html',
  'src/signing/scout-page.html',
];

mkdirSync(SIGNING_DIST_DIR, { recursive: true });
for (const asset of ASSETS) {
  cpSync(asset, `dist/${asset}`);
}
