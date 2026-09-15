import { DEFAULT_STRATEGY, ENCOUNTERS, HEROES, OBSTACLES, ROLES, SLOTS } from './data';
import type { Battle, BattleEvent, Campaign, Role, Unit } from './types';

const distance=(a:{x:number;y:number},b:{x:number;y:number})=>Math.hypot(a.x-b.x,a.y-b.y);
export function createBattle(c:Campaign):Battle {
 const units:Unit[]=ROLES.map(role=>{
  const h=c.heroes[role],d=HEROES[role],at=SLOTS[h.slot];
  const count=(u:string)=>h.upgrades.filter(x=>x===u).length;
  const maxHp=Math.round(d.hp*(1+.25*count('vitality')));
  return {id:role,name:d.name,role,team:'ally',...at,hp:maxHp,maxHp,damage:d.damage*(1+.2*count('power')),range:d.range,speed:d.speed*(1+.15*count('haste')),period:d.period/(1+.15*count('haste')),cooldown:.15,strategy:{...h.strategy},upgrades:[...h.upgrades],intent:'等待部署',face:1,flash:0,dodgeCooldown:0,immune:0,counterUntil:0,rallyUntil:0};
 });
 ENCOUNTERS[c.stage].roles.forEach((role,i)=>{
  const boss=role==='boss',d=boss?{hp:710,damage:30,range:60,speed:47,period:2.2}:HEROES[role as Role];
  const mult=ENCOUNTERS[c.stage].mult,hp=Math.round(d.hp*mult);
  units.push({id:`enemy-${i}`,name:boss?'重锤守门人':role==='guard'?'铁甲掠夺者':role==='archer'?'荒原弓手':'暗影追猎者',role,team:'enemy',x:role==='archer'?770:650,y:ENCOUNTERS[c.stage].roles.length===2?210+i*120:150+i*110,hp,maxHp:hp,damage:d.damage*mult,range:d.range,speed:d.speed*.94,period:d.period,cooldown:.6+i*.25,strategy:{...DEFAULT_STRATEGY,target:role==='assassin'?'ranged':'nearest'},upgrades:[],intent:'等待交战',face:-1,flash:0,dodgeCooldown:0,immune:0,counterUntil:0,rallyUntil:0});
 });
 return {stage:c.stage,time:0,phase:'ready',units,events:[],effects:[],damage:{},damageTaken:{},dodges:{}};
}
function emit(b:Battle,type:BattleEvent['type'],actor:string,text:string){b.events.push({time:b.time,type,actor,text});if(b.events.length>400)b.events.shift();}
function blocked(x:number,y:number){return x<35||x>865||y<56||y>480||OBSTACLES.some(o=>x>o.x-16&&x<o.x+o.w+16&&y>o.y-16&&y<o.y+o.h+16);}
function move(u:Unit,tx:number,ty:number,amount:number){
 const dx=tx-u.x,dy=ty-u.y,len=Math.hypot(dx,dy);if(len<1)return;
 const step=Math.min(amount,len),nx=dx/len,ny=dy/len;
 const direct={x:u.x+nx*step,y:u.y+ny*step};
 if(!blocked(direct.x,direct.y)){u.x=direct.x;u.y=direct.y;return;}
 // Route around the nearest side of a pillar, keeping the central passage open.
 const obstacle=OBSTACLES.find(o=>u.x>o.x-40&&u.x<o.x+o.w+40&&u.y>o.y-40&&u.y<o.y+o.h+40);
 if(obstacle){const wy=obstacle.y<260?obstacle.y+obstacle.h+24:obstacle.y-24;const sy=Math.sign(wy-u.y)*step;if(!blocked(u.x,u.y+sy)){u.y+=sy;return;}}
 if(!blocked(direct.x,u.y))u.x=direct.x;else if(!blocked(u.x,direct.y))u.y=direct.y;
}
function targetFor(b:Battle,u:Unit){
 let enemies=b.units.filter(v=>v.team!==u.team&&v.hp>0);
 if(u.strategy.protect){const archer=b.units.find(v=>v.team===u.team&&v.role==='archer'&&v.hp>0);if(archer){const threats=enemies.filter(v=>distance(v,archer)<160);if(threats.length)enemies=threats;}}
 if(u.strategy.target==='ranged'){const ranged=enemies.filter(v=>v.role==='archer');if(ranged.length)enemies=ranged;}
 return enemies.sort((a,z)=>u.strategy.target==='weakest'?a.hp-z.hp||distance(u,a)-distance(u,z):distance(u,a)-distance(u,z))[0];
}
function hit(b:Battle,u:Unit,t:Unit,heavy=false){
 if(t.hp<=0||t.immune>0)return;
 const counter=u.counterUntil>b.time&&u.upgrades.includes('counter');
 const damage=Math.min(t.hp,Math.round(u.damage*(heavy?2.1:1)*(counter?1.8:1)*(u.rallyUntil>b.time?1.25:1)));
 t.hp=Math.max(0,t.hp-damage);t.flash=.22;
 b.damage[u.id]=(b.damage[u.id]||0)+damage;b.damageTaken[t.id]=(b.damageTaken[t.id]||0)+damage;
 b.effects.push({kind:'hit',x:t.x,y:t.y-35,tx:t.x,ty:t.y-60,life:.7,maxLife:.7,color:counter?'#edcb78':t.team==='ally'?'#ec8b80':'#e8d9b0',text:`${counter?'反击 ':''}−${damage}`});
 emit(b,counter?'counter':'damage',u.id,`${u.name}${counter?'触发反击':heavy?'重击':'命中'}${t.name} · ${damage}`);
 if(counter){u.counterUntil=0;if(u.upgrades.includes('rally')){b.units.filter(v=>v.team===u.team&&v.hp>0).forEach(v=>v.rallyUntil=b.time+3);emit(b,'info',u.id,'协同追击：队友伤害提高 25%，持续 3 秒');}}
 if(t.hp===0){t.intent='已倒下';t.attack=undefined;emit(b,'kill',u.id,`${t.name}倒下了`);}
}
export function stepBattle(b:Battle,dt:number){
 if(b.phase!=='running'||!Number.isFinite(dt)||dt<=0)return;
 dt=Math.min(dt,.1);b.time+=dt;
 b.effects.forEach(e=>e.life-=dt);b.effects=b.effects.filter(e=>e.life>0);
 const alive=b.units.filter(u=>u.hp>0);
 // React before resolving telegraphed attacks; this never requests a model.
 for(const u of alive){
  u.flash=Math.max(0,u.flash-dt);u.immune=Math.max(0,u.immune-dt);u.dodgeCooldown=Math.max(0,u.dodgeCooldown-dt);u.cooldown-=dt;
  const threat=alive.find(v=>v.team!==u.team&&v.attack?.kind==='heavy'&&distance(u,v.attack)<v.attack.radius+12);
  if(threat?.attack&&u.strategy.dodge&&u.upgrades.includes('dodge')&&u.dodgeCooldown<=0){
   const old={x:u.x,y:u.y};const center=threat.attack;
   const angle=distance(u,center)<1?Math.atan2(u.y-threat.y,u.x-threat.x):Math.atan2(u.y-center.y,u.x-center.x);
   for(const offset of [0,Math.PI/2,-Math.PI/2,Math.PI]){const x=u.x+Math.cos(angle+offset)*105,y=u.y+Math.sin(angle+offset)*105;if(!blocked(x,y)){u.x=x;u.y=y;break;}}
   u.immune=.8;u.dodgeCooldown=4;u.counterUntil=b.time+3;u.attack=undefined;u.intent='闪避重击';
   b.dodges[u.id]=(b.dodges[u.id]||0)+1;b.effects.push({kind:'dodge',...old,tx:u.x,ty:u.y,life:.4,maxLife:.4,color:'#77d7cb'});emit(b,'dodge',u.id,`${u.name}识破重击，闪避成功`);
  }
 }
 for(const u of alive){
  if(u.hp<=0)continue;
  if(u.attack){
   u.attack.remaining-=dt;
   if(u.attack.remaining<=0){const attack=u.attack;u.attack=undefined;
    if(attack.kind==='heavy'){b.effects.push({kind:'slash',x:attack.x,y:attack.y,tx:attack.x,ty:attack.y,life:.45,maxLife:.45,color:'#ee9276'});for(const t of b.units.filter(v=>v.team!==u.team&&v.hp>0&&distance(v,attack)<attack.radius))hit(b,u,t,true);}
    else {const t=b.units.find(v=>v.id===attack.target&&v.hp>0);if(t&&distance(u,t)<=u.range+35){hit(b,u,t);b.effects.push({kind:u.role==='archer'?'arrow':'slash',x:u.x,y:u.y-15,tx:t.x,ty:t.y-15,life:.22,maxLife:.22,color:u.team==='ally'?'#d4c38a':'#d7807d'});}}
   }continue;
  }
  if(u.immune>.45)continue;
  // A successful sidestep must not immediately path back into the same windup.
  if(u.strategy.dodge&&u.upgrades.includes('dodge')&&u.dodgeCooldown>2.5&&alive.some(v=>v.team!==u.team&&v.attack?.kind==='heavy'&&distance(u,v.attack)<v.attack.radius+120)){
   u.intent='等待重击落地';continue;
  }
  const t=targetFor(b,u);if(!t)continue;u.targetId=t.id;u.face=t.x>=u.x?1:-1;
  if(u.strategy.retreat&&u.hp/u.maxHp<.3&&distance(u,t)<180){u.intent='低血量后撤';move(u,u.x+(u.x-t.x),u.y+(u.y-t.y),u.speed*dt);continue;}
  if(u.strategy.wait&&u.role!=='guard'&&b.time<7){const front=alive.find(v=>v.team===u.team&&(v.role==='guard'||v.role==='boss'));if(front&&b.units.every(v=>v.team===u.team||v.hp<=0||distance(front,v)>75)){u.intent='等待前排接敌';continue;}}
  const gap=distance(u,t);
  if(u.role==='archer'&&gap<105&&u.cooldown>0){u.intent='保持射程';move(u,u.x+(u.x-t.x),u.y+(u.y-t.y),u.speed*dt);}
  else if(gap>u.range){u.intent=u.strategy.protect?'回防拦截':u.strategy.target==='ranged'?'突袭后排':'接近目标';move(u,t.x,t.y,u.speed*dt);}
  else if(u.cooldown<=0){const heavy=u.role==='boss'||(u.team==='enemy'&&u.role==='guard'&&b.stage===2);u.intent=heavy?'蓄力重击':u.role==='archer'?'瞄准射击':'发动攻击';u.attack={kind:heavy?'heavy':'normal',remaining:heavy?1.05:.22,x:t.x,y:t.y,radius:heavy?72:0,target:t.id};u.cooldown=u.period+(heavy?.8:0);if(heavy)emit(b,'cast',u.id,`${u.name}开始蓄力 · 离开红色区域`);}
  else u.intent='寻找出手机会';
 }
 // Separate overlapping bodies without moving through scenery.
 for(let i=0;i<alive.length;i++)for(let j=i+1;j<alive.length;j++){const a=alive[i],z=alive[j],d=distance(a,z);if(d<25&&d>.1){const push=(25-d)*.5;move(a,a.x+(a.x-z.x),a.y+(a.y-z.y),push);move(z,z.x+(z.x-a.x),z.y+(z.y-a.y),push);}}
 if(!b.units.some(u=>u.team==='enemy'&&u.hp>0))b.phase='victory';
 else if(!b.units.some(u=>u.team==='ally'&&u.hp>0)||b.time>=120)b.phase='defeat';
}
