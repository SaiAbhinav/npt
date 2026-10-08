/**
 * Downloads each park's boundary from the National Park Service's public data
 * repository (github.com/nationalparkservice/data) into tools/cache/.
 * build-map.cjs reads them from there. Only needed when rebuilding the map.
 *
 *   cd tools && npm run fetch-boundaries
 */
const fs = require('fs');
const path = require('path');
const { boundaryCodes } = require('./park-list.cjs');

const BASE = 'https://raw.githubusercontent.com/nationalparkservice/data/gh-pages/base_data/boundaries/parks';
const CACHE = path.join(__dirname, 'cache', 'park-boundaries');

(async () => {
  fs.mkdirSync(CACHE, { recursive: true });
  const codes = [...new Set(Object.values(boundaryCodes()))].sort();
  let failed = 0;
  for (const code of codes) {
    const file = path.join(CACHE, `${code}.geojson`);
    if (fs.existsSync(file)) continue;
    const res = await fetch(`${BASE}/${code}.geojson`);
    if (!res.ok) { console.error(`  ${code}: HTTP ${res.status}`); failed += 1; continue; }
    fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
    console.log(`  ${code}`);
  }
  console.log(failed ? `${failed} downloads failed.` : `All ${codes.length} boundaries are in ${path.relative(process.cwd(), CACHE)}.`);
  process.exit(failed ? 1 : 0);
})();
