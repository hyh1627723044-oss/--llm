import { DEFAULT_SUPPORT, SUPPORT_SKILLS, describeSupportSkill } from './game/support';
import { HEROES } from './game/data';
import type { SupportTactics, Unit } from './game/types';

export function SupportPanel({unit,tactics,editable,running,onChange}:{unit:Unit;tactics?:SupportTactics;editable:boolean;running:boolean;onChange:(value:SupportTactics)=>void}){
 const policy=tactics??DEFAULT_SUPPORT;
 return <section className="support-panel" aria-label="司祭技能与释放时机">
  <h3>技能与释放时机</h3>
  <p>先治疗，再虚弱，再祝福。三项技能独立冷却，同一时间只能吟唱一项。</p>
  <div className="support-skills">{(Object.keys(SUPPORT_SKILLS) as Array<keyof typeof SUPPORT_SKILLS>).map(key=>{
   const skill=SUPPORT_SKILLS[key],remaining=unit.skillCooldowns?.[key]??0;
   return <div key={key}><strong>{skill.name}</strong><span>{running?(unit.skillCast?.skill===key?'吟唱中':remaining>0?`${remaining.toFixed(1)} 秒`:'就绪'):`CD ${skill.cooldown} 秒`}</span><small>{describeSupportSkill(key)} · 吟唱 {skill.castTime} 秒 · 范围 {skill.range}</small></div>;
  })}</div>
  <label>治疗时机<select disabled={!editable} value={policy.healAt} onChange={e=>onChange({...policy,healAt:Number(e.target.value)})}><option value={.4}>紧急：生命 ≤40%</option><option value={.7}>均衡：生命 ≤70%</option><option value={.9}>提前：生命 ≤90%</option></select></label>
  <label>祝福优先对象<select disabled={!editable} value={policy.buffTarget} onChange={e=>onChange({...policy,buffTarget:e.target.value as SupportTactics['buffTarget']})}><option value="strongest">高输出队友</option><option value="archer">射手</option><option value="assassin">刺客</option></select></label>
  <label>虚弱释放时机<select disabled={!editable} value={policy.weakenWhen} onChange={e=>onChange({...policy,weakenWhen:e.target.value as SupportTactics['weakenWhen']})}><option value="heavy">保留到敌人蓄力重击</option><option value="engaged">敌人接敌时释放</option></select></label>
  <p>治疗优先血量比例最低者。祝福只给正在交战的队友，首选不可用时改选其他人；与协同追击取最高值。基础普攻 {HEROES.support.damage} 点，攻速成长不缩短技能 CD。闪避会打断吟唱，已开始的冷却不返还。</p>
 </section>;
}
