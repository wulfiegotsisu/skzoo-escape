'use strict';
/* SKZOO Escape — browser game; no external JS dependencies. */
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const W = canvas.width, H = canvas.height;
const T = 48, COLS = 39, ROWS = 29, WORLD_W = T * COLS, WORLD_H = T * ROWS;
const TWO_PI = Math.PI * 2;
const FRIENDS = [
  {id:'leebit',name:'Leebit'}, {id:'dwaekki',name:'Dwaekki'},
  {id:'jiniret',name:'Jiniret'}, {id:'han_quokka',name:'Han Quokka'},
  {id:'bbokari',name:'BbokAri'}, {id:'puppym',name:'PuppyM'},
  {id:'foxiny',name:'FoxI.Ny'}
];
const ITEM_NAMES = {boost:'Dash potion',vanish:'Smoke charm',radar:'Echo lantern'};
const $ = s=>document.querySelector(s);
const ui = {
 keys:$('#keyCount'), rescued:$('#rescuedCount'), hearts:$('#hearts'), progress:$('#progressFraction'),
 phase:$('#phaseStatus'), objective:$('#objectiveTag'), chapter:$('#chapterTag'),
 arrow:$('#targetArrow'), target:$('#targetLabel'), distance:$('#targetDistance'),
 stamina:$('#staminaFill'), staminaPct:$('#staminaPct'), hint:$('#interactionHint'),
 interact:$('#interactText'), mapLegend:$('#mapLegend'), toast:$('#toastContainer'),
 menu:$('#menuOverlay'), pause:$('#pauseOverlay'), end:$('#endOverlay'),
 endTitle:$('#endTitle'), endDescription:$('#endDescription'), endEyebrow:$('#endEyebrow'),
 endChars:$('#endCharacters'), endStats:$('#endStats')
};
const sprites={};
const bossSprites=[];
for(let i=1;i<=7;i++){const img=new Image();img.src=`assets/bosses/jyp_${i}.png`;bossSprites.push(img);}
for(const k of ['wolf_chan',...FRIENDS.map(f=>f.id)]){
 const img = new Image(); img.src=`assets/faces/${k}.png`; sprites[k]=img;
}
for(const f of FRIENDS){
 const el=document.createElement('div'); el.className='portrait'; el.id=`portrait-${f.id}`; el.title=`${f.name} — still trapped`;
 el.innerHTML=`<img src="assets/faces/${f.id}.png" alt="${f.name}"><span class="portrait-tick">✓</span>`;
 $('#friendPortraits').append(el);
}
const music={enabled:true,context:null,master:null,drone:[],ambient:null,escapeGain:null,escapeMode:false,nextBeat:0,beatNumber:0,percussion:null,dripAt:0,creepAt:0,dripEcho:null,dripFeedback:null,creepStep:0};
// All background audio is an original WebAudio composition: nothing is streamed or downloaded.
function audioStart(){
 try{
   if(!music.context){
     const a=music.context=new (window.AudioContext||window.webkitAudioContext)();
     music.master=a.createGain();music.master.gain.value=music.enabled?.72:0;music.master.connect(a.destination);
     music.ambient=a.createGain();music.ambient.gain.value=.9;music.ambient.connect(music.master);
     music.escapeGain=a.createGain();music.escapeGain.gain.value=.0001;music.escapeGain.connect(music.master);
     for(const f of [54.99,82.41,110.0]){
       const o=a.createOscillator(),g=a.createGain();o.type=f===110?'triangle':'sine';o.frequency.value=f;
       g.gain.value=f<60?.024:f<90?.010:.0025;o.connect(g);g.connect(music.ambient);o.start();music.drone.push(g);
     }
     // Low-frequency filtered wind, looped without clicks.
     const length=a.sampleRate*4, buf=a.createBuffer(1,length,a.sampleRate), samples=buf.getChannelData(0);
     let drift=0;for(let i=0;i<length;i++){drift=drift*.995+(Math.random()*2-1)*.005;samples[i]=drift*.9+(Math.random()*2-1)*.035;}
     const wind=a.createBufferSource();wind.buffer=buf;wind.loop=true;
     const filter=a.createBiquadFilter();filter.type='lowpass';filter.frequency.value=430;
     const windGain=a.createGain();windGain.gain.value=.38;wind.connect(filter);filter.connect(windGain);windGain.connect(music.ambient);wind.start();
     const percussion=a.createBuffer(1,Math.floor(a.sampleRate*.32),a.sampleRate);const noise=percussion.getChannelData(0);
     for(let i=0;i<noise.length;i++)noise[i]=(Math.random()*2-1)*Math.exp(-i/(a.sampleRate*.13));
     music.percussion=percussion;
     // Echoing water in a resonant cavern: independent dry sound and delayed reflections.
     music.dripEcho=a.createDelay(.7);music.dripEcho.delayTime.value=.23;
     music.dripFeedback=a.createGain();music.dripFeedback.gain.value=.26;
     const echoLowpass=a.createBiquadFilter();echoLowpass.type='lowpass';echoLowpass.frequency.value=1400;
     music.dripEcho.connect(echoLowpass);echoLowpass.connect(music.dripFeedback);
     music.dripFeedback.connect(music.dripEcho);echoLowpass.connect(music.ambient);
     music.dripAt=a.currentTime+.65;music.creepAt=a.currentTime+1.2;
     // Slow, gently wavering cavern notes, beneath the water drops.
     for(const [f,vol,rate] of [[146.83,.0058,.13],[155.56,.0023,.089]]){
       const tone=a.createOscillator(),level=a.createGain(),lfo=a.createOscillator(),depth=a.createGain();
       tone.type='sine';tone.frequency.value=f;level.gain.value=vol;
       lfo.frequency.value=rate;depth.gain.value=f*.0019;
       lfo.connect(depth);depth.connect(tone.frequency);
       tone.connect(level);level.connect(music.ambient);tone.start();lfo.start();
     }
   }
   music.context.resume();
   music.master.gain.setTargetAtTime(music.enabled?.72:0,music.context.currentTime,.08);
 }catch(e){/* audio is optional */}
}
function playNote(frequency,at,duration,level=.09,shape='sawtooth',bus=music.escapeGain){
 const a=music.context;if(!a||!bus)return;
 const o=a.createOscillator(),g=a.createGain(),lp=a.createBiquadFilter();
 o.type=shape;o.frequency.setValueAtTime(frequency,at);lp.type='lowpass';lp.frequency.value=shape==='sawtooth'?540:1300;
 g.gain.setValueAtTime(.0001,at);g.gain.exponentialRampToValueAtTime(level,at+.013);g.gain.exponentialRampToValueAtTime(.0001,at+duration);
 o.connect(lp);lp.connect(g);g.connect(bus);o.start(at);o.stop(at+duration+.02);
}
function soundBeat(at,step){
 const a=music.context;if(!a)return;
 // Urgent minor-key pulse and kick/snare. Original synthesis, not copyrighted audio.
 const bass=[55,55,65.41,55,73.42,65.41,82.41,65.41];
 playNote(bass[step%8],at,.18,.095,'sawtooth');
 if(step%2===0){const o=a.createOscillator(),g=a.createGain();o.type='sine';o.frequency.setValueAtTime(120,at);o.frequency.exponentialRampToValueAtTime(43,at+.15);g.gain.setValueAtTime(.21,at);g.gain.exponentialRampToValueAtTime(.0001,at+.18);o.connect(g);g.connect(music.escapeGain);o.start(at);o.stop(at+.19);}
 if(step%4===2&&music.percussion){const s=a.createBufferSource(),hp=a.createBiquadFilter(),g=a.createGain();s.buffer=music.percussion;hp.type='highpass';hp.frequency.value=1000;g.gain.setValueAtTime(.0001,at);g.gain.linearRampToValueAtTime(.065,at+.009);g.gain.exponentialRampToValueAtTime(.0001,at+.21);s.connect(hp);hp.connect(g);g.connect(music.escapeGain);s.start(at);s.stop(at+.24);}
 if(step%2){playNote([220,261.63,293.66,329.63][Math.floor(step/2)%4],at,.085,.020,'triangle');}
}
function startEscapeMusic(){
 if(!music.context)return;
 const a=music.context;music.escapeMode=true;music.nextBeat=a.currentTime+.07;music.beatNumber=0;
 music.ambient.gain.setTargetAtTime(.19,a.currentTime,.3);
 music.escapeGain.gain.setTargetAtTime(.85,a.currentTime,.35);
}
function stopEscapeMusic(){
 music.escapeMode=false;
 if(!music.context)return;
 const a=music.context;music.ambient.gain.setTargetAtTime(.9,a.currentTime,.3);
 music.escapeGain.gain.setTargetAtTime(.0001,a.currentTime,.08);
}
// Pitch-swept water droplets and quiet, uneasy musical notes, all original WebAudio.
function waterDrop(t){
 const a=music.context;if(!a)return;
 const o=a.createOscillator(),g=a.createGain(),filter=a.createBiquadFilter();
 const f=610+Math.random()*520,volume=.035+Math.random()*.017;
 o.type='sine';o.frequency.setValueAtTime(f,t);
 o.frequency.exponentialRampToValueAtTime(f*.41,t+.14);
 filter.type='lowpass';filter.frequency.value=1700;
 g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(volume,t+.008);
 g.gain.exponentialRampToValueAtTime(.0001,t+.19);
 o.connect(filter);filter.connect(g);g.connect(music.ambient);g.connect(music.dripEcho);
 o.start(t);o.stop(t+.21);
 // Occasional secondary splash, softer and lower, to imply water falling into puddles.
 if(Math.random()<.3){playNote(200+Math.random()*140,t+.12,.2,.005,'sine',music.ambient);}
}
function creepyCaveNote(t){
 const notes=[164.81,146.83,155.56,130.81,146.83,116.54,155.56,123.47];
 const f=notes[music.creepStep++%notes.length];
 playNote(f,t,2.4,.012,'sine',music.ambient);
 if(music.creepStep%3===0)playNote(f*.5,t+.4,2.1,.009,'triangle',music.ambient);
}
function updateAudio(){
 if(!music.context||!music.enabled||state!=='playing'||mapOpen)return;
 const a=music.context;
 if(music.escapeMode){
   while(music.nextBeat<a.currentTime+.18){soundBeat(music.nextBeat,music.beatNumber++);music.nextBeat+=60/154/2;}
 }else{
   // Irregular drops are frequent enough to establish a dripping cave, without rhythmic repetition.
   if(a.currentTime>music.dripAt){
     waterDrop(a.currentTime+.01);
     music.dripAt=a.currentTime+.7+Math.random()*2.35;
   }
   if(a.currentTime>music.creepAt){
     creepyCaveNote(a.currentTime+.02);
     music.creepAt=a.currentTime+4.0+Math.random()*2.8;
   }
 }
}
function syncAudioPause(){
 if(!music.context||!music.master)return;
 const on=music.enabled && state==='playing' && !mapOpen;
 music.master.gain.setTargetAtTime(on?.72:0,music.context.currentTime,.09);
 if(on&&music.escapeMode)music.nextBeat=music.context.currentTime+.055;
 if(on&&!music.escapeMode){music.dripAt=music.context.currentTime+.35;music.creepAt=music.context.currentTime+1.1;}
}

