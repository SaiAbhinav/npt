/**
 * Builds js/data/us-map.js — everything the park dialog's map draws:
 *
 *   - simplified state outlines for each area (lower 48, Alaska, Hawaii,
 *     Caribbean, Samoa), shown while the map glides between parks;
 *   - for each park: a framed view, the park's boundary, full-detail state
 *     lines around it, the pin position and a distance scale.
 *
 * Run after changing park coordinates or boundaries:
 *
 *   cd tools && npm install && npm run fetch-boundaries && npm run build-map
 *
 * The output is a plain script, so the site keeps working from file:// with no
 * server and no map service.
 */
const fs = require('fs');
const path = require('path');
const d3 = require('d3-geo');
const topojson = require('topojson-client');
const simplify = require('topojson-simplify');
const { ROOT, loadParks, boundaryCodes } = require('./park-list.cjs');

// d3-composite-projections ships its CommonJS build under a .js name inside an
// ES-module package, so load that file directly.
const dcpFile = require.resolve('d3-composite-projections/d3-composite-projections.js');
const dcp = { exports: {} };
new Function('module', 'exports', 'require', fs.readFileSync(dcpFile, 'utf8'))(dcp, dcp.exports, require);
const { geoAlbersUsaTerritories } = dcp.exports;

const OUT = path.join(ROOT, 'js/data/us-map.js');
const CACHE = path.join(__dirname, 'cache', 'park-boundaries');

const WIDTH = 960;
const HEIGHT = 600;
const ASPECT = 16 / 9;    // shape of the map box in the dialog
const DISPLAY_PX = 380;   // roughly how wide the map box renders, for simplification
const PAD = 0.6;          // space around the park, as a share of its size
// Smallest view per area, in map units (~5 km each in the lower 48), so even
// tiny parks show some surroundings.
const MIN_WIDTH = { lower48: 34, alaska: 22, hawaii: 16, caribbean: 5, samoa: 9 };

const ALIASES = { 'U.S. Virgin Islands': 'United States Virgin Islands' };
const GROUP_OF = {
  Alaska: 'alaska',
  Hawaii: 'hawaii',
  'Puerto Rico': 'caribbean',
  'United States Virgin Islands': 'caribbean',
  'American Samoa': 'samoa',
};
const SKIP = new Set(['Guam', 'Commonwealth of the Northern Mariana Islands']); // no national parks
const groupOf = (name) => GROUP_OF[name] || 'lower48';

/* ---------- Geometry helpers (planar, in projected map units) ---------- */

function ringsOf(geometry) {
  if (!geometry) return [];
  if (geometry.type === 'Polygon') return geometry.coordinates;
  if (geometry.type === 'MultiPolygon') return geometry.coordinates.flat();
  if (geometry.type === 'GeometryCollection') return geometry.geometries.flatMap(ringsOf);
  return [];
}

function projectRing(ring, projection) {
  const out = [];
  for (const c of ring) {
    const p = projection(c);
    if (p) out.push(p);
  }
  return out;
}

function boundsOf(rings) {
  let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const ring of rings) for (const [x, y] of ring) {
    if (x < x0) x0 = x; if (y < y0) y0 = y;
    if (x > x1) x1 = x; if (y > y1) y1 = y;
  }
  return [x0, y0, x1, y1];
}

/** Douglas–Peucker line simplification. */
function simplifyRing(points, tol) {
  if (points.length <= 4) return points;
  const keep = new Uint8Array(points.length);
  keep[0] = keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];
  const tol2 = tol * tol;
  while (stack.length) {
    const [a, b] = stack.pop();
    const [ax, ay] = points[a];
    const [bx, by] = points[b];
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy;
    let maxD = -1;
    let idx = -1;
    for (let i = a + 1; i < b; i += 1) {
      const [px, py] = points[i];
      let d;
      if (len2 === 0) d = (px - ax) ** 2 + (py - ay) ** 2;
      else {
        const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
        d = (px - ax - t * dx) ** 2 + (py - ay - t * dy) ** 2;
      }
      if (d > maxD) { maxD = d; idx = i; }
    }
    if (maxD > tol2) { keep[idx] = 1; stack.push([a, idx], [idx, b]); }
  }
  return points.filter((_, i) => keep[i]);
}

