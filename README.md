# National Park Tracker

A static site for tracking visits to all 63 U.S. national parks. Open `index.html`
directly in a browser. There is no server, build step or install.

## Features
- **Three views**, switched under the search bar:
  - **Honeycomb**: the tiles described below.
  - **List**: one row per park with its photo, region, states, year and visited stamp.
  - **Map**: every park on one map of the U.S. (Alaska, Hawaii and the territories
    in insets), with each park's boundary and a pin: filled for visited parks, an
    open ring for the rest. Searching zooms to the matching parks and labels them.
    It zooms and pans like the dialog map.

  Search and the All / Visited switch apply to every view, and Previous / Next in
  the dialog follows the order of the view you opened it from. The chosen view is
  kept in the address (`#list`, `#map`), so a reload or a bookmark returns to it.
- **Honeycomb of parks.** The 61 parks in U.S. states form one large hexagon
  (rows of 5·6·7·8·9·8·7·6·5). The 2 parks in U.S. territories (American Samoa and
  the Virgin Islands) sit in their own row below. On narrow screens the hexagon
  becomes a centered honeycomb so tiles stay readable.
- **Park photos.** Each tile shows the park's photo with its name on an overlay.
  Unvisited parks are slightly darker; hovering brightens them and adds a thin border.
- **Search** by park name, state (`Utah`, or a code like `UT`) or region (`Southwest`).
  Non-matching tiles fade instead of disappearing, so the honeycomb keeps its shape.
  Press `/` to jump to the search field.
- **All / Visited switch.** The page opens on **Visited**, so it shows your progress first.
- **Park dialog** with the photo, region, year established and states. Previous /
  Next (or the arrow keys) move through only the parks that match the current filter.
- **Park map** in the dialog: the park's actual boundary over the state lines
  around it, with a pin, the park's name, the state name and a distance scale in
  miles. Below it are the coordinates and links to the park's **NPS.gov** page and
  **Google Maps**. Zoom with the + / − buttons, the scroll wheel, a pinch or a
  double-click; drag to move around; the reset button returns to the park. With
  the map focused, + − 0 and the arrow keys work too. The map glides between
  parks as you page through them. It is
  drawn from data bundled with the site, so it works offline and needs no map
  service.
- **Visited stamp** on both the tile and the dialog.
- **Progress** in the header: "X of 63 visited" and a progress bar.
- **Visited parks come from a file you edit**, `data/visited.js`. The page has no
  buttons for marking parks and saves nothing in the browser.

## Project structure
```
index.html
css/
  tokens.css            design tokens: colors, fonts, motion
  base.css              reset, page layout, buttons
  components/
    header.css          title, visited count, progress bar
    controls.css        search bar and All / Visited switch
    views.css           view switch, List view, Map view
    map.css             shared map pieces: shapes, pins, zoom buttons, scale
    honeycomb.css       hexagon tiles, territories row, hover and filter states
    stamp.css           the VISITED stamp
    modal.css           park dialog
data/
  visited.js            the parks you've visited (edit this)
js/
  core/utils.js         text normalizing and formatting helpers
  core/viewport.js      zoom and pan for the maps (buttons, wheel, drag, pinch, keys)
  data/parks.js         the 63 parks, with coordinates
  data/us-map.js        state outlines and park boundaries (generated, see below)
  components/
    honeycomb.js        builds tiles and computes the hexagon layout
    modal.js            park dialog, stamp, Previous / Next
    park-map.js         the map in the dialog
    park-list.js        the List view
    atlas.js            the Map view
    search.js           search matching and the All / Visited switch
  app.js                wires everything together
tools/                  build scripts for the map (need Node; the site doesn't)
  fetch-boundaries.cjs  downloads park boundaries into tools/cache/
  build-map.cjs         regenerates js/data/us-map.js
  park-list.cjs         reads the park list from js/data/parks.js
images/
  parks/                park photos (see below)
  placeholder.svg       fallback when a photo is missing
  favicon.svg
```

The scripts are classic `defer` scripts that share one `window.NPT` namespace.
Browsers block ES modules (`type="module"`) on `file://` URLs, so this keeps the
code split into modules while still opening without a server.

## Marking parks as visited
Open `data/visited.js`, add parks to the list, save, and reload the page:

```js
window.NPT_VISITED = [
  "zion",
  "grand-teton",
  "Yellowstone"
];
```

- Each entry can be a park id from the table below or the park's name. Case,
  accents and punctuation don't matter, so `"Hawaii Volcanoes"` works.
- Put each entry in double quotes, with a comma between entries.
- To unmark a park, delete its line.

If an entry doesn't match a park, the page ignores it and logs a warning in the
browser console. If the file has a typo that breaks it (a missing comma or quote),
the page still loads, shows no parks as visited, and says so under the search bar.

The file is `.js` rather than `.json` because browsers refuse to load `.json` files
into a page opened straight from disk. The list inside it uses JSON syntax.

<details>
<summary>All 63 park ids</summary>

