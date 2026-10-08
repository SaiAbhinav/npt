/**
 * The 63 U.S. national parks.
 * Each row: [name, year established as a national park, states/territories, region,
 *            [latitude, longitude] of the park's center, used to pin it on the map]
 *
 * Photos live in images/parks/, named by park id:
 *   <id>.jpg     large photo for the dialog (≤1600px)
 *   <id>-sm.jpg  small photo for the tile (420px short side)
 * If a photo is missing, the tile and dialog fall back to the placeholder.
 */
(function (NPT) {
  'use strict';

  const { slugify, normalize } = NPT.utils;

  const PLACEHOLDER = 'images/placeholder.svg';
  const PHOTO_DIR = 'images/parks';

  const STATE_CODES = {
    'Alaska': 'AK', 'American Samoa': 'AS', 'Arizona': 'AZ', 'Arkansas': 'AR',
    'California': 'CA', 'Colorado': 'CO', 'Florida': 'FL', 'Hawaii': 'HI',
    'Idaho': 'ID', 'Indiana': 'IN', 'Kentucky': 'KY', 'Maine': 'ME',
    'Michigan': 'MI', 'Minnesota': 'MN', 'Missouri': 'MO', 'Montana': 'MT',
    'Nevada': 'NV', 'New Mexico': 'NM', 'North Carolina': 'NC', 'North Dakota': 'ND',
    'Ohio': 'OH', 'Oregon': 'OR', 'South Carolina': 'SC', 'South Dakota': 'SD',
    'Tennessee': 'TN', 'Texas': 'TX', 'U.S. Virgin Islands': 'VI', 'Utah': 'UT',
    'Virginia': 'VA', 'Washington': 'WA', 'West Virginia': 'WV', 'Wyoming': 'WY',
  };

  /* National Park Service unit codes, used for nps.gov links (nps.gov/<code>). */
  const NPS_CODES = {
    'acadia': 'acad',
    'american-samoa': 'npsa',
    'arches': 'arch',
    'badlands': 'badl',
    'big-bend': 'bibe',
    'biscayne': 'bisc',
    'black-canyon-of-the-gunnison': 'blca',
    'bryce-canyon': 'brca',
    'canyonlands': 'cany',
    'capitol-reef': 'care',
    'carlsbad-caverns': 'cave',
    'channel-islands': 'chis',
    'congaree': 'cong',
    'crater-lake': 'crla',
    'cuyahoga-valley': 'cuva',
    'death-valley': 'deva',
    'denali': 'dena',
    'dry-tortugas': 'drto',
    'everglades': 'ever',
    'gates-of-the-arctic': 'gaar',
    'gateway-arch': 'jeff',
    'glacier': 'glac',
    'glacier-bay': 'glba',
    'grand-canyon': 'grca',
    'grand-teton': 'grte',
    'great-basin': 'grba',
    'great-sand-dunes': 'grsa',
    'great-smoky-mountains': 'grsm',
    'guadalupe-mountains': 'gumo',
    'haleakala': 'hale',
    'hawaii-volcanoes': 'havo',
    'hot-springs': 'hosp',
    'indiana-dunes': 'indu',
    'isle-royale': 'isro',
    'joshua-tree': 'jotr',
    'katmai': 'katm',
    'kenai-fjords': 'kefj',
    'kings-canyon': 'seki',
    'kobuk-valley': 'kova',
    'lake-clark': 'lacl',
    'lassen-volcanic': 'lavo',
    'mammoth-cave': 'maca',
    'mesa-verde': 'meve',
    'mount-rainier': 'mora',
    'new-river-gorge': 'neri',
    'north-cascades': 'noca',
    'olympic': 'olym',
    'petrified-forest': 'pefo',
    'pinnacles': 'pinn',
    'redwood': 'redw',
    'rocky-mountain': 'romo',
    'saguaro': 'sagu',
    'sequoia': 'seki',
    'shenandoah': 'shen',
    'theodore-roosevelt': 'thro',
    'virgin-islands': 'viis',
    'voyageurs': 'voya',
    'white-sands': 'whsa',
    'wind-cave': 'wica',
    'wrangell-st-elias': 'wrst',
    'yellowstone': 'yell',
    'yosemite': 'yose',
    'zion': 'zion',
  };

  const TERRITORIES = new Set(['American Samoa', 'U.S. Virgin Islands']);

  const REGIONS = [
    'Alaska', 'Pacific West', 'Rocky Mountains', 'Southwest', 'Midwest',
    'Southeast', 'Northeast', 'Pacific Islands', 'Caribbean',
  ];

  const RAW = [
    ['Acadia', 1919, ['Maine'], 'Northeast', [44.35, -68.21]],
    ['American Samoa', 1988, ['American Samoa'], 'Pacific Islands', [-14.25, -170.68]],
    ['Arches', 1971, ['Utah'], 'Southwest', [38.68, -109.57]],
    ['Badlands', 1978, ['South Dakota'], 'Midwest', [43.75, -102.5]],
    ['Big Bend', 1944, ['Texas'], 'Southwest', [29.25, -103.25]],
    ['Biscayne', 1980, ['Florida'], 'Southeast', [25.65, -80.08]],
    ['Black Canyon of the Gunnison', 1999, ['Colorado'], 'Rocky Mountains', [38.57, -107.72]],
    ['Bryce Canyon', 1928, ['Utah'], 'Southwest', [37.57, -112.18]],
    ['Canyonlands', 1964, ['Utah'], 'Southwest', [38.2, -109.93]],
    ['Capitol Reef', 1971, ['Utah'], 'Southwest', [38.2, -111.17]],
    ['Carlsbad Caverns', 1930, ['New Mexico'], 'Southwest', [32.17, -104.44]],
    ['Channel Islands', 1980, ['California'], 'Pacific West', [34.01, -119.42]],
    ['Congaree', 2003, ['South Carolina'], 'Southeast', [33.78, -80.78]],
    ['Crater Lake', 1902, ['Oregon'], 'Pacific West', [42.94, -122.1]],
    ['Cuyahoga Valley', 2000, ['Ohio'], 'Midwest', [41.24, -81.55]],
    ['Death Valley', 1994, ['California', 'Nevada'], 'Pacific West', [36.24, -116.82]],
    ['Denali', 1917, ['Alaska'], 'Alaska', [63.33, -150.5]],
    ['Dry Tortugas', 1992, ['Florida'], 'Southeast', [24.63, -82.87]],
    ['Everglades', 1934, ['Florida'], 'Southeast', [25.32, -80.93]],
    ['Gates of the Arctic', 1980, ['Alaska'], 'Alaska', [67.78, -153.3]],
    ['Gateway Arch', 2018, ['Missouri'], 'Midwest', [38.63, -90.19]],
    ['Glacier', 1910, ['Montana'], 'Rocky Mountains', [48.8, -114.0]],
    ['Glacier Bay', 1980, ['Alaska'], 'Alaska', [58.5, -137.0]],
    ['Grand Canyon', 1919, ['Arizona'], 'Southwest', [36.06, -112.14]],
    ['Grand Teton', 1929, ['Wyoming'], 'Rocky Mountains', [43.73, -110.8]],
    ['Great Basin', 1986, ['Nevada'], 'Southwest', [38.98, -114.3]],
    ['Great Sand Dunes', 2004, ['Colorado'], 'Rocky Mountains', [37.73, -105.51]],
    ['Great Smoky Mountains', 1934, ['North Carolina', 'Tennessee'], 'Southeast', [35.68, -83.53]],
    ['Guadalupe Mountains', 1966, ['Texas'], 'Southwest', [31.92, -104.87]],
    ['Haleakalā', 1916, ['Hawaii'], 'Pacific Islands', [20.72, -156.17]],
    ['Hawaiʻi Volcanoes', 1916, ['Hawaii'], 'Pacific Islands', [19.38, -155.2]],
    ['Hot Springs', 1921, ['Arkansas'], 'Southeast', [34.51, -93.05]],
    ['Indiana Dunes', 2019, ['Indiana'], 'Midwest', [41.65, -87.05]],
    ['Isle Royale', 1940, ['Michigan'], 'Midwest', [48.0, -88.83]],
    ['Joshua Tree', 1994, ['California'], 'Pacific West', [33.79, -115.9]],
    ['Katmai', 1980, ['Alaska'], 'Alaska', [58.5, -155.0]],
    ['Kenai Fjords', 1980, ['Alaska'], 'Alaska', [59.92, -149.65]],
    ['Kings Canyon', 1940, ['California'], 'Pacific West', [36.8, -118.55]],
    ['Kobuk Valley', 1980, ['Alaska'], 'Alaska', [67.55, -159.28]],
    ['Lake Clark', 1980, ['Alaska'], 'Alaska', [60.97, -153.42]],
    ['Lassen Volcanic', 1916, ['California'], 'Pacific West', [40.49, -121.51]],
    ['Mammoth Cave', 1941, ['Kentucky'], 'Southeast', [37.18, -86.1]],
    ['Mesa Verde', 1906, ['Colorado'], 'Rocky Mountains', [37.18, -108.49]],
    ['Mount Rainier', 1899, ['Washington'], 'Pacific West', [46.85, -121.75]],
    ['New River Gorge', 2020, ['West Virginia'], 'Southeast', [38.07, -81.08]],
    ['North Cascades', 1968, ['Washington'], 'Pacific West', [48.7, -121.2]],
    ['Olympic', 1938, ['Washington'], 'Pacific West', [47.97, -123.5]],
    ['Petrified Forest', 1962, ['Arizona'], 'Southwest', [35.07, -109.78]],
    ['Pinnacles', 2013, ['California'], 'Pacific West', [36.48, -121.16]],
    ['Redwood', 1968, ['California'], 'Pacific West', [41.3, -124.0]],
    ['Rocky Mountain', 1915, ['Colorado'], 'Rocky Mountains', [40.4, -105.58]],
    ['Saguaro', 1994, ['Arizona'], 'Southwest', [32.25, -110.5]],
    ['Sequoia', 1890, ['California'], 'Pacific West', [36.43, -118.68]],
    ['Shenandoah', 1935, ['Virginia'], 'Southeast', [38.53, -78.35]],
    ['Theodore Roosevelt', 1978, ['North Dakota'], 'Midwest', [46.97, -103.45]],
    ['Virgin Islands', 1956, ['U.S. Virgin Islands'], 'Caribbean', [18.33, -64.73]],
    ['Voyageurs', 1975, ['Minnesota'], 'Midwest', [48.5, -92.88]],
    ['White Sands', 2019, ['New Mexico'], 'Southwest', [32.78, -106.17]],
    ['Wind Cave', 1903, ['South Dakota'], 'Midwest', [43.57, -103.48]],
    ['Wrangell–St. Elias', 1980, ['Alaska'], 'Alaska', [61.0, -142.0]],
    ['Yellowstone', 1872, ['Wyoming', 'Montana', 'Idaho'], 'Rocky Mountains', [44.6, -110.5]],
    ['Yosemite', 1890, ['California'], 'Pacific West', [37.83, -119.5]],
    ['Zion', 1919, ['Utah'], 'Southwest', [37.3, -113.05]],
  ];

  /* Visited parks come from data/visited.js (window.NPT_VISITED), by id or name. */
  const visitedIds = new Set();
  const visitedFileOk = Array.isArray(window.NPT_VISITED);
  const listed = visitedFileOk ? window.NPT_VISITED : [];
  if (!visitedFileOk) {
    console.warn('data/visited.js did not load or is not a list; showing no parks as visited.');
  }
  const knownIds = new Set(RAW.map(([name]) => slugify(name)));
  listed.forEach((entry) => {
    const id = slugify(entry);
    if (knownIds.has(id)) visitedIds.add(id);
    else console.warn(`data/visited.js: "${entry}" doesn't match any park. Check the spelling against the ids in README.md.`);
  });

  const parks = RAW
    .map(([name, established, states, region, [lat, lon]]) => {
      const id = slugify(name);
      const codes = states.map((s) => STATE_CODES[s]).filter(Boolean);
      return Object.freeze({
        id,
        name,
        established,
        states,
        codes,
        region,
        lat,
        lon,
        npsCode: NPS_CODES[id],
        visited: visitedIds.has(id),
        isTerritory: states.every((s) => TERRITORIES.has(s)),
        image: `${PHOTO_DIR}/${id}.jpg`,
        thumb: `${PHOTO_DIR}/${id}-sm.jpg`,
        searchText: normalize([name, ...states, region, 'national park'].join(' ')),
      });
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'en'));

  const stateCodeSet = new Set(Object.values(STATE_CODES).map((c) => c.toLowerCase()));

  NPT.data = Object.freeze({
    parks: Object.freeze(parks),
    regions: Object.freeze(REGIONS.filter((r) => parks.some((p) => p.region === r))),
    states: Object.freeze([...new Set(parks.flatMap((p) => p.states))].sort()),
    stateCodes: STATE_CODES,
    isStateCode: (code) => stateCodeSet.has(String(code).toLowerCase()),
    placeholder: PLACEHOLDER,
    visitedFileOk,
  });
})(window.NPT = window.NPT || {});
