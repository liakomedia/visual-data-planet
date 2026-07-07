#!/usr/bin/env python3
"""Builds includes/js/planet-world.js — the extra open-data world layers:
     POLITICAL  — country borders + capitals (Natural Earth 10m, public domain)
     LOGISTICS  — large & medium airports (OurAirports, public domain)
     DISASTERS  — M4.5+ earthquakes over the past 30 days (USGS) + open natural events (NASA EONET)
     CLIMATE    — Köppen-Geiger present-day zones sampled to a 1° land grid
                  (Beck et al. 2018, Nature Scientific Data, CC BY 4.0; figshare 6396959)
   Disaster feeds are live at build time (snapshot). Requires: rasterio, numpy, and internet.
   Usage: python3 scripts/fetch-world.py"""
import json, urllib.request, csv, io, re, zipfile, tempfile, os
import numpy as np, rasterio
from rasterio.enums import Resampling

def get(u, t=120):
    return urllib.request.urlopen(urllib.request.Request(u, headers={'User-Agent': 'LiakoVisualData/1.0'}), timeout=t).read()
r1 = lambda x: round(x, 1)
r2 = lambda x: round(x, 2)
NE = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/'

def rings(g):
    t = g['type']
    if t == 'LineString': return [g['coordinates']]
    if t == 'MultiLineString': return g['coordinates']
    return []

# POLITICAL
gj = json.loads(get(NE + 'ne_10m_admin_0_boundary_lines_land.geojson'))
BORDERS = []
for f in gj['features']:
    for line in rings(f['geometry']):
        pl, last = [], None
        for k in range(0, len(line), 2):
            lon, lat = line[k]; p = [r1(lat), r1(lon)]
            if p != last: pl += [p[0], p[1]]; last = p
        if len(pl) >= 6: BORDERS.append(pl)
caps = json.loads(get(NE + 'ne_10m_populated_places_simple.geojson'))
CAPITALS = []
for f in caps['features']:
    p = f['properties']; fc = (p.get('featurecla') or '')
    if 'capital' in fc.lower() and 'Admin-0' in fc:
        lon, lat = f['geometry']['coordinates']
        CAPITALS.append([r2(lat), r2(lon), p.get('name') or '', p.get('adm0name') or '', p.get('pop_max') or 0])

# LOGISTICS
raw = get('https://davidmegginson.github.io/ourairports-data/airports.csv').decode('utf-8', 'replace')
AIRPORTS = []
TYPES = {'large_airport': 2, 'medium_airport': 1}
for row in csv.DictReader(io.StringIO(raw)):
    if row.get('type') not in TYPES: continue
    try: lat = float(row['latitude_deg']); lon = float(row['longitude_deg'])
    except Exception: continue
    AIRPORTS.append([r2(lat), r2(lon), TYPES[row['type']], (row.get('name') or '')[:40],
                     (row.get('iata_code') or ''), (row.get('iso_country') or '')])

# DISASTERS
q = json.loads(get('https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_month.geojson'))
QUAKES = []
for f in q['features']:
    c = f['geometry']['coordinates']; pr = f['properties']
    QUAKES.append([r2(c[1]), r2(c[0]), round(pr.get('mag') or 0, 1), (pr.get('place') or '')[:50], round(c[2] or 0)])
ECAT = ['Wildfires', 'Severe Storms', 'Volcanoes', 'Sea and Lake Ice', 'Floods', 'Earthquakes', 'Drought',
        'Dust and Haze', 'Landslides', 'Snow', 'Temperature Extremes', 'Water Color', 'Manmade']
eo = json.loads(get('https://eonet.gsfc.nasa.gov/api/v3/events?status=open&limit=800'))
EONET = []
for ev in eo.get('events', []):
    cats = [c['title'] for c in ev.get('categories', [])]
    ci = next((ECAT.index(c) for c in cats if c in ECAT), 0)
    geo = ev.get('geometry') or []
    if not geo: continue
    g = geo[-1]
    if g.get('type') != 'Point' or not g.get('coordinates'): continue
    EONET.append([r2(g['coordinates'][1]), r2(g['coordinates'][0]), ci, (ev.get('title') or '')[:48]])

# CLIMATE (Köppen)
KOPPEN = ['', 'Af','Am','Aw','BWh','BWk','BSh','BSk','Csa','Csb','Csc','Cwa','Cwb','Cwc','Cfa','Cfb','Cfc',
          'Dsa','Dsb','Dsc','Dsd','Dwa','Dwb','Dwc','Dwd','Dfa','Dfb','Dfc','Dfd','ET','EF']
zf = tempfile.mktemp(suffix='.zip'); open(zf, 'wb').write(get('https://ndownloader.figshare.com/files/12407516', 400))
with zipfile.ZipFile(zf) as z:
    z.extract('Beck_KG_V1_present_0p083.tif', tempfile.gettempdir())
os.unlink(zf)
tif = os.path.join(tempfile.gettempdir(), 'Beck_KG_V1_present_0p083.tif')
W, H = 360, 180
with rasterio.open(tif) as ds:
    a = ds.read(1, out_shape=(H, W), resampling=Resampling.nearest)
os.unlink(tif)
CLIMATE = []
for j in range(H):
    lat = 90 - (j + 0.5) / H * 180
    for i in range(W):
        k = int(a[j, i])
        if 1 <= k <= 30:
            CLIMATE.append([round(lat, 1), round(-180 + (i + 0.5) / W * 360, 1), k])

open('includes/js/planet-world.js', 'w').write(
    '/* Open world-data layers. POLITICAL/LOGISTICS: Natural Earth + OurAirports (public domain).\n'
    '   DISASTERS: USGS quakes + NASA EONET (snapshot at build time). CLIMATE: Köppen-Geiger,\n'
    '   Beck et al. (2018), CC BY 4.0. */\n'
    'const BORDERS=' + json.dumps(BORDERS) + ';\nconst CAPITALS=' + json.dumps(CAPITALS) + ';\n'
    'const AIRPORTS=' + json.dumps(AIRPORTS) + ';\nconst QUAKES=' + json.dumps(QUAKES) + ';\n'
    'const EONET_CATS=' + json.dumps(ECAT) + ';\nconst EONET=' + json.dumps(EONET) + ';\n'
    'const KOPPEN=' + json.dumps(KOPPEN) + ';\nconst CLIMATE=' + json.dumps(CLIMATE) + ';\n')
print('wrote includes/js/planet-world.js: %d borders, %d capitals, %d airports, %d quakes, %d events, %d climate' %
      (len(BORDERS), len(CAPITALS), len(AIRPORTS), len(QUAKES), len(EONET), len(CLIMATE)))