function sound(name){
 if(!music.enabled||!music.context)return;
 const patterns={key:[720,980],crate:[340,530],good:[500,720,940],bad:[260,180],rescue:[470,620,780,1050],hurt:[170,90],victory:[440,660,880,1175],door:[330,440,660],use:[620,850]};
 const seq=patterns[name]||patterns.crate;
 try{
   const a=music.context, now=a.currentTime;
   seq.forEach((freq,i)=>{
     const o=a.createOscillator(),g=a.createGain(),t=now+i*.065;
     o.type=name==='bad'||name==='hurt'?'sawtooth':'sine';o.frequency.setValueAtTime(freq,t);
     g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(.047,t+.013);
     g.gain.exponentialRampToValueAtTime(.0001,t+.15);
     o.connect(g);g.connect(music.master);o.start(t);o.stop(t+.16);
   });
 }catch(e){}
}
// Deep, rough, descending cave-beast roar, synthesized offline without audio files.
function monsterRoar(m){
 if(!music.enabled||!music.context||time-lastRoarAt<1.6||time-(m.roaredAt||-100)<4.2)return;
 lastRoarAt=time;m.roaredAt=time;
 try{
  const a=music.context,t=a.currentTime,d=.83;
  const master=a.createGain(),filter=a.createBiquadFilter();
  filter.type='lowpass';filter.frequency.setValueAtTime(900,t);
  filter.frequency.exponentialRampToValueAtTime(190,t+d);
  master.gain.setValueAtTime(.0001,t);master.gain.exponentialRampToValueAtTime(.22,t+.08);
  master.gain.setValueAtTime(.19,t+.32);master.gain.exponentialRampToValueAtTime(.0001,t+d);
  filter.connect(master);master.connect(music.master);
  for(const [base,shape,level] of [[156,'sawtooth',.28],[87,'sawtooth',.42],[59,'triangle',.30]]){
   const o=a.createOscillator(),g=a.createGain();o.type=shape;
   o.frequency.setValueAtTime(base,t);o.frequency.exponentialRampToValueAtTime(base*.55,t+d);
   g.gain.value=level;o.connect(g);g.connect(filter);o.start(t);o.stop(t+d+.01);
  }
  const length=Math.floor(a.sampleRate*d),buf=a.createBuffer(1,length,a.sampleRate),data=buf.getChannelData(0);
  for(let i=0;i<length;i++)data[i]=(Math.random()*2-1)*.42*(.65+.35*Math.sin(i/a.sampleRate*29));
  const noise=a.createBufferSource();noise.buffer=buf;noise.connect(filter);noise.start(t);noise.stop(t+d+.01);
 }catch(e){/* no audio support: gameplay continues */}
}
$('#soundBtn').addEventListener('click',()=>{
 music.enabled=!music.enabled;$('#soundBtn').textContent=music.enabled?'♫':'♩';
 $('#soundBtn').title=music.enabled?'Mute sound':'Unmute sound';
 if(music.enabled){audioStart();if(music.context&&music.escapeMode)music.nextBeat=music.context.currentTime+.05;}
 syncAudioPause();
});
let rng=Math.random, runNumber=0, difficulty='explorer';
function seeded(seed){let t=seed>>>0;return function(){t=(t+0x6D2B79F5)>>>0;let x=t;x=Math.imul(x^x>>>15,x|1);x^=x+Math.imul(x^x>>>7,x|61);return ((x^x>>>14)>>>0)/4294967296;};}
function randInt(n){return Math.floor(rng()*n);}
function shuffle(a){for(let i=a.length-1;i>0;i--){let j=randInt(i+1);[a[i],a[j]]=[a[j],a[i]];}return a;}
function clamp(n,min,max){return Math.max(min,Math.min(max,n));}
function dist(a,b){return Math.hypot(a.x-b.x,a.y-b.y);}
function cellID(c,r){return r*COLS+c;}
function cellCenter(c,r){return{x:(c+.5)*T,y:(r+.5)*T,c,r};}
function cellOf(p){return {c:clamp(Math.floor(p.x/T),0,COLS-1),r:clamp(Math.floor(p.y/T),0,ROWS-1)};}
let state='menu', mapOpen=false, time=0, elapsed=0, camera={x:0,y:0};
let grid=[],terrain, floorTiles=[], player, monsters=[], keys=[], cages=[], crates=[], exitDoor;
let playerTrail=[], trailDistance=0, lastRoarAt=-100;
let unlockTarget=null,unlockProgress=0;const UNLOCK_SECONDS=3;
let keysHeld=0, rescued=0, effects={}, inventory={}, input={},touch={}, lastToast=0, toastUntil=0;
let fog=[], flash=0, shake=0, msgCooldown=0, frameCount=0, pointerTarget=null;
const DIRS=[[0,-1],[1,0],[0,1],[-1,0]];
// Always let a healthy sprinting Wolf Chan outrun a JYP on a straight corridor.
const HUNTER_SPEED={
 explorer:{patrol:77,search:108,alertStart:99,alertMax:174},
 normal:{patrol:83,search:113,alertStart:104,alertMax:184},
 nightmare:{patrol:88,search:119,alertStart:109,alertMax:197}
};
// Independent per-friend rolls (1.8% per second each) with a global cooldown.
const ICE_CREAM_CHANCE_PER_FRIEND_PER_SECOND=.018;
const ICE_CREAM_COOLDOWN=9;
let iceCreamCooldown=0, hunterAnnouncementUntil=0;
function inbounds(c,r){return c>=0&&c<COLS&&r>=0&&r<ROWS;}
function walkable(c,r){return inbounds(c,r)&&grid[r][c]===0;}
function neighbors(c,r){return DIRS.map(([dx,dy])=>({c:c+dx,r:r+dy})).filter(p=>walkable(p.c,p.r));}
function bfs(source){
 const distance=new Int16Array(COLS*ROWS);distance.fill(-1);
 const parent=new Int32Array(COLS*ROWS);parent.fill(-1);
 const from=cellID(source.c,source.r);distance[from]=0;
 const q=new Int32Array(COLS*ROWS),count=q.length;let h=0,t=0;q[t++]=from;
 while(h<t){const cur=q[h++],c=cur%COLS,r=(cur/COLS)|0;
   for(const [dx,dy] of DIRS){const nc=c+dx,nr=r+dy,ni=cellID(nc,nr);
     if(walkable(nc,nr)&&distance[ni]===-1){distance[ni]=distance[cur]+1;parent[ni]=cur;q[t++]=ni;}
   }
 }
 return {distance,parent};
}
function pathTo(source,target){
 if(source.c===target.c&&source.r===target.r)return[];
 if(!walkable(source.c,source.r)||!walkable(target.c,target.r))return[];
 const {distance,parent}=bfs(source);let i=cellID(target.c,target.r),start=cellID(source.c,source.r);
 if(distance[i]<0)return[];const path=[];
 while(i!==start && path.length<COLS*ROWS){path.push(cellCenter(i%COLS,(i/COLS)|0));i=parent[i];if(i<0)break;}
 return path.reverse();
}
function generateMaze(){
 grid=Array.from({length:ROWS},()=>Array(COLS).fill(1));
 const stack=[[1,1]];grid[1][1]=0;
 while(stack.length){
  const [c,r]=stack[stack.length-1];
  const dirs=shuffle([[0,-2],[2,0],[0,2],[-2,0]]).filter(([dx,dy])=>{
    const x=c+dx,y=r+dy;return x>0&&x<COLS-1&&y>0&&y<ROWS-1&&grid[y][x]===1;
  });
  if(!dirs.length){stack.pop();continue;}
  const [dx,dy]=dirs[0];grid[r+dy/2][c+dx/2]=0;grid[r+dy][c+dx]=0;stack.push([c+dx,r+dy]);
 }
 // Braid some dead ends and connect otherwise separate corridors to create escape routes.
 const maybe=[];
 for(let r=2;r<ROWS-2;r++)for(let c=2;c<COLS-2;c++){
  if(grid[r][c]===1&&((walkable(c-1,r)&&walkable(c+1,r))||(walkable(c,r-1)&&walkable(c,r+1))))maybe.push([c,r]);
 }
 shuffle(maybe);for(let i=0;i<Math.min(79,maybe.length);i++){const [c,r]=maybe[i];grid[r][c]=0;}
 floorTiles=[];for(let r=1;r<ROWS-1;r++)for(let c=1;c<COLS-1;c++)if(walkable(c,r))floorTiles.push(cellCenter(c,r));
}
function selectPlacement(exclusions, minDistance, candidates){
 const opts=shuffle((candidates||floorTiles).filter(p=>!exclusions.some(x=>dist(p,x)<minDistance*T)));
 if(opts.length)return opts[0];
 return shuffle(floorTiles.filter(p=>!exclusions.some(x=>dist(p,x)<2*T)))[0] || cellCenter(3,3);
}
function scatterObjects(){
 const spawn=cellCenter(1,1);const dmap=bfs({c:1,r:1}).distance;
 const far=floorTiles.filter(p=>dmap[cellID(p.c,p.r)]>18);
 const sorted=floorTiles.slice().sort((a,b)=>dmap[cellID(b.c,b.r)]-dmap[cellID(a.c,a.r)]);
 exitDoor=sorted[Math.min(3,sorted.length-1)];
 const used=[spawn,exitDoor];
 keys=[];cages=[];crates=[];
 // Mix locations by maze distance rather than clustering all the objectives at the end.
 for(const friend of shuffle([...FRIENDS])){
   const p=selectPlacement(used,5,far);used.push(p);cages.push({...p,friend,freed:false,known:false});
 }
 for(let i=0;i<7;i++){
   const p=selectPlacement(used,4,floorTiles.filter(t=>dmap[cellID(t.c,t.r)]>8));used.push(p);
   keys.push({...p,collected:false});
 }
 for(let i=0;i<26;i++){
   const p=selectPlacement(used,2.8,floorTiles.filter(t=>dmap[cellID(t.c,t.r)]>5));used.push(p);
   crates.push({...p,opened:false});
 }
 const monsterCandidates=floorTiles.filter(p=>dmap[cellID(p.c,p.r)]>23&&dist(p,spawn)>12*T && dist(p,exitDoor)>5*T);
 const mp=monsterCandidates[randInt(monsterCandidates.length)]||sorted[5];
  monsters=[makeMonster(mp,0)];
 player={x:spawn.x,y:spawn.y,angle:0,face:1,health:difficulty==='explorer'?4:difficulty==='normal'?3:2,
   maxHealth:difficulty==='explorer'?4:difficulty==='normal'?3:2,stamina:100,invuln:0,walking:false,sprinting:false};
}
function resetGame(){
 runNumber++;rng=seeded((Math.random()*4294967295)>>>0);
 generateMaze();scatterObjects();
 keysHeld=0;rescued=0;effects={};inventory={boost:0,vanish:0,radar:0};input={};touch={};unlockTarget=null;unlockProgress=0;iceCreamCooldown=0;hunterAnnouncementUntil=0;
 $('#hunterAnnouncement').classList.remove('active');stopEscapeMusic();
 time=0;elapsed=0;flash=0;shake=0;mapOpen=false;fog=new Array(COLS*ROWS).fill(false);
  camera={x:0,y:0};ui.mapLegend.hidden=true;
  playerTrail=[{x:player.x,y:player.y,d:0}];trailDistance=0;lastRoarAt=-100;
 ui.toast.innerHTML='';toastUntil=0;lastToast=0;msgCooldown=0;
 buildTerrain();revealFog();updateHUD();updateProgress();
 ui.chapter.innerHTML='CHAPTER I <span>·</span> INTO THE HOLLOW';
 ui.objective.textContent='FIND KEYS & RESCUE FRIENDS';
 ui.hint.hidden=true;ui.menu.classList.remove('visible');ui.pause.classList.remove('visible');ui.end.classList.remove('visible');
}
function buildTerrain(){
 terrain=document.createElement('canvas');terrain.width=WORLD_W;terrain.height=WORLD_H;
 const c=terrain.getContext('2d');
 c.fillStyle='#0e0b15';c.fillRect(0,0,WORLD_W,WORLD_H);
 for(let r=0;r<ROWS;r++)for(let x=0;x<COLS;x++){
  const px=x*T,py=r*T,v=hash(x,r,1);
  if(grid[r][x]===0){
    c.fillStyle=v>.5?'#292232':'#2c2536';c.fillRect(px,py,T,T);
    c.fillStyle='rgba(209,171,181,.052)';c.fillRect(px+4,py+7,18,1);
    c.strokeStyle='#493c4a';c.lineWidth=.8;c.beginPath();c.moveTo(px+9+v*11,py+15);c.lineTo(px+13+v*11,py+22);c.lineTo(px+10+v*11,py+29);c.stroke();
    c.fillStyle='rgba(229,198,191,.15)';c.fillRect(px+5+v*18,py+27-v*13,2,2);
    if(hash(x,r,4)>.89){c.strokeStyle='#5a4852';c.beginPath();c.moveTo(px+7,py+10);c.lineTo(px+17,py+15);c.lineTo(px+20,py+26);c.stroke();}
  }else{
    c.fillStyle='#15101e';c.fillRect(px,py,T,T);
    c.fillStyle=v>.52?'#34273a':'#2f2536';c.fillRect(px+2,py+1,36,36);
    c.fillStyle='#423345';c.beginPath();c.moveTo(px+3,py+6);c.lineTo(px+8+v*9,py+3);c.lineTo(px+28,py+5);c.lineTo(px+38,py+15);c.lineTo(px+34,py+29);c.lineTo(px+15,py+37);c.lineTo(px+3,py+24);c.closePath();c.fill();
    c.fillStyle='rgba(9,8,15,.34)';c.beginPath();c.moveTo(px+8,py+8);c.lineTo(px+20,py+11);c.lineTo(px+27,py+27);c.lineTo(px+7,py+33);c.closePath();c.fill();
    c.strokeStyle='#6b5065';c.lineWidth=.65;c.beginPath();c.moveTo(px+7,py+11);c.lineTo(px+24,py+8);c.lineTo(px+30,py+16);c.stroke();
  }
 }
 // Path edge highlights, giving caves depth around wall faces.
 for(let r=1;r<ROWS-1;r++)for(let x=1;x<COLS-1;x++)if(!walkable(x,r)){
  const px=x*T,py=r*T;c.fillStyle='#66516b';
  if(walkable(x,r+1))c.fillRect(px+3,py+T-6,34,3);
  if(walkable(x+1,r))c.fillRect(px+T-6,py+4,3,32);
 }
}
function hash(x,y,seed=1){let n=((x*374761393+y*668265263+seed*1274126177)|0);n=Math.imul(n^(n>>>13),1274126177);return ((n^(n>>>16))>>>0)/4294967295;}
function revealFog(){const {c,r}=cellOf(player);for(let y=r-4;y<=r+4;y++)for(let x=c-4;x<=c+4;x++)if(inbounds(x,y)&&Math.hypot(c-x,r-y)<4.7)fog[cellID(x,y)]=true;for(const cage of cages){if(dist(player,cage)<5*T)cage.known=true;}}
function wallCircle(x,y,r){for(let row=Math.floor((y-r)/T);row<=Math.floor((y+r)/T);row++)for(let col=Math.floor((x-r)/T);col<=Math.floor((x+r)/T);col++){
 if(!walkable(col,row)){
   const left=col*T,top=row*T, cx=clamp(x,left,left+T),cy=clamp(y,top,top+T);
   if((cx-x)**2+(cy-y)**2 < r*r)return true;
 }
}return false;}
// Substep fast moves; let each axis slide independently so no one tunnels or catches at corners.
function tryMove(obj,dx,dy,radius){
 const steps=Math.max(1,Math.ceil(Math.hypot(dx,dy)/5));
 for(let i=0;i<steps;i++){
  const sx=dx/steps,sy=dy/steps;
  if(!wallCircle(obj.x+sx,obj.y,radius))obj.x+=sx;
  if(!wallCircle(obj.x,obj.y+sy,radius))obj.y+=sy;
 }
}
function rememberTrail(){
 const last=playerTrail[playerTrail.length-1];const move=Math.hypot(player.x-last.x,player.y-last.y);
 if(move>.15){trailDistance+=move;playerTrail.push({x:player.x,y:player.y,d:trailDistance});}
 while(playerTrail.length>2&&playerTrail[1].d<trailDistance-540)playerTrail.shift();
}
function trailAt(distance){
 if(!playerTrail.length)return{x:player.x,y:player.y};
 distance=Math.max(playerTrail[0].d,Math.min(trailDistance,distance));
 let low=0,high=playerTrail.length-1;
 while(low<high){const mid=(low+high)>>1;if(playerTrail[mid].d<distance)low=mid+1;else high=mid;}
 if(low===0)return playerTrail[0];
 const b=playerTrail[low],a=playerTrail[low-1],t=(distance-a.d)/Math.max(.00001,b.d-a.d);
 return{x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t};
}
function followerPosition(c,index){
 const traveled=Math.max(0,trailDistance-c.joinedAt);
 const lag=Math.min(31+index*23,traveled*.46);
 return trailAt(trailDistance-lag);
}
function lineClear(a,b){const d=dist(a,b),n=Math.max(1,Math.ceil(d/9));for(let i=1;i<n;i++){const x=a.x+(b.x-a.x)*i/n,y=a.y+(b.y-a.y)*i/n;if(!walkable(Math.floor(x/T),Math.floor(y/T)))return false;}return true;}
function nearCage(){let best=null,bd=Infinity;for(const c of cages){const d=dist(player,c);if(!c.freed&&d<56&&d<bd){bd=d;best=c;}}return best;}
function updatePlayer(dt){
 let dx=0,dy=0;
 if(input['arrowup']||input['w']||touch.up)dy--;
 if(input['arrowdown']||input['s']||touch.down)dy++;
 if(input['arrowleft']||input['a']||touch.left)dx--;
 if(input['arrowright']||input['d']||touch.right)dx++;
 if(effects.reverse>0){dx=-dx;dy=-dy;}
 const norm=Math.hypot(dx,dy);player.walking=norm>0;
 const sprinting=(input['shift']||touch.sprint)&&norm>0&&player.stamina>1&&!(effects.noSprint>0);
 player.sprinting=sprinting;
 if(sprinting)player.stamina=Math.max(0,player.stamina-dt*23);else player.stamina=Math.min(100,player.stamina+dt*17);
 let speed=145;
 if(difficulty==='explorer')speed=155;
 if(sprinting)speed*=1.44;
 if(effects.speed>0)speed*=1.48;
 if(effects.slow>0)speed*=.59;
 if(norm>0){dx/=norm;dy/=norm;tryMove(player,dx*dt*speed,dy*dt*speed,10);
   if(Math.abs(dx)>.02)player.face=dx<0?-1:1;
 }
 rememberTrail();
 if(player.invuln>0)player.invuln=Math.max(0,player.invuln-dt);
 revealFog();
 for(const key of keys){if(!key.collected&&dist(player,key)<27){key.collected=true;keysHeld++;sound('key');notify('🗝  A golden key! Saved in your pocket.','good');updateHUD();}}
 for(const box of crates){if(!box.opened&&dist(player,box)<27){box.opened=true;openCrate();}}
 if(rescued===7&&dist(player,exitDoor)<33)winGame();
 const cage=nearCage();
 const holding=!!(input.e||input[' ']||touch.action);
 if(!cage||!keysHeld||!holding||cage!==unlockTarget){if(unlockProgress>0){unlockProgress=0;unlockTarget=null;}}
 if(cage&&keysHeld&&holding){
   unlockTarget=cage;unlockProgress=Math.min(UNLOCK_SECONDS,unlockProgress+dt);
   if(unlockProgress>=UNLOCK_SECONDS){finishRescue(cage);}
 }
 ui.hint.hidden=!cage||cage.freed;
 if(cage&&!cage.freed){
   ui.interact.textContent=!keysHeld?`${cage.friend.name} needs a key`: `Hold E to free ${cage.friend.name}`;
   $('#unlockFill').style.width=`${Math.round(unlockProgress/UNLOCK_SECONDS*100)}%`;
   ui.hint.classList.toggle('unlocking',unlockProgress>0);
 }
 
}
function tryRescue(){if(state!=='playing'||mapOpen)return;
 const cage=nearCage();
 if(!cage){if(msgCooldown<=0){notify('Stand closer to a cage and hold E for three seconds.','info');msgCooldown=2;}return;}
 if(keysHeld<1){if(msgCooldown<=0){notify(`Find a golden key to free ${cage.friend.name}!`,'bad');sound('bad');msgCooldown=1.7;}return;}
}
function finishRescue(cage){
 if(!cage||cage.freed||keysHeld<1||state!=='playing')return;
 cage.freed=true;cage.joinedAt=trailDistance;keysHeld--;rescued++;sound('rescue');notify(`✦  ${cage.friend.name} is free! (${rescued}/7)`,'good');flash=.18;
 unlockProgress=0;unlockTarget=null;
 if(rescued<=6)spawnMonster();
 updateHUD();updateProgress();ui.hint.hidden=true;
 if(rescued===7){
   ui.chapter.innerHTML='FINAL CHAPTER <span>·</span> THE WAY OUT';ui.objective.textContent='THE EXIT IS OPEN — RUN!';
   notify('✦  ALL SEVEN ARE FREE! THE EXIT IS OPEN!','good');sound('door');startEscapeMusic();
   for(const m of monsters){m.alert=9;m.lastSeen={x:player.x,y:player.y};}
 }
}
function openCrate(){
 sound('crate');const r=rng();
 if(r<.32){
   const type=['boost','vanish','radar'][randInt(3)];inventory[type]++;notify(`🎁  A lucky find: ${ITEM_NAMES[type]}! (Use ${['boost','vanish','radar'].indexOf(type)+1})`,'good');sound('good');
 }else if(r<.54){
   const bonus=randInt(4);
   if(bonus===0){player.health=Math.min(player.maxHealth,player.health+1);notify('✨  Warm light! Restored one heart.','good');}
   if(bonus===1){effects.speed=8;notify('✨  Fleet feet! Move faster for 8 seconds.','good');}
   if(bonus===2){effects.radar=11;notify('✨  Cave sight! Hidden treasures revealed briefly.','good');}
   if(bonus===3){effects.vanish=5;notify('✨  Shadow cloak! JYP cannot spot you.','good');}
   sound('good');
 }else{
   const bad=randInt(5);
   if(bad===0){effects.slow=7;notify('☠  Sticky boots! Slowed for 7 seconds.','bad');}
   if(bad===1){effects.reverse=5;notify('☠  Dizzy spell! Controls reversed for 5 seconds.','bad');}
   if(bad===2){effects.fog=7;notify('☠  Black mist! Your lantern fades for 7 seconds.','bad');}
   if(bad===3){effects.noSprint=8;notify('☠  Tired legs! Cannot sprint for 8 seconds.','bad');}
   if(bad===4){for(const m of monsters){m.alert=9;m.lastSeen={x:player.x,y:player.y};}notify('☠  CURSED CRATE! All JYP hunters heard you!','bad');}
   sound('bad');flash=.12;
 }
 updateHUD();
}
function useItem(type){if(state!=='playing'||mapOpen)return;
 if(!inventory[type]){if(msgCooldown<=0){notify(`No ${ITEM_NAMES[type].toLowerCase()} in your pocket yet.`,'info');msgCooldown=1.5;}return;}
 inventory[type]--;
 if(type==='boost'){effects.speed=Math.max(effects.speed||0,9);notify('⚡  Dash potion activated — 9 seconds!','good');}
 if(type==='vanish'){effects.vanish=Math.max(effects.vanish||0,7);for(const m of monsters){m.alert=0;m.lastSeen=null;m.mode='roam';}notify('☁  Smoke charm activated — invisible for 7 seconds!','good');}
 if(type==='radar'){effects.radar=Math.max(effects.radar||0,15);notify('✧  Echo lantern activated — see hidden pickups!','good');}
 sound('use');updateHUD();
}
function makeMonster(p,index){
 return{x:p.x,y:p.y,index,mode:'roam',timer:0,route:[],pathTimer:0,target:null,
 lastSeen:null,hasSeen:false,alert:0,stun:0,wanderTimer:0,face:1,roaredAt:-100,stuck:0};
}
function spawnMonster(){
 const dmap=bfs(cellOf(player)).distance;
 const choices=floorTiles.filter(p=>{
  const steps=dmap[cellID(p.c,p.r)];
  return steps>=11 && dist(player,p)>9*T && dist(exitDoor,p)>3*T && monsters.every(m=>dist(m,p)>5*T);
 });
 const mp=choices[randInt(choices.length)]||floorTiles.filter(p=>dist(p,player)>7*T)[0];
 if(!mp)return;
 monsters.push(makeMonster(mp,monsters.length));
 showHunterAnnouncement(monsters.length);
 flash=.18;sound('bad');
}
function showHunterAnnouncement(count){
 const announcement=$('#hunterAnnouncement');
 $('#hunterDispatchCount').textContent=`${count} / 7 JYP hunters active`;
 announcement.classList.remove('active');
 void announcement.offsetWidth; // replay the entrance animation for each new hunter
 announcement.classList.add('active');
 hunterAnnouncementUntil=time+2.9;
}
function playIceCreamSplat(){
 if(!music.enabled||!music.context)return;
 const a=music.context,t=a.currentTime;
 // Playful squeaky ice-cream hit, conspicuous against the deep cave sounds.
 for(const [start,at] of [[790,t],[530,t+.05]]){
   const o=a.createOscillator(),g=a.createGain();o.type='sine';
   o.frequency.setValueAtTime(start,at);o.frequency.exponentialRampToValueAtTime(start*.49,at+.18);
   g.gain.setValueAtTime(.0001,at);g.gain.exponentialRampToValueAtTime(.10,at+.012);
   g.gain.exponentialRampToValueAtTime(.0001,at+.22);
   o.connect(g);g.connect(music.master);o.start(at);o.stop(at+.25);
 }
}
function updateFriendDefense(dt){
 if(iceCreamCooldown>0){iceCreamCooldown=Math.max(0,iceCreamCooldown-dt);return;}
 const chasing=monsters.filter(m=>m.mode==='chase'&&m.stun<=0);
 if(!chasing.length||effects.vanish>0)return;
 // Each rescued friend makes an independent probability roll every frame.
 const chance=1-Math.exp(-ICE_CREAM_CHANCE_PER_FRIEND_PER_SECOND*dt);
 for(const cage of cages){
   if(!cage.freed||rng()>=chance)continue;
   const target=chasing.reduce((a,b)=>dist(a,player)<dist(b,player)?a:b);
   target.stun=2;target.mode='stunned';target.alert=0;target.chaseRamp=0;
   target.lastSeen=null;target.target=null;target.route=[];target.pathTimer=0;
   iceCreamCooldown=ICE_CREAM_COOLDOWN;
   notify(`${cage.friend.name} threw ice cream at JYP!`,'icecream');
   playIceCreamSplat();
   return;
 }
}

