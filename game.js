import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.166.1/build/three.module.js';

const $ = (id) => document.getElementById(id);
const canvas = $('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.7));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(54, innerWidth / innerHeight, .1, 220);
const clock = new THREE.Clock();
const themes = [
  {name:'ABANDONED CITY', sky:0x101b2a, ground:0x26343a, fog:0x17232c, glow:0x75dfbd, accent:0xd9a56d, objective:'Find the three city keys', location:'SECTOR 01 · OUTER RING'},
  {name:'DIGITAL NIGHTMARE', sky:0x100e2b, ground:0x211d3d, fog:0x17142e, glow:0x69f3dc, accent:0xf35cba, objective:'Destroy the corrupted echoes', location:'SECTOR 02 · NULL SPACE'},
  {name:'FORGOTTEN DESERT', sky:0x30202a, ground:0x624638, fog:0x3c2b31, glow:0xffd18a, accent:0xe98e6b, objective:'Recover the buried relic', location:'SECTOR 03 · THE PALE DUNES'},
  {name:'COSMIC ABYSS', sky:0x0b1630, ground:0x202c48, fog:0x111a31, glow:0x94b9ff, accent:0xd184ff, objective:'Open the astral portal', location:'SECTOR 04 · EVENT HORIZON'},
  {name:'CITADEL ULTITANKIST_RUT', sky:0x170b16, ground:0x30212a, fog:0x1d101b, glow:0xff8c79, accent:0xf14f59, objective:'Defeat ULTITANKIST_RUT', location:'SECTOR 05 · THE LAST ROOM'}
];
let world=0, player, floor, worldGroup, objects=[], enemies=[], projectiles=[], decorations=[], boss=null;
let hp=100, artifactPieces=0, keysFound=0, enemiesDefeated=0, bossHp=100, bossPhase=0, bossAttack=0, toastTimer=0, dialogueTimer=0, invuln=0, dashCooldown=0, interactTarget=null, gameStarted=false, ending=false;
let lastShot=0, frame=0, screenShake=0, gameTime=0, secretUnlocked=false, worldCompleting=false, moveVector=new THREE.Vector2(), mobileVector=new THREE.Vector2();
const keys={};
const mats={};
function material(color, rough=.72, metal=0, emissive=0, intensity=0){return new THREE.MeshStandardMaterial({color,roughness:rough,metalness:metal,emissive,emissiveIntensity:intensity});}
function addMesh(parent,geometry,mat,pos,scale){const m=new THREE.Mesh(geometry,mat);if(pos)m.position.set(...pos);if(scale)m.scale.set(...scale);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
function glowMaterial(color,intensity=2){return new THREE.MeshBasicMaterial({color,transparent:true,opacity:.94});}
function makeLabel(text,color='#d8fff1'){
 const c=document.createElement('canvas');c.width=512;c.height=128;const x=c.getContext('2d');x.font='500 30px monospace';x.textAlign='center';x.fillStyle=color;x.shadowColor=color;x.shadowBlur=18;x.fillText(text,256,69);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;const s=new THREE.Sprite(new THREE.SpriteMaterial({map:t,transparent:true,depthWrite:false}));s.scale.set(3.2,.8,1);return s;
}
function makePlayer(){
 player=new THREE.Group();scene.add(player);player.position.set(0,0,9);
 const body=addMesh(player,new THREE.CapsuleGeometry(.43,.9,5,10),material(0x293d49,.47,.3),[0,1.05,0]);
 body.rotation.z=-.03;
 addMesh(player,new THREE.SphereGeometry(.31,16,12),material(0xc3e6d9,.3,.2,0x457a68,.7),[0,1.9,-.04]);
 addMesh(player,new THREE.BoxGeometry(.78,.32,.5),material(0x496b6d,.48,.35),[0,1.28,-.02]);
 addMesh(player,new THREE.CylinderGeometry(.12,.17,.35,8),material(0xa6e9c9,.3,.2,0x65efb9,1.4),[0,1.33,-.32]).rotation.x=Math.PI/2;
 const gun=addMesh(player,new THREE.BoxGeometry(.16,.18,.72),material(0x91b6a8,.32,.55),[.25,1.18,-.56]);gun.rotation.x=-.07;
 addMesh(player,new THREE.SphereGeometry(.5,16,10),new THREE.MeshBasicMaterial({color:0x89e2be,transparent:true,opacity:.085}),[0,1,0]);
}
function resetWorld(stage){
 if(worldGroup)scene.remove(worldGroup);
 world=stage;worldCompleting=false;boss=null;objects=[];enemies=[];projectiles=[];decorations=[];worldGroup=new THREE.Group();scene.add(worldGroup);
 const t=themes[world];scene.background=new THREE.Color(t.sky);scene.fog=new THREE.Fog(t.fog,25,78);
 while(worldGroup.children.length)worldGroup.remove(worldGroup.children[0]);
 const floorMat=material(t.ground,.9,.03);floor=addMesh(worldGroup,new THREE.PlaneGeometry(90,90),floorMat,[0,-.08,0]);floor.rotation.x=-Math.PI/2;floor.receiveShadow=true;
 const grid=new THREE.GridHelper(90,45, t.glow, t.glow);grid.position.y=-.065;grid.material.transparent=true;grid.material.opacity=world===2?.1:.13;worldGroup.add(grid);
 scene.children.filter(c=>c.userData.ambient).forEach(c=>scene.remove(c));
 const hemi=new THREE.HemisphereLight(0xbde9e3,0x171622,1.8);hemi.userData.ambient=true;scene.add(hemi);
 const sun=new THREE.DirectionalLight(world===2?0xa9a2ff:0xffe6c6,3);sun.position.set(-9,18,8);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);sun.shadow.camera.left=-23;sun.shadow.camera.right=23;sun.shadow.camera.top=23;sun.shadow.camera.bottom=-23;sun.userData.ambient=true;scene.add(sun);
 const point=new THREE.PointLight(t.glow,20,22);point.position.set(0,5,-4);point.userData.ambient=true;scene.add(point);
 player.position.set(0,0,9);player.rotation.y=0;
 buildSet();
 if(world===0)spawnPickup(-8, -8,'KEY','KEY 01');
 if(world===0)spawnPickup(8, -12,'KEY','KEY 02');
 if(world===0)spawnPickup(0, -16,'KEY','KEY 03');
 if(world===1){for(let i=0;i<5;i++)spawnEnemy(-10+(i%3)*10,-9-Math.floor(i/3)*11,0x77ffe4,false);}
 if(world===2)spawnPickup(7,-14,'RELIC','BURIED RELIC');
 if(world===3)spawnPortal();
 if(world===4){spawnBoss();spawnPickup('SECRET',11,-7,'SAVE FILE');}
 updateHUD();
}
function buildSet(){
 const t=themes[world];
 // broken skyline and monumental silhouettes
 for(let i=0;i<18;i++){
  const side=i%4, lane=Math.floor(i/4), x=side<2?(side===0?-1:1)*(18+Math.random()*9):(-17+lane*11), z=side>=2?(side===2?-1:1)*(18+Math.random()*8):(-18+lane*12);
  const h=3+Math.random()*9,w=1.5+Math.random()*3;
  const geo=world===2?new THREE.ConeGeometry(w,h,5):new THREE.BoxGeometry(w,h,1.8+Math.random()*2);
  const mm=material(world===2?0x8a6148:(world===1?0x39385a:0x35434a),.84,.12);
  const ob=addMesh(worldGroup,geo,mm,[x,h/2-.05,z]);ob.rotation.y=Math.random()*Math.PI;ob.rotation.z=(Math.random()-.5)*.11;
  if(world===0||world===1||world===3){const strip=addMesh(worldGroup,new THREE.BoxGeometry(.045,h*.7,.05),glowMaterial(t.glow),[x-w*.25,h*.48,z-1.0]);strip.material.opacity=.65;}
 }
 // orbiting monoliths / far stars
 const starGeo=new THREE.BufferGeometry(), starPos=[];for(let i=0;i<420;i++)starPos.push((Math.random()-.5)*170,8+Math.random()*85,(Math.random()-.5)*170);starGeo.setAttribute('position',new THREE.Float32BufferAttribute(starPos,3));const stars=new THREE.Points(starGeo,new THREE.PointsMaterial({color:world===2?0x9ea0ff:0xd4e7e5,size:.16,transparent:true,opacity:.68}));worldGroup.add(stars);
 // lit pylons around arena
 for(let i=0;i<8;i++){const a=i*Math.PI/4;const x=Math.cos(a)*13,z=Math.sin(a)*13;const p=addMesh(worldGroup,new THREE.CylinderGeometry(.14,.28,2.1,6),material(0x37484d,.3,.5),[x,1,z]);const orb=addMesh(worldGroup,new THREE.OctahedronGeometry(.26),glowMaterial(t.glow),[x,2.22,z]);orb.userData.float=true;}
 // broken slabs
 for(let i=0;i<9;i++){const x=(Math.random()-.5)*26,z=(Math.random()-.5)*24; if(Math.abs(x)<4&&z>2)continue;const slab=addMesh(worldGroup,new THREE.BoxGeometry(1+Math.random()*2,.28,.8+Math.random()*2),material(0x4c5a59,.88,.12),[x,.16,z]);slab.rotation.y=Math.random()*3;}
}
function spawnPickup(kind,x,z,label){
 const group=new THREE.Group();worldGroup.add(group);group.position.set(x,0,z);const color=kind==='KEY'?themes[world].glow:kind==='SECRET'?0xff8cf5:0xffd08a;
 const gem=addMesh(group,new THREE.OctahedronGeometry(.55,0),glowMaterial(color),[0,1,0]);gem.userData.pickup=true;
 const ring=addMesh(group,new THREE.TorusGeometry(.78,.035,8,36),glowMaterial(color),[0,1,0]);ring.rotation.x=Math.PI/2;
 const beam=addMesh(group,new THREE.CylinderGeometry(.02,.38,3.8,16,1,true),new THREE.MeshBasicMaterial({color,transparent:true,opacity:.11,side:THREE.DoubleSide}),[0,2.7,0]);
 const sprite=makeLabel(label,kind==='KEY'?'#adf7d8':kind==='SECRET'?'#ff9cf2':'#ffe0a2');sprite.position.set(0,2.1,0);group.add(sprite);
 group.userData={kind,label,active:true,baseY:0};objects.push(group);
}
function spawnEnemy(x,z,color=0x75ffe2,decoy=false){
 const g=new THREE.Group();worldGroup.add(g);g.position.set(x,0,z);
 addMesh(g,new THREE.OctahedronGeometry(.72,1),material(decoy?0x4d4b8a:0x313a55,.28,.45,color,2),[0,1,0]);
 addMesh(g,new THREE.SphereGeometry(.24,14,12),glowMaterial(decoy?0x7376ff:color),[0,1,0]);
 for(let j=0;j<3;j++){const r=addMesh(g,new THREE.TorusGeometry(.82+j*.12,.028,6,36),glowMaterial(color),[0,1,0]);r.rotation.x=Math.PI/2+j*.45;}
 g.userData={health:decoy?1:2,decoy,baseX:x,baseZ:z,phase:Math.random()*6,attack:1+Math.random()*2};enemies.push(g);return g;
}
function spawnPortal(){
 const g=new THREE.Group();worldGroup.add(g);g.position.set(0,0,-13);
 const torus=addMesh(g,new THREE.TorusGeometry(2.4,.15,12,64),glowMaterial(themes[world].glow),[0,3,0]);
 const inner=addMesh(g,new THREE.CircleGeometry(2.22,48),new THREE.MeshBasicMaterial({color:0x5b8eff,transparent:true,opacity:.25,side:THREE.DoubleSide}),[0,3,0]);
 const ring2=addMesh(g,new THREE.TorusGeometry(1.82,.028,8,60),glowMaterial(0xdac6ff),[0,3,0]);ring2.rotation.z=.4;
 addMesh(g,new THREE.BoxGeometry(5,.25,.5),material(0x4b5872,.3,.65),[0,.13,0]);
 const label=makeLabel('ASTRAL GATE · E TO OPEN','#d7d4ff');label.position.set(0,6.1,0);g.add(label);g.userData={kind:'PORTAL'};objects.push(g);
}
function spawnBoss(){
 boss=new THREE.Group();worldGroup.add(boss);boss.position.set(0,0,-12);
 const dark=material(0x33303c,.28,.68,0x360b18,.6), red=glowMaterial(0xff3f57);
 addMesh(boss,new THREE.CapsuleGeometry(1.55,2.05,6,12),dark,[0,2.15,0]);
 addMesh(boss,new THREE.BoxGeometry(4.5,.75,1.4),dark,[0,2.1,0]);
 addMesh(boss,new THREE.SphereGeometry(.8,20,16),material(0x641f2e,.22,.35,0xf23043,2),[0,3.65,-.08]);
 addMesh(boss,new THREE.SphereGeometry(.39,16,12),red,[0,3.65,-.68]);
 for(const side of [-1,1]){
  const arm=addMesh(boss,new THREE.CylinderGeometry(.48,.68,2.1,8),dark,[side*2.35,1.62,0]);arm.rotation.z=side*-.22;
  const claw=addMesh(boss,new THREE.ConeGeometry(.42,.9,6),red,[side*2.45,.42,-.05]);claw.rotation.x=Math.PI;
  addMesh(boss,new THREE.ConeGeometry(.26,1.45,5),dark,[side*1.25,4.35,.2]);
 }
 for(let i=0;i<4;i++){const ring=addMesh(boss,new THREE.TorusGeometry(2.15+i*.26,.028,6,60),glowMaterial(0xfb5366),[0,2.5,0]);ring.rotation.x=i*.6;}
 const label=makeLabel('ULTITANKIST_RUT','#ff9ca0');label.scale.set(5,.9,1);label.position.set(0,5.6,0);boss.add(label);
 boss.userData={attack:2.1,baseY:0,teleport:0};bossHp=100;bossPhase=0;bossAttack=0;
}
function projectile(from,to,enemy=false){
 const color=enemy?(bossPhase===2?0xff2746:0xf061d0):0xa4ffda;
 const mesh=addMesh(worldGroup,new THREE.SphereGeometry(enemy?.16:.11,10,8),glowMaterial(color),from.toArray());
 const trail=addMesh(worldGroup,new THREE.SphereGeometry(enemy?.32:.2,10,8),new THREE.MeshBasicMaterial({color,transparent:true,opacity:.18}),from.toArray());
 const d=new THREE.Vector3().subVectors(to,from).normalize();projectiles.push({mesh,trail,dir:d,speed:enemy?12:35,life:enemy?4:1.6,enemy});
}
function updateHUD(){
 const t=themes[world];$('world-name').textContent=t.name;$('world-index').textContent=`0${world+1} / 05`;$('mission-title').textContent=t.objective;$('mission-num').textContent=`0${world+1}`;$('location-label').textContent=t.location;$('artifact-count').innerHTML=`0${artifactPieces} <small>/ 04</small>`;
 let n=0,max=1,label='';
 if(world===0){n=keysFound;max=3;label=`${n} / 3`;}
 if(world===1){n=enemiesDefeated;max=5;label=`${n} / 5`;}
 if(world===2){n=objects.some(o=>o.userData.kind==='RELIC'&&o.userData.active)?0:1;max=1;label=n?'1 / 1':'0 / 1';}
 if(world===3){n=0;max=1;label='READY';}
 if(world===4){n=Math.max(0,100-bossHp);max=100;label=`${Math.round(n)}%`;}
 $('mission-progress').style.width=`${Math.min(100,n/max*100)}%`;$('progress-label').textContent=label;
 $('health-fill').style.width=`${hp}%`;$('health-value').textContent=`${Math.ceil(hp)}%`;$('health-fill').style.background=hp<30?'#ff6469':'#91e4bd';
 $('boss-hud').classList.toggle('hidden',world!==4);if(world===4){$('boss-fill').style.width=`${bossHp}%`;$('boss-fill').style.background=bossPhase===2?'#ff4654':bossPhase===1?'#bd79ff':'#8de7bf';$('boss-phase-label').textContent=['NORMAL FORM','GLITCH FORM','ABSOLUTE FORM'][bossPhase];}
}
function showToast(text){const el=$('toast');el.textContent=text;el.classList.add('show');toastTimer=2.2;}
function showDialogue(text,duration=4){$('dialogue-text').textContent=text;$('boss-dialogue').classList.remove('hidden');dialogueTimer=duration;}
function completeWorld(){
 if(worldCompleting)return;
 worldCompleting=true;
 artifactPieces=Math.min(4,artifactPieces+1);updateHUD();
 showToast(`ANCIENT SEAL FRAGMENT ${artifactPieces}/4 ACQUIRED`);
 if(world<3){setTimeout(()=>{if(!ending){resetWorld(world+1);hp=Math.min(100,hp+24);showToast(`WORLD ${world+1} COMPLETE · SEAL FRAGMENT RECOVERED`);}},1900);}
 else {setTimeout(()=>{if(!ending){showToast('THE CITADEL GATE IS OPEN');resetWorld(4);showDialogue("You've reached the very end... But you didn't think you could defeat ULTITANKIST_RUT, did you?",7);}},1900);}
}
function interact(){
 if(!interactTarget)return;
 const o=interactTarget;
 if(o.userData.kind==='SECRET'){
  o.userData.active=false;o.visible=false;secretUnlocked=true;showToast('HIDDEN SAVE FILE FOUND · SECRET ENDING UNLOCKED');
 } else if(o.userData.kind==='KEY'||o.userData.kind==='RELIC'){
  o.userData.active=false;o.visible=false;
  if(world===0){keysFound++;showToast(`CITY KEY RECOVERED · ${keysFound}/3`);updateHUD();if(keysFound>=3)completeWorld();}
  else {showToast('ANCIENT RELIC RECOVERED');completeWorld();}
 } else if(o.userData.kind==='PORTAL'){
  if(artifactPieces<3){showToast('THE GATE NEEDS THE FIRST THREE SEAL FRAGMENTS');return;}
  o.userData.active=false;o.visible=false;
  showToast('THREE SEALS RESONATE · FOURTH FRAGMENT AWAKENS');completeWorld();
 }
}
function fire(){
 if(!gameStarted||ending||performance.now()-lastShot<245)return;lastShot=performance.now();
 const origin=player.position.clone().add(new THREE.Vector3(0,1.35,0));
 let target=null,dist=100;
 const choices=world===4?[boss]:enemies.filter(e=>!e.userData.decoy||world!==4);
 for(const e of choices){if(!e||!e.visible)continue;const d=e.position.distanceTo(player.position);if(d<dist){dist=d;target=e;}}
 const point=target?target.position.clone().add(new THREE.Vector3(0,1.2,0)):new THREE.Vector3(player.position.x,1.3,-25);
 projectile(origin,point,false);player.rotation.y=Math.atan2(point.x-player.position.x,point.z-player.position.z);
 if(target&&dist<31){
  if(world===4){
   if(bossPhase===1&&Math.random()<.32){showToast('DECOY SIGNATURE — FIND THE REAL ONE');return;}
   damageBoss(24);
  }else damageEnemy(target,1);
 }
}
function damageEnemy(e,amount){e.userData.health-=amount;e.scale.setScalar(.87+Math.random()*.16);screenShake=.1;if(e.userData.health<=0){e.visible=false;enemiesDefeated++;showToast('CORRUPTION CLEARED');if(world===1&&enemiesDefeated>=5)completeWorld();updateHUD();}}
function damageBoss(amount){
 bossHp=Math.max(0,bossHp-amount);screenShake=.18;updateHUD();
 if(bossHp<=0){
  if(bossPhase<2){bossPhase++;bossHp=100;boss.userData.teleport=1.3;showToast(['','GLITCH FORM INITIATED','ABSOLUTE FORM · REALITY COLLAPSING'][bossPhase]);if(bossPhase===1){for(let i=0;i<3;i++){const d=spawnEnemy(-8+i*8,-13,0x8c65ff,true);d.userData.health=999;}}if(bossPhase===2){scene.fog.color.set(0x410c1b);scene.background.set(0x260a16);showDialogue('Reality is only another thing I can break.',3);for(let i=0;i<7;i++){const a=i*Math.PI*2/7;addMesh(worldGroup,new THREE.ConeGeometry(.7,1.8,4),glowMaterial(0xff334d),[Math.cos(a)*12,.9,Math.sin(a)*12]);}}
  }else{showToast('HOSTILE SIGNATURE TERMINATED');setTimeout(()=>finishGame(secretUnlocked),2400);}
 }
}
function finishGame(secret){ending=true;$('hud').classList.add('hidden');$('end-screen').classList.add('visible');$('end-title').textContent=secret?'THE GAME ISN’T OVER':'THE LOOP IS BROKEN';$('end-copy').textContent=secret?'ULTITANKIST_RUT hasn\'t finished his game yet...':'The citadel falls silent. The worlds can finally breathe.';}
function updateInteract(){
 interactTarget=null;let nearest=2.4;
 for(const o of objects){if(!o.visible||!o.userData.active)continue;const d=o.position.distanceTo(player.position);if(d<nearest){nearest=d;interactTarget=o;}}
 $('interact-prompt').classList.toggle('hidden',!interactTarget);
}
function takeDamage(amount){if(invuln>0)return;hp=Math.max(0,hp-amount);invuln=.7;screenShake=.22;updateHUD();if(hp<=0){hp=100;player.position.set(0,0,9);if(world===4)bossHp=Math.min(100,bossHp+15);showToast('SIGNAL REBOOT · VITALS RESTORED');updateHUD();}}
function startGame(){if(gameStarted)return;gameStarted=true;$('start-screen').classList.remove('visible');$('hud').classList.remove('hidden');resetWorld(0);showToast('FIND THREE KEYS TO UNSEAL THE FIRST FRAGMENT');}
$('start-button').addEventListener('click',startGame);$('replay-button').addEventListener('click',()=>location.reload());$('mobile-fire').addEventListener('pointerdown',e=>{e.preventDefault();fire()});$('mobile-use').addEventListener('pointerdown',e=>{e.preventDefault();interact()});$('mobile-dash').addEventListener('pointerdown',e=>{e.preventDefault();dash()});
window.addEventListener('keydown',e=>{keys[e.code]=true;if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault();if(e.code==='Enter'&&!gameStarted)startGame();if(e.code==='KeyE')interact();if(e.code==='Space')fire();if(e.code==='ShiftLeft'||e.code==='ShiftRight')dash();});window.addEventListener('keyup',e=>keys[e.code]=false);canvas.addEventListener('pointerdown',e=>{if(e.pointerType==='mouse')fire();});
function dash(){if(!gameStarted||dashCooldown>0)return;dashCooldown=1.45;invuln=.35;const d=new THREE.Vector3(moveVector.x,0,moveVector.y);if(d.lengthSq()<.1)d.set(0,0,-1);player.position.add(d.normalize().multiplyScalar(5.2));player.position.x=THREE.MathUtils.clamp(player.position.x,-15,15);player.position.z=THREE.MathUtils.clamp(player.position.z,-18,14);showToast('PHASE DASH');}
const stick=$('stick');let stickPointer=null;stick.addEventListener('pointerdown',e=>{stickPointer=e.pointerId;stick.setPointerCapture(e.pointerId);updateStick(e);});stick.addEventListener('pointermove',e=>{if(e.pointerId===stickPointer)updateStick(e)});stick.addEventListener('pointerup',e=>{if(e.pointerId===stickPointer){stickPointer=null;mobileVector.set(0,0);stick.querySelector('span').style.transform='translate(0,0)';}});function updateStick(e){const r=stick.getBoundingClientRect(),dx=e.clientX-(r.left+r.width/2),dy=e.clientY-(r.top+r.height/2),len=Math.min(31,Math.hypot(dx,dy)),a=Math.atan2(dy,dx),x=Math.cos(a)*len,y=Math.sin(a)*len;mobileVector.set(x/31,y/31);stick.querySelector('span').style.transform=`translate(${x}px,${y}px)`;}
function update(dt){
 if(!gameStarted||ending)return;gameTime+=dt;frame++;if(toastTimer>0){toastTimer-=dt;if(toastTimer<=0)$('toast').classList.remove('show');}if(dialogueTimer>0){dialogueTimer-=dt;if(dialogueTimer<=0)$('boss-dialogue').classList.add('hidden');}invuln=Math.max(0,invuln-dt);dashCooldown=Math.max(0,dashCooldown-dt);$('dash-status').textContent=dashCooldown>0?`DASH ${dashCooldown.toFixed(1)}S`:'DASH READY';
 moveVector.set((keys.KeyD||keys.ArrowRight?1:0)-(keys.KeyA||keys.ArrowLeft?1:0)+mobileVector.x,(keys.KeyS||keys.ArrowDown?1:0)-(keys.KeyW||keys.ArrowUp?1:0)+mobileVector.y);if(moveVector.lengthSq()>1)moveVector.normalize();
 const speed=keys.ShiftLeft||keys.ShiftRight?9:6.5;player.position.x+=moveVector.x*speed*dt;player.position.z+=moveVector.y*speed*dt;player.position.x=THREE.MathUtils.clamp(player.position.x,-15,15);player.position.z=THREE.MathUtils.clamp(player.position.z,-18,14);
 if(moveVector.lengthSq()>.02){player.rotation.y=Math.atan2(moveVector.x,-moveVector.y);player.position.y=Math.abs(Math.sin(gameTime*12))*.055;}
 player.visible=invuln<=0||Math.floor(gameTime*18)%2===0;
 updateInteract();
 for(const o of objects){if(!o.visible)continue;o.rotation.y+=dt*.55;o.position.y=.12+Math.sin(gameTime*2.2+o.position.x)*.12;}
 for(const e of enemies){if(!e.visible)continue;const ud=e.userData;ud.phase+=dt; e.position.y=.35+Math.sin(ud.phase*2)*.34;if(world===1){const v=new THREE.Vector3().subVectors(player.position,e.position);if(v.length()>5)e.position.add(v.normalize().multiplyScalar(dt*.95));ud.attack-=dt;if(ud.attack<0){const from=e.position.clone().add(new THREE.Vector3(0,1,0)),to=player.position.clone().add(new THREE.Vector3(0,1,0));projectile(from,to,true);ud.attack=2.8+Math.random()*1.8;}}}
 if(boss){boss.position.y=.13+Math.sin(gameTime*2)*.18;boss.rotation.y=Math.sin(gameTime*.5)*.13;if(boss.userData.teleport>0){boss.userData.teleport-=dt;boss.visible=Math.floor(gameTime*24)%2===0;if(boss.userData.teleport<=0){boss.visible=true;boss.position.x=(Math.random()-.5)*8;}}if(boss.visible){boss.userData.attack-=dt;if(boss.userData.attack<0){const from=boss.position.clone().add(new THREE.Vector3(0,2.5,0)),to=player.position.clone().add(new THREE.Vector3(0,1,0));projectile(from,to,true);boss.userData.attack=bossPhase===2?1.05:bossPhase===1?1.55:2.15;if(bossPhase===2&&Math.random()<.42){projectile(from.clone().add(new THREE.Vector3(1,0,0)),to.clone().add(new THREE.Vector3(5,0,1)),true);projectile(from.clone().add(new THREE.Vector3(-1,0,0)),to.clone().add(new THREE.Vector3(-5,0,-1)),true);}}}}
 for(let i=projectiles.length-1;i>=0;i--){const p=projectiles[i];p.life-=dt;p.mesh.position.addScaledVector(p.dir,p.speed*dt);p.trail.position.copy(p.mesh.position);p.trail.material.opacity=Math.max(0,p.life*.09);if(p.enemy&&p.mesh.position.distanceTo(player.position.clone().add(new THREE.Vector3(0,1,0)))<.9){takeDamage(bossPhase===2?15:10);p.life=0;}if(p.life<=0){worldGroup.remove(p.mesh,p.trail);projectiles.splice(i,1);}}
 for(const c of worldGroup.children){if(c.userData.float)c.rotation.y+=dt*.7;}
 const target=new THREE.Vector3(player.position.x,player.position.y+2.7,player.position.z+9.2);camera.position.lerp(target,1-Math.exp(-4.3*dt));camera.lookAt(player.position.x,1.25,player.position.z-2.7);
 screenShake=Math.max(0,screenShake-dt);if(screenShake>0){camera.position.x+=(Math.random()-.5)*screenShake;camera.position.y+=(Math.random()-.5)*screenShake;}
 if(dashCooldown>0)$('dash-status').style.opacity='.6';else $('dash-status').style.opacity='1';
 if(frame%100===0){$('fps-label').textContent='SYSTEMS NOMINAL';}
}
function animate(){requestAnimationFrame(animate);const dt=Math.min(.04,clock.getDelta());update(dt);renderer.render(scene,camera);}
makePlayer();resetWorld(0);gameStarted=false;animate();
window.addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.7));});
