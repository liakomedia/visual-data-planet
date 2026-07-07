/* Builds includes/js/planet-data.js from the World Database on Protected Areas (WDPA).
   Source: UNEP-WCMC & IUCN, Protected Planet (www.protectedplanet.net), queried via the
   public UNEP-WCMC ArcGIS REST service. WDPA terms prohibit redistribution of the data,
   so the generated file is NOT shipped in this repository — run this script to create it.
   Node 18+ (built-in fetch). Usage: node scripts/fetch-wdpa.mjs [outfile] */
const BASE='https://data-gis.unep-wcmc.org/server/rest/services/ProtectedSites/The_World_Database_of_Protected_Areas/MapServer';
const FIELDS='name_eng,desig_eng,iucn_cat,realm,rep_area,iso3,status_yr,int_crit';
const MOD=13;                                   // every 13th polygon → ~23.6k of ~307k
const out=process.argv[2]||'includes/js/planet-data.js';

async function q(layer, where, offset, geometry){
  const p=new URLSearchParams({where, outFields:FIELDS, returnGeometry:String(geometry),
    outSR:'4326', resultOffset:String(offset), resultRecordCount:'2000', f:'json'});
  if(geometry) p.set('maxAllowableOffset','0.5');
  const r=await fetch(`${BASE}/${layer}/query`,{method:'POST',body:p});
  return r.json();
}
function centroid(geo){                          // bbox middle of the generalised rings
  if(!geo) return null;
  if(geo.x!==undefined) return [geo.y, geo.x];
  if(geo.points && geo.points.length) return [geo.points[0][1], geo.points[0][0]];   // multipoint layer
  let x0=180,x1=-180,y0=90,y1=-90,n=0;
  for(const ring of (geo.rings||[])) for(const [x,y] of ring){
    n++; if(x<x0)x0=x; if(x>x1)x1=x; if(y<y0)y0=y; if(y>y1)y1=y; }
  if(!n) return null;                            // empty generalised geometry → skip the site
  return [(y0+y1)/2, (x0+x1)/2];
}
const sites=[], DESIG=[], ISO=[], IUCN=['Ia','Ib','II','III','IV','V','VI','Not Reported','Not Applicable','Not Assigned'];
const REALM=['Terrestrial','Marine','Coastal'];
const ix=(arr,v)=>{ v=v||'—'; let i=arr.indexOf(v); if(i<0){ arr.push(v); i=arr.length-1; } return i; };
function add(a, ll){
  if(!ll || !isFinite(ll[0])) return;
  const wh=/world heritage/i.test(a.desig_eng||'')?1:0;
  const ram=/ramsar/i.test(a.desig_eng||'')?1:0;
  const mab=/UNESCO-MAB/i.test(a.desig_eng||'')?1:0;
  sites.push([+ll[0].toFixed(2), +ll[1].toFixed(2),
    Math.max(0,IUCN.indexOf(a.iucn_cat)), Math.max(0,REALM.indexOf(a.realm)),
    Math.round((a.rep_area||0)*10)/10, a.status_yr||0, ix(ISO,a.iso3), ix(DESIG,a.desig_eng),
    (a.name_eng||'').slice(0,60).replace(/"/g,"'"), wh*4+ram*2+mab]);
}
for(const [layer, where, geom] of [[0,'1=1',true],[1,`MOD(objectid,${MOD})=0`,true]]){
  for(let off=0;;off+=2000){
    const d=await q(layer, where, off, geom);
    if(!d.features){ console.error('ERR',JSON.stringify(d).slice(0,200)); break; }
    d.features.forEach(f=>add(f.attributes, centroid(f.geometry)));
    process.stdout.write(`layer ${layer} @${off}: total ${sites.length}\r`);
    if(!d.exceededTransferLimit) break;
  }
  console.log();
}
const js=`/* Protected areas of Earth — uniform sample of the World Database on Protected Areas
   (WDPA + points layer). Source: UNEP-WCMC and IUCN (2026), Protected Planet, queried via
   the UNEP-WCMC ArcGIS REST service. NOT for redistribution — see protectedplanet.net terms.
   Format: [lat, lon, iucnIdx, realmIdx, area_km2, year, isoIdx, desigIdx, name, flags(4=WHS,2=Ramsar,1=MAB)] */
const PP_IUCN=${JSON.stringify(IUCN)};
const PP_REALM=${JSON.stringify(REALM)};
const PP_ISO=${JSON.stringify(ISO)};
const PP_DESIG=${JSON.stringify(DESIG)};
const PP=${JSON.stringify(sites)};
`;
await import('fs').then(fs=>fs.writeFileSync(out, js));
console.log(`wrote ${out}: ${sites.length} sites, ${DESIG.length} designations, ${ISO.length} countries`);