function pickRoamTarget(m){
 const start=cellOf(m),d=bfs(start).distance;
 const choices=floorTiles.filter(p=>{const dd=d[cellID(p.c,p.r)];return dd>=8&&dd<=21;});
 m.target=choices[randInt(choices.length)]||floorTiles[randInt(floorTiles.length)];m.pathTimer=0;
}
function updateMonster(m,dt){
 if(m.stun>0){m.stun=Math.max(0,m.stun-dt);m.chaseRamp=0;return;}
 const distance=dist(player,m),visible=!(effects.vanish>0);
 const seen=visible&&distance<(difficulty==='nightmare'?9.5:7.4)*T&&lineClear(m,player);
 const heard=visible&&((player.sprinting&&distance<4.8*T)||distance<1.7*T);
 const wasAlerted=m.mode==='chase'||m.mode==='investigate';
 if(seen){
  if(!wasAlerted)monsterRoar(m);
  m.mode='chase';m.alert=5.3;m.lastSeen={x:player.x,y:player.y};m.hasSeen=true;
 }else if(heard){
  if(!wasAlerted)monsterRoar(m);
  m.mode='investigate';m.alert=2.9;m.lastSeen={x:player.x,y:player.y};
 }else if(m.alert>0){m.alert=Math.max(0,m.alert-dt);m.mode='search';}
 else{m.mode='roam';m.lastSeen=null;}
 let target=null;
 if(m.alert>0&&m.lastSeen)target=m.lastSeen;
 else{
  if(!m.target||dist(m,m.target)<8||m.wanderTimer<=0){pickRoamTarget(m);m.wanderTimer=9;}
  m.wanderTimer-=dt;target=m.target;
 }
 m.pathTimer-=dt;
 if(m.pathTimer<=0){m.route=pathTo(cellOf(m),cellOf(target));m.pathTimer=m.mode==='roam'?.8:.3;}
 // Finish travelling to a cell centre before turning into the next narrow passage.
 while(m.route.length&&dist(m,m.route[0])<4.5)m.route.shift();
 const dest=m.route[0]||target;
 if(dest){const dirx=dest.x-m.x,diry=dest.y-m.y,mag=Math.hypot(dirx,diry);
  if(mag>1){
   const chasing=m.mode==='chase'||m.mode==='investigate';
   m.chaseRamp=clamp((m.chaseRamp||0)+(chasing?dt*.95:-dt*.85),0,1);
   const speed=HUNTER_SPEED[difficulty];
   const v=chasing?speed.alertStart+(speed.alertMax-speed.alertStart)*m.chaseRamp:
           m.mode==='search'?speed.search:speed.patrol;
   const step=Math.min(v*dt,mag),ox=m.x,oy=m.y;
   tryMove(m,dirx/mag*step,diry/mag*step,10);
   if(Math.hypot(m.x-ox,m.y-oy)<.3){m.stuck+=dt;if(m.stuck>.16){m.pathTimer=0;m.route=[];m.target=null;m.stuck=0;}}
   else m.stuck=0;
   if(Math.abs(dirx)>3)m.face=dirx<0?-1:1;
  }
 }
 if(dist(player,m)<23&&player.invuln<=0&&!(effects.vanish>0)){
  player.health--;player.invuln=3.3;flash=.75;shake=15;unlockProgress=0;unlockTarget=null;
  notify(`☠  A JYP hunter caught you! ${player.health} heart${player.health===1?'':'s'} left.`,'bad');sound('hurt');
  const away=Math.atan2(m.y-player.y,m.x-player.x);
  for(let i=0;i<5;i++)tryMove(m,Math.cos(away)*8,Math.sin(away)*8,10);
  // Give all hunters a short recovery break after any hit.
  for(const other of monsters){other.stun=2;other.alert=0;other.lastSeen=null;other.mode='roam';other.target=null;other.route=[];}
  updateHUD();if(player.health<=0)loseGame();
 }
}
function updateEffects(dt){for(const type in effects)if(effects[type]>0)effects[type]=Math.max(0,effects[type]-dt);flash=Math.max(0,flash-dt*1.8);shake=Math.max(0,shake-dt*24);msgCooldown=Math.max(0,msgCooldown-dt);}
function updateHUD(){
 ui.keys.textContent=keysHeld;ui.rescued.textContent=`${rescued}/7`;$('#monsterCount').textContent=`${monsters.length}/7`;
 ui.hearts.textContent='♥ '.repeat(player.health)+'♡ '.repeat(player.maxHealth-player.health);
 for(const [type,count] of Object.entries(inventory)){
   $(`#${type}Count`).textContent=count;
   $(`[data-item="${type}"]`).classList.toggle('empty',!count);
 }
}
function updateProgress(){
 ui.progress.textContent=`${rescued} OF 7 SAFE`;
 ui.phase.textContent=rescued===7?'RUN TO THE EXIT':rescued?'KEEP SEARCHING':'FIND THEM IN THE DARK';
 for(const c of cages){const p=$(`#portrait-${c.friend.id}`);p.classList.toggle('safe',c.freed);p.title=`${c.friend.name} — ${c.freed?'SAFE!':'still trapped'}`;}
}
function nearestObjective(){
 const from=cellOf(player),data=bfs(from), candidates=[];
 if(rescued===7)candidates.push({...exitDoor,type:'exit',label:'Escape door'});
 else if(keysHeld){for(const c of cages)if(!c.freed)candidates.push({...c,type:'cage',label:`Rescue ${c.friend.name}`});}
 else for(const key of keys)if(!key.collected)candidates.push({...key,type:'key',label:'Nearest key'});
 candidates.sort((a,b)=>data.distance[cellID(a.c,a.r)]-data.distance[cellID(b.c,b.r)]);
 const target=candidates[0];if(!target)return null;
 const path=pathTo(from,{c:target.c,r:target.r});
 return {...target,step:path[0]||target,steps:Math.max(0,data.distance[cellID(target.c,target.r)])};
}
function updateIndicators(){
 const target=nearestObjective();
 if(target){const dir={x:target.step.x-player.x,y:target.step.y-player.y};
  ui.arrow.style.transform=`rotate(${Math.atan2(dir.y,dir.x)*180/Math.PI}deg)`;
  ui.target.textContent=target.label;ui.distance.textContent=target.steps<3?'Very close':`${target.steps} passage steps away`;
 }else{ui.target.textContent='Explore the maze';ui.distance.textContent='Follow the passageways';}
 ui.stamina.style.width=`${player.stamina.toFixed(0)}%`;ui.staminaPct.textContent=`${player.stamina.toFixed(0)}%`;
}
function notify(message,type='info'){
 ui.toast.innerHTML='';const p=document.createElement('div');p.className=`toast ${type}`;p.textContent=message;ui.toast.append(p);
 toastUntil=time+4;
}
function winGame(){if(state!=='playing')return;state='won';stopEscapeMusic();sound('victory');showEnd(true);syncAudioPause();}
function loseGame(){if(state!=='playing')return;state='lost';stopEscapeMusic();sound('bad');showEnd(false);syncAudioPause();}
function showEnd(won){
 ui.endEyebrow.textContent=won?'THE WHOLE PACK IS SAFE':'THE HOLLOW CLAIMS ANOTHER';
 ui.endTitle.textContent=won?'YOU MADE IT OUT!':'CAUGHT IN THE DARK';
 ui.endDescription.textContent=won?'All seven friends escaped together. The moonlight has never looked so good.':'Wolf Chan was caught before everyone could escape. The maze will change next time...';
 ui.endChars.innerHTML='';
 const visible=won?['wolf_chan',...FRIENDS.map(f=>f.id)]:['wolf_chan',...cages.filter(c=>c.freed).map(c=>c.friend.id)];
 for(const id of visible){const img=document.createElement('img');img.src=`assets/faces/${id}.png`;img.alt=id.replaceAll('_',' ');ui.endChars.append(img);}
 ui.endStats.textContent=`${rescued} / 7 rescued  ·  ${Math.floor(elapsed/60)}m ${String(Math.floor(elapsed%60)).padStart(2,'0')}s  ·  ${difficulty.toUpperCase()} MODE`;
 ui.end.classList.add('visible');
}
function startGame(){resetGame();state='playing';audioStart();syncAudioPause();notify('✦  Find keys. Hold E to open cages. Avoid JYP!','info');}
function pauseGame(){
 if(state==='playing'){
  state='paused';input={};touch={};unlockProgress=0;unlockTarget=null;ui.pause.classList.add('visible');
 }else if(state==='paused'){state='playing';ui.pause.classList.remove('visible');}
 syncAudioPause();
}
function toggleMap(){if(state!=='playing'||ui.pause.classList.contains('visible'))return;mapOpen=!mapOpen;unlockProgress=0;unlockTarget=null;ui.mapLegend.hidden=!mapOpen;syncAudioPause();}
$('#startBtn').addEventListener('click',startGame);
$('#resumeBtn').addEventListener('click',pauseGame);
$('#pauseBtn').addEventListener('click',pauseGame);
$('#mapBtn').addEventListener('click',toggleMap);
$('#restartPauseBtn').addEventListener('click',startGame);
$('#restartEndBtn').addEventListener('click',startGame);
document.querySelectorAll('.difficulty').forEach(b=>b.addEventListener('click',()=>{
 difficulty=b.dataset.mode;document.querySelectorAll('.difficulty').forEach(x=>x.classList.toggle('active',x===b));
}));
document.querySelectorAll('.hotbar-slot').forEach(b=>b.addEventListener('click',()=>useItem(b.dataset.item)));
window.addEventListener('keydown',ev=>{
 const k=ev.key.toLowerCase();if(['arrowup','arrowdown','arrowleft','arrowright',' ','shift','m','p','e'].includes(k))ev.preventDefault();
 if(!ev.repeat){
  if(k==='escape'||k==='p'){if(mapOpen){toggleMap();}else pauseGame();return;}
  if(k==='m'){toggleMap();return;}
  if(k==='e'||k===' '){tryRescue();}
  if(['1','2','3'].includes(k)){useItem(['boost','vanish','radar'][Number(k)-1]);return;}
  if(k==='r'&&(state==='won'||state==='lost')){startGame();return;}
 }
 input[k]=true;
});
window.addEventListener('keyup',ev=>{input[ev.key.toLowerCase()]=false;});
window.addEventListener('blur',()=>{input={};touch={};});
window.addEventListener('blur',()=>{input={};touch={};if(state==='playing'&&!mapOpen)pauseGame();});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&state==='playing'&&!mapOpen)pauseGame();});
document.querySelectorAll('[data-direction]').forEach(btn=>{
 const k=btn.dataset.direction;
 btn.addEventListener('pointerdown',ev=>{ev.preventDefault();touch[k]=true;btn.setPointerCapture(ev.pointerId);});
 for(const event of ['pointerup','pointercancel','lostpointercapture'])btn.addEventListener(event,()=>{touch[k]=false;});
});
$('#touchSprint').addEventListener('pointerdown',ev=>{ev.preventDefault();touch.sprint=true;ev.currentTarget.setPointerCapture(ev.pointerId);});
for(const event of ['pointerup','pointercancel','lostpointercapture'])$('#touchSprint').addEventListener(event,()=>{touch.sprint=false;});
$('#touchAction').addEventListener('pointerdown',ev=>{ev.preventDefault();tryRescue();touch.action=true;ev.currentTarget.setPointerCapture(ev.pointerId);});
for(const event of ['pointerup','pointercancel','lostpointercapture'])$('#touchAction').addEventListener(event,()=>{touch.action=false;unlockProgress=0;unlockTarget=null;});
// Aerial dust, torches and lanternlight are drawn on the main canvas to stay responsive.
function roundRect(c,x,y,w,h,r){c.beginPath();c.roundRect(x,y,w,h,r);}
function glow(x,y,r,color){const g=ctx.createRadialGradient(x,y,1,x,y,r);g.addColorStop(0,color);g.addColorStop(1,'transparent');ctx.fillStyle=g;ctx.fillRect(x-r,y-r,r*2,r*2);}
function drawKey(k){
 const s=Math.sin(time*3+k.c*2)*3;
 glow(k.x,k.y,30,'#fbd88033');ctx.save();ctx.translate(k.x,k.y+s);ctx.rotate(-.55);
 ctx.strokeStyle='#ffdfa0';ctx.lineWidth=4;ctx.lineCap='round';ctx.shadowColor='#ffe2a0';ctx.shadowBlur=10;
 ctx.beginPath();ctx.arc(-6,-5,6,0,TWO_PI);ctx.moveTo(-1,0);ctx.lineTo(10,10);ctx.moveTo(5,5);ctx.lineTo(10,0);ctx.moveTo(9,9);ctx.lineTo(14,4);ctx.stroke();ctx.restore();
}
function drawCrate(box){const x=box.x,y=box.y;glow(x,y,22,'#b38bd42e');ctx.save();ctx.translate(x,y);
 ctx.fillStyle='#16111c';ctx.fillRect(-18,-12,36,34);
 ctx.fillStyle='#77536c';roundRect(ctx,-16,-16,32,31,3);ctx.fill();
 ctx.fillStyle='#a06c7c';ctx.fillRect(-13,-12,26,3);ctx.fillRect(-13,9,26,3);
 ctx.strokeStyle='#da9d98';ctx.lineWidth=2;ctx.strokeRect(-12,-10,24,20);
 ctx.beginPath();ctx.moveTo(-12,-10);ctx.lineTo(12,10);ctx.moveTo(12,-10);ctx.lineTo(-12,10);ctx.stroke();
 ctx.fillStyle='#f8e3ba';ctx.font='bold 21px Georgia';ctx.textAlign='center';ctx.fillText('?',0,5);
 ctx.restore();}
