/* visual-data-planet — engine (design & interaction model of visual-data-solar).
   One textured Earth; every protected area of the WDPA as a point at its true lat/lon,
   layered by IUCN category (terrestrial = greens, marine = blues) plus the international
   designations (World Heritage, Ramsar, UNESCO-MAB). Glass UI, legend with select-all. */
window.addEventListener('error',function(e){ if(e.filename && e.filename.indexOf('3d-force-graph')>-1){ e.preventDefault(); return true; } },true);

const R=60;                                        // Earth radius in scene units
/* lat/lon (deg) → position on the sphere, matching an equirectangular texture */
function llToVec(lat,lon,r){
  const phi=(90-lat)*Math.PI/180, th=(lon+180)*Math.PI/180;
  return [-r*Math.sin(phi)*Math.cos(th), r*Math.cos(phi), r*Math.sin(phi)*Math.sin(th)];
}

/* ---- layer definitions over the PP array ----
   PP row: [lat, lon, iucnIdx, realmIdx, area, year, isoIdx, desigIdx, name, flags] */
const GROUPS=[
  {key:'ia',  label:'Ia·Ib — strict nature reserves & wilderness', cats:[0,1], l:0.66},
  {key:'ii',  label:'II — national parks',                        cats:[2],   l:0.60},
  {key:'iii', label:'III — natural monuments',                    cats:[3],   l:0.55},
  {key:'iv',  label:'IV — habitat & species areas',               cats:[4],   l:0.50},
  {key:'v',   label:'V — protected landscapes',                   cats:[5],   l:0.45},
  {key:'vi',  label:'VI — sustainable use',                       cats:[6],   l:0.40},
  {key:'nr',  label:'category not reported',                      cats:[7,8,9], l:0.34},
];
const SPECIALS=[
  {key:'whs', label:'UNESCO World Heritage', flag:4, color:0xffd97a, size:3.2},
  {key:'ram', label:'Ramsar wetlands',       flag:2, color:0x7fe0e8, size:2.4},
  {key:'mab', label:'UNESCO-MAB biospheres', flag:1, color:0xb58ee7, size:2.4},
];

let NODES=[{id:'earth',name:'Earth',x:0,y:0,z:0}];   // one pinned node — the globe itself
const elGraph=document.getElementById('graph');
let Graph, earthGroup, _ray=null;
const _clouds=[];                                   // {pts,label,idxs (into PP)}
const _lines=[];                                    // maritime line layers {obj,label,sw}
const hiddenTypes=new Set(), _legendChips=[];
function refreshLegendChips(){ _legendChips.forEach(c=>c.el.classList.toggle('off',!c.isOn())); }

let _texLoader=null;
function tex(f){ if(!_texLoader) _texLoader=new THREE.TextureLoader();
  const t=_texLoader.load('includes/images/tex/'+f); if('colorSpace' in t) t.colorSpace='srgb';
  t.anisotropy=8; return t; }
function dotTexture(){
  const cv=document.createElement('canvas'); cv.width=cv.height=64;
  const g=cv.getContext('2d'), gr=g.createRadialGradient(32,32,0,32,32,32);
  gr.addColorStop(0,'rgba(255,255,255,1)'); gr.addColorStop(0.55,'rgba(255,255,255,.55)'); gr.addColorStop(1,'rgba(255,255,255,0)');
  g.fillStyle=gr; g.fillRect(0,0,64,64);
  const t=new THREE.CanvasTexture(cv); return t;
}