/** Sutherland–Hodgman clip of a closed ring to a rectangle. */
function clipRing(points, [x0, y0, x1, y1]) {
  const edges = [
    (p) => p[0] >= x0, (p) => p[0] <= x1, (p) => p[1] >= y0, (p) => p[1] <= y1,
  ];
  const cut = [
    (a, b) => [x0, a[1] + ((b[1] - a[1]) * (x0 - a[0])) / (b[0] - a[0])],
    (a, b) => [x1, a[1] + ((b[1] - a[1]) * (x1 - a[0])) / (b[0] - a[0])],
    (a, b) => [a[0] + ((b[0] - a[0]) * (y0 - a[1])) / (b[1] - a[1]), y0],
    (a, b) => [a[0] + ((b[0] - a[0]) * (y1 - a[1])) / (b[1] - a[1]), y1],
  ];
  let out = points;
  for (let e = 0; e < 4 && out.length; e += 1) {
    const input = out;
    out = [];
    for (let i = 0; i < input.length; i += 1) {
      const cur = input[i];
      const prev = input[(i + input.length - 1) % input.length];
      const curIn = edges[e](cur);
      const prevIn = edges[e](prev);
      if (curIn) {
        if (!prevIn) out.push(cut[e](prev, cur));
        out.push(cur);
      } else if (prevIn) out.push(cut[e](prev, cur));
    }
  }
  return out;
}

function pathOf(rings, digits) {
  const f = (v) => {
    const s = v.toFixed(digits);
    return s.includes('.') ? s.replace(/0+$/, '').replace(/\.$/, '') : s;
  };
  return rings
    .filter((r) => r.length >= 3)
    .map((r) => `M${r.map(([x, y]) => `${f(x)} ${f(y)}`).join('L')}Z`)
    .join('');
}

/** Even–odd point-in-polygon test. */
function contains(rings, [x, y]) {
  let inside = false;
  for (const ring of rings) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
      const [xi, yi] = ring[i];
      const [xj, yj] = ring[j];
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
  }
  return inside;
}

/* ---------- States ---------- */
const us = require('us-atlas/states-10m.json');
const pre = simplify.presimplify(us);
const light = simplify.simplify(pre, simplify.quantile(pre, 0.12));
const fullStates = topojson.feature(us, us.objects.states).features;
const lightStates = topojson.feature(light, light.objects.states).features;

const projection = geoAlbersUsaTerritories().fitExtent([[8, 8], [WIDTH - 8, HEIGHT - 8]], {
  type: 'FeatureCollection', features: fullStates,
});
const geoPath = d3.geoPath(projection).digits(1);

// Overview outlines (simplified; islands keep full detail so they don't vanish).
const FULL_DETAIL = new Set(['hawaii', 'caribbean', 'samoa']);
const outStates = lightStates
  .map((f, i) => (FULL_DETAIL.has(groupOf(f.properties.name)) ? fullStates[i] : f))
  .filter((f) => !SKIP.has(f.properties.name))
  .map((f) => ({ name: f.properties.name, group: groupOf(f.properties.name), d: geoPath(f) }))
  .sort((a, b) => a.name.localeCompare(b.name));

// Bounds of each area, so the map knows how far it can zoom out and pan.
const outGroups = {};
for (const f of fullStates.filter((s) => !SKIP.has(s.properties.name))) {
  const g = groupOf(f.properties.name);
  const [[x0, y0], [x1, y1]] = geoPath.bounds(f);
  const b = outGroups[g] || [Infinity, Infinity, -Infinity, -Infinity];
  outGroups[g] = [Math.min(b[0], x0), Math.min(b[1], y0), Math.max(b[2], x1), Math.max(b[3], y1)];
}
for (const g of Object.keys(outGroups)) {
  const [x0, y0, x1, y1] = outGroups[g];
  outGroups[g] = [x0, y0, x1 - x0, y1 - y0].map((v) => Number(v.toFixed(1)));
}

// Full-detail state rings in map units, for drawing around each park.
const detailStates = fullStates
  .filter((f) => !SKIP.has(f.properties.name))
  .map((f) => {
    const rings = ringsOf(f.geometry).map((r) => projectRing(r, projection)).filter((r) => r.length >= 3);
    return { name: f.properties.name, group: groupOf(f.properties.name), rings, box: boundsOf(rings) };
  });
const detailByName = Object.fromEntries(detailStates.map((s) => [s.name, s]));

/* ---------- Parks ---------- */
const parks = loadParks();
const codes = boundaryCodes();
const outParks = {};
const problems = [];
const notes = [];
let totalBytes = 0;

