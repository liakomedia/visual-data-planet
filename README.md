# Visual Data Planet — Earth's protected areas in 3D

[![Live](https://img.shields.io/badge/live-vdata.liako.eu%2Fplanet-000000?style=flat&logo=googlechrome&logoColor=white)](https://vdata.liako.eu/planet/)
[![Licence: MIT (code)](https://img.shields.io/badge/licence-MIT_(code)-f4f4f4?style=flat)](LICENSE)
[![Three.js r183](https://img.shields.io/badge/three.js-r183-049EF4?style=flat&logo=threedotjs&logoColor=white)](https://threejs.org)
[![Protected areas](https://img.shields.io/badge/protected_areas-31%2C362-8fe3a8?style=flat)](DATA.md)
[![Source](https://img.shields.io/badge/data-WDPA_·_Protected_Planet-2f6f4f?style=flat)](https://www.protectedplanet.net)
[![Build](https://img.shields.io/badge/build-none_·_vanilla_JS-3fb950?style=flat)](#running-locally)

![Visual Data Planet — the rotating globe](preview.gif)

**Live: [vdata.liako.eu/planet](https://vdata.liako.eu/planet/)**

Earth's protected areas on one interactive 3D globe — **31,362 sites**, a uniform sample of
the ~315,000-site **World Database on Protected Areas** (WDPA, UNEP-WCMC & IUCN,
[protectedplanet.net](https://www.protectedplanet.net)):

- Every dot is a real national park, strict reserve, natural monument, habitat area,
  protected landscape or marine sanctuary, at its true latitude/longitude —
  greens on land and coast, blues at sea
- Layers by IUCN management category (Ia·Ib → VI), plus the international designations:
  **UNESCO World Heritage**, **Ramsar wetlands**, **UNESCO-MAB biospheres**
- Tap any dot for its data: name, designation, IUCN category, reported area, year
  established, country
- Search any park or reserve by name (Enter cycles matches); the camera flies to it
- Context in the HUD: 17.6% of land and 8.4% of the ocean are protected
  (Protected Planet)

The mapping methodology — coordinate maths, sampling, centroid handling, and what is exact
versus approximate — is documented in [METHODS.md](METHODS.md); sources and citation in
[DATA.md](DATA.md).

## Running locally

No build step — plain JavaScript, [Three.js](https://threejs.org) and
[3d-force-graph](https://github.com/vasturiano/3d-force-graph) from CDN (pinned to matching
revisions — a mismatch makes textures sample black).

**The WDPA-derived data file is not shipped in this repository** (WDPA terms prohibit
redistribution). Generate it once, then serve:

```bash
node scripts/fetch-wdpa.mjs includes/js/planet-data.js
python3 -m http.server 8000   # → http://localhost:8000/
```

## Licence

Code is [MIT](LICENSE). **Not covered**: the WDPA data (property of UNEP-WCMC & IUCN,
regenerate locally via the script above), Earth imagery (Solar System Scope, CC BY 4.0),
and the LIAKO name and branding.

Sister projects: [visual-data-cosmos](https://github.com/liakomedia/visual-data-cosmos) ·
[visual-data-solar](https://github.com/liakomedia/visual-data-solar) ·
[visual-data-art](https://github.com/liakomedia/visual-data-art) — compiled by
[Liako](https://liako.eu).