function buildClouds(){
  const dot=dotTexture();
  // IUCN groups — per-point colour: terrestrial greens / marine blues (hue), lightness by group
  GROUPS.forEach(gr=>{
    const idxs=[], pos=[], col=[], c=new THREE.Color();
    PP.forEach((s,i)=>{ if(!gr.cats.includes(s[2])) return;
      idxs.push(i); const v=llToVec(s[0],s[1],R*1.034);
      pos.push(v[0],v[1],v[2]);
      c.setHSL(s[3]===1?0.55:0.335, 0.62, gr.l);          // marine → blue, land/coastal → green
      col.push(c.r,c.g,c.b); });
    const geo=new THREE.BufferGeometry();
    geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
    geo.setAttribute('color',new THREE.Float32BufferAttribute(col,3));
    const mat=new THREE.PointsMaterial({size:2.0, map:dot, vertexColors:true, transparent:true, opacity:0.85,
      sizeAttenuation:false, depthWrite:false});
    const pts=new THREE.Points(geo,mat); pts.frustumCulled=false;
    earthGroup.add(pts); _clouds.push({pts,label:gr.label,idxs});
  });
  // international designations — drawn on top, single colours
  SPECIALS.forEach(sp=>{
    const idxs=[], pos=[];
    PP.forEach((s,i)=>{ if(!(s[9]&sp.flag)) return;
      idxs.push(i); const v=llToVec(s[0],s[1],R*1.05); pos.push(v[0],v[1],v[2]); });
    const geo=new THREE.BufferGeometry();
    geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
    const mat=new THREE.PointsMaterial({size:sp.size, map:dot, color:sp.color, transparent:true, opacity:0.95,
      sizeAttenuation:false, depthWrite:false});
    const pts=new THREE.Points(geo,mat); pts.frustumCulled=false;
    earthGroup.add(pts); _clouds.push({pts,label:sp.label,idxs});
  });
}

/* WD-OECM — Other Effective area-based Conservation Measures: the second Protected Planet
   database (areas that deliver conservation without being formally "protected areas"). */
function buildOECM(){
  if(typeof PP_OECM==='undefined') return;
  const dot=dotTexture(), pos=[], idxs=[];
  PP_OECM.forEach((o,i)=>{ idxs.push(i); const v=llToVec(o[0],o[1],R*1.038); pos.push(v[0],v[1],v[2]); });
  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
  const mat=new THREE.PointsMaterial({size:2.4, map:dot, color:0xff9d5c, transparent:true, opacity:0.92,
    sizeAttenuation:false, depthWrite:false});
  const pts=new THREE.Points(geo,mat); pts.frustumCulled=false;
  earthGroup.add(pts); _clouds.push({pts,label:'OECM — other conservation measures',idxs,kind:'oecm',data:PP_OECM});
}

/* physical & human geography — cities (Natural Earth), mountain peaks (Wikidata),
   ports and named oceans/seas (Natural Earth). Same picking/panel machinery. */
function buildEarthLayers(){
  const dot=dotTexture();
  const mk=(arr,kind,label,posR,colorFn,size,opacity)=>{
    const idxs=[],pos=[],col=[],c=new THREE.Color();
    arr.forEach((it,i)=>{ idxs.push(i); const v=llToVec(it[0],it[1],posR); pos.push(v[0],v[1],v[2]);
      colorFn(c,it); col.push(c.r,c.g,c.b); });
    const geo=new THREE.BufferGeometry();
    geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
    geo.setAttribute('color',new THREE.Float32BufferAttribute(col,3));
    const mat=new THREE.PointsMaterial({size, map:dot, vertexColors:true, transparent:true, opacity,
      sizeAttenuation:false, depthWrite:false});
    const pts=new THREE.Points(geo,mat); pts.frustumCulled=false;
    earthGroup.add(pts); _clouds.push({pts,label,idxs,kind,data:arr});
  };
  if(typeof CITIES!=='undefined') mk(CITIES,'city','cities',R*1.033,
    (c,it)=>c.setHSL(0.09,0.95,0.50+0.28*Math.min(1,Math.log10(Math.max(1,it[2]))/7.4)),2.6,0.95);
  if(typeof PEAKS!=='undefined') mk(PEAKS,'peak','mountain peaks ≥ 3,500 m',R*1.045,
    (c,it)=>c.setHSL(0.07,0.25,0.62+0.36*Math.min(1,(it[2]-3500)/5000)),2.4,0.95);
  if(typeof PORTS!=='undefined') mk(PORTS,'port','ports',R*1.033,
    (c)=>c.set(0x8fe6f5),2.4,0.95);
  if(typeof SEAS!=='undefined') mk(SEAS,'sea','oceans & seas (named)',R*1.055,
    (c)=>c.set(0x6fa6f8),5.0,0.9);
}
/* SPUN Underground Atlas — mycorrhizal fungal biodiversity hotspots (CC BY 4.0). */
function buildFungi(){
  if(typeof FUNGI==='undefined') return;
  const dot=dotTexture();
  const mk=(arr,label,color,ftype)=>{
    const idxs=[],pos=[]; arr.forEach((f,i)=>{ idxs.push(i); const v=llToVec(f[0],f[1],R*1.037); pos.push(v[0],v[1],v[2]); });
    const geo=new THREE.BufferGeometry(); geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
    const mat=new THREE.PointsMaterial({size:2.4, map:dot, color, transparent:true, opacity:0.85, sizeAttenuation:false, depthWrite:false});
    const pts=new THREE.Points(geo,mat); pts.frustumCulled=false;
    earthGroup.add(pts); _clouds.push({pts,label,idxs,kind:'fungi',data:arr,ftype});
  };
  mk(FUNGI.filter(f=>f[2]===0),'AM (arbuscular) richness hotspots',0xff7ab8,'Arbuscular mycorrhizal (AM)');
  mk(FUNGI.filter(f=>f[2]===1),'EcM (ecto) richness hotspots',0xc98cff,'Ectomycorrhizal (EcM)');
}