| Park | Id |
| --- | --- |
| Acadia | `acadia` |
| American Samoa | `american-samoa` |
| Arches | `arches` |
| Badlands | `badlands` |
| Big Bend | `big-bend` |
| Biscayne | `biscayne` |
| Black Canyon of the Gunnison | `black-canyon-of-the-gunnison` |
| Bryce Canyon | `bryce-canyon` |
| Canyonlands | `canyonlands` |
| Capitol Reef | `capitol-reef` |
| Carlsbad Caverns | `carlsbad-caverns` |
| Channel Islands | `channel-islands` |
| Congaree | `congaree` |
| Crater Lake | `crater-lake` |
| Cuyahoga Valley | `cuyahoga-valley` |
| Death Valley | `death-valley` |
| Denali | `denali` |
| Dry Tortugas | `dry-tortugas` |
| Everglades | `everglades` |
| Gates of the Arctic | `gates-of-the-arctic` |
| Gateway Arch | `gateway-arch` |
| Glacier | `glacier` |
| Glacier Bay | `glacier-bay` |
| Grand Canyon | `grand-canyon` |
| Grand Teton | `grand-teton` |
| Great Basin | `great-basin` |
| Great Sand Dunes | `great-sand-dunes` |
| Great Smoky Mountains | `great-smoky-mountains` |
| Guadalupe Mountains | `guadalupe-mountains` |
| Haleakalā | `haleakala` |
| Hawaiʻi Volcanoes | `hawaii-volcanoes` |
| Hot Springs | `hot-springs` |
| Indiana Dunes | `indiana-dunes` |
| Isle Royale | `isle-royale` |
| Joshua Tree | `joshua-tree` |
| Katmai | `katmai` |
| Kenai Fjords | `kenai-fjords` |
| Kings Canyon | `kings-canyon` |
| Kobuk Valley | `kobuk-valley` |
| Lake Clark | `lake-clark` |
| Lassen Volcanic | `lassen-volcanic` |
| Mammoth Cave | `mammoth-cave` |
| Mesa Verde | `mesa-verde` |
| Mount Rainier | `mount-rainier` |
| New River Gorge | `new-river-gorge` |
| North Cascades | `north-cascades` |
| Olympic | `olympic` |
| Petrified Forest | `petrified-forest` |
| Pinnacles | `pinnacles` |
| Redwood | `redwood` |
| Rocky Mountain | `rocky-mountain` |
| Saguaro | `saguaro` |
| Sequoia | `sequoia` |
| Shenandoah | `shenandoah` |
| Theodore Roosevelt | `theodore-roosevelt` |
| Virgin Islands | `virgin-islands` |
| Voyageurs | `voyageurs` |
| White Sands | `white-sands` |
| Wind Cave | `wind-cave` |
| Wrangell–St. Elias | `wrangell-st-elias` |
| Yellowstone | `yellowstone` |
| Yosemite | `yosemite` |
| Zion | `zion` |

</details>

## Design
- Dark theme with a sunset-orange accent; all values live in `css/tokens.css`.
- Fonts (Google Fonts): **Unbounded** for headings and the stamp, **Manrope** for
  body text, **DM Mono** for the small stats line. Without internet the page falls
  back to system fonts.
- To try another font pairing, change the `--font-*` tokens in `css/tokens.css`
  and the Google Fonts link in `index.html`.

## Photos
Each park has two photos in `images/parks/`, named by park id:
- `<id>.jpg` is the large photo shown in the dialog (up to 1600px).
- `<id>-sm.jpg` is the small photo used on the tile (420px on the short side).

Park ids are the slugged park names, for example `grand-teton`,
`wrangell-st-elias` and `hawaii-volcanoes`. To replace a photo, overwrite both
files. If a file is missing, that tile and dialog fall back to
`images/placeholder.svg`.

The originals were resized and recompressed for the web (338MB down to 23MB).
Keep new photos around these sizes so the page stays fast.

## Editing park data
Parks are listed in `js/data/parks.js` as
`[name, year established, states, region, [latitude, longitude]]`.
Counts on the page (parks, states, territories) are calculated from this list.
A park whose only location is a territory is shown in the territories row.

Each park also has an NPS unit code in `NPS_CODES` in the same file. It's used
for the nps.gov link and to find the park's boundary file.

### Updating the map
`js/data/us-map.js` is generated from the park list. After changing a park's
coordinates, states or code, rebuild it:

```sh
cd tools
npm install
npm run fetch-boundaries   # first time only; saves to tools/cache/
npm run build-map
```

The build stops with an error if a park can't be placed. Each map is framed on
the park's boundary, and the pin sits at the park's coordinates. If those fall
outside the boundary, as with parks split into separate sections, the pin
moves onto the park and the build prints a note.

Sources:
- Park boundaries: National Park Service, from
  [nationalparkservice/data](https://github.com/nationalparkservice/data). Most
  were last edited in 2010–2013, so recent boundary changes may be missing.
- State outlines: [us-atlas](https://github.com/topojson/us-atlas), built from
  U.S. Census Bureau cartographic boundary files.

Establishment years are the year each site first became a national park. A few
have nuances worth knowing if you need precision: Acadia (1919, as Lafayette NP),
Everglades and Guadalupe Mountains (year authorized), and Haleakalā (1916 as part
of Hawaii NP; separate park in 1961).

## Versions
- **v1** (git tag `v1`): placeholder images, dark theme, Unbounded + Manrope.
- **v2** (git tag `v2`): real park photos; visited parks read from
  `data/visited.js` instead of being saved in the browser; a zoomable map of each
  park's boundary in the dialog, with NPS.gov and Google Maps links; compact
  dialog facts.
