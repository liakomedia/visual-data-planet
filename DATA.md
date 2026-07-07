# Data sources — Visual Data Planet

Earth mapped in 3D from open datasets — conservation, life, geography and the oceans.

| Dataset | In-app file | Source | Citation |
|---|---|---|---|
| Protected areas (31,362 — uniform sample of ~315,000) | `includes/js/planet-data.js` (**not in this repo** — generate with `scripts/fetch-wdpa.mjs`) | [Protected Planet / WDPA](https://www.protectedplanet.net), queried via the [UNEP-WCMC map services](https://data-gis.unep-wcmc.org) | UNEP-WCMC and IUCN (2026), *Protected Planet: The World Database on Protected Areas (WDPA)* [Online], Cambridge, UK: UNEP-WCMC and IUCN. Available at: www.protectedplanet.net |
| International designations (World Heritage, Ramsar, UNESCO-MAB) | derived from the WDPA `DESIG_ENG` field | as above | as above |
| OECMs (7,524 — Other Effective area-based Conservation Measures) | `includes/js/planet-data.js` (**not in this repo** — same script) | [WD-OECM, Protected Planet](https://www.protectedplanet.net), via the UNEP-WCMC map services | UNEP-WCMC and IUCN (2026), *Protected Planet: The World Database on OECMs (WD-OECM)*, Cambridge, UK |
| Surface imagery (depth-shaded oceans) | `includes/images/tex/earth_bathy_8k.jpg` | [NASA Blue Marble: Next Generation w/ Topography & Bathymetry](https://visibleearth.nasa.gov/collection/1484/blue-marble) | **Public domain** (NASA) |
| Terrain + sea-floor relief (displacement map) | `includes/images/tex/earth_relief.jpg` (rebuild with `scripts/fetch-relief.py`) | [NOAA NCEI ETOPO Global Relief](https://www.ncei.noaa.gov/products/etopo-global-relief-model) | **Public domain** (NOAA) |
| Mycorrhizal-fungi biodiversity hotspots (15,496 — AM + EcM) | `includes/js/planet-fungi.js` (shipped — rebuild with `scripts/fetch-fungi.py`) | [SPUN Underground Atlas](https://www.spun.earth); Van Nuland et al. (2025), [*Nature*](https://www.nature.com/articles/s41586-025-09277-4) | **CC BY 4.0** — [Zenodo 10.5281/zenodo.14871588](https://doi.org/10.5281/zenodo.14871588). Cite Van Nuland et al. (2025) and acknowledge SPUN |
| Bathymetric depth contours (isobaths) + maritime boundary lines | `includes/js/planet-maritime.js` (shipped — rebuild with `scripts/fetch-maritime.mjs`) | [Natural Earth 10m](https://www.naturalearthdata.com) (bathymetry, maritime indicator lines) | **Public domain** |
| Coverage statistics (17.6% land · 8.4% ocean) | HUD text | [Protected Planet](https://www.protectedplanet.net) | UNEP-WCMC & IUCN |
| Cities (7,342) & ports (1,081) & named oceans/seas (295) | `includes/js/planet-earth.js` (shipped — rebuild with `scripts/fetch-earth-layers.mjs`) | [Natural Earth 10m](https://www.naturalearthdata.com) (populated places, ports, marine polygons) | **Public domain** — "Made with Natural Earth" |
| Mountain peaks ≥ 3,500 m (7,461) | `includes/js/planet-earth.js` | [Wikidata](https://www.wikidata.org) SPARQL (P31=Q8502, P2044 ≥ 3500) | **CC0** |
| Earth imagery (8k day map) | `includes/images/tex/` | [Solar System Scope](https://www.solarsystemscope.com/textures/) | **CC BY 4.0** |

## Why the data file is not in the repository

The WDPA terms of use prohibit repackaging and redistribution of the data. This repository
therefore ships the **fetch script** (`scripts/fetch-wdpa.mjs`) instead of the extract:
run it once (Node 18+, no dependencies) and it rebuilds `includes/js/planet-data.js` from
the live UNEP-WCMC service — every 13th polygon site plus the full point layer, with
name, designation, IUCN category, realm, reported area, year and country per site.

If you reuse WDPA data, follow the citation above and the terms at
[protectedplanet.net/en/legal](https://www.protectedplanet.net/en/legal).

Compiled by [Liako](https://liako.eu).
