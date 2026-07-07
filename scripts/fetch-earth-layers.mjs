/* Builds includes/js/planet-earth.js — the physical/human geography layers:
   CITIES — Natural Earth 10m populated places (public domain)
   PORTS  — Natural Earth 10m ports (public domain)
   SEAS   — Natural Earth 10m marine polygons → named label points (public domain)
   PEAKS  — mountains with elevation ≥ 3500 m from Wikidata (CC0)
   Node 18+. Usage: node scripts/fetch-earth-layers.mjs [outfile] */
const NE='https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/';
const out=process.argv[2]||'includes/js/planet-earth.js';
const r2=x=>Math.round(x*100)/100;

async function gj(name){ const r=await fetch(NE+name); return r.json(); }

// CITIES: [lat, lon, popMax, name, country]
const cities=[];
{ const d=await gj('ne_10m_populated_places_simple.geojson');
  for(const f of d.features){ const p=f.properties, [lon,lat]=f.geometry.coordinates;
    cities.push([r2(lat), r2(lon), p.pop_max||0, p.name||'', p.adm0name||'']); }
  cities.sort((a,b)=>b[2]-a[2]);
  console.log('cities:', cities.length); }

// PORTS: [lat, lon, name]
const ports=[];
{ const d=await gj('ne_10m_ports.geojson');
  for(const f of d.features){ const p=f.properties, [lon,lat]=f.geometry.coordinates;
    ports.push([r2(lat), r2(lon), p.name||'']); }
  console.log('ports:', ports.length); }

// SEAS: [lat, lon, name, type] — label point = bbox centre of the largest polygon part
const seas=[];
{ const d=await gj('ne_10m_geography_marine_polys.geojson');
  for(const f of d.features){ const p=f.properties; if(!p.name) continue;
    let rings=f.geometry.type==='Polygon'?[f.geometry.coordinates]:f.geometry.coordinates;
    let best=null, bestN=0;
    for(const poly of rings){ const outer=poly[0]; if(outer.length>bestN){ bestN=outer.length; best=outer; } }
    if(!best) continue;
    let x0=180,x1=-180,y0=90,y1=-90;
    for(const [x,y] of best){ if(x<x0)x0=x; if(x>x1)x1=x; if(y<y0)y0=y; if(y>y1)y1=y; }
    seas.push([r2((y0+y1)/2), r2((x0+x1)/2), p.name, p.featurecla||'sea']); }
  console.log('seas:', seas.length); }

// PEAKS from Wikidata (CC0): mountains with elevation ≥ 3500 m
const peaks=[];
{ const q=`SELECT ?mLabel ?coord ?elev WHERE {
    ?m wdt:P31 wd:Q8502; wdt:P2044 ?elev; wdt:P625 ?coord .
    FILTER(?elev >= 3500)
    SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
  } ORDER BY DESC(?elev) LIMIT 8000`;
  const r=await fetch('https://query.wikidata.org/sparql?format=json&query='+encodeURIComponent(q),
    {headers:{'User-Agent':'LiakoVisualData/1.0 (https://vdata.liako.eu; nxprm@icloud.com)','Accept':'application/sparql-results+json'}});
  const d=await r.json();
  const seen=new Set();
  for(const b of d.results.bindings){
    const m=/Point\(([-\d.]+) ([-\d.]+)\)/.exec(b.coord.value); if(!m) continue;
    const name=(b.mLabel?.value||'').slice(0,50); if(!name||/^Q\d+$/.test(name)) continue;
    const key=name+'|'+r2(+m[2]); if(seen.has(key)) continue; seen.add(key);
    peaks.push([r2(+m[2]), r2(+m[1]), Math.round(+b.elev.value), name]); }
  console.log('peaks:', peaks.length); }

const js=`/* Physical & human geography layers.
   CITIES/PORTS/SEAS: Natural Earth 10m (public domain, naturalearthdata.com).
   PEAKS: Wikidata (CC0), mountains with elevation >= 3500 m.
   Formats: CITIES [lat,lon,pop,name,country] · PORTS [lat,lon,name]
            SEAS [lat,lon,name,type] · PEAKS [lat,lon,elev_m,name] */
const CITIES=${JSON.stringify(cities)};
const PORTS=${JSON.stringify(ports)};
const SEAS=${JSON.stringify(seas)};
const PEAKS=${JSON.stringify(peaks)};
`;
await import('fs').then(fs=>fs.writeFileSync(out, js));
console.log('wrote', out);
