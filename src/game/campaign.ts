import { DEFAULT_STRATEGY, ROLES } from './data';
import { DEFAULT_SUPPORT, validateSupport } from './support';
import type { Campaign, Proposal, Role, Upgrade } from './types';
export function newCampaign():Campaign{return {version:1,stage:0,wins:0,rewardAvailable:false,rewardClaimed:false,outcome:null,heroes:{support:{strategy:{...DEFAULT_STRATEGY,support:{...DEFAULT_SUPPORT}},upgrades:[],slot:3},guard:{strategy:{...DEFAULT_STRATEGY},upgrades:[],slot:1},archer:{strategy:{...DEFAULT_STRATEGY},upgrades:[],slot:4},assassin:{strategy:{...DEFAULT_STRATEGY},upgrades:[],slot:2}}};}
export function finishBattle(c:Campaign,result:'victory'|'defeat'){
 if(c.outcome!==null)return;
 c.outcome=result;c.rewardAvailable=result==='victory'&&c.stage<3;c.rewardClaimed=false;
 if(result==='victory')c.wins++;
}
export function upgradeIssue(c:Campaign,role:Role,u:Upgrade):string|null{
 const list=c.heroes[role].upgrades;
 if(['dodge','counter','rally'].includes(u)&&list.includes(u))return '已经掌握这个能力，请选择另一种强化。';
 if(u==='counter'&&!list.includes('dodge'))return '先学会“识破重击”，才能获得闪避反击。';
 if(u==='rally'&&!list.includes('counter'))return '先获得“闪避反击”，才能触发协同追击。';
 return null;
}
export function claimReward(c:Campaign,p:Proposal){
 if(!c.rewardAvailable||c.rewardClaimed||p.kind!=='upgrade'||!p.upgrade||p.role==='team')throw new Error('当前没有可领取的强化。');
 const issue=upgradeIssue(c,p.role,p.upgrade);if(issue)throw new Error(issue);
 c.heroes[p.role].upgrades.push(p.upgrade);
 if(p.upgrade==='dodge')c.heroes[p.role].strategy.dodge=true;
 c.rewardClaimed=true;c.rewardAvailable=false;
}
export function nextEncounter(c:Campaign){if(c.outcome!=='victory'||!c.rewardClaimed||c.stage>=3)throw new Error('请先领取强化。');c.stage++;c.outcome=null;c.rewardClaimed=false;}
export function restoreCampaign(raw:string):Campaign{
 const p=JSON.parse(raw);if(p?.version!==1||!Number.isInteger(p.stage)||p.stage<0||p.stage>3)throw new Error('存档版本无效');
 const c=newCampaign();const slots=new Set<number>();
 for(const r of ROLES){const h=p.heroes?.[r];if(r==='support'&&h===undefined)continue;if(!h||!Number.isInteger(h.slot)||h.slot<0||h.slot>5||slots.has(h.slot)||!Array.isArray(h.upgrades)||h.upgrades.length>3||h.upgrades.some((u:string)=>!['power','vitality','haste','dodge','counter','rally'].includes(u)))throw new Error('存档角色无效');slots.add(h.slot);
  const s=h.strategy;if(!s||!['nearest','ranged','weakest'].includes(s.target)||['dodge','retreat','wait','protect'].some(k=>typeof s[k]!=='boolean'))throw new Error('存档战术无效');
  c.heroes[r]={slot:h.slot,upgrades:[...h.upgrades],strategy:{target:s.target,dodge:s.dodge,retreat:s.retreat,wait:s.wait,protect:s.protect,...(r==="support"?{support:s.support===undefined?{...DEFAULT_SUPPORT}:validateSupport(s.support)}:{})}};
 }
 if(p.heroes?.support===undefined)c.heroes.support.slot=[0,1,2,3,4,5].find(slot=>!slots.has(slot))!;
 if(Object.values(c.heroes).reduce((s,h)=>s+h.upgrades.length,0)>3)throw new Error('存档强化超出限制');
 c.stage=p.stage;c.wins=Number.isInteger(p.wins)?Math.max(0,Math.min(4,p.wins)):0;
 c.outcome=['victory','defeat'].includes(p.outcome)?p.outcome:null;
 c.rewardClaimed=c.outcome==='victory'&&p.rewardClaimed===true&&c.stage<3;
 c.rewardAvailable=c.outcome==='victory'&&!c.rewardClaimed&&c.stage<3;
 return c;
}