for (const park of parks) {
  const file = path.join(CACHE, `${codes[park.id]}.geojson`);
  if (!fs.existsSync(file)) { problems.push(`${park.name}: no boundary file (run npm run fetch-boundaries)`); continue; }
  const geo = JSON.parse(fs.readFileSync(file, 'utf8'));
  const features = geo.type === 'FeatureCollection' ? geo.features : [geo];
  const areaRings = features
    .flatMap((f) => ringsOf(f.geometry))
    .map((r) => projectRing(r, projection))
    .filter((r) => r.length >= 3);
  if (!areaRings.length) { problems.push(`${park.name}: boundary has no shapes`); continue; }

  const own = park.states.map((s) => detailByName[ALIASES[s] || s]);
  if (own.some((s) => !s)) { problems.push(`${park.name}: unknown state in ${park.states}`); continue; }
  const group = own[0].group;

  let pin = projection([park.lon, park.lat]);
  if (!pin) { problems.push(`${park.name}: coordinates fall outside the map`); continue; }

  /* Frame the park boundary */
  const [bx0, by0, bx1, by1] = boundsOf(areaRings);
  let w = Math.max((bx1 - bx0) * (1 + PAD * 2), MIN_WIDTH[group]);
  let h = Math.max((by1 - by0) * (1 + PAD * 2), w / ASPECT);
  w = Math.max(w, h * ASPECT);
  h = w / ASPECT;
  const cx = (bx0 + bx1) / 2;
  const cy = (by0 + by1) / 2;
  const view = [cx - w / 2, cy - h / 2, w, h];

  // Keep the pin on the park: if the given point isn't inside the boundary,
  // fall back to the boundary's center (or the nearest boundary vertex).
  if (!contains(areaRings, pin)) {
    const center = [cx, cy];
    let fallback = center;
    if (!contains(areaRings, center)) {
      let best = Infinity;
      for (const r of areaRings) for (const p of r) {
        const d = (p[0] - pin[0]) ** 2 + (p[1] - pin[1]) ** 2;
        if (d < best) { best = d; fallback = p; }
      }
    }
    notes.push(`${park.name}: pin moved onto the park boundary`);
    pin = fallback;
  }

  /* Simplify to the display size */
  const tol = (w / DISPLAY_PX) * 0.4;           // ~0.4 px on screen
  const digits = Math.max(1, Math.ceil(-Math.log10(tol / 2)));
  const minRing = tol * 1.5;
  const simplifyAll = (rings) => rings
    .map((r) => simplifyRing(r, tol))
    .filter((r) => {
      const [x0, y0, x1, y1] = boundsOf([r]);
      return r.length >= 3 && (x1 - x0 > minRing || y1 - y0 > minRing);
    });

  const area = pathOf(simplifyAll(areaRings), digits);

  // Full-detail states around the park, clipped a little beyond the frame.
  const m = w * 0.08;
  const clipBox = [view[0] - m, view[1] - m, view[0] + w + m, view[1] + h + m];
  const detail = detailStates
    .filter((s) => s.group === group)
    .filter((s) => !(s.box[2] < clipBox[0] || s.box[0] > clipBox[2] || s.box[3] < clipBox[1] || s.box[1] > clipBox[3]))
    .map((s) => ({ name: s.name, d: pathOf(simplifyAll(s.rings.map((r) => clipRing(r, clipBox))), digits) }))
    .filter((s) => s.d);

  // Distance scale: kilometres per map unit at the park.
  const east = projection([park.lon + 0.1, park.lat]);
  const unitKm = (d3.geoDistance([park.lon, park.lat], [park.lon + 0.1, park.lat]) * 6371)
    / Math.hypot(east[0] - pin[0], east[1] - pin[1]);

  const round = (v) => Number(v.toFixed(digits));
  outParks[park.id] = {
    group,
    pin: pin.map(round),
    view: view.map(round),
    unitKm: Number(unitKm.toPrecision(4)),
    area,
    detail,
  };
  totalBytes += area.length + detail.reduce((n, s) => n + s.d.length, 0);
}

if (problems.length) {
  console.error('Could not place:\n  ' + problems.join('\n  '));
  process.exit(1);
}

/* ---------- Write ---------- */
const banner = `/* Generated by tools/build-map.cjs. Do not edit by hand.
   State outlines: us-atlas (U.S. Census Bureau cartographic boundaries).
   Park boundaries: National Park Service, via github.com/nationalparkservice/data. */\n`;
const body = `window.NPT_MAP = ${JSON.stringify({ width: WIDTH, height: HEIGHT, groups: outGroups, states: outStates, parks: outParks })};\n`;
fs.writeFileSync(OUT, banner + body);
if (notes.length) console.log(notes.map((n) => `  note: ${n}`).join('\n'));
console.log(`Wrote ${path.relative(ROOT, OUT)}: ${Object.keys(outParks).length} parks, `
  + `${(Buffer.byteLength(body) / 1024).toFixed(0)} KB (${(totalBytes / 1024).toFixed(0)} KB of park detail)`);