/* Maritime cartography — bathymetric isobaths + maritime boundaries (Natural Earth, lines). */
function depthColor(d){ const t=Math.min(1,Math.max(0,(d-200)/5800));
  const c=new THREE.Color(); c.setHSL(0.58, 0.75, 0.72-0.42*t); return c; }   // shallow bright → deep dark blue
function polysToSegments(lines, r){ const segs=[];
  lines.forEach(fl=>{ for(let i=0;i<fl.length-2;i+=2){
    const a=llToVec(fl[i],fl[i+1],r), b=llToVec(fl[i+2],fl[i+3],r);
    segs.push(a[0],a[1],a[2], b[0],b[1],b[2]); } });
  return segs; }
function addLine(segs, color, opacity, label, sw){
  const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.Float32BufferAttribute(segs,3));
  const m=new THREE.LineBasicMaterial({color, transparent:true, opacity});
  const ls=new THREE.LineSegments(g,m); ls.frustumCulled=false;
  earthGroup.add(ls); _lines.push({obj:ls,label,sw});
}
function buildMaritime(){
  if(typeof BATHY!=='undefined') BATHY.forEach(b=>{ const col=depthColor(b.d);
    addLine(polysToSegments(b.lines, R*1.002), col, 0.5,
      b.d.toLocaleString()+' m isobath', '#'+col.getHexString()); });
  if(typeof MBOUNDS!=='undefined')
    addLine(polysToSegments(MBOUNDS, R*1.006), 0xcbb3ff, 0.6, 'maritime boundaries', '#cbb3ff');
}

/* ETOPO combined relief: grey 0.5 = sea level, brighter = land, darker = ocean floor.
   displacementBias re-zeros sea level to R, so land rises and the sea floor sinks. */
const DISP=R*0.05;              // full land+ocean vertical exaggeration (real relief is <0.3% of R)
/* pick texture resolution to the GPU's limit — high-end desktops get the 16k surface,
   most get 8k, weak/mobile GPUs get 4k. Keeps deep zoom sharp without breaking low-end. */
