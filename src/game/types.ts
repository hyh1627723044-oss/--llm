export type Role = 'guard' | 'archer' | 'assassin' | 'support';
export type Target = 'nearest' | 'ranged' | 'weakest';
export type Upgrade = 'power' | 'vitality' | 'haste' | 'dodge' | 'counter' | 'rally';
export type SupportSkill = 'heal' | 'empower' | 'weaken';
export interface SupportTactics {healAt:number;buffTarget:'strongest'|'archer'|'assassin';weakenWhen:'heavy'|'engaged';}
export interface Strategy { support?:SupportTactics; target: Target; dodge: boolean; retreat: boolean; wait: boolean; protect: boolean; }
export interface Hero { strategy: Strategy; upgrades: Upgrade[]; slot: number; }
export interface Campaign { version:1; stage:number; wins:number; heroes:Record<Role,Hero>; rewardAvailable:boolean; rewardClaimed:boolean; outcome:'victory'|'defeat'|null; }
export interface Proposal { kind:'strategy'|'upgrade'; role:Role|'team'; strategy?:Strategy; upgrade?:Upgrade; summary:string; source:'local'|'deepseek'; }
export interface Unit {skillCooldowns?:Record<SupportSkill,number>;skillCast?:{skill:SupportSkill;target:string;remaining:number};empowerUntil?:number;weakenUntil?:number;id:string;name:string;role:Role|'boss';team:'ally'|'enemy';x:number;y:number;hp:number;maxHp:number;damage:number;range:number;speed:number;cooldown:number;period:number;targetId?:string;strategy:Strategy;upgrades:Upgrade[];intent:string;face:number;flash:number;dodgeCooldown:number;immune:number;counterUntil:number;rallyUntil:number;attack?:{kind:'normal'|'heavy';remaining:number;x:number;y:number;radius:number;target:string};}
export interface BattleEvent {time:number;type:'damage'|'dodge'|'kill'|'cast'|'info'|'counter'|'heal';actor:string;text:string;}
export interface Effect {kind:'hit'|'arrow'|'slash'|'dodge'|'heal';x:number;y:number;tx:number;ty:number;life:number;maxLife:number;color:string;text?:string;}
export interface Battle {stage:number;time:number;phase:'ready'|'running'|'victory'|'defeat';units:Unit[];events:BattleEvent[];effects:Effect[];damage:Record<string,number>;damageTaken:Record<string,number>;healing:Record<string,number>;dodges:Record<string,number>;}
