import { useEffect, useRef } from 'react';
import type { Battle, Role, Unit } from './game/types';
import { HEROES, OBSTACLES, SLOTS } from './game/data';
import { stepBattle } from './game/engine';

type Props = { battle: Battle; selected: Role; onSlot: (slot: number) => void; speed: number; paused: boolean; onTick: () => void };
type Context = CanvasRenderingContext2D;
const W = 900, H = 520;
const ink = '#111b1c';
function rect(c: Context, x: number, y: number, w: number, h: number, color: string) {
  c.fillStyle = color; c.fillRect(Math.round(x), Math.round(y), w, h);
}
function line(c: Context, points: number[], color: string, width = 1) {
  c.beginPath(); c.moveTo(points[0], points[1]);
  for (let i = 2; i < points.length; i += 2) c.lineTo(points[i], points[i + 1]);
  c.strokeStyle = color; c.lineWidth = width; c.stroke();
}
function ellipse(c: Context, x: number, y: number, rx: number, ry: number, fill: string, stroke?: string) {
  c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); c.fillStyle = fill; c.fill();
  if (stroke) { c.strokeStyle = stroke; c.lineWidth = 1.5; c.stroke(); }
}
function label(c: Context, text: string, x: number, y: number, color: string, size = 11) {
  c.font = `500 ${size}px "Microsoft YaHei", "PingFang SC", sans-serif`;
  c.textAlign = 'center'; c.fillStyle = color; c.fillText(text, x, y);
}
function ground(c: Context) {
  rect(c, 0, 0, W, H, '#151f20');
  // Stable, hand-sized stone blocks: the field never shimmers between frames.
  let seed = 7813;
  const random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (let row = 0; row < 11; row++) {
    for (let col = -1; col < 15; col++) {
      const x = col * 68 + (row % 2) * 34, y = row * 48;
      const n = Math.floor(random() * 7);
      rect(c, x + 2, y + 2, 65, 45, `rgb(${36 + n},${47 + n},${45 + n})`);
      rect(c, x + 3, y + 3, 63, 1, '#3b4841');
      rect(c, x + 4, y + 44, 60, 2, '#202d2b');
      if (random() > .4) {
        const px = x + 12 + random() * 30, py = y + 12 + random() * 17;
        rect(c, px, py, 9 + Math.floor(random() * 15), 2, '#34413a');
        line(c, [px + 8, y + 45, px + 10, y + 36, px + 18, y + 31], '#202b28');
      }
    }
  }
  // The old processional path and its inset border.
  c.fillStyle = '#b1a78008'; c.fillRect(37, 225, 826, 72);
  c.strokeStyle = '#69725a38'; c.lineWidth = 1; c.strokeRect(39.5, 53.5, 820, 425);
  c.strokeStyle = '#111d1bb0'; c.lineWidth = 7; c.strokeRect(25.5, 40.5, 847, 451);
  for (let i = 0; i < 220; i++) {
    let x = random() * W, y = random() * H;
    if (x > 52 && x < 847 && y > 65 && y < 472) continue;
    const color = ['#465344', '#374a3c', '#5a6045', '#263f35'][Math.floor(random() * 4)];
    rect(c, x, y, 3, 5 + Math.floor(random() * 10), color);
    rect(c, x - 3, y + 4, 9, 3, color);
  }
  for (const x of [61, 836]) for (const y of [90, 420]) {
    rect(c, x - 8, y - 4, 17, 15, '#172222'); rect(c, x - 6, y - 5, 13, 6, '#535c4d');
    rect(c, x - 3, y - 12, 7, 9, '#ba9659'); rect(c, x, y - 16, 3, 10, '#f3d48a');
    const glow = c.createRadialGradient(x, y - 9, 0, x, y - 9, 48);
    glow.addColorStop(0, '#e4bb5821'); glow.addColorStop(1, '#e4bb5800'); c.fillStyle = glow; c.fillRect(x - 48, y - 57, 96, 96);
  }
  // A faded compass seal, visible through the central fighting lane.
  ellipse(c, 448, 260, 48, 30, '#57746809', '#627d612a');
  ellipse(c, 448, 260, 39, 23, 'transparent', '#627d611c');
  line(c, [448, 233, 456, 254, 484, 260, 456, 265, 448, 287, 440, 265, 412, 260, 440, 254, 448, 233], '#71826a35');
  const vignette = c.createRadialGradient(450, 260, 190, 450, 260, 520);
  vignette.addColorStop(0, '#07161500'); vignette.addColorStop(1, '#071615a8'); c.fillStyle = vignette; c.fillRect(0, 0, W, H);
}
function pillar(c: Context, o: typeof OBSTACLES[number]) {
  const { x, y, w, h } = o;
  ellipse(c, x + w / 2 + 11, y + h - 3, 59, 17, '#0a141a65');
  rect(c, x - 4, y + h - 18, w + 8, 20, '#131f1f');
  rect(c, x - 1, y + h - 23, w + 2, 18, '#3e4a40');
  rect(c, x + 7, y + 6, w - 14, h - 26, '#39483f');
  rect(c, x + w - 22, y + 6, 15, h - 25, '#293830');
  for (let dy = 20; dy < h - 15; dy += 17) {
    rect(c, x + 8, y + dy, w - 16, 2, '#202f2b');
    rect(c, x + (dy % 2 ? 35 : 24), y + dy - 15, 2, 15, '#263730');
  }
  rect(c, x - 3, y - 9, w + 6, 19, '#1c2b28');
  rect(c, x - 1, y - 11, w + 2, 16, '#56604c');
  rect(c, x + 4, y - 9, w - 8, 3, '#76806a');
  rect(c, x + 8, y - 4, w - 16, 6, '#616a54');
  line(c, [x + 46, y - 10, x + 41, y - 3, x + 46, y + 5, x + 39, y + 17], '#293b31', 2);
  line(c, [x + 35, y + 29, x + 43, y + 24, x + 49, y + 30, x + 43, y + 37, x + 43, y + 45], '#82aa793c', 2);
  for (const [dx, dy] of [[3, 8], [8, 13], [1, 18], [65, 64], [72, 62], [58, 67]]) {
    rect(c, x + dx, y + dy, 10, 4, '#536344'); rect(c, x + dx + 2, y + dy + 3, 5, 6, '#3d543b');
  }
}
function miniature(c: Context, u: Unit, time: number) {
  const ally = u.team === 'ally', boss = u.role === 'boss';
  const main = ally ? (u.role === 'assassin' ? '#8891b7' : '#69a89a') : '#ac6c55';
  const light = ally ? '#b5cabb' : '#ddae80', dark = ally ? '#365b56' : '#653e36';
  const moving = /接近|突袭|回防|后撤|保持/.test(u.intent);
  const bob = moving ? Math.round(Math.sin(time * 13) * 2) : 0;
  c.save(); c.translate(Math.round(u.x), Math.round(u.y));
  if (u.hp <= 0) {
    c.globalAlpha = .35; ellipse(c, 0, 2, 18, 6, '#101817');
    rect(c, -13, -4, 23, 6, dark); rect(c, 4, -7, 8, 7, main); c.restore(); return;
  }
  ellipse(c, 0, 3, boss ? 24 : 18, 6, '#07131bab');
  if (u.immune > 0) { c.globalAlpha = .55; ellipse(c, 0, 1, 25, 10, '#77d7cb20', '#89e7d2'); }
  if (u.counterUntil > time || u.rallyUntil > time || (u.empowerUntil??0)>time) ellipse(c, 0, 1, 23, 9, '#d9ba5020', '#d9ba5080');
  if ((u.weakenUntil??0)>time) ellipse(c, 0, 1, 26, 11, '#aa73d620', '#be92de');
  c.translate(0, bob); c.scale(u.face || 1, 1);
  if (boss) c.scale(1.45, 1.45);
  const r = (x: number, y: number, w: number, h: number, color: string) => rect(c, x, y, w, h, color);
  // Silhouettes use deliberately chunky pixels rather than vector avatars.
  r(-11, -31, 19, 23, ink); r(-9, -30, 15, 22, dark);
  r(-9, -11, 7, 11, ink); r(3, -11, 7, 11, ink);
  r(-8, -10, 5, 7 + (moving ? bob : 0), '#566460'); r(4, -9, 5, 7 - (moving ? bob : 0), '#718078');
  r(-10, -2, 9, 4, '#152022'); r(3, -2, 10, 4, '#152022');
  r(-9, -28, 18, 16, main); r(-8, -28, 4, 14, light); r(-9, -13, 19, 4, '#34312d'); r(0, -13, 4, 4, '#b8a779');
  r(-8, -44, 17, 17, ink); r(-6, -42, 14, 14, '#c6a481'); r(0, -37, 9, 8, '#d9bc94'); r(5, -36, 3, 3, '#182323');
  if (u.role === 'support') {
    r(-12, -46, 21, 9, '#d2dfba'); r(-10, -41, 6, 15, '#8cbb98');
    r(-12, -28, 24, 21, '#5f937b'); r(-8, -27, 4, 20, '#cfdbb1');
    r(12, -27, 8, 6, '#d9bc94'); r(20, -44, 3, 43, '#bcaa7b');
    r(17, -47, 9, 9, '#93d9b7'); r(20, -50, 3, 15, '#e0efbd');
    if(u.skillCast)ellipse(c,23,-43,11,11,'#9be6c533','#c2f6d7');
  } else if (u.role === 'archer') {
    r(-10, -44, 16, 7, dark); r(-12, -40, 6, 19, main); r(-9, -43, 11, 3, light);
    r(-16, -33, 5, 22, '#5c4934'); line(c, [-14, -35, -18, -46], '#c2baa1', 2);
    r(9, -26, 10, 5, main); r(16, -25, 5, 5, '#d9bc94');
    line(c, [21, -39, 27, -32, 29, -23, 25, -12, 20, -7], '#c1a16c', 3);
    line(c, [21, -39, 20, -7], '#d5ccae', 1); line(c, [12, -23, 34, -23], '#d9cfaa', 2);
    r(32, -25, 4, 4, '#c8d4c9');
  } else if (u.role === 'assassin') {
    r(-10, -45, 17, 8, dark); r(-12, -40, 6, 13, main); r(-5, -32, 15, 5, dark); r(-3, -40, 11, 3, light);
    r(-19, -30, 10, 6, main); r(-22, -27, 5, 5, '#c6a481');
    line(c, [-20, -23, -29, -13], '#c8d9cf', 3); line(c, [-23, -24, -18, -19], '#b39b69', 2);
    r(9, -26, 9, 6, main); r(16, -25, 4, 6, '#c6a481');
    line(c, [19, -24, 30, -35], '#e0e4cf', 3); line(c, [16, -27, 22, -21], '#b39b69', 2);
    r(-16, -19, 7, 12, dark); r(-20, -10, 10, 4, dark);
  } else {
    r(-9, -45, 19, 9, '#6a7972'); r(-7, -46, 14, 3, '#a3afa0'); r(-10, -37, 6, 9, '#4e615b'); r(-2, -36, 12, 4, '#172528'); r(5, -36, 4, 2, boss ? '#e49965' : '#9fdfcb');
    r(-13, -30, 8, 8, '#a5b5a5'); r(6, -30, 9, 7, '#8a9b8a'); r(-5, -25, 13, 2, '#bbccba');
    if (boss) {
      r(-15, -43, 6, 9, '#ae9470'); r(9, -43, 6, 9, '#ae9470');
      line(c, [16, -8, 23, -43], '#887454', 4); r(15, -48, 23, 13, ink); r(16, -49, 21, 10, '#849080'); r(18, -49, 17, 3, '#b7bea4'); r(24, -48, 3, 11, '#554f40');
      r(11, -26, 9, 6, main);
    } else {
      r(-20, -28, 15, 23, '#17282b'); r(-19, -29, 13, 21, '#a9beb0'); r(-17, -26, 9, 16, dark); r(-14, -25, 3, 15, main); r(-19, -8, 12, 3, '#6c9286');
      r(12, -24, 6, 6, '#bfa889'); r(17, -42, 3, 22, '#b3c8bd'); r(18, -43, 2, 20, '#e1e6cb'); r(13, -23, 11, 3, '#ab9361'); r(17, -20, 3, 7, '#625644');
    }
  }
  if (u.flash > 0) { c.globalCompositeOperation = 'source-atop'; c.fillStyle = `rgba(255,238,190,${u.flash * 1.6})`; c.fillRect(-10, -43, 20, 42); }
  c.restore();
}