function texTier(){
  let maxT=8192;
  try{ maxT=(Graph&&Graph.renderer&&Graph.renderer().capabilities.maxTextureSize)||8192; }catch(e){}
  const mobile=/Mobi|Android|iPhone|iPad/i.test(navigator.userAgent||'');
  if(maxT>=16384 && !mobile) return {color:'earth_bathy_16k.jpg', relief:'earth_relief_8k.jpg', normal:'earth_normal_8k.jpg', seg:640};
  if(maxT>=8192)            return {color:'earth_bathy_8k.jpg',  relief:'earth_relief_8k.jpg', normal:'earth_normal_8k.jpg', seg:512};
  return {color:'earth_bathy_4k.jpg', relief:'earth_relief_4k.jpg', normal:'earth_normal_4k.jpg', seg:384};
}
function earthMesh(){
  earthGroup=new THREE.Group();
  const T=texTier();
  const relief=tex(T.relief);  if('colorSpace' in relief) relief.colorSpace=THREE.NoColorSpace;   // heightmap is data
  const normal=tex(T.normal);  if('colorSpace' in normal) normal.colorSpace=THREE.NoColorSpace;   // normals are data
  const sph=new THREE.Mesh(new THREE.SphereGeometry(R,T.seg,T.seg/2),
    new THREE.MeshPhongMaterial({map:tex(T.color),                    // NASA Blue Marble w/ bathymetry — depth-shaded oceans
      displacementMap:relief, displacementScale:DISP, displacementBias:-DISP*0.5,   // 0.5 grey (sea level) → R
      normalMap:normal, normalScale:new THREE.Vector2(1.1,1.1),       // per-pixel land & sea-floor detail, crisp at any zoom
      shininess:3, specular:0x0a1420}));
  sph.name='globe';
  earthGroup.add(sph);
  const halo=new THREE.Mesh(new THREE.SphereGeometry(R*1.06,48,32),
    new THREE.MeshBasicMaterial({color:0x8fe3a8, transparent:true, opacity:0.05, side:THREE.BackSide, depthWrite:false}));
  earthGroup.add(halo);
  buildClouds();
  buildOECM();
  buildEarthLayers();
  buildFungi();
  buildMaritime();
  buildLegend(); updateHud();   // clouds exist only now — the graph calls this factory lazily
  return earthGroup;
}

function boot(){
  if(typeof ForceGraph3D==='undefined'||typeof THREE==='undefined'){ setTimeout(boot,120); return; }
  document.getElementById('loading').classList.add('done');
  Graph=ForceGraph3D({controlType:'orbit'})(elGraph)
    .enableNodeDrag(false)
    .backgroundColor('#05070e')
    .nodeThreeObject(earthMesh)
    .nodeLabel(()=>null)
    .linkVisibility(false)
    .onBackgroundClick(()=>{})
    .graphData({nodes:NODES,links:[]});
  const scene=Graph.scene();
  scene.add(new THREE.AmbientLight(0xffffff,0.62));                 // keeps the far side readable
  const key=new THREE.DirectionalLight(0xffffff,0.85);
  key.position.set(-0.5*R,0.7*R,0.9*R);                            // camera-local → grazes the terrain, follows the view
  Graph.camera().add(key); scene.add(Graph.camera());
  NODES[0].fx=NODES[0].fy=NODES[0].fz=0;
  Graph.d3Force('charge',null); Graph.d3Force('center',null); Graph.cooldownTicks(0);
  Graph.cameraPosition({x:0,y:R*0.7,z:R*2.6});
}

/* gentle rotation — points ride the globe (they are its children) */
let _spin=true;
(function tick(){ requestAnimationFrame(tick);
  if(earthGroup && _spin) earthGroup.rotation.y += 0.0006; })();

/* ===================== PICKING ===================== */
function pickSite(e){
  if(!Graph||!Graph.camera) return null;
  if(!_ray) _ray=new THREE.Raycaster();
  const rect=elGraph.getBoundingClientRect();
  _ray.setFromCamera({x:((e.clientX-rect.left)/rect.width)*2-1, y:-((e.clientY-rect.top)/rect.height)*2+1}, Graph.camera());
  const cam=Graph.cameraPosition();
  _ray.params.Points.threshold=Math.max(0.35, Math.hypot(cam.x,cam.y,cam.z)/450);
  let best=null;
  for(const cl of _clouds){ if(!cl.pts.visible) continue;
    const h=_ray.intersectObject(cl.pts,false);
    for(const hit of h){                        // nearest hit that faces the camera (not behind the globe)
      const p=hit.point, d=Math.hypot(p.x-cam.x,p.y-cam.y,p.z-cam.z);
      if(Math.hypot(cam.x,cam.y,cam.z) < d) continue;
      if(!best || d<best.d) best={cl, i:hit.index, d};
    } }
  return best;
}
const panel=document.getElementById('panel'), pbd=document.getElementById('pbd'), pph=document.getElementById('pph');
document.getElementById('pclose').onclick=()=>panel.classList.remove('open');
function row(l,v){return `<div class="row"><div class="lab">${l}</div><div class="val">${v}</div></div>`;}
function fmtArea(a){ if(!a) return '—';
  if(a<1) return Math.round(a*100)+' ha';
  return a.toLocaleString(undefined,{maximumFractionDigits:a<100?1:0})+' km²'; }
