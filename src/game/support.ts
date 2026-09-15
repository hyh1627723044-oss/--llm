import type { Battle, SupportSkill, SupportTactics, Unit } from './types';

export const DEFAULT_SUPPORT:SupportTactics={healAt:.7,buffTarget:'strongest',weakenWhen:'heavy'};
export const SUPPORT_SKILLS={
 heal:{name:'愈合祷言',cooldown:6,castTime:.45,range:280,amount:45,duration:0},
 empower:{name:'锋芒祝福',cooldown:9,castTime:.35,range:280,amount:.25,duration:4},
 weaken:{name:'虚弱咒印',cooldown:10,castTime:.25,range:280,amount:.25,duration:4}
} as const;

export function describeSupportSkill(skill:SupportSkill){
 const spec=SUPPORT_SKILLS[skill];
 return skill==='heal'?`恢复 ${spec.amount} 点生命`:
  `${skill==='empower'?'队友攻击 +':'敌人攻击 -'}${spec.amount*100}%，持续 ${spec.duration} 秒`;
}

export function validateSupport(value:unknown):SupportTactics {
 if(!value||typeof value!=='object')throw new Error('辅助战术无效。');
 const s=value as Record<string,unknown>;
 if(Object.keys(s).some(k=>!['healAt','buffTarget','weakenWhen'].includes(k))||
 ![.4,.7,.9].includes(s.healAt as number)||
 !['strongest','archer','assassin'].includes(s.buffTarget as string)||
 !['heavy','engaged'].includes(s.weakenWhen as string))throw new Error('辅助战术超出允许范围。');
 return {healAt:s.healAt as number,buffTarget:s.buffTarget as SupportTactics['buffTarget'],weakenWhen:s.weakenWhen as SupportTactics['weakenWhen']};
}

const distance=(a:Unit,b:Unit)=>Math.hypot(a.x-b.x,a.y-b.y);
function note(b:Battle,u:Unit,type:'cast'|'heal'|'info',text:string){
 b.events.push({time:b.time,type,actor:u.id,text});
 if(b.events.length>400)b.events.shift();
}

// One shared casting action, three independent cooldowns. Cooldown starts on cast,
// including interrupted/failed casts; haste only affects movement and basic attacks.
export function beginSupportSkill(b:Battle,u:Unit):boolean {
 if(u.role!=='support'||u.hp<=0||u.skillCast||u.attack)return false;
 const policy=u.strategy.support??DEFAULT_SUPPORT;
 const allies=b.units.filter(v=>v.team===u.team&&v.hp>0);
 const enemies=b.units.filter(v=>v.team!==u.team&&v.hp>0);
 const cds=u.skillCooldowns??(u.skillCooldowns={heal:0,empower:0,weaken:0});
 const inRange=(v:Unit,skill:SupportSkill)=>distance(u,v)<=SUPPORT_SKILLS[skill].range;
 const engaged=(v:Unit)=>enemies.some(e=>distance(v,e)<=v.range+35);
 let skill:SupportSkill|undefined,target:Unit|undefined;
 if(cds.heal<=0){
  target=allies.filter(v=>inRange(v,'heal')&&v.hp/v.maxHp<=policy.healAt)
   .sort((a,z)=>a.hp/a.maxHp-z.hp/z.maxHp)[0];
  if(target)skill='heal';
 }
 if(!skill&&cds.weaken<=0){
  target=enemies.filter(v=>inRange(v,'weaken')&&(v.weakenUntil??0)<=b.time&&
   (policy.weakenWhen==='heavy'?v.attack?.kind==='heavy':allies.some(a=>distance(v,a)<=v.range+35)))
   .sort((a,z)=>Number(z.attack?.kind==='heavy')-Number(a.attack?.kind==='heavy')||z.damage/z.period-a.damage/a.period)[0];
  if(target)skill='weaken';
 }
 if(!skill&&cds.empower<=0){
  const candidates=allies.filter(v=>v.id!==u.id&&inRange(v,'empower')&&engaged(v)&&Math.max(v.empowerUntil??0,v.rallyUntil)<=b.time);
  target=candidates.sort((a,z)=>Number(z.role===policy.buffTarget)-Number(a.role===policy.buffTarget)||z.damage/z.period-a.damage/a.period)[0];
  if(target)skill='empower';
 }
 if(!skill||!target)return false;
 const spec=SUPPORT_SKILLS[skill];
 cds[skill]=spec.cooldown;u.skillCast={skill,target:target.id,remaining:spec.castTime};
 u.intent=`吟唱${spec.name}`;u.face=target.x>=u.x?1:-1;
 note(b,u,'cast',`${u.name}对${target.name}施放${spec.name}`);
 return true;
}

export function resolveSupportSkill(b:Battle,u:Unit,dt:number):boolean {
 const cast=u.skillCast;if(!cast)return false;
 cast.remaining-=dt;if(cast.remaining>0)return true;
 u.skillCast=undefined;
 const spec=SUPPORT_SKILLS[cast.skill],target=b.units.find(v=>v.id===cast.target&&v.hp>0);
 if(!target||distance(u,target)>spec.range||(cast.skill==='weaken'?target.team===u.team:target.team!==u.team)){
  note(b,u,'info',`${spec.name}未生效：目标倒下或离开施法范围`);return true;
 }
 let text:string,color:string;
 if(cast.skill==='heal'){
  const amount=Math.min(SUPPORT_SKILLS.heal.amount,target.maxHp-target.hp);
  target.hp+=amount;b.healing[u.id]=(b.healing[u.id]||0)+amount;
  text=`+${amount}`;color='#8ee4b5';note(b,u,'heal',`${u.name}治疗${target.name} · 实际恢复 ${amount}`);
 }else if(cast.skill==='empower'){
  target.empowerUntil=b.time+spec.duration;text='攻击 ↑';color='#e7cc7c';
  note(b,u,'info',`${target.name}获得${spec.name}：${describeSupportSkill('empower')}（与协同追击取最高值）`);
 }else{
  target.weakenUntil=b.time+spec.duration;text='虚弱 ↓';color='#bf9fe6';
  note(b,u,'info',`${target.name}受到${spec.name}：${describeSupportSkill('weaken')}`);
 }
 b.effects.push({kind:'heal',x:target.x,y:target.y-40,tx:target.x,ty:target.y-65,life:.9,maxLife:.9,color,text});
 return true;
}
