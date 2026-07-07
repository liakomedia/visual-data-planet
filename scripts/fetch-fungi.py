#!/usr/bin/env python3
"""Builds includes/js/planet-fungi.js from the SPUN Underground Atlas hotspot rasters.
   Van Nuland et al. (2025), "Global hotspots of mycorrhizal fungal richness are poorly
   protected", Nature. Data: Zenodo 10.5281/zenodo.14871588 (CC BY 4.0).
   Requires: rasterio, numpy.  Usage:
     1) download myc_richness.zip from the Zenodo record
     2) unzip the two files under 3_visualisations/Hotspots/:
          AM_fungal_richness_hotspots.tif  EcM_fungal_richness_hotspots.tif
     3) python3 scripts/fetch-fungi.py AM_fungal_richness_hotspots.tif EcM_fungal_richness_hotspots.tif
   Cite Van Nuland et al. (2025) and acknowledge SPUN when reusing."""
import sys, json, numpy as np, rasterio
from rasterio.warp import transform as warp
from rasterio.enums import Resampling
W, H = 617, 300
FUNGI = []
for typeIdx, f in enumerate(sys.argv[1:3]):
    with rasterio.open(f) as ds:
        a = ds.read(1, out_shape=(H, W), resampling=Resampling.average)
        mask = np.isfinite(a)
        L, B, Rt, T = ds.bounds
        xs, ys = [], []
        for j in range(H):
            for i in range(W):
                if mask[j, i]:
                    xs.append(L + (i+0.5)/W*(Rt-L)); ys.append(T - (j+0.5)/H*(T-B))
        lon, lat = warp(ds.crs, 'EPSG:4326', xs, ys)
        for la, lo in zip(lat, lon):
            if np.isfinite(la) and np.isfinite(lo):
                FUNGI.append([round(la,1), round(lo,1), typeIdx])
js = ('/* Mycorrhizal fungal biodiversity hotspots — SPUN Underground Atlas.\n'
      '   Van Nuland et al. (2025), Nature; SPUN. Zenodo 10.5281/zenodo.14871588, CC BY 4.0.\n'
      '   Format: FUNGI [lat, lon, type]  type 0=AM (arbuscular) 1=EcM (ecto). */\n'
      'const FUNGI=' + json.dumps(FUNGI) + ';\n')
open('includes/js/planet-fungi.js', 'w').write(js)
print('wrote includes/js/planet-fungi.js:', len(FUNGI), 'points')
