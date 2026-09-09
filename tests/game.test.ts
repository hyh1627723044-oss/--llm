import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBattle, stepBattle } from '../src/game/engine';
import { newCampaign, claimReward, finishBattle, nextEncounter } from '../src/game/campaign';
import { localCompile, validateProposal } from '../src/game/rules';

test('battle advances only while running and stops with a finite result', () => {
 const b=createBattle(newCampaign()); const before=b.units.map(u=>u.hp);
 stepBattle(b,1/30); assert.deepEqual(b.units.map(u=>u.hp),before); assert.equal(b.time,0);
 b.phase='running'; for(let i=0;i<5400&&b.phase==='running';i++) stepBattle(b,1/30);
 assert.notEqual(b.phase,'running'); assert.ok(b.events.some(e=>e.type==='damage'));
 assert.ok(b.units.every(u=>Number.isFinite(u.x)&&u.hp>=0));
});
test('dodge strategy avoids a telegraphed heavy hit with the learned ability', () => {
 const c=newCampaign(); c.stage=3; c.heroes.guard.upgrades=['dodge']; c.heroes.guard.strategy.dodge=true;
 const b=createBattle(c); b.phase='running'; const guard=b.units.find(u=>u.id==='guard')!;
 const boss=b.units.find(u=>u.role==='boss')!;
 guard.x=420;guard.y=270;boss.x=460;boss.y=270;
 boss.attack={kind:'heavy',remaining:.5,x:420,y:270,radius:65,target:'guard'};
 const hp=guard.hp; for(let i=0;i<20;i++)stepBattle(b,1/30);
 assert.equal(guard.hp,hp);assert.ok(b.events.some(e=>e.type==='dodge'&&e.actor==='guard'));
});
test('target instruction makes assassin select enemy archer', () => {
 const c=newCampaign(); c.stage=1;c.heroes.assassin.strategy.target='ranged';
 const b=createBattle(c);b.phase='running';stepBattle(b,1/30);
 const a=b.units.find(u=>u.id==='assassin')!;
 assert.equal(b.units.find(u=>u.id===a.targetId)?.role,'archer');
});
test('a dodger does not walk back into the full heavy windup',()=>{
 const c=newCampaign();c.stage=3;c.heroes.guard.upgrades=['dodge'];c.heroes.guard.strategy.dodge=true;
 const b=createBattle(c);b.units=b.units.filter(u=>u.id==='guard'||u.role==='boss');b.phase='running';
 const g=b.units.find(u=>u.id==='guard')!,boss=b.units.find(u=>u.role==='boss')!;
 g.x=560;g.y=260;boss.x=500;boss.y=260;boss.cooldown=3;
 boss.attack={kind:'heavy',remaining:1.05,x:560,y:260,radius:72,target:'guard'};
 for(let i=0;i<33;i++)stepBattle(b,1/30);
 assert.equal(g.hp,250,'The taught dodge must survive the actual heavy windup.');
});
test('reward cannot be claimed before victory or more than once', () => {
 const c=newCampaign();const p=localCompile('upgrade','提高攻击力','archer');
 assert.throws(()=>claimReward(c,p)); finishBattle(c,'victory');claimReward(c,p);
 assert.equal(c.heroes.archer.upgrades.length,1);assert.throws(()=>claimReward(c,p));
 nextEncounter(c);assert.equal(c.stage,1);assert.equal(c.rewardAvailable,false);
});
test('rejects illegal model actions and excessive buff requests', () => {
 assert.throws(()=>validateProposal({kind:'upgrade',role:'guard',upgrade:'invincible',summary:'无敌'}));
 const p=localCompile('upgrade','攻击力增加一万倍','guard');
 assert.equal(p.upgrade,'power');assert.ok(!p.summary.includes('一万'));
});
test('local compiler is explicitly labelled and rejects unsupported requests', () => {
 const p=localCompile('strategy','优先攻击后排，学会躲避重击','assassin');
 assert.equal(p.source,'local');assert.equal(p.strategy?.target,'ranged');assert.equal(p.strategy?.dodge,true);
 assert.throws(()=>localCompile('strategy','召唤一条龙','guard'));
});
