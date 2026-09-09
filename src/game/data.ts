import type { Role, Strategy, Upgrade } from './types';
export const ROLES:Role[]=['guard','archer','assassin'];
export const DEFAULT_STRATEGY:Strategy={target:'nearest',dodge:false,retreat:false,wait:false,protect:false};
export const HEROES={
 guard:{name:'罗恩',title:'坚盾卫士',tag:'守护 · 近战',icon:'◆',color:'#77c7c1',hp:250,damage:18,range:44,speed:65,period:1.15,description:'用钢盾稳住战线，为队友创造出手机会。'},
 archer:{name:'莉娅',title:'逐风射手',tag:'远程 · 持续输出',icon:'⌁',color:'#d5bc79',hp:135,damage:24,range:225,speed:71,period:1.25,description:'保持安全距离，用箭矢锁定最重要的目标。'},
 assassin:{name:'灰羽',title:'影刃斥候',tag:'突袭 · 爆发',icon:'⚔',color:'#a99bdd',hp:150,damage:22,range:39,speed:109,period:.8,description:'穿过战线的空隙，寻找脆弱的敌方后排。'}
};
export const UPGRADES:Record<Upgrade,{name:string;description:string;icon:string}>={
 power:{name:'磨砺锋芒',description:'攻击力 +20%（按基础攻击力叠加）',icon:'⚔'},
 vitality:{name:'坚韧体魄',description:'最大生命 +25%（按基础生命叠加）',icon:'♥'},
 haste:{name:'疾风身法',description:'攻击速度与移动速度 +15%',icon:'»'},
 dodge:{name:'识破重击',description:'解锁闪避并启用重击规避；冷却 4 秒',icon:'◇'},
 counter:{name:'闪避反击',description:'成功闪避后 3 秒内，下一击伤害 +80%；需要闪避能力',icon:'↗'},
 rally:{name:'协同追击',description:'反击命中后，存活队友获得 3 秒伤害 +25%；需要闪避反击',icon:'✦'}
};
export const ENCOUNTERS=[
 {name:'碎石前哨',subtitle:'第一场遭遇',description:'两名掠夺者正面逼近。稳住前排，让射手安全输出。',roles:['guard','assassin'],mult:.68},
 {name:'枯木伏击',subtitle:'第二场遭遇',description:'卫兵掩护两名弓手。试试命令刺客优先攻击后排。',roles:['guard','archer','archer'],mult:.78},
 {name:'暗影追猎',subtitle:'第三场遭遇',description:'双刺客向你的后排突进，重装兵会蓄力重击。',roles:['guard','assassin','assassin'],mult:.9},
 {name:'重锤守门人',subtitle:'首领战',description:'守门人会锁定位置发动重击。观察红色预警，检验你的闪避反击。',roles:['boss','archer'],mult:1}
] as const;
export const ARENA={width:900,height:520};
export const OBSTACLES=[{x:400,y:120,w:86,h:82},{x:400,y:334,w:86,h:82}];
export const SLOTS=[{x:240,y:158},{x:240,y:260},{x:240,y:362},{x:125,y:158},{x:125,y:260},{x:125,y:362}];