function showSite(hit){
  const kind=hit.cl.kind||'pp';
  if(kind==='pp') return showPP(hit);
  const it=hit.cl.data[hit.cl.idxs[hit.i]]; if(!it) return; pph.style.display='none';
  let tag,col,h2,rows='',note='';
  if(kind==='city'){ tag='City · Natural Earth'; col='#e8b45f'; h2=it[3]||'City';
    rows=row('Country',it[4]||'—')+row('Population (urban area)',it[2]?it[2].toLocaleString():'—');
    note='Natural Earth 10m populated places (public domain).'; }
  else if(kind==='peak'){ tag='Mountain peak · Wikidata'; col='#e8dcc8'; h2=it[3]||'Peak';
    rows=row('Elevation',it[2].toLocaleString()+' m ('+Math.round(it[2]*3.28084).toLocaleString()+' ft)');
    note='Mountains with elevation ≥ 3,500 m — Wikidata (CC0).'; }
  else if(kind==='port'){ tag='Port · Natural Earth'; col='#7fd8e8'; h2=it[2]||'Port';
    note='Natural Earth 10m ports (public domain).'; }
  else if(kind==='fungi'){ tag='Fungal hotspot · SPUN'; col='#ff7ab8'; h2=hit.cl.ftype;
    rows=row('Fungal group',hit.cl.ftype);
    note='Predicted mycorrhizal-richness hotspot — SPUN Underground Atlas; Van Nuland et al. (2025), Nature (CC BY 4.0). Over 90% of these hotspots lie outside protected areas.'; }
  else if(kind==='oecm'){ tag='OECM · Protected Planet'; col='#ff9d5c'; h2=it[8]||'Unnamed OECM';
    rows=(typeof PPO_DESIG!=='undefined'?row('Designation',PPO_DESIG[it[7]]||'—'):'')
        +row('IUCN category',PP_IUCN[it[2]]||'—')+row('Reported area',fmtArea(it[4]))
        +(it[5]?row('Established',it[5]):'')
        +(typeof PPO_ISO!=='undefined'?row('Country / territory',(PPO_ISO[it[6]]||'—').split(';').join(' · ')):'');
    note='Other Effective area-based Conservation Measure — WD-OECM, UNEP-WCMC & IUCN, protectedplanet.net.'; }
  else { tag='Ocean / sea · Natural Earth'; col='#5f96e8'; h2=it[2]||'Sea';
    rows=row('Type',(it[3]||'sea').replace(/_/g,' '));
    note='Named marine region — dot marks the label point of its main basin (Natural Earth, public domain).'; }
  let h=`<span class="tag" style="background:${col};color:#04121a;border-color:${col}">${tag}</span>`;
  h+=`<h2>${h2}</h2><div class="rows">${rows}`;
  h+=row('Latitude',it[0].toFixed(2)+'°')+row('Longitude',it[1].toFixed(2)+'°')+`</div>`;
  h+=`<div class="note" style="font-style:normal;color:#dbe4ff">${note}</div>`;
  pbd.innerHTML=h; panel.classList.add('open');
}
function showPP(hit){
  const s=PP[hit.cl.idxs[hit.i]]; if(!s) return; pph.style.display='none';
  const marine=s[3]===1, col=marine?'#7fb8e8':'#8fe3a8';
  let h=`<span class="tag" style="background:${col};color:#04121a;border-color:${col}">Protected area · ${PP_REALM[s[3]]||'—'}</span>`;
  h+=`<h2>${s[8]||'Unnamed site'}</h2><div class="years">${PP_DESIG[s[7]]||''}</div><div class="rows">`;
  h+=row('IUCN category',PP_IUCN[s[2]]||'—');
  h+=row('Reported area',fmtArea(s[4]));
  if(s[5]) h+=row('Established',s[5]);
  h+=row('Country / territory',(PP_ISO[s[6]]||'—').split(';').join(' · '));
  h+=row('Latitude',s[0].toFixed(2)+'°')+row('Longitude',s[1].toFixed(2)+'°')+`</div>`;
  const badges=[]; if(s[9]&4)badges.push('UNESCO World Heritage'); if(s[9]&2)badges.push('Ramsar wetland'); if(s[9]&1)badges.push('UNESCO-MAB biosphere');
  if(badges.length) h+=`<div class="note" style="font-style:normal;color:#ffd97a">★ ${badges.join(' · ')}</div>`;
  h+=`<div class="note" style="font-style:normal;color:#dbe4ff">One of ${PP.length.toLocaleString()} sites mapped from the World Database on Protected Areas — UNEP-WCMC &amp; IUCN, protectedplanet.net.</div>`;
  pbd.innerHTML=h; panel.classList.add('open');
}
let _pickLast=0,_hoverKey=null,_touchMode=false;
elGraph.addEventListener('pointermove',e=>{
  if(_touchMode) return;
  const now=performance.now(); if(now-_pickLast<90) return; _pickLast=now;
  const hit=pickSite(e);
  elGraph.style.cursor=hit?'pointer':'grab';
  if(hit){ const k=hit.cl.label+':'+hit.i; if(k!==_hoverKey){ _hoverKey=k; showSite(hit); } }
  else _hoverKey=null;
});
let _downXY=null,_downT=0;
elGraph.addEventListener('pointerdown',e=>{ if(e.pointerType==='touch')_touchMode=true; _downXY=[e.clientX,e.clientY]; _downT=performance.now(); },true);
elGraph.addEventListener('pointerup',e=>{ const d=_downXY; _downXY=null; if(!d) return;
  if(Math.hypot(e.clientX-d[0],e.clientY-d[1])>=8||performance.now()-_downT>600) return;
  const hit=pickSite(e); if(hit) showSite(hit);
},true);