function draw(c: Context, base: HTMLCanvasElement, b: Battle, selected: Role, hover: number) {
  c.clearRect(0, 0, W, H); c.drawImage(base, 0, 0);
  label(c, '我 方 阵 线', 168, 33, '#8da99c', 10); label(c, '敌 方 阵 线', 730, 33, '#b4947d', 10);
  if (b.phase === 'ready') SLOTS.forEach((s, i) => {
    const occupied = b.units.find(u => u.team === 'ally' && Math.hypot(u.x - s.x, u.y - s.y) < 25);
    const active = occupied?.role === selected || hover === i;
    ellipse(c, s.x, s.y + 2, 35, 17, active ? '#79cead20' : '#7198840a', active ? '#9bd9bd' : '#678e7760');
    line(c, [s.x - 40, s.y + 1, s.x - 35, s.y + 1], '#8aaf8760');
    line(c, [s.x + 35, s.y + 1, s.x + 40, s.y + 1], '#8aaf8760');
    if (!occupied) { label(c, '+', s.x, s.y + 6, hover === i ? '#c7e6cc' : '#759084', 18); label(c, `0${i + 1}`, s.x, s.y + 33, '#6f897d', 9); }
  });
  for (const u of b.units) {
    if (u.hp <= 0 || u.attack?.kind !== 'heavy') continue;
    const a = u.attack, progress = 1 - Math.max(0, a.remaining) / 1.05;
    ellipse(c, a.x, a.y, a.radius, a.radius, '#df635523', '#e99776');
    c.beginPath(); c.arc(a.x, a.y, a.radius, -Math.PI / 2, -Math.PI / 2 + progress * Math.PI * 2); c.lineWidth = 4; c.strokeStyle = '#f3aa85'; c.stroke();
    line(c, [a.x - 9, a.y - 9, a.x + 9, a.y + 9], '#eea18c', 2); line(c, [a.x + 9, a.y - 9, a.x - 9, a.y + 9], '#eea18c', 2);
    label(c, '重击范围', a.x, a.y + a.radius + 16, '#f5b7a0', 11);
  }
  const objects = [...b.units.map(u => ({ y: u.y, unit: u })), ...OBSTACLES.map(o => ({ y: o.y + o.h, obstacle: o }))];
  objects.sort((a, z) => a.y - z.y).forEach(o => {
    if ('obstacle' in o) pillar(c, o.obstacle);
    else {
      if (o.unit.team === 'ally' && o.unit.role === selected && o.unit.hp > 0) ellipse(c, o.unit.x, o.unit.y + 2, 24, 10, '#7aceb410', '#9bd7be80');
      miniature(c, o.unit, b.time);
    }
  });
  // HUD labels render after scenery so intent and health stay legible.
  for (const u of b.units) {
    if (u.hp <= 0) continue;
    const y = u.y - (u.role === 'boss' ? 85 : 64), width = u.role === 'boss' ? 64 : 44;
    label(c, u.name, u.x, y - 5, u.team === 'ally' ? '#d2dfd2' : '#d2b39b', 11);
    rect(c, u.x - width / 2 - 1, y, width + 2, 6, '#0c191bee');
    rect(c, u.x - width / 2, y + 1, width * Math.max(0, u.hp / u.maxHp), 4, u.team === 'ally' ? '#80c9aa' : '#c28265');
    const statuses=[(u.empowerUntil??0)>b.time?'攻击↑':'',(u.weakenUntil??0)>b.time?'虚弱↓':''].filter(Boolean);
    if(statuses.length)label(c,statuses.join(' · '),u.x,y-20,'#dfc3eb',9);
    if (u.attack?.kind === 'heavy') label(c, '◆ 蓄力重击', u.x, u.y + 24, '#f0a38b', 11);
    else if (u.team === 'ally' && b.phase === 'running') label(c, u.intent, u.x, u.y + 24, '#adbeb0', 10);
  }
  for (const e of b.effects) {
    const p = 1 - Math.max(0, e.life / e.maxLife);
    c.save(); c.globalAlpha = Math.min(1, e.life / e.maxLife * 2);
    if (e.text) {
      c.font = 'bold 16px "Microsoft YaHei", sans-serif'; c.textAlign = 'center'; c.lineWidth = 4; c.strokeStyle = '#182123';
      c.strokeText(e.text, e.x, e.y - p * 24); c.fillStyle = e.color; c.fillText(e.text, e.x, e.y - p * 24);
    } else if (e.kind === 'arrow') {
      const x = e.x + (e.tx - e.x) * p, y = e.y + (e.ty - e.y) * p;
      const angle = Math.atan2(e.ty - e.y, e.tx - e.x);
      line(c, [x - Math.cos(angle) * 21, y - Math.sin(angle) * 21, x, y], e.color, 2);
      c.translate(x, y); c.rotate(angle); line(c, [-5, -3, 0, 0, -5, 3], '#ebdfb3', 2);
    } else if (e.kind === 'dodge') {
      c.setLineDash([7, 7]); line(c, [e.x, e.y, e.tx, e.ty], e.color, 2);
      ellipse(c, e.tx, e.ty, 24 + p * 17, 10 + p * 6, 'transparent', e.color);
    } else if (e.kind === 'heal') {
      line(c, [e.x - 6, e.y - p * 20, e.x + 6, e.y - p * 20], e.color, 3);
      line(c, [e.x, e.y - 6 - p * 20, e.x, e.y + 6 - p * 20], e.color, 3);
    } else {
      c.beginPath(); c.arc(e.tx, e.ty, 13 + p * 39, -.8, 2.3); c.strokeStyle = e.color; c.lineWidth = 5 * (1 - p) + 1; c.stroke();
      for (let i = 0; i < 5; i++) { const angle = i * 1.4; rect(c, e.tx + Math.cos(angle) * p * 42, e.ty + Math.sin(angle) * p * 30, 3, 3, e.color); }
    }
    c.restore();
  }
  if (b.phase === 'ready') label(c, `部署阶段 · 选择${HEROES[selected].title}的起始阵位`, 450, 503, '#9dac98', 11);
}

