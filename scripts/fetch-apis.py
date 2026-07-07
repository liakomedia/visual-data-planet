#!/usr/bin/env python3
"""Builds includes/js/planet-apis.js — public APIs mapped by hosting-server location.
   Source list: github.com/public-apis/public-apis (MIT). Server geolocation: ip-api.com
   (free, non-commercial — attribution required). Sections mapped: Animals, Environment,
   Development, Food & Drink, Government, Health, Jobs, Music, Science & Math, Social,
   Transportation, Vehicle, Weather.  Requires: internet only (Python stdlib)."""
import re, json, socket, urllib.request, time
from urllib.parse import urlparse
SECTIONS = ['Animals','Environment','Development','Food & Drink','Government','Health','Jobs',
            'Music','Science & Math','Social','Transportation','Vehicle','Weather']
md = urllib.request.urlopen(
    'https://raw.githubusercontent.com/public-apis/public-apis/master/README.md', timeout=60).read().decode()
lines = md.splitlines()
idx = {}
for i, l in enumerate(lines):
    m = re.match(r'^### (.+?)\s*$', l)
    if m and m.group(1) in SECTIONS:
        idx[m.group(1)] = i
rowre = re.compile(r'^\|\s*\[([^\]]+)\]\(([^)]+)\)\s*\|\s*(.*?)\s*\|\s*(.*?)\s*\|')
entries = []
for si, sec in enumerate(SECTIONS):
    start = idx[sec]
    end = len(lines)
    for j in range(start + 1, len(lines)):
        if lines[j].startswith('### '):
            end = j
            break
    for j in range(start + 1, end):
        m = rowre.match(lines[j])
        if not m:
            continue
        name, url, desc, auth = m.groups()
        host = urlparse(url).netloc.lower().replace('www.', '')
        if host:
            entries.append({'sec': si, 'name': name.strip()[:42], 'url': url.strip(), 'host': host,
                            'desc': re.sub(r'\s+', ' ', desc)[:80], 'auth': (auth.strip() or 'No')[:24]})
socket.setdefaulttimeout(3)
host_ip = {}
for h in sorted({e['host'] for e in entries}):
    try:
        host_ip[h] = socket.gethostbyname(h)
    except Exception:
        pass
ips = sorted(set(host_ip.values()))
iploc = {}
for i in range(0, len(ips), 100):
    body = json.dumps([{'query': ip} for ip in ips[i:i + 100]]).encode()
    req = urllib.request.Request('http://ip-api.com/batch?fields=status,lat,lon,query',
                                 body, {'Content-Type': 'application/json'})
    for r in json.load(urllib.request.urlopen(req, timeout=60)):
        if r.get('status') == 'success':
            iploc[r['query']] = [round(r['lat'], 2), round(r['lon'], 2)]
    time.sleep(1.6)
out = []
for k, e in enumerate(entries):
    ip = host_ip.get(e['host'])
    L = iploc.get(ip) if ip else None
    if not L:
        continue
    jx = ((k * 37) % 100 - 50) / 100 * 0.6
    jy = ((k * 53) % 100 - 50) / 100 * 0.6
    out.append([round(L[0] + jy, 2), round(L[1] + jx, 2), e['sec'],
                e['name'], e['host'], e['auth'], e['desc'], e['url']])
open('includes/js/planet-apis.js', 'w').write(
    '/* Public APIs mapped by hosting-server location. github.com/public-apis/public-apis (MIT);\n'
    '   geolocation ip-api.com (free, non-commercial). Format: APIS [lat,lon,secIdx,name,host,auth,desc,url] */\n'
    'const API_SECTIONS=' + json.dumps(SECTIONS) + ';\nconst APIS=' + json.dumps(out) + ';\n')
print('wrote includes/js/planet-apis.js:', len(out), 'APIs')