/* ===================== CAMERA ===================== */
let _camAnim=null;
function easeCam(toPos,toTarget,ms){
  const run=(now)=>{ const cam=Graph.camera&&Graph.camera(), ctr=Graph.controls&&Graph.controls();
    if(!cam||!ctr) return;
    if(!run._s){ run._s=now; run._p0=cam.position.clone(); run._t0=ctr.target.clone(); }
    const k=Math.min(1,(now-run._s)/ms), e2=k<.5?2*k*k:1-Math.pow(-2*k+2,2)/2;
    cam.position.set(run._p0.x+(toPos.x-run._p0.x)*e2, run._p0.y+(toPos.y-run._p0.y)*e2, run._p0.z+(toPos.z-run._p0.z)*e2);
    ctr.target.set(run._t0.x+(toTarget.x-run._t0.x)*e2, run._t0.y+(toTarget.y-run._t0.y)*e2, run._t0.z+(toTarget.z-run._t0.z)*e2);
    ctr.update(); if(k<1) _camAnim=requestAnimationFrame(run); };
  cancelAnimationFrame(_camAnim); _camAnim=requestAnimationFrame(run);
}
function flyToLL(lat,lon){
  const v=llToVec(lat,lon,1);
  // account for the globe's current rotation
  const rot=earthGroup.rotation.y, cos=Math.cos(rot), sin=Math.sin(rot);
  const x=v[0]*cos+v[2]*sin, z=-v[0]*sin+v[2]*cos;
  easeCam({x:x*R*2.2, y:v[1]*R*2.2, z:z*R*2.2},{x:0,y:0,z:0},900);
}
document.getElementById('bAll').onclick=()=>easeCam({x:0,y:R*0.7,z:R*2.6},{x:0,y:0,z:0},700);
document.getElementById('bFit').onclick=()=>easeCam({x:0,y:R*0.7,z:R*2.6},{x:0,y:0,z:0},700);
document.getElementById('bReset').onclick=()=>{ panel.classList.remove('open');
  _clouds.forEach(c=>c.pts.visible=true); _lines.forEach(l=>l.obj.visible=true); refreshLegendChips(); _syncLegendMaster();
  easeCam({x:0,y:R*0.7,z:R*2.6},{x:0,y:0,z:0},700); };