export function Battlefield(props: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const live = useRef(props); live.current = props;
  const hover = useRef(-1);
  useEffect(() => {
    const element = canvas.current, c = element?.getContext('2d'); if (!element || !c) return;
    const base = document.createElement('canvas'); base.width = W; base.height = H;
    const bg = base.getContext('2d'); if (!bg) return; ground(bg);
    let raf = 0, last = 0, accumulator = 0, lastNotify = 0;
    c.imageSmoothingEnabled = false;
    const frame = (now: number) => {
      const { battle, speed, paused, selected, onTick } = live.current;
      const dt = last ? Math.min(.2, (now - last) / 1000) : 0; last = now;
      const before = battle.phase;
      if (!document.hidden && !paused && battle.phase === 'running') {
        accumulator = Math.min(.2, accumulator + dt * Math.max(0, Math.min(4, speed)));
        while (accumulator >= 1 / 30 && battle.phase === 'running') { stepBattle(battle, 1 / 30); accumulator -= 1 / 30; }
        if (battle.phase !== before || now - lastNotify >= 150) { lastNotify = now; onTick(); }
      } else accumulator = 0;
      draw(c, base, battle, selected, hover.current);
      raf = requestAnimationFrame(frame);
    };
    const visibility = () => { last = 0; accumulator = 0; };
    document.addEventListener('visibilitychange', visibility);
    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); document.removeEventListener('visibilitychange', visibility); };
  }, [props.battle]);
  const slotAt = (clientX: number, clientY: number) => {
    const box = canvas.current?.getBoundingClientRect(); if (!box || !box.width || !box.height) return -1;
    const x = (clientX - box.left) * W / box.width, y = (clientY - box.top) * H / box.height;
    return SLOTS.findIndex(s => Math.hypot(s.x - x, s.y - y) < 43);
  };
  return <canvas ref={canvas} width={W} height={H} className="battlefield-canvas" tabIndex={0}
    aria-label={`战术战场。${props.battle.phase === 'ready' ? '点击六个阵位部署当前角色，或按数字键 1 至 6。' : '战斗自动进行，可使用上方控制暂停或调整速度。'}`}
    style={{ display: 'block', width: '100%', height: 'auto', aspectRatio: '900 / 520', background: '#182421', cursor: props.battle.phase === 'ready' ? 'crosshair' : 'default', borderRadius: 8 }}
    onPointerMove={e => { hover.current = slotAt(e.clientX, e.clientY); }} onPointerLeave={() => { hover.current = -1; }}
    onClick={e => { if (props.battle.phase === 'ready') { const slot = slotAt(e.clientX, e.clientY); if (slot >= 0) props.onSlot(slot); } }}
    onKeyDown={e => { if (props.battle.phase === 'ready' && /^[1-6]$/.test(e.key)) { e.preventDefault(); props.onSlot(Number(e.key) - 1); } }}
  >战术战场：需要支持 Canvas 的浏览器。</canvas>;
}
