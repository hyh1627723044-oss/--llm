import {useCallback,useEffect,useRef,useState} from 'react';
import {Battlefield} from './Battlefield';
import {HEROES,ROLES,ENCOUNTERS,UPGRADES} from './game/data';
import {createBattle} from './game/engine';
import {claimReward,finishBattle,newCampaign,nextEncounter,restoreCampaign,upgradeIssue} from './game/campaign';
import {describeStrategy,validateProposal} from './game/rules';
import type {Campaign,Proposal,Role,Upgrade} from './game/types';

const SAVE='tactic-weaver-v1';
function initial(){try{const raw=localStorage.getItem(SAVE);return raw?restoreCampaign(raw):newCampaign();}catch{return newCampaign();}}
const ROLE_LABEL:Record<Role,string>={guard:'盾卫',archer:'射手',assassin:'刺客'};
const time=(s:number)=>`${String(Math.floor(s/60)).padStart(2,'0')}:${String(Math.floor(s%60)).padStart(2,'0')}`;
const portrait=(role:Role)=>`/portraits/${role}.png`;
function Portrait({role,large=false}:{role:Role;large?:boolean}){return <div aria-hidden="true" className={`portrait ${role} ${large?'large':''}`} style={{backgroundImage:`url(${portrait(role)})`}}/>;}