const bSpin=document.getElementById('bSpin');
if(bSpin) bSpin.onclick=()=>{ _spin=!_spin; bSpin.classList.toggle('active',_spin); };

/* ===================== LEGEND (with select / unselect all) ===================== */
function _syncLegendMaster(){ const cb=document.getElementById('legend-all'); if(!cb) return;
  const on=_legendChips.filter(c=>c.isOn()).length;
  cb.checked=on===_legendChips.length; cb.indeterminate=on>0&&on<_legendChips.length; }
function mkToggle(el, html, isOn, onToggle){
  const s=document.createElement('span'); s.className='lg tgl'+(isOn()?'':' off'); s.innerHTML=html;
  s.title='Click to show / hide';
  s.onclick=()=>{ onToggle(); s.classList.toggle('off', !isOn()); _syncLegendMaster(); };
  el.appendChild(s); _legendChips.push({el:s,isOn,toggle:onToggle}); return s;
}
function buildLegend(){
  const el=document.getElementById('legend');
  el.innerHTML='<b>PROTECTED-AREA LAYERS · click to hide / show</b>';
  el.insertAdjacentHTML('afterbegin',
    '<label class="lg" style="width:100%;cursor:pointer;user-select:none;margin-bottom:2px;color:#eaf0ff">'+
    '<input type="checkbox" id="legend-all" checked style="accent-color:#8fe3a8;margin:0 7px 0 0;cursor:pointer;vertical-align:-2px">select / unselect all</label>');
  document.getElementById('legend-all').onchange=e=>{ const on=e.target.checked;
    _legendChips.forEach(c=>{ if(c.toggle && c.isOn()!==on) c.toggle(); });
    refreshLegendChips(); _syncLegendMaster(); };
  const EARTH_SW={city:'#e8b45f',peak:'#e8dcc8',port:'#7fd8e8',sea:'#5f96e8'};
  const FUNGI_SW={0:'#ff7ab8',1:'#c98cff'};
  let earthHeadDone=false, oecmHeadDone=false, fungiHeadDone=false, fi=0;
  _clouds.forEach((cl,ci)=>{
    let sw;
    if(cl.kind==='oecm'){ if(!oecmHeadDone){ el.insertAdjacentHTML('beforeend','<b style="margin-top:6px">OTHER CONSERVATION (WD-OECM) · click to hide / show</b>'); oecmHeadDone=true; }
      sw='<span class="sw" style="background:#ff9d5c;border-radius:50%"></span>'; }
    else if(cl.kind==='fungi'){ if(!fungiHeadDone){ el.insertAdjacentHTML('beforeend','<b style="margin-top:6px">FUNGAL BIODIVERSITY (SPUN) · click to hide / show</b>'); fungiHeadDone=true; }
      sw=`<span class="sw" style="background:${FUNGI_SW[fi++]};border-radius:50%"></span>`; }
    else if(cl.kind){ if(!earthHeadDone){ el.insertAdjacentHTML('beforeend','<b style="margin-top:6px">EARTH LAYERS · click to hide / show</b>'); earthHeadDone=true; }
      sw=`<span class="sw" style="background:${EARTH_SW[cl.kind]};border-radius:50%"></span>`; }
    else sw = ci<GROUPS.length
      ? `<span class="sw" style="background:hsl(120,55%,${Math.round(GROUPS[ci].l*100)}%)"></span>`
      : `<span class="sw" style="background:#${SPECIALS[ci-GROUPS.length].color.toString(16)};border-radius:50%"></span>`;
    mkToggle(el, sw+cl.label+` <span style="color:#8ea3cf">${cl.idxs.length.toLocaleString()}</span>`,
      ()=>cl.pts.visible, ()=>{ cl.pts.visible=!cl.pts.visible; });
  });
  if(_lines.length){
    el.insertAdjacentHTML('beforeend','<b style="margin-top:6px">OCEANS &amp; MARITIME CARTOGRAPHY · click to hide / show</b>');
    _lines.forEach(ln=>{
      const sw=`<span class="sw" style="background:${ln.sw}"></span>`;
      mkToggle(el, sw+ln.label, ()=>ln.obj.visible, ()=>{ ln.obj.visible=!ln.obj.visible; });
    });
  }
  el.insertAdjacentHTML('beforeend','<span class="lg" style="width:100%;margin-top:4px;color:#cbd6ff">greens = land &amp; coast · blues = marine · isobaths deepen with depth · one dot = one record</span>');
}
function updateHud(){
  const nF=(typeof FUNGI!=='undefined')?FUNGI.length.toLocaleString():0;
  document.getElementById('hud').innerHTML=
    `${PP.length.toLocaleString()} protected areas${(typeof PP_OECM!=='undefined'?' + '+PP_OECM.length.toLocaleString()+' OECMs':'')} (Protected Planet) · ${nF} mycorrhizal-fungi hotspots (SPUN)<br/>`+
    `${(typeof CITIES!=='undefined'?CITIES.length.toLocaleString():0)} cities · ${(typeof PEAKS!=='undefined'?PEAKS.length.toLocaleString():0)} peaks · ports · seas · bathymetry &amp; maritime borders · 3D terrain · tap any dot`;
}

