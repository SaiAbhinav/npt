/**
 * The 63 U.S. national parks.
 * Each row: [name, year established as a national park, states/territories, region]
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

  const TERRITORIES = new Set(['American Samoa', 'U.S. Virgin Islands']);

  const REGIONS = [
    'Alaska', 'Pacific West', 'Rocky Mountains', 'Southwest', 'Midwest',
    'Southeast', 'Northeast', 'Pacific Islands', 'Caribbean',
  ];

  const RAW = [
    ['Acadia', 1919, ['Maine'], 'Northeast'],
    ['American Samoa', 1988, ['American Samoa'], 'Pacific Islands'],
    ['Arches', 1971, ['Utah'], 'Southwest'],
    ['Badlands', 1978, ['South Dakota'], 'Midwest'],
    ['Big Bend', 1944, ['Texas'], 'Southwest'],
    ['Biscayne', 1980, ['Florida'], 'Southeast'],
    ['Black Canyon of the Gunnison', 1999, ['Colorado'], 'Rocky Mountains'],
    ['Bryce Canyon', 1928, ['Utah'], 'Southwest'],
    ['Canyonlands', 1964, ['Utah'], 'Southwest'],
    ['Capitol Reef', 1971, ['Utah'], 'Southwest'],
    ['Carlsbad Caverns', 1930, ['New Mexico'], 'Southwest'],
    ['Channel Islands', 1980, ['California'], 'Pacific West'],
    ['Congaree', 2003, ['South Carolina'], 'Southeast'],
    ['Crater Lake', 1902, ['Oregon'], 'Pacific West'],
    ['Cuyahoga Valley', 2000, ['Ohio'], 'Midwest'],
    ['Death Valley', 1994, ['California', 'Nevada'], 'Pacific West'],
    ['Denali', 1917, ['Alaska'], 'Alaska'],
    ['Dry Tortugas', 1992, ['Florida'], 'Southeast'],
    ['Everglades', 1934, ['Florida'], 'Southeast'],
    ['Gates of the Arctic', 1980, ['Alaska'], 'Alaska'],
    ['Gateway Arch', 2018, ['Missouri'], 'Midwest'],
    ['Glacier', 1910, ['Montana'], 'Rocky Mountains'],
    ['Glacier Bay', 1980, ['Alaska'], 'Alaska'],
    ['Grand Canyon', 1919, ['Arizona'], 'Southwest'],
    ['Grand Teton', 1929, ['Wyoming'], 'Rocky Mountains'],
    ['Great Basin', 1986, ['Nevada'], 'Southwest'],
    ['Great Sand Dunes', 2004, ['Colorado'], 'Rocky Mountains'],
    ['Great Smoky Mountains', 1934, ['North Carolina', 'Tennessee'], 'Southeast'],
    ['Guadalupe Mountains', 1966, ['Texas'], 'Southwest'],
    ['Haleakalā', 1916, ['Hawaii'], 'Pacific Islands'],
    ['Hawaiʻi Volcanoes', 1916, ['Hawaii'], 'Pacific Islands'],
    ['Hot Springs', 1921, ['Arkansas'], 'Southeast'],
    ['Indiana Dunes', 2019, ['Indiana'], 'Midwest'],
    ['Isle Royale', 1940, ['Michigan'], 'Midwest'],
    ['Joshua Tree', 1994, ['California'], 'Pacific West'],
    ['Katmai', 1980, ['Alaska'], 'Alaska'],
    ['Kenai Fjords', 1980, ['Alaska'], 'Alaska'],
    ['Kings Canyon', 1940, ['California'], 'Pacific West'],
    ['Kobuk Valley', 1980, ['Alaska'], 'Alaska'],
    ['Lake Clark', 1980, ['Alaska'], 'Alaska'],
    ['Lassen Volcanic', 1916, ['California'], 'Pacific West'],
    ['Mammoth Cave', 1941, ['Kentucky'], 'Southeast'],
    ['Mesa Verde', 1906, ['Colorado'], 'Rocky Mountains'],
    ['Mount Rainier', 1899, ['Washington'], 'Pacific West'],
    ['New River Gorge', 2020, ['West Virginia'], 'Southeast'],
    ['North Cascades', 1968, ['Washington'], 'Pacific West'],
    ['Olympic', 1938, ['Washington'], 'Pacific West'],
    ['Petrified Forest', 1962, ['Arizona'], 'Southwest'],
    ['Pinnacles', 2013, ['California'], 'Pacific West'],
    ['Redwood', 1968, ['California'], 'Pacific West'],
    ['Rocky Mountain', 1915, ['Colorado'], 'Rocky Mountains'],
    ['Saguaro', 1994, ['Arizona'], 'Southwest'],
    ['Sequoia', 1890, ['California'], 'Pacific West'],
    ['Shenandoah', 1935, ['Virginia'], 'Southeast'],
    ['Theodore Roosevelt', 1978, ['North Dakota'], 'Midwest'],
    ['Virgin Islands', 1956, ['U.S. Virgin Islands'], 'Caribbean'],
    ['Voyageurs', 1975, ['Minnesota'], 'Midwest'],
    ['White Sands', 2019, ['New Mexico'], 'Southwest'],
    ['Wind Cave', 1903, ['South Dakota'], 'Midwest'],
    ['Wrangell–St. Elias', 1980, ['Alaska'], 'Alaska'],
    ['Yellowstone', 1872, ['Wyoming', 'Montana', 'Idaho'], 'Rocky Mountains'],
    ['Yosemite', 1890, ['California'], 'Pacific West'],
    ['Zion', 1919, ['Utah'], 'Southwest'],
  ];

  const parks = RAW
    .map(([name, established, states, region]) => {
      const id = slugify(name);
      const codes = states.map((s) => STATE_CODES[s]).filter(Boolean);
      return Object.freeze({
        id,
        name,
        established,
        states,
        codes,
        region,
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
  });
})(window.NPT = window.NPT || {});