function drawCage(c){const x=c.x,y=c.y,f=c.friend;
 glow(x,y,41,'#d69fd51e');ctx.save();ctx.translate(x,y);
 ctx.fillStyle='#100c19aa';ctx.beginPath();ctx.ellipse(0,16,29,12,0,0,TWO_PI);ctx.fill();
 ctx.fillStyle='#4d3b52';roundRect(ctx,-25,-24,50,49,6);ctx.fill();
 ctx.fillStyle='#201721';roundRect(ctx,-21,-21,42,43,4);ctx.fill();
 const img=sprites[f.id];if(img.complete&&img.naturalWidth)ctx.drawImage(img,-17,-19,34,35);
 ctx.strokeStyle='#a38d9b';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(-23,-14);ctx.lineTo(-23,19);ctx.moveTo(23,-14);ctx.lineTo(23,19);ctx.moveTo(-12,-21);ctx.lineTo(-12,21);ctx.moveTo(0,-21);ctx.lineTo(0,21);ctx.moveTo(12,-21);ctx.lineTo(12,21);ctx.stroke();
 ctx.strokeStyle='#c7b5bf';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(-25,-19);ctx.quadraticCurveTo(0,-33,25,-19);ctx.stroke();
 ctx.fillStyle='#dcb17b';roundRect(ctx,-5,5,10,12,2);ctx.fill();ctx.fillStyle='#6c4c53';ctx.fillRect(-1,9,2,5);
 ctx.restore();
 if(c===unlockTarget&&unlockProgress>0){
  ctx.save();ctx.strokeStyle='#201329';ctx.lineWidth=6;ctx.beginPath();ctx.arc(x,y-4,36,0,TWO_PI);ctx.stroke();
  ctx.strokeStyle='#ffe1a2';ctx.lineCap='round';ctx.lineWidth=5;ctx.beginPath();ctx.arc(x,y-4,36,-Math.PI/2,-Math.PI/2+TWO_PI*unlockProgress/UNLOCK_SECONDS);ctx.stroke();ctx.restore();
 }
 if(dist(player,c)<5*T){ctx.font='bold 11px Trebuchet MS';ctx.textAlign='center';ctx.fillStyle='#fae3db';ctx.shadowColor='#08070d';ctx.shadowBlur=6;ctx.fillText(f.name,x,y-37);ctx.shadowBlur=0;}
}
function drawExit(){const x=exitDoor.x,y=exitDoor.y,open=rescued===7;
 glow(x,y,open?100:34,open?'#e8c6fd66':'#f2daa222');ctx.save();ctx.translate(x,y);
 ctx.fillStyle='#0c0911';roundRect(ctx,-26,-34,52,68,9);ctx.fill();
 ctx.strokeStyle=open?'#ffdcaa':'#77657e';ctx.lineWidth=6;ctx.beginPath();ctx.moveTo(-26,30);ctx.lineTo(-26,-18);ctx.quadraticCurveTo(-26,-38,0,-38);ctx.quadraticCurveTo(26,-38,26,-18);ctx.lineTo(26,30);ctx.stroke();
 ctx.fillStyle=open?'#ead6ff':'#393046';roundRect(ctx,-20,-25,40,57,4);ctx.fill();
 if(open){glow(0,0,43,'#fff5d6bb');ctx.fillStyle='#fff4d3';ctx.font='bold 13px Georgia';ctx.textAlign='center';ctx.fillText('EXIT',0,3);}
 else{ctx.fillStyle='#ada0ad';ctx.fillRect(-1,-24,2,56);ctx.font='26px Georgia';ctx.fillStyle='#cfab83';ctx.textAlign='center';ctx.fillText('♜',0,8);}
 ctx.restore();
}
function drawPlayer(){const p=player;
 ctx.save();ctx.translate(p.x,p.y);
 ctx.fillStyle='#0b08149a';ctx.beginPath();ctx.ellipse(0,8,19,8,0,0,TWO_PI);ctx.fill();
 if(effects.speed>0)glow(0,0,41,'#e6ca7566');
 if(effects.vanish>0)glow(0,0,45,'#b7b2ff66');
 const img=sprites.wolf_chan;
 if(p.invuln>0&&Math.floor(time*12)%2===0)ctx.globalAlpha=.42;
 if(effects.vanish>0)ctx.globalAlpha=.53;
 if(p.face<0)ctx.scale(-1,1);
 const bob=p.walking?Math.sin(time*17)*2.4:Math.sin(time*3)*.8;
 if(img.complete&&img.naturalWidth)ctx.drawImage(img,-24,-30+bob,48,47);
 else{ctx.fillStyle='#abb2c9';ctx.fillRect(-12,-25,24,33);}
 ctx.restore();
 if(effects.vanish>0){ctx.strokeStyle='#c2a7ff99';ctx.lineWidth=2;ctx.beginPath();ctx.arc(p.x,p.y-9,26,0,TWO_PI);ctx.stroke();}
}
function drawFollower(c,index){
 const pos=followerPosition(c,index),img=sprites[c.friend.id];
 ctx.save();ctx.translate(pos.x,pos.y);
 ctx.fillStyle='#090a13ac';ctx.beginPath();ctx.ellipse(0,12,15,5,0,0,TWO_PI);ctx.fill();
 glow(0,0,24,'#d9b9ed39');
 if(img.complete&&img.naturalWidth)ctx.drawImage(img,-18,-22+Math.sin(time*5+index)*1.3,36,35);
 else{ctx.fillStyle='#eed6ff';ctx.beginPath();ctx.arc(0,0,12,0,TWO_PI);ctx.fill();}
 ctx.restore();
}
function drawMonster(m){
 ctx.save();ctx.translate(m.x,m.y);
 const aggro=m.mode==='chase'||m.mode==='investigate';
 const bob=Math.sin(time*6+m.index*2)*2.2;
 glow(0,-7,aggro?65:43,aggro?'#ff43736f':'#bd8de04c');
 ctx.fillStyle='#030208bb';ctx.beginPath();ctx.ellipse(0,16,25,8,0,0,TWO_PI);ctx.fill();
 if(aggro){ctx.strokeStyle='#ff7c84';ctx.lineWidth=2.7;ctx.shadowColor='#ff264f';ctx.shadowBlur=12;}
 else{ctx.strokeStyle='#cfb7e3';ctx.lineWidth=2;}
 ctx.beginPath();ctx.arc(0,-9+bob,25,0,TWO_PI);ctx.stroke();ctx.shadowBlur=0;
 const pic=bossSprites[m.index%7];
 if(pic&&pic.complete&&pic.naturalWidth)ctx.drawImage(pic,-27,-36+bob,54,54);
 else{ctx.fillStyle='#e9bcd8';ctx.beginPath();ctx.arc(0,-9+bob,22,0,TWO_PI);ctx.fill();}
 if(m.stun>0){
  ctx.fillStyle='#d7f6ff';ctx.strokeStyle='#76dcff';ctx.shadowColor='#7defff';ctx.shadowBlur=11;
  ctx.font='bold 26px Trebuchet MS';ctx.textAlign='center';ctx.fillText('❄',0,-48+bob);
  ctx.shadowBlur=0;
  ctx.strokeStyle='#acf2ff';ctx.lineWidth=4;
  ctx.beginPath();ctx.arc(0,-9,31,-Math.PI/2,-Math.PI/2+TWO_PI*m.stun/2);ctx.stroke();
 }else if(aggro){ctx.fillStyle='#ffbec8';ctx.font='bold 10px Trebuchet MS';ctx.textAlign='center';ctx.fillText('!',0,-41+bob);}
 ctx.restore();
}
function drawWorld(){
 const cx=clamp(player.x-W*.5,0,WORLD_W-W),cy=clamp(player.y-H*.5,0,WORLD_H-H);
 camera.x+=(cx-camera.x)*.13;camera.y+=(cy-camera.y)*.13;
 const jx=shake?(rng()-.5)*shake:0,jy=shake?(rng()-.5)*shake:0;
 ctx.save();ctx.translate(-camera.x+jx,-camera.y+jy);
 ctx.drawImage(terrain,0,0);
 // Scattered torches along the walls add pools of warm light and cave ambience.
 const left=(camera.x/T|0)-1,right=((camera.x+W)/T|0)+2,top=(camera.y/T|0)-1,bottom=((camera.y+H)/T|0)+2;
 for(let r=Math.max(1,top);r<Math.min(ROWS-1,bottom);r++)for(let c=Math.max(1,left);c<Math.min(COLS-1,right);c++){
   if(!walkable(c,r))continue;const v=hash(c,r,9);
   if(v>.971 && (!walkable(c,r-1)||!walkable(c-1,r))){
     const x=(c+.5)*T,y=(r+.5)*T;glow(x,y,65,'#f3bc6a25');
     ctx.fillStyle='#e8a970';ctx.beginPath();ctx.arc(x,y,2.5+Math.sin(time*6+c)*.6,0,TWO_PI);ctx.fill();
   }
 }
 for(const k of keys)if(!k.collected)drawKey(k);
 for(const box of crates)if(!box.opened)drawCrate(box);
 for(const cage of cages)if(!cage.freed)drawCage(cage);
 drawExit();
 // Up to seven JYP hunters and rescued head-only friends share depth sorting.
 const followers=cages.filter(c=>c.freed);
 const figures=[{y:player.y,draw:drawPlayer},...monsters.map(m=>({y:m.y,draw:()=>drawMonster(m)})),...followers.map((c,i)=>({y:followerPosition(c,i).y,draw:()=>drawFollower(c,i)}))];
 figures.sort((a,b)=>a.y-b.y);for(const figure of figures)figure.draw();
 ctx.restore();
 drawDarkness();
 if(monsters.some(m=>m.mode==='chase')&&state==='playing'){
  ctx.strokeStyle=`rgba(207,65,98,${.18+.06*Math.sin(time*7)})`;ctx.lineWidth=12;ctx.strokeRect(1,1,W-2,H-2);
 }
 if(flash>0){ctx.fillStyle=`rgba(212,51,96,${flash*.23})`;ctx.fillRect(0,0,W,H);}
 if(effects.radar>0){drawRadarEdges();}
 if(mapOpen)drawMap();
}
const darknessLayer=document.createElement('canvas');darknessLayer.width=W;darknessLayer.height=H;
const darknessContext=darknessLayer.getContext('2d');
function drawDarkness(){
 const layer=darknessLayer,c=darknessContext;c.globalCompositeOperation='source-over';c.clearRect(0,0,W,H);
 c.fillStyle='rgba(4,3,10,.78)';c.fillRect(0,0,W,H);
 const radius=effects.fog>0?125:difficulty==='explorer'?370:difficulty==='nightmare'?245:308;
 c.globalCompositeOperation='destination-out';
 const sx=player.x-camera.x,sy=player.y-camera.y;
 const g=c.createRadialGradient(sx,sy,12,sx,sy,radius);
 g.addColorStop(0,'rgba(0,0,0,.98)');g.addColorStop(.32,'rgba(0,0,0,.92)');g.addColorStop(.67,'rgba(0,0,0,.55)');g.addColorStop(1,'rgba(0,0,0,0)');
 c.fillStyle=g;c.fillRect(0,0,W,H);
 // An open exit casts a recognizable beacon even through distant shadows.
 if(rescued===7){const ex=exitDoor.x-camera.x,ey=exitDoor.y-camera.y;
  const gg=c.createRadialGradient(ex,ey,5,ex,ey,125);gg.addColorStop(0,'rgba(0,0,0,.9)');gg.addColorStop(1,'rgba(0,0,0,0)');c.fillStyle=gg;c.fillRect(ex-125,ey-125,250,250);
 }
 ctx.drawImage(layer,0,0);
 // vignette
 const vignette=ctx.createRadialGradient(W/2,H/2,Math.min(W,H)*.29,W/2,H/2,W*.8);
 vignette.addColorStop(0,'#08061300');vignette.addColorStop(1,'#0301098c');ctx.fillStyle=vignette;ctx.fillRect(0,0,W,H);
}
function drawRadarEdges(){
 const all=[...keys.filter(k=>!k.collected).map(k=>({...k,color:'#ffdc8a'})),
 ...cages.filter(c=>!c.freed).map(c=>({...c,color:'#e5b7ed'}))];
 for(const o of all){const x=o.x-camera.x,y=o.y-camera.y;
  if(x>=0&&x<=W&&y>=0&&y<=H){ctx.strokeStyle=o.color;ctx.lineWidth=2;ctx.beginPath();ctx.arc(x,y,24+Math.sin(time*4)*4,0,TWO_PI);ctx.stroke();}
  else{let ex=clamp(x,25,W-25),ey=clamp(y,25,H-25);ctx.fillStyle=o.color;ctx.beginPath();ctx.arc(ex,ey,4.5,0,TWO_PI);ctx.fill();}
 }
}
function drawMap(){
 ctx.save();ctx.fillStyle='#0e0919e9';ctx.fillRect(0,0,W,H);
 const scale=Math.min((W-100)/COLS,(H-125)/ROWS),offX=(W-COLS*scale)/2,offY=(H-ROWS*scale)/2+8;
 ctx.fillStyle='#362b42';roundRect(ctx,offX-14,offY-15,COLS*scale+28,ROWS*scale+30,12);ctx.fill();
 ctx.strokeStyle='#a48aaa';ctx.stroke();
 for(let r=0;r<ROWS;r++)for(let col=0;col<COLS;col++){
  const known=fog[cellID(col,r)]||effects.radar>0;
  ctx.fillStyle=known?(walkable(col,r)?'#76617d':'#302839'):'#181521';
  ctx.fillRect(offX+col*scale,offY+r*scale,scale+.2,scale+.2);
 }
 function mark(obj,color,size=5){if(fog[cellID(obj.c,obj.r)]||effects.radar>0){ctx.fillStyle=color;ctx.beginPath();ctx.arc(offX+(obj.c+.5)*scale,offY+(obj.r+.5)*scale,size,0,TWO_PI);ctx.fill();}}
 for(const k of keys)if(!k.collected)mark(k,'#f2d28d',4);
 for(const c of cages)if(!c.freed&&c.known)mark(c,'#e8b4e5',5);
 if(rescued===7)mark(exitDoor,'#ccffdc',6);
 for(const m of monsters)if(m.mode==='chase')mark({...cellOf(m)},'#ff7890',5);
 mark({...cellOf(player)},'#fdf4ed',6);
 ctx.font='bold 17px Trebuchet MS';ctx.textAlign='center';ctx.fillStyle='#e9d5f2';ctx.fillText('THE HOLLOW • DISCOVERED PATHS',W/2,31);
 ctx.font='12px Trebuchet MS';ctx.fillStyle='#bcacc7';ctx.fillText('M TO CLOSE · MYSTERY CRATES ARE NOT REVEALED · TIME IS PAUSED',W/2,H-22);
 ctx.restore();
}
function drawFrame(){ctx.clearRect(0,0,W,H);if(terrain)drawWorld();}
let previous=performance.now(),hudClock=0;
function loop(now){
 const dt=Math.min((now-previous)/1000,.045);previous=now;time+=dt;frameCount++;
 if(state==='playing'&&!mapOpen){elapsed+=dt;updateEffects(dt);updatePlayer(dt);updateAudio();updateFriendDefense(dt);if(state==='playing'){for(const m of monsters){if(state!=='playing')break;updateMonster(m,dt);}}
   hudClock+=dt;if(hudClock>.17){updateIndicators();hudClock=0;}
 }
 if(time>toastUntil&&ui.toast.childElementCount)ui.toast.innerHTML='';
 if(hunterAnnouncementUntil&&time>hunterAnnouncementUntil){$('#hunterAnnouncement').classList.remove('active');hunterAnnouncementUntil=0;}
 drawFrame();requestAnimationFrame(loop);
}
resetGame();state='menu';ui.menu.classList.add('visible');updateIndicators();requestAnimationFrame(loop);
