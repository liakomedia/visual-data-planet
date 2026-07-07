# Data sources — Visual Data Planet

| Dataset | In-app file | Source | Citation |
|---|---|---|---|
| Protected areas (31,362 — uniform sample of ~315,000) | `includes/js/planet-data.js` (**not in this repo** — generate with `scripts/fetch-wdpa.mjs`) | [Protected Planet / WDPA](https://www.protectedplanet.net), queried via the [UNEP-WCMC map services](https://data-gis.unep-wcmc.org) | UNEP-WCMC and IUCN (2026), *Protected Planet: The World Database on Protected Areas (WDPA)* [Online], Cambridge, UK: UNEP-WCMC and IUCN. Available at: www.protectedplanet.net |
| International designations (World Heritage, Ramsar, UNESCO-MAB) | derived from the WDPA `DESIG_ENG` field | as above | as above |
| Coverage statistics (17.6% land · 8.4% ocean) | HUD text | [Protected Planet](https://www.protectedplanet.net) | UNEP-WCMC & IUCN |
| Cities (7,342) & ports (1,081) & named oceans/seas (295) | `includes/js/planet-earth.js` (shipped — rebuild with `scripts/fetch-earth-layers.mjs`) | [Natural Earth 10m](https://www.naturalearthdata.com) (populated places, ports, marine polygons) | **Public domain** — "Made with Natural Earth" |
| Mountain peaks ≥ 3,500 m (7,461) | `includes/js/planet-earth.js` | [Wikidata](https://www.wikidata.org) SPARQL (P31=Q8502, P2044 ≥ 3500) | **CC0** |
| Earth imagery (4k day map) | `includes/images/tex/` | [Solar System Scope](https://www.solarsystemscope.com/textures/) | **CC BY 4.0** |

## Why the data file is not in the repository

The WDPA terms of use prohibit repackaging and redistribution of the data. This repository
therefore ships the **fetch script** (`scripts/fetch-wdpa.mjs`) instead of the extract:
run it once (Node 18+, no dependencies) and it rebuilds `includes/js/planet-data.js` from
the live UNEP-WCMC service — every 13th polygon site plus the full point layer, with
name, designation, IUCN category, realm, reported area, year and country per site.

If you reuse WDPA data, follow the citation above and the terms at
[protectedplanet.net/en/legal](https://www.protectedplanet.net/en/legal).

Compiled by [Liako](https://liako.eu).
