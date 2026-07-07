# How the data becomes the map — Visual Data Planet

Technical notes on how a set of open Earth datasets — protected areas, conservation, fungal
biodiversity, geography and the oceans — become one interactive globe. Same principles as the sister apps: real coordinates are never bent for design, and
every approximation is disclosed here and honoured in the panels.

---

## 1. The globe

One textured Earth on a sphere of radius R, with **real 3D relief for both land and sea floor**.
The colour is NASA's Blue Marble: Next Generation *with topography and bathymetry*, so the oceans
are shaded by depth (bright continental shelves through to dark abyssal plains) instead of a flat
blue. A combined **ETOPO** elevation grid (NOAA) is re-encoded to a grayscale where sea level
(0 m) is mid-grey, land runs brighter and the sea floor darker; it drives a vertex displacement
with `displacementBias` set so the mid-grey sea level sits exactly at R — land therefore rises and
the sea floor sinks, revealing mid-ocean ridges, seamount chains and trenches in true position.
A **tangent-space normal map**, computed from the same ETOPO gradient at 8k, shades every ridge
and valley per-pixel so land and sea floor stay detailed when zoomed in — beyond what the
displaced geometry alone resolves. The surface texture, relief map and normal map are each
served at a resolution matched to the GPU's limit (a 16k Blue Marble surface on high-end
desktops, 8k on most machines, 4k on weak or mobile GPUs). A camera-following key light shades
the relief from any angle. The vertical scale is exaggerated
(true relief is <0.3% of the radius and would be invisible) — a disclosed, purely visual
amplification that does not affect any datum in the panels. A site's
latitude/longitude becomes a position on the sphere with the standard mapping that matches
equirectangular UVs:

```
φ = (90 − lat)°   θ = (lon + 180)°
x = −R·sinφ·cosθ     y = R·cosφ     z = R·sinφ·sinθ
```

All point clouds are **children of the globe group**, so the gentle
rotation (⟳ Spin, pausable) carries every dot with the planet — picking accounts for the
rotation via world-space raycasting, and the search fly-to compensates for the current
rotation angle when aiming the camera.

## 2. The sample

The WDPA holds ~307,000 polygon sites and ~7,700 point-only sites. The app maps a
**uniform sample of 31,362**:

- **every 13th polygon site** (`MOD(objectid,13)=0` on the UNEP-WCMC ArcGIS service) —
  ~23,600 sites, unbiased across countries and categories;
- **the complete point layer** (7,747 sites that have no polygon in the WDPA).

Polygon sites are placed at the **bounding-box centre of their generalised outline**
(geometry fetched with a 0.5° simplification tolerance). For small and mid-sized areas
this is indistinguishable from a true centroid at globe scale; for very large or
crescent-shaped areas the dot can sit slightly off the visual middle — a disclosed
approximation. Sites whose generalised geometry comes back empty are skipped, and the
point layer's multipoint geometries use their first coordinate.

Per site the extract keeps: name, designation (921 distinct), IUCN category, realm
(terrestrial / marine / coastal), reported area (km²), status year, country ISO3 code(s),
and flags for the international designations.

## 3. The two Protected Planet databases

Protected Planet publishes several databases; this map draws the two spatial ones:

- **WDPA** — the World Database on Protected Areas (the sample described above), greens/blues.
- **WD-OECM** — the World Database on Other Effective area-based Conservation Measures: areas
  that achieve conservation outcomes without being formally designated "protected areas"
  (Indigenous and community lands, some private and military areas, etc.). The **complete**
  OECM point and polygon layers (7,524 sites) are drawn as a distinct **orange** layer with its
  own legend toggle and panels. (Protected Planet's other databases — GD-PAME management
  effectiveness, the ICCA Registry and the IUCN Green List — are assessments or registries
  attached to these same sites rather than separate global geometries, so they are not drawn as
  extra point layers.)

## 4. Layers and colour

- **Seven IUCN layers**: Ia·Ib (strict nature reserves & wilderness), II (national
  parks), III (natural monuments), IV (habitat & species areas), V (protected
  landscapes), VI (sustainable use), and "category not reported". Colour encodes two
  real attributes at once: **hue = realm** (greens for land and coast, blues for marine)
  and **lightness = IUCN group** (stricter → brighter).
