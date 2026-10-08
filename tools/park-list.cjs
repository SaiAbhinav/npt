/**
 * Loads the park list from js/data/parks.js exactly as the site does, so the
 * build tools never keep a second copy of the park data.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');

function loadParks() {
  const sandbox = { window: { NPT_VISITED: [] }, console };
  sandbox.window.window = sandbox.window;
  vm.createContext(sandbox);
  for (const file of ['js/core/utils.js', 'js/data/parks.js']) {
    vm.runInContext(fs.readFileSync(path.join(ROOT, file), 'utf8'), sandbox, { filename: file });
  }
  return sandbox.window.NPT.data.parks;
}

// Sequoia and Kings Canyon share one website (nps.gov/seki) but have separate
// boundary files.
const BOUNDARY_OVERRIDES = { sequoia: 'sequ', 'kings-canyon': 'kica' };

/** park id → boundary file code */
function boundaryCodes() {
  return Object.fromEntries(loadParks().map((p) => [p.id, BOUNDARY_OVERRIDES[p.id] || p.npsCode]));
}

module.exports = { ROOT, loadParks, boundaryCodes };