/* ===================== SEARCH ===================== */
const q=document.getElementById('q');
let _searchHits=[], _searchN=0;
function searchSources(){ const src=[{arr:PP,n:8,kind:'pp'}];
  if(typeof PP_OECM!=='undefined') src.push({arr:PP_OECM,n:8,kind:'oecm'});
  if(typeof CITIES!=='undefined') src.push({arr:CITIES,n:3,kind:'city'});
  if(typeof PEAKS!=='undefined') src.push({arr:PEAKS,n:3,kind:'peak'});
  if(typeof PORTS!=='undefined') src.push({arr:PORTS,n:2,kind:'port'});
  if(typeof SEAS!=='undefined') src.push({arr:SEAS,n:2,kind:'sea'});
  return src; }
q.addEventListener('keydown',e=>{ if(e.key!=='Enter') return; const term=q.value.trim().toLowerCase(); if(!term) return;
  if(_searchHits.term!==term){
    _searchHits=[];
    for(const src of searchSources())
      src.arr.forEach((it,i)=>{ const nm=it[src.n]; if(nm && (''+nm).toLowerCase().includes(term)) _searchHits.push({src,i}); });
    _searchHits.term=term; _searchN=0;
  }
  if(!_searchHits.length) return;
  const hit=_searchHits[_searchN%_searchHits.length]; _searchN++;
  const it=hit.src.arr[hit.i];
  flyToLL(it[0],it[1]);
  showSite({cl:{kind:hit.src.kind,idxs:[hit.i],data:hit.src.arr}, i:0});
});
/* legend button + references button */
const legendBtn=document.getElementById('legend-btn'), legendEl=document.getElementById('legend');
if(legendBtn&&legendEl) legendBtn.onclick=()=>{ legendEl.classList.toggle('open'); legendBtn.classList.toggle('open', legendEl.classList.contains('open')); };
const citeBtn=document.getElementById('cite-btn'), citeBody=document.getElementById('cite-body');
if(citeBtn&&citeBody) citeBtn.onclick=()=>{ citeBody.hidden=!citeBody.hidden; citeBtn.classList.toggle('open',!citeBody.hidden); };
window.addEventListener('resize',()=>{ if(Graph){Graph.width(elGraph.clientWidth).height(elGraph.clientHeight);} });
boot();
