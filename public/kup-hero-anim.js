(function(){
  const canvas = document.getElementById('scene');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isMobile = window.matchMedia('(max-width:760px)').matches;

  let renderer;
  try{
    renderer = new THREE.WebGLRenderer({canvas, antialias:true, alpha:true, powerPreference:'high-performance'});
  }catch(e){
    document.body.classList.add('no-webgl');
    return;
  }
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio||1));
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xfef6f9, 13, 26);

  const camera = new THREE.PerspectiveCamera(46, 1, 0.1, 100);
  camera.position.set(0,0,6.4);

  scene.add(new THREE.AmbientLight(0xffffff, 0.82));
  const dir = new THREE.DirectionalLight(0xffffff, 0.85);
  dir.position.set(4, 7, 8);
  scene.add(dir);
  const hemi = new THREE.HemisphereLight(0xffffff, 0xfad1df, 0.45);
  scene.add(hemi);

  /* ---- post-it "content card" texture (white card + faint content, tinted pink per-instance) ---- */
  function roundRect(ctx,x,y,w,h,r){
    ctx.beginPath();
    ctx.moveTo(x+r,y);
    ctx.arcTo(x+w,y,x+w,y+h,r);
    ctx.arcTo(x+w,y+h,x,y+h,r);
    ctx.arcTo(x,y+h,x,y,r);
    ctx.arcTo(x,y,x+w,y,r);
    ctx.closePath();
  }
  function makeCardTexture(){
    const s=256, c=document.createElement('canvas'); c.width=c.height=s;
    const x=c.getContext('2d');
    x.clearRect(0,0,s,s);
    roundRect(x,16,16,224,224,30); x.fillStyle='#ffffff'; x.fill();
    // media block
    roundRect(x,34,34,188,104,18); x.fillStyle='#fef6f9'; x.fill();
    // play glyph
    x.fillStyle='#e52364';
    x.beginPath(); x.moveTo(118,72); x.lineTo(118,100); x.lineTo(144,86); x.closePath(); x.fill();
    // avatar + handle
    x.fillStyle='#fad1df'; x.beginPath(); x.arc(52,168,13,0,Math.PI*2); x.fill();
    roundRect(x,74,161,86,12,6); x.fillStyle='#e5e8eb'; x.fill();
    // caption lines
    x.fillStyle='#f2f4f6';
    roundRect(x,34,192,170,11,5); x.fill();
    roundRect(x,34,210,120,11,5); x.fill();
    const t=new THREE.CanvasTexture(c);
    t.anisotropy = renderer.capabilities.getMaxAnisotropy();
    return t;
  }

  const N = isMobile ? 1300 : 2600;
  const R = 5.0;
  const geo = new THREE.PlaneGeometry(1,1);
  const mat = new THREE.MeshStandardMaterial({
    map:makeCardTexture(), transparent:false, alphaTest:0.5,
    roughness:0.9, metalness:0.0, side:THREE.DoubleSide
  });
  const mesh = new THREE.InstancedMesh(geo, mat, N);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  const group = new THREE.Group();
  group.add(mesh);
  group.rotation.x = -0.14;
  scene.add(group);

  /* ---- per-instance data (Fibonacci sphere) ---- */
  const pos=[], quat=[], size=[], thr=[], normal=[];
  const golden = Math.PI*(3-Math.sqrt(5));
  const up = new THREE.Vector3(0,0,1);
  const pinks = [0xe52364,0xe9497e,0xef769f,0x920736,0xf4a4bf,0xfad1df].map(h=>new THREE.Color(h));

  // build, then pick "hero" cards = frontmost (largest z) so they face the camera at start
  const tmp=[];
  for(let i=0;i<N;i++){
    const y = 1-(i/(N-1))*2;
    const rr = Math.sqrt(Math.max(0,1-y*y));
    const th = i*golden;
    const dirv = new THREE.Vector3(Math.cos(th)*rr, y, Math.sin(th)*rr);
    tmp.push({i, dirv, z:dirv.z});
  }
  // choose ~26 hero indices spread across the front hemisphere
  const front = tmp.slice().sort((a,b)=>b.z-a.z).slice(0, 220);
  const heroSet = new Set();
  const HERO = 26;
  for(let k=0;k<HERO;k++){ heroSet.add(front[Math.floor(k*front.length/HERO)].i); }

  const q1=new THREE.Quaternion(), q2=new THREE.Quaternion();
  const nOff=new THREE.Vector3();
  const mLook=new THREE.Matrix4(), eye=new THREE.Vector3(), tgt=new THREE.Vector3(), wUp=new THREE.Vector3();
  for(let i=0;i<N;i++){
    const d = tmp[i].dirv;
    const p = d.clone().multiplyScalar(R);
    normal.push(d.clone());
    // small layering offset along the normal so notes look stacked (kept subtle for a clean rim)
    nOff.copy(d).multiplyScalar((Math.random()-0.5)*0.06);
    p.add(nOff);
    pos.push(p);

    // orient the card's front (+z) to look at the sphere's center — same aim for every card
    wUp.set(0,1,0);
    if(Math.abs(d.dot(wUp))>0.98) wUp.set(1,0,0);   // avoid degenerate roll near the poles
    eye.copy(p);
    tgt.copy(p).add(d);                              // -z points outward, so +z faces the core
    mLook.lookAt(eye, tgt, wUp);
    const qf = new THREE.Quaternion().setFromRotationMatrix(mLook);
    quat.push(qf);

    size.push(0.44 + Math.random()*0.14);
    thr.push(heroSet.has(i) ? 0 : 0.07 + Math.random()*0.5);

    mesh.setColorAt(i, pinks[(Math.random()*pinks.length)|0]);
  }
  mesh.instanceColor.needsUpdate = true;

  /* ---- float some cards off the surface (like the marked ones) ---- */
  const FLOAT = 32;
  const floats = [];
  for(let k=0;k<FLOAT;k++){
    const idx = Math.floor((k+0.5)/FLOAT * N);
    const dist = R + 0.4 + Math.random()*0.9;        // sit 0.4~1.3 outside the surface
    pos[idx].copy(normal[idx]).multiplyScalar(dist); // push straight out; still faces the core
    size[idx] = 0.52 + Math.random()*0.14;           // a touch larger so they read as distinct
    thr[idx] = 0.22 + Math.random()*0.18;            // reveal along with the crowd
    floats.push({
      idx, dist,
      phase: Math.random()*Math.PI*2,
      amp:   0.14 + Math.random()*0.20,              // gentle bob distance
      speed: 0.35 + Math.random()*0.45               // slow, varied
    });
  }

  /* ---- assembly per scroll progress ---- */
  const M=new THREE.Matrix4(), sc=new THREE.Vector3(), vF=new THREE.Vector3();
  function smoothstep(a,b,x){ x=Math.max(0,Math.min(1,(x-a)/(b-a))); return x*x*(3-2*x); }
  function easeInOut(x){ return x<.5 ? 4*x*x*x : 1-Math.pow(-2*x+2,3)/2; }

  function scaleFor(idx, p, heroLerp){
    const isHero = thr[idx]===0;
    const reveal = isHero ? 1 : smoothstep(thr[idx], thr[idx]+0.16, p);
    let s = size[idx]*reveal*(isHero?heroLerp:1);
    return s<0.0008 ? 0.0001 : s;
  }

  function buildMatrices(p){
    const heroLerp = 1.7 - 0.7*smoothstep(0,0.32,p); // hero cards start big, settle in
    for(let i=0;i<N;i++){
      const s = scaleFor(i, p, heroLerp);
      sc.set(s,s,s);
      M.compose(pos[i], quat[i], sc);
      mesh.setMatrixAt(i, M);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }
  buildMatrices(0);

  // gently bob only the floating cards along their outward normal
  function updateFloats(p, t){
    const heroLerp = 1.7 - 0.7*smoothstep(0,0.32,p);
    for(const f of floats){
      const s = scaleFor(f.idx, p, heroLerp);
      const dist = f.dist + Math.sin(t*f.speed + f.phase)*f.amp;
      vF.copy(normal[f.idx]).multiplyScalar(dist);
      sc.set(s,s,s);
      M.compose(vF, quat[f.idx], sc);
      mesh.setMatrixAt(f.idx, M);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }

  /* ---- scroll + pointer ---- */
  let progress=0, lastBuilt=-1, spin=0;
  let mx=0,my=0,tmx=0,tmy=0;

  const heroEl=document.getElementById('hero');
  const heroBlock=document.getElementById('heroBlock');
  const endline=document.getElementById('endline');
  const hint=document.getElementById('hint');
  const hd=document.getElementById('hd');

  function updateProgress(){
    const rect=heroEl.getBoundingClientRect();
    const total=heroEl.offsetHeight-window.innerHeight;
    progress = Math.max(0, Math.min(1, (-rect.top)/total));
    // overlay text choreography
    heroBlock.style.opacity = 1 - smoothstep(0.42,0.66,progress);
    heroBlock.style.transform = `translateY(${-progress*40}px)`;
    endline.style.opacity = smoothstep(0.6,0.9,progress);
    hint.style.opacity = 1 - smoothstep(0.02,0.12,progress);
    hd.classList.toggle('solid', window.scrollY>40);
  }
  window.addEventListener('scroll', updateProgress, {passive:true});

  if(!reduced && !isMobile){
    window.addEventListener('pointermove', e=>{
      tmx=(e.clientX/window.innerWidth-0.5);
      tmy=(e.clientY/window.innerHeight-0.5);
    });
  }

  function resize(){
    const w=window.innerWidth, h=window.innerHeight;
    renderer.setSize(w,h,false);
    camera.aspect=w/h; camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);
  resize(); updateProgress();

  /* ---- render loop ---- */
  function frame(){
    if(Math.abs(progress-lastBuilt)>0.0009){ buildMatrices(progress); lastBuilt=progress; }

    const pe=easeInOut(progress);
    const d = 6.4 + (15.6-6.4)*pe;              // dolly out: few big cards -> whole globe
    mx += (tmx-mx)*0.05; my += (tmy-my)*0.05;
    const par = 1-progress;                     // fade parallax so the globe lands dead-center
    camera.position.set(mx*0.7*par, -my*0.5*par, d);
    camera.lookAt(0,0,0);

    // shrink the assembled globe to ~50% once it's formed
    group.scale.setScalar(1 - 0.5*smoothstep(0.55,1.0,progress));

    if(!reduced) spin += 0.0012;
    group.rotation.y = spin + progress*0.9;
    group.rotation.x = -0.14 + progress*0.05;

    if(!reduced) updateFloats(progress, performance.now()*0.001);

    renderer.render(scene,camera);
    requestAnimationFrame(frame);
  }
  frame();
})();
