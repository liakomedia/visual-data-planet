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
      idxs.push(i); const v=llToVec(s[0],s[1],R*1.006);
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
      idxs.push(i); const v=llToVec(s[0],s[1],R*1.012); pos.push(v[0],v[1],v[2]); });
    const geo=new THREE.BufferGeometry();
    geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
    const mat=new THREE.PointsMaterial({size:sp.size, map:dot, color:sp.color, transparent:true, opacity:0.95,
      sizeAttenuation:false, depthWrite:false});
    const pts=new THREE.Points(geo,mat); pts.frustumCulled=false;
    earthGroup.add(pts); _clouds.push({pts,label:sp.label,idxs});
  });
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
  if(typeof CITIES!=='undefined') mk(CITIES,'city','cities',R*1.004,
    (c,it)=>c.setHSL(0.09,0.95,0.50+0.28*Math.min(1,Math.log10(Math.max(1,it[2]))/7.4)),2.6,0.95);
  if(typeof PEAKS!=='undefined') mk(PEAKS,'peak','mountain peaks ≥ 3,500 m',R*1.009,
    (c,it)=>c.setHSL(0.07,0.25,0.62+0.36*Math.min(1,(it[2]-3500)/5000)),2.4,0.95);
  if(typeof PORTS!=='undefined') mk(PORTS,'port','ports',R*1.004,
    (c)=>c.set(0x8fe6f5),2.4,0.95);
  if(typeof SEAS!=='undefined') mk(SEAS,'sea','oceans & seas (named)',R*1.02,
    (c)=>c.set(0x6fa6f8),5.0,0.9);
}
function earthMesh(){
  earthGroup=new THREE.Group();
  const sph=new THREE.Mesh(new THREE.SphereGeometry(R,72,48),
    new THREE.MeshBasicMaterial({map:tex('8k_earth_daymap.jpg')}));
  earthGroup.add(sph);
  const halo=new THREE.Mesh(new THREE.SphereGeometry(R*1.02,48,32),
    new THREE.MeshBasicMaterial({color:0x8fe3a8, transparent:true, opacity:0.05, side:THREE.BackSide, depthWrite:false}));
  earthGroup.add(halo);
  buildClouds();
  buildEarthLayers();
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
  _clouds.forEach(c=>c.pts.visible=true); refreshLegendChips(); _syncLegendMaster();
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
  let earthHeadDone=false;
  _clouds.forEach((cl,ci)=>{
    let sw;
    if(cl.kind){ if(!earthHeadDone){ el.insertAdjacentHTML('beforeend','<b style="margin-top:6px">EARTH LAYERS · click to hide / show</b>'); earthHeadDone=true; }
      sw=`<span class="sw" style="background:${EARTH_SW[cl.kind]};border-radius:50%"></span>`; }
    else sw = ci<GROUPS.length
      ? `<span class="sw" style="background:hsl(120,55%,${Math.round(GROUPS[ci].l*100)}%)"></span>`
      : `<span class="sw" style="background:#${SPECIALS[ci-GROUPS.length].color.toString(16)};border-radius:50%"></span>`;
    mkToggle(el, sw+cl.label+` <span style="color:#8ea3cf">${cl.idxs.length.toLocaleString()}</span>`,
      ()=>cl.pts.visible, ()=>{ cl.pts.visible=!cl.pts.visible; });
  });
  el.insertAdjacentHTML('beforeend','<span class="lg" style="width:100%;margin-top:4px;color:#cbd6ff">greens = land &amp; coast · blues = marine · one dot = one protected area</span>');
}
function updateHud(){
  document.getElementById('hud').innerHTML=
    `${PP.length.toLocaleString()} protected areas (sample of the ~315,000-site WDPA) · 17.6% of land &amp; 8.4% of ocean protected<br/>`+
    `${(typeof CITIES!=='undefined'?CITIES.length.toLocaleString():0)} cities · ${(typeof PEAKS!=='undefined'?PEAKS.length.toLocaleString():0)} peaks · ports &amp; seas · drag to orbit · tap any dot for its data`;
}

/* ===================== SEARCH ===================== */
const q=document.getElementById('q');
let _searchHits=[], _searchN=0;
function searchSources(){ const src=[{arr:PP,n:8,kind:'pp'}];
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
