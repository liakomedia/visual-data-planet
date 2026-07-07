/* Builds includes/js/planet-maritime.js — maritime cartography (Natural Earth, public domain):
   BATHY   — bathymetric depth contours (isobaths) at 200/2000/4000/6000 m
   MBOUNDS — international maritime boundary indicator lines (EEZ-style limits at sea) */
const NE='https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/';
const out=process.argv[2]||'includes/js/planet-maritime.js';
const r1=x=>Math.round(x*10)/10;
async function gj(name){ const r=await fetch(NE+name); return r.json(); }

// decimate a ring/line: round to 0.1°, keep every STEP-th vertex, drop dupes & tiny rings
function decimate(coords, step, minLen){
  const out=[]; let last=null;
  for(let i=0;i<coords.length;i+=step){ const [lon,lat]=coords[i];
    const p=[r1(lat), r1(lon)]; if(last && p[0]===last[0] && p[1]===last[1]) continue;
    out.push(p[0],p[1]); last=p; }
  return (out.length/2)>=minLen ? out : null;
}
function ringsOf(geom){
  if(!geom) return [];
  if(geom.type==='Polygon') return geom.coordinates;
  if(geom.type==='MultiPolygon') return geom.coordinates.flat();
  if(geom.type==='LineString') return [geom.coordinates];
  if(geom.type==='MultiLineString') return geom.coordinates;
  return [];
}

const BATHY=[];
for(const [d,file,step] of [[200,'ne_10m_bathymetry_K_200',3],[2000,'ne_10m_bathymetry_I_2000',3],
                            [4000,'ne_10m_bathymetry_G_4000',3],[6000,'ne_10m_bathymetry_E_6000',2]]){
  const gjd=await gj(file+'.geojson'); const lines=[];
  for(const f of gjd.features) for(const ring of ringsOf(f.geometry)){
    const dl=decimate(ring, step, 8); if(dl) lines.push(dl); }
  BATHY.push({d, lines});
  console.log('bathy', d+'m:', lines.length, 'contours');
}
// maritime boundary indicator lines
const gjm=await gj('ne_10m_admin_0_boundary_lines_maritime_indicator.geojson');
const MBOUNDS=[];
for(const f of gjm.features) for(const ring of ringsOf(f.geometry)){
  const dl=decimate(ring, 1, 3); if(dl) MBOUNDS.push(dl); }
console.log('maritime boundaries:', MBOUNDS.length, 'segments');

const js=`/* Maritime cartography — Natural Earth 10m (public domain, naturalearthdata.com).
   BATHY: bathymetric depth contours (isobaths). Each entry {d: metres, lines: [ [lat,lon,...], ... ] }.
   MBOUNDS: international maritime boundary indicator lines, [ [lat,lon,...], ... ]. */
const BATHY=${JSON.stringify(BATHY)};
const MBOUNDS=${JSON.stringify(MBOUNDS)};
`;
await import('fs').then(fs=>fs.writeFileSync(out, js));
const kb=Math.round((await import('fs')).statSync(out).size/1024);
console.log('wrote', out, kb+'KB');
