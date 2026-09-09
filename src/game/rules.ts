import { DEFAULT_STRATEGY, ROLES, UPGRADES } from './data';
import type { Proposal, Strategy } from './types';
export function validateProposal(value:unknown):Proposal {
 if(!value||typeof value!=='object')throw new Error('没有收到有效的规则。');
 const p=value as Record<string,unknown>;
 if(!['strategy','upgrade'].includes(String(p.kind))||![...ROLES,'team'].includes(p.role as never))throw new Error('规则类型或角色无效。');
 if(typeof p.summary!=='string'||!p.summary.trim()||p.summary.length>350)throw new Error('规则说明无效。');
 const result:Proposal={kind:p.kind as Proposal['kind'],role:p.role as Proposal['role'],summary:p.summary,source:p.source==='deepseek'?'deepseek':'local'};
 if(result.kind==='strategy'){
  const s=p.strategy as Record<string,unknown>;
  if(!s||typeof s!=='object'||!['nearest','ranged','weakest'].includes(String(s.target)))throw new Error('目标选择无效。');
  const keys=['target','dodge','retreat','wait','protect'];
  if(Object.keys(s).some(k=>!keys.includes(k))||keys.slice(1).some(k=>typeof s[k]!=='boolean'))throw new Error('战术包含不支持的动作。');
  result.strategy={target:s.target,dodge:s.dodge,retreat:s.retreat,wait:s.wait,protect:s.protect} as Strategy;
 }else{
  if(result.role==='team'||typeof p.upgrade!=='string'||!Object.hasOwn(UPGRADES,p.upgrade))throw new Error('请选择一名角色和有效的强化。');
  result.upgrade=p.upgrade as Proposal['upgrade'];
 }
 // All executable fields are whitelisted; model-supplied numbers and code are never used.
 return result;
}
export function describeStrategy(s:Strategy){
 return [s.target==='ranged'?'优先攻击远程后排':s.target==='weakest'?'优先攻击最低血量目标':'攻击最近的敌人',s.dodge?'发现重击时尝试闪避（需已解锁）':'',s.retreat?'生命低于 30% 时后撤':'',s.wait?'等待前排接敌后再行动':'',s.protect?'优先拦截威胁射手的敌人':''].filter(Boolean).join('；');
}
export function localCompile(kind:'strategy'|'upgrade',text:string,role:Proposal['role']):Proposal{
 if(!text.trim()||text.length>600)throw new Error('请输入 1–600 字的战术或强化愿望。');
 if(kind==='upgrade'){
  const upgrade=/集火|协同|队友|追击/.test(text)?'rally':/反击/.test(text)?'counter':/躲|闪避/.test(text)?'dodge':/生命|血|护甲|防御|坚韧/.test(text)?'vitality':/速度|攻速|移动|疾风/.test(text)?'haste':/攻击|伤害|力量|锋芒/.test(text)?'power':null;
  if(!upgrade)throw new Error('本地演示支持：攻击、生命、攻速、闪避、闪避反击、协同追击。连接 DeepSeek 后可用更自由的表达。');
  return validateProposal({kind,role,upgrade,summary:UPGRADES[upgrade].description,source:'local'});
 }
 if(!/攻击|后排|远程|集火|残血|最近|躲|闪避|撤|保|等待|接敌|默认/.test(text))throw new Error('本地演示未识别这条指令。试试“优先攻击后排”或“保护射手”。');
 const strategy={...DEFAULT_STRATEGY,target:/后排|远程/.test(text)?'ranged':/残血|最低|虚弱/.test(text)?'weakest':'nearest',dodge:/躲|闪避/.test(text),retreat:/后撤|撤退|低血|血少/.test(text),wait:/等待|接敌后/.test(text),protect:/保护|护卫/.test(text)} as Strategy;
 return validateProposal({kind,role,strategy,summary:describeStrategy(strategy),source:'local'});
}
