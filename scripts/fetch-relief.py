#!/usr/bin/env python3
"""Builds the globe's relief + normal maps from NOAA ETOPO Global Relief (public domain):
     includes/images/tex/earth_relief_8k.jpg   — combined topo+bathy displacement map
                                                   (grey 0.5 = sea level; land brighter, sea floor darker)
     includes/images/tex/earth_normal_8k.jpg   — tangent-space normal map for crisp per-pixel
                                                   land & sea-floor detail at any zoom
   Then downscale each to *_4k.jpg for weak/mobile GPUs (the app picks a tier by GPU limit).
   The colour surface (earth_bathy_{4k,8k,16k}.jpg) is NASA Blue Marble: Next Generation with
   Topography & Bathymetry (public domain) — download & downscale separately.
   ETOPO's ImageServer caps a single export, so the world is pulled as four 30-arc-second
   quadrants (5400x2700 each) and mosaicked to 10800x5400. Requires: rasterio, numpy, Pillow."""
import numpy as np, rasterio, urllib.request, tempfile, os
from PIL import Image
Image.MAX_IMAGE_PIXELS=None
BASE=('https://gis.ngdc.noaa.gov/arcgis/rest/services/DEM_mosaics/ETOPO1_ice_surface/'
      'ImageServer/exportImage?bboxSR=4326&imageSR=4326&size=5400,2700&format=tiff'
      '&pixelType=F32&interpolation=RSP_BilinearInterpolation&f=image&bbox=')
def quad(bbox):
    t=tempfile.mktemp(suffix='.tif'); urllib.request.urlretrieve(BASE+bbox, t)
    with rasterio.open(t) as ds: a=ds.read(1).astype('float32')
    os.unlink(t); return a
H,W=2700,5400
elev=np.empty((2*H,2*W),'float32')
elev[:H,:W]=quad('-180,0,0,90');  elev[:H,W:]=quad('0,0,180,90')
elev[H:,:W]=quad('-180,-90,0,0'); elev[H:,W:]=quad('0,-90,180,0')
elev=np.where(np.isfinite(elev),elev,0.0)

vmax=float(elev[elev>0].max()); vmin=float(elev[elev<0].min())
g=np.empty_like(elev); land=elev>=0
g[land]=0.5+0.5*(elev[land]/vmax); g[~land]=0.5*(1.0-elev[~land]/vmin)
r8=Image.fromarray((np.clip(g,0,1)*255).astype('uint8')).resize((8192,4096),Image.LANCZOS)
r8.save('includes/images/tex/earth_relief_8k.jpg',quality=92)
r8.resize((4096,2048),Image.LANCZOS).save('includes/images/tex/earth_relief_4k.jpg',quality=92)

gy,gx=np.gradient(elev)
lat=np.linspace(90,-90,elev.shape[0])[:,None]
gx=gx/np.clip(np.cos(np.deg2rad(lat)),0.15,1.0)
K=0.00035; nx=-gx*K; ny=gy*K; nz=np.ones_like(elev)
inv=1.0/np.sqrt(nx*nx+ny*ny+nz*nz); nx*=inv; ny*=inv; nz*=inv
rgb=np.stack([nx*0.5+0.5,ny*0.5+0.5,nz*0.5+0.5],-1)
n8=Image.fromarray((rgb*255).astype('uint8'),'RGB').resize((8192,4096),Image.LANCZOS)
n8.save('includes/images/tex/earth_normal_8k.jpg',quality=92)
n8.resize((4096,2048),Image.LANCZOS).save('includes/images/tex/earth_normal_4k.jpg',quality=92)
print('relief + normal (8k & 4k) written. land max %dm, ocean min %dm'%(round(vmax),round(vmin)))