- **Three designation layers**, drawn on top: UNESCO World Heritage (gold), Ramsar
  wetlands (cyan), UNESCO-MAB biospheres (violet) — flagged from the WDPA designation
  text, so a site can appear both in its IUCN layer and as a designation dot.
- The legend lists every layer with its live count and has the select/unselect-all
  tick box; one dot = one protected area, always.

## 5. Earth layers — the geographic context

Four non-WDPA layers, drawn slightly above the surface so the protected areas keep visual
priority, give the globe its physical and human geography:

- **Cities (7,342)** — Natural Earth 10m populated places; amber dots whose lightness
  scales with log₁₀(urban population), so megacities glow brighter. Panels show country
  and population.
- **Mountain peaks (7,461)** — every Wikidata mountain (`P31 = Q8502`) with a recorded
  elevation (`P2044`) of **≥ 3,500 m**; sand-to-white dots, brighter = higher. Panels show
  the elevation in metres and feet.
- **Ports (1,081)** — Natural Earth 10m ports, cyan.
- **Named oceans & seas (295)** — Natural Earth marine polygons reduced to one **label
  point** each (the bounding-box centre of the largest polygon part, lifted slightly off
  the surface) — a disclosed approximation stated in each panel: the dot marks the label
  point of a region, not a boundary.

All four live in the legend under **EARTH LAYERS** with live counts and the same
select/unselect-all control, and the search box covers them alongside the protected areas.
These sources are public domain (Natural Earth) and CC0 (Wikidata), so unlike the WDPA
extract the built file `includes/js/planet-earth.js` **is** shipped in the repository —
rebuild it with `scripts/fetch-earth-layers.mjs`.

## 6. Interaction

- **Hover / tap** any dot: the raycaster finds the nearest visible point *on the camera's
  side of the globe* (hits behind the horizon are rejected) and the panel shows the site's
  real record — designation, IUCN category, area (km², or hectares under 1 km²), year,
  country code(s), and any World Heritage / Ramsar / MAB badges.
- **Search** covers all ~47k names — protected areas, cities, peaks, ports and seas;
  Enter flies the camera to the match (cycling through multiple hits) and opens its panel.

## 7. Fungal biodiversity and the oceans

- **Mycorrhizal-fungi hotspots (SPUN).** The Underground Atlas publishes 1-km global rasters
  of predicted arbuscular (AM) and ectomycorrhizal (EcM) fungal-richness *hotspots* in an
  Equal-Earth projection. Each is a binary mask (a cell is a hotspot or it is not). The build
  script averages each raster down to a ~617×300 grid, reprojects every hotspot cell centre to
  latitude/longitude, and stores the result as two point layers (pink = AM, violet = EcM). At
  this grid AM and EcM hotspots each cover only ~4% of the land and sit largely in different
  places — arbuscular fungi peaking in the tropics and grasslands, ecto in temperate and
  boreal forests. The panels state the headline finding: over 90% of these hotspots fall
  outside protected areas.
- **Bathymetry (isobaths).** Natural Earth's bathymetry polygons at 200 / 2,000 / 4,000 /
  6,000 m are reduced to their outline rings and drawn as depth-coloured contour lines
  (isobaths) just above the sea surface — shallow shelves bright, the deep ocean dark.
- **Maritime boundaries.** Natural Earth's maritime boundary indicator lines are drawn as a
  single pale line layer — the borders that continue national limits out over the sea.

All three are toggleable in the legend and covered by the select/unselect-all control.

## 8. Honesty rules

1. Latitudes and longitudes are the catalogue's; the only positional approximation is the
   bbox-centre of generalised polygons, and the sample is a blind 1-in-13 — no cherry-picking.
2. Layer counts shown in the legend are counts **of the sample**, not of the full WDPA —
   the HUD states the sample-of-315,000 relationship explicitly.
3. Every figure in the panels (area, year, category, designation, country) is the WDPA's
   own record, unmodified.
4. Source and citation: UNEP-WCMC and IUCN, Protected Planet (see [DATA.md](DATA.md));
   the data itself is not redistributed — the repo ships the fetch script instead.

Compiled by [Liako](https://liako.eu).