export function App(){
 const [campaign,setCampaign]=useState<Campaign>(initial);
 const [battle,setBattle]=useState(()=>{const b=createBattle(campaign);if(campaign.outcome)b.phase=campaign.outcome;return b;});
 const [selected,setSelected]=useState<Role>('guard');
 const [scope,setScope]=useState<'unit'|'team'>('unit');
 const [text,setText]=useState('发现重击时躲避，保护射手');
 const [proposal,setProposal]=useState<Proposal|null>(null);
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [status,setStatus]=useState<{mode:string;model:string|null}>({mode:'connecting',model:null});
 const [speed,setSpeed]=useState(1),[paused,setPaused]=useState(false);
 const [resultOpen,setResultOpen]=useState(!!campaign.outcome),[help,setHelp]=useState(false),[resetOpen,setResetOpen]=useState(false);
 const [storageError,setStorageError]=useState(false);
 const [,redraw]=useState(0);const generation=useRef(0);
 const reward=campaign.rewardAvailable;
 const ready=battle.phase==='ready',running=battle.phase==='running';
 const finished=battle.phase==='victory'||battle.phase==='defeat';
 const hero=HEROES[selected],config=campaign.heroes[selected];
 const encounter=ENCOUNTERS[campaign.stage];
 const editable=(ready||reward)&&!busy;
 useEffect(()=>{fetch('/api/status').then(r=>{if(!r.ok)throw new Error();return r.json();}).then(setStatus).catch(()=>setStatus({mode:'offline',model:null}));},[]);
 useEffect(()=>{try{localStorage.setItem(SAVE,JSON.stringify(campaign));setStorageError(false);}catch{setStorageError(true);}},[campaign]);
 useEffect(()=>{if(!notice)return;const id=setTimeout(()=>setNotice(''),4200);return()=>clearTimeout(id);},[notice]);
 const onTick=useCallback(()=>{
  redraw(v=>v+1);
  if(battle.phase==='victory'||battle.phase==='defeat'){
   setCampaign(prev=>{if(prev.outcome!==null)return prev;const c=structuredClone(prev);finishBattle(c,battle.phase as 'victory'|'defeat');return c;});
   setResultOpen(true);
  }
 },[battle]);
 const resetProposal=()=>{generation.current++;setProposal(null);setError('');};
 function select(role:Role){if(busy)return;setSelected(role);resetProposal();}
 function onSlot(slot:number){
  if(!ready||busy)return;const c=structuredClone(campaign),old=c.heroes[selected].slot;
  const occupant=ROLES.find(r=>c.heroes[r].slot===slot);if(occupant)c.heroes[occupant].slot=old;
  c.heroes[selected].slot=slot;setCampaign(c);setBattle(createBattle(c));
 }
 async function compile(){
  if(!editable||!text.trim())return;setError('');setProposal(null);setBusy(true);const id=++generation.current;
  try{const r=await fetch('/api/compile',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({kind:reward?'upgrade':'strategy',role:reward||scope==='unit'?selected:'team',text}),signal:AbortSignal.timeout(30000)});const data=await r.json();if(!r.ok)throw new Error(data.error||'生成失败');const p=validateProposal(data);if(id===generation.current)setProposal(p);
  }catch(e){if(id===generation.current)setError(e instanceof Error&&e.name==='TimeoutError'?'等待超过 30 秒，请重试。':e instanceof Error?e.message:'暂时无法生成，请重试。');}finally{setBusy(false);}
 }
 function accept(){
  if(!proposal||busy)return;const c=structuredClone(campaign);
  try{if(proposal.kind==='upgrade'){claimReward(c,proposal);setNotice(`${HEROES[proposal.role as Role].name}获得「${UPGRADES[proposal.upgrade!].name}」`);}
   else{if(!ready)throw new Error('请在备战阶段修改战术。');for(const r of proposal.role==='team'?ROLES:[proposal.role])c.heroes[r].strategy={...proposal.strategy!};setBattle(createBattle(c));setNotice('战术已写入。下一场战斗将按新规则执行。');}
   setCampaign(c);resetProposal();
  }catch(e){setError((e as Error).message);}
 }
 function start(){if(!ready||busy)return;setPaused(false);setProposal(null);setError('');battle.phase='running';onTick();}
 function retry(){const c=structuredClone(campaign);c.outcome=null;c.rewardAvailable=false;c.rewardClaimed=false;setCampaign(c);setBattle(createBattle(c));setResultOpen(false);setPaused(false);resetProposal();}
 function advance(){const c=structuredClone(campaign);try{nextEncounter(c);setCampaign(c);setBattle(createBattle(c));setResultOpen(false);setPaused(false);setText('优先攻击后排');resetProposal();}catch(e){setError((e as Error).message);}}
 function restart(){const c=newCampaign();setCampaign(c);setBattle(createBattle(c));setResultOpen(false);setResetOpen(false);setPaused(false);setSelected('guard');setText('发现重击时躲避，保护射手');resetProposal();}
 function exportSave(){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(campaign,null,2)],{type:'application/json'}));a.download='战术织匠-旅程.json';a.click();URL.revokeObjectURL(a.href);}
 async function importSave(file?:File){if(!file||running||busy)return;try{const c=restoreCampaign(await file.text());setCampaign(c);const b=createBattle(c);if(c.outcome)b.phase=c.outcome;setBattle(b);setResultOpen(!!c.outcome);resetProposal();setNotice('已载入旅程。未结束的战斗从备战重新开始。');}catch{setError('存档格式无效，当前旅程未改变。');}}
 const recent=battle.events.filter(e=>e.type!=='damage').slice(-5).reverse();
 const suggestions=reward?['学会躲避重击','成功闪避后强化反击','提高攻击力','增加最大生命']:['优先攻击后排','保护射手','等待前排接敌后行动','生命低时后撤'];
 const hasDodgeWarning=proposal?.kind==='strategy'&&proposal.strategy?.dodge&&(proposal.role==='team'?ROLES:[proposal.role]).some(r=>!campaign.heroes[r].upgrades.includes('dodge'));
 const issue=proposal?.kind==='upgrade'?upgradeIssue(campaign,proposal.role as Role,proposal.upgrade!):null;

 return <div className="app-shell">
  <header className="topbar"><a className="brand" href="/" aria-label="战术织匠首页"><span className="brand-mark">⌘</span><span>战术织匠<small>TACTIC WEAVER</small></span><span className="alpha">原型 01</span></a><div className="header-actions"><span className={`connection ${status.mode==='deepseek'?'live':''}`}><i/>{status.mode==='deepseek'?'DeepSeek 已连接':status.mode==='connecting'?'正在连接':status.mode==='offline'?'服务未连接':'本地演示模式'}</span><button className="quiet" onClick={()=>setHelp(true)}>玩法指南 <span>?</span></button><button className="icon-button" aria-label="重新开始旅程" title="重新开始旅程" disabled={busy} onClick={()=>setResetOpen(true)}>↻</button></div></header>
  <main>
   <section className="intro"><div><div className="eyebrow"><span/> LANGUAGE INTO TACTICS</div><h1>每一句指令，<em>都是新的可能。</em></h1><p>布下你的阵容，教会他们战斗。让想法在战场上发生。</p></div><div className="run-tag"><span>当前旅程</span><strong>遗迹试炼</strong><small>3 名同伴 · 4 场挑战</small></div></section>
   <nav className="journey" aria-label="旅程进度">{ENCOUNTERS.map((e,i)=><div key={e.name} className={`journey-step ${i===campaign.stage?'current':''} ${i<campaign.stage?'complete':''}`}><span className="step-number">{i<campaign.stage?'✓':i===3?'♜':`0${i+1}`}</span><div><small>{i===3?'FINAL ENCOUNTER':`ENCOUNTER 0${i+1}`}</small><strong>{e.name}</strong></div><span className="step-state">{i<campaign.stage?'已通过':i===campaign.stage?'进行中':'···'}</span></div>)}</nav>
   <div className="workspace">
    <section className="left-column">
     <div className="arena-panel"><div className="panel-heading"><div className="arena-title"><span className="diamond">◇</span><h2>{encounter.name}</h2><span className="phase-label">{ready?'备战阶段':running?paused?'已暂停':'交战中':battle.phase==='victory'?'战斗胜利':'挑战失败'}</span></div><div className="arena-tools"><span className="clock">{time(battle.time)}</span><button className="speed" onClick={()=>setSpeed(speed===1?2:1)} aria-label="切换战斗倍速">{speed}×</button><button className="icon-button" aria-label={paused?'继续战斗':'暂停战斗'} disabled={!running} onClick={()=>setPaused(!paused)}>{paused?'▶':'Ⅱ'}</button></div></div>
      <Battlefield battle={battle} selected={selected} onSlot={onSlot} speed={speed} paused={paused||help||resetOpen} onTick={onTick}/>
      <div className="arena-footer"><span><i className="legend-dot ally"/>我方 <i className="legend-dot enemy"/>敌方</span><p>{ready?'选择同伴，再点击战场位置调整部署':running?'战术自动执行 · 红色区域是敌方重击预警':battle.phase==='victory'?'每次胜利，都值得一次新的成长':'复盘并调整战术，再次挑战'}</p><span className="arena-coordinate">遗迹 / 01</span></div>
     </div>
     <div className="squad-heading"><h2>你的同伴 <span>YOUR PARTY</span></h2><small>点击角色，编排专属战术</small></div>
     <div className="squad">{ROLES.map(r=>{const h=HEROES[r],u=battle.units.find(u=>u.id===r)!;return <button className={`hero-card ${selected===r?'selected':''}`} key={r} onClick={()=>select(r)} disabled={busy}><Portrait role={r}/><div className="hero-card-info"><div><strong>{h.name}</strong><span>{ROLE_LABEL[r]}</span></div><small>{h.tag}</small><div className="hp-track"><i style={{width:`${u.hp/u.maxHp*100}%`,background:h.color}}/></div><div className="hero-card-bottom"><span>{Math.ceil(u.hp)} / {u.maxHp}</span><span>{campaign.heroes[r].upgrades.length?`✦ ${campaign.heroes[r].upgrades.length} 项成长`:'初始能力'}</span></div></div><span className="selected-corner">✓</span></button>;})}</div>
     <div className="encounter-tip"><span>⌖</span><div><strong>敌情简报</strong><p>{encounter.description}</p></div><span className="enemy-count">{encounter.roles.length} 敌人</span></div>
     <section className="log-panel"><div className="log-title"><h2>战场手记 <span>FIELD NOTES</span></h2><span className="log-live">{running?'● 实时记录':'关键行动'}</span></div>{recent.length?recent.map((e,i)=><div className={`log-entry ${e.type}`} key={`${e.time}-${i}`}><time>{time(e.time)}</time><span>{e.type==='dodge'?'◇':e.type==='kill'?'×':e.type==='counter'?'↗':'·'}</span><p>{e.text}</p></div>):<div className="log-empty"><span>✧</span><p>第一场战斗，第一段默契。<small>这里会记录闪避、重击预警和击败敌人等关键时刻。</small></p></div>}</section>
    </section>
    <aside className={`command-panel ${reward?'reward-mode':''}`}>
     <div className="command-heading"><div><span className="eyebrow">{reward?'GROW THROUGH WORDS':'THE TACTIC DESK'}</span><h2>{reward?'输入一次成长':'战术编排'}</h2></div><span className="quill">{reward?'✦':'✎'}</span></div>
     {reward?<div className="reward-banner"><span>✦</span><div><strong>胜利奖励 · 1 次强化</strong><small>把你的想法，变成同伴的新能力。</small></div></div>:<div className="scope-switch"><button className={scope==='unit'?'active':''} disabled={busy} onClick={()=>{setScope('unit');resetProposal();}}>个体指令</button><button className={scope==='team'?'active':''} disabled={busy} onClick={()=>{setScope('team');resetProposal();}}>全队方针</button></div>}
     <div className="selected-hero"><Portrait role={selected}/><div><span>{scope==='team'&&!reward?'指令对象 · 全体同伴':`指令对象 · ${ROLE_LABEL[selected]}`}</span><h3>{scope==='team'&&!reward?'三人小队':hero.name}<small>{scope==='team'&&!reward?'共同的目标':hero.title}</small></h3></div></div>
     <label className="field-label" htmlFor="instruction">{reward?'这一次，你希望他学会什么？':'你想教会他们什么？'}<span>{text.length}/600</span></label>
     <div className={`input-wrap ${busy?'is-busy':''}`}><textarea id="instruction" value={text} maxLength={600} disabled={!editable} onChange={e=>{setText(e.target.value);resetProposal();}} placeholder={reward?'例如：成功闪避重击后，下一次攻击更强':'例如：先保护射手，敌人蓄力时尝试躲避'} onKeyDown={e=>{if((e.ctrlKey||e.metaKey)&&e.key==='Enter')void compile();}}/><span className="input-hint">{reward?'自由描述 · 确认后消耗机会':'用日常语言，描述你的战术'}<kbd>⌘ ↵</kbd></span></div>
     <div className="suggestions">{suggestions.map(s=><button disabled={!editable} key={s} onClick={()=>{setText(s);resetProposal();}}>{s}</button>)}</div>
     <button className="compile-button" disabled={!editable||!text.trim()} onClick={()=>void compile()}>{busy?<><span className="spinner"/>正在理解你的想法…</>:<><span>✧</span>{reward?'生成强化方案':'生成战术方案'}<span>↗</span></>}</button>
     <p className="mode-note">{status.mode==='deepseek'?`${status.model} · 只在生成方案时调用模型`:status.mode==='offline'?'服务暂未连接，请检查本地服务':'本地关键词演示 · 配置密钥后启用 DeepSeek'}</p>
     {error&&<div role="alert" className="error-box">{error}</div>}
     {proposal&&<section className="proposal"><div><strong>✦ {proposal.kind==='upgrade'?UPGRADES[proposal.upgrade!].name:'待应用的战术'}</strong><span>{proposal.source==='local'?'本地解析':'DeepSeek'}</span></div><p>{proposal.kind==='strategy'?describeStrategy(proposal.strategy!):proposal.summary}</p>{hasDodgeWarning&&<small>尚未解锁闪避的角色会保留这条指令，获得“识破重击”后才可执行。</small>}{issue&&<small className="warning">{issue}</small>}<button onClick={accept} disabled={!!issue}>{proposal.kind==='upgrade'?'接受这次强化':'应用战术'} <span>✓</span></button></section>}
     <section className="active-rules"><div className="mini-heading"><h3>已掌握的战术</h3><span>生效中</span></div><p><span>01</span>{describeStrategy(config.strategy)}</p>{config.upgrades.length>0&&<div className="upgrade-list">{config.upgrades.map((u,i)=><span title={UPGRADES[u].description} key={`${u}-${i}`}>{UPGRADES[u].icon} {UPGRADES[u].name}</span>)}</div>}</section>
     <div className="command-bottom">{ready?<><button className="start-button" disabled={busy} onClick={start}><span>开始战斗</span><span>⚔</span></button><small>准备就绪？见证你的战术。</small></>:running?<><button className="start-button secondary" onClick={()=>setPaused(!paused)}>{paused?'继续战斗 ▶':'暂停观战 Ⅱ'}</button><small>战斗中不能修改战术</small></>:campaign.outcome==='victory'&&campaign.stage<3&&campaign.rewardClaimed?<button className="start-button" onClick={advance}>前往下一场 <span>→</span></button>:reward?<div className="await-reward">✦ 选择角色，为他输入一次强化</div>:<button className="start-button" onClick={()=>setResultOpen(true)}>查看战斗复盘 <span>→</span></button>}</div>
    </aside>
   </div>
   <footer className="page-footer"><span>✧ 战术由你编写，故事由他们完成。</span><div><button onClick={exportSave}>导出旅程</button><label className={running||busy?'disabled':''}>导入旅程<input type="file" accept=".json,application/json" disabled={running||busy} onChange={e=>{void importSave(e.target.files?.[0]);e.target.value='';}}/></label><span>WEB MVP · 0.1</span></div></footer>
  </main>
  {notice&&<div className="toast" role="status">✓ {notice}</div>}
  {storageError&&<div className="storage-warning" role="alert">浏览器无法保存进度，请使用“导出旅程”。</div>}
  {resultOpen&&finished&&<div className="modal-backdrop"><section className="modal result-modal" role="dialog" aria-modal="true" aria-labelledby="result-title"><div className="result-symbol">{battle.phase==='victory'?'✦':'◇'}</div><div className="eyebrow">{battle.phase==='victory'?'TACTICS MADE REAL':'A LESSON, NOT THE END'}</div><h2 id="result-title">{battle.phase==='victory'?campaign.stage===3?'遗迹试炼，完成。':'这一战，是默契的胜利。':'调整战术，再试一次。'}</h2><p>{battle.phase==='victory'?campaign.stage===3?'你用三次成长，写出了属于自己的战斗方式。':'胜利带来一次成长。教会同伴下一项能力。':battle.time>=120?'战斗超过两分钟。试着提高输出、调整目标或进场时机。':'看看谁先倒下、谁未能及时进场，下一次可以做得不同。'}</p><div className="result-stats"><div><strong>{time(battle.time)}</strong><span>战斗时长</span></div><div><strong>{ROLES.reduce((sum,r)=>sum+(battle.damage[r]||0),0)}</strong><span>我方输出</span></div><div><strong>{ROLES.reduce((n,r)=>n+(battle.dodges[r]||0),0)}</strong><span>成功闪避</span></div></div><div className="result-heroes">{ROLES.map(r=><div key={r}><Portrait role={r}/><span>{HEROES[r].name}</span><strong>{battle.damage[r]||0}</strong><small>造成伤害</small><strong>{battle.damageTaken[r]||0}</strong><small>承受伤害</small><span className={battle.units.find(u=>u.id===r)!.hp>0?"result-alive":"result-fallen"}>{battle.units.find(u=>u.id===r)!.hp>0?"存活":"倒下"}</span></div>)}</div><p className="result-stat-note">伤害与承伤按实际扣血统计，不含溢出伤害或被免疫的伤害。</p>{battle.events.filter(e=>e.type==='kill'||e.type==='dodge').length>0&&<p className="result-fact">战场记录：{battle.events.filter(e=>e.type==='kill'||e.type==='dodge').slice(-2).map(e=>e.text).join('；')}</p>}<button className="start-button" onClick={()=>{if(battle.phase==='defeat')retry();else if(campaign.stage===3){setResultOpen(false);setResetOpen(true);}else if(campaign.rewardClaimed)advance();else{setResultOpen(false);setScope('unit');setText('学会躲避重击');resetProposal();}}}>{battle.phase==='defeat'?'回到备战，调整指令':campaign.stage===3?'开启新的旅程':campaign.rewardClaimed?'前往下一场':'输入你的强化'} <span>→</span></button><button className="quiet modal-close" onClick={()=>setResultOpen(false)}>留在战场查看记录</button></section></div>}
  {help&&<div className="modal-backdrop"><section className="modal" role="dialog" aria-modal="true" aria-labelledby="help-title"><span className="eyebrow">FIELD GUIDE</span><h2 id="help-title">把一句话，变成一种打法。</h2><ol className="guide"><li><strong>布阵</strong><p>点击同伴，再点击战场上的六个部署点。占用的位置会交换。</p></li><li><strong>教学</strong><p>输入指令，生成并应用方案。全队方针会同步覆盖三人的当前战术，之后可以单独调整。</p></li><li><strong>观战</strong><p>战斗自动进行，可暂停或倍速。红色圆圈代表即将落下的重击。</p></li><li><strong>成长</strong><p>每场普通战斗胜利后强化一人。先解锁闪避，再获得反击，最后组合协同追击。</p></li></ol><div className="guide-note">本地演示仅识别提示中的关键词。DeepSeek 密钥由开发者配置在服务端 .env，刷新后显示连接状态。强化效果受游戏规则约束。</div><button className="start-button" onClick={()=>setHelp(false)}>明白了，开始编排 <span>→</span></button></section></div>}
  {resetOpen&&<div className="modal-backdrop"><section className="modal small-modal" role="dialog" aria-modal="true" aria-labelledby="reset-title"><h2 id="reset-title">开启新的旅程？</h2><p>当前旅程将被重置。你可以先导出存档，再尝试另一种流派。</p><button className="start-button" onClick={restart}>重新开始</button><button className="quiet modal-close" onClick={()=>setResetOpen(false)}>继续当前旅程</button></section></div>}
 </div>;
}

