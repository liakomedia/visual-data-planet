# How the data becomes the map — Visual Data Planet

Technical notes on how the World Database on Protected Areas becomes one interactive
globe. Same principles as the sister apps: real coordinates are never bent for design, and
every approximation is disclosed here and honoured in the panels.

---

## 1. The globe

One textured Earth (equirectangular 2k day map on a sphere, radius R). A site's
latitude/longitude becomes a position on the sphere with the standard mapping that matches
equirectangular UVs:

```
φ = (90 − lat)°   θ = (lon + 180)°
x = −R·sinφ·cosθ     y = R·cosφ     z = R·sinφ·sinθ
```

The protected-area point clouds are **children of the globe group**, so the gentle
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

## 3. Layers and colour

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

## 4. Interaction

- **Hover / tap** any dot: the raycaster finds the nearest visible point *on the camera's
  side of the globe* (hits behind the horizon are rejected) and the panel shows the site's
  real record — designation, IUCN category, area (km², or hectares under 1 km²), year,
  country code(s), and any World Heritage / Ramsar / MAB badges.
- **Search** filters the 31k names; Enter flies the camera to the match (cycling through
  multiple hits) and opens its panel.

## 5. Honesty rules

1. Latitudes and longitudes are the catalogue's; the only positional approximation is the
   bbox-centre of generalised polygons, and the sample is a blind 1-in-13 — no cherry-picking.
2. Layer counts shown in the legend are counts **of the sample**, not of the full WDPA —
   the HUD states the sample-of-315,000 relationship explicitly.
3. Every figure in the panels (area, year, category, designation, country) is the WDPA's
   own record, unmodified.
4. Source and citation: UNEP-WCMC and IUCN, Protected Planet (see [DATA.md](DATA.md));
   the data itself is not redistributed — the repo ships the fetch script instead.

Compiled by [Liako](https://liako.eu).
