#!/usr/bin/env python3
"""Builds includes/images/tex/earth_relief.jpg — the combined topography+bathymetry
   displacement map used for the globe's 3D relief (land AND sea floor).
   Source: NOAA NCEI ETOPO 2022/ETOPO1 Global Relief (public domain), pulled from the
   NCEI ImageServer as raw float32 elevation and re-encoded so sea level (0 m) = mid-grey.
   The globe's colour texture (earth_bathy_8k.jpg) is NASA Blue Marble: Next Generation with
   Topography & Bathymetry (public domain, visibleearth.nasa.gov) — download & downscale that
   separately. Requires: rasterio, numpy, Pillow.  Usage: python3 scripts/fetch-relief.py"""
import numpy as np, rasterio, urllib.request, tempfile, os
from PIL import Image
URL=('https://gis.ngdc.noaa.gov/arcgis/rest/services/DEM_mosaics/ETOPO1_ice_surface/'
     'ImageServer/exportImage?bbox=-180,-90,180,90&bboxSR=4326&imageSR=4326'
     '&size=5400,2700&format=tiff&pixelType=F32&interpolation=RSP_BilinearInterpolation&f=image')
tif=tempfile.mktemp(suffix='.tif'); urllib.request.urlretrieve(URL, tif)
with rasterio.open(tif) as ds:
    a=ds.read(1).astype('float32')
os.unlink(tif)
a=np.where(np.isfinite(a), a, 0.0)
vmax=float(a[a>0].max()); vmin=float(a[a<0].min())
g=np.empty_like(a); land=a>=0
g[land]=0.5+0.5*(a[land]/vmax)              # land: sea level 0.5 → 1.0
g[~land]=0.5*(1.0 - a[~land]/vmin)          # ocean: sea level 0.5 → 0.0 at the deepest trench
g=np.clip(g,0,1)
Image.fromarray((g*255).astype('uint8')).resize((4096,2048)).save(
    'includes/images/tex/earth_relief.jpg', quality=92)
print('wrote includes/images/tex/earth_relief.jpg  (land max %dm, ocean min %dm)'%(round(vmax),round(vmin)))
