'use strict';

/**
 * OGP画像バリエーション生成（SVGソース）
 *
 * カテゴリ別のOGP画像SVGを og-src/ に出力する。
 * PNG化は og-src/render.html をブラウザで開いて行う（tools/ogSaveServer.js が受信して og/ に保存）。
 *
 * 使い方:
 *   node tools/generateOgSvgs.js
 */

const fs = require('fs');
const path = require('path');

const W = 1200;
const H = 630;
const OUT_DIR = path.join(__dirname, '..', 'og-src');

// ---- 乱数（決定的） --------------------------------------------------------

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---- 共通パーツ ------------------------------------------------------------

const FONT = "'Segoe UI', 'Helvetica Neue', Arial, sans-serif";

function defs(accent, accent2) {
  return `
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#0b1426"/>
      <stop offset="0.55" stop-color="#0a1020"/>
      <stop offset="1" stop-color="#060b16"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.72" cy="0.45" r="0.65">
      <stop offset="0" stop-color="${accent}" stop-opacity="0.28"/>
      <stop offset="0.55" stop-color="${accent}" stop-opacity="0.10"/>
      <stop offset="1" stop-color="${accent}" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="accentBar" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="${accent}"/>
      <stop offset="1" stop-color="${accent2 || accent}"/>
    </linearGradient>
    <linearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${accent}" stop-opacity="0.55"/>
      <stop offset="1" stop-color="${accent}" stop-opacity="0.05"/>
    </linearGradient>
  </defs>`;
}

function background(accent) {
  const lines = [];
  for (let x = 0; x <= W; x += 60) {
    lines.push(`<line x1="${x}" y1="0" x2="${x}" y2="${H}" stroke="#ffffff" stroke-opacity="0.025" stroke-width="1"/>`);
  }
  for (let y = 0; y <= H; y += 60) {
    lines.push(`<line x1="0" y1="${y}" x2="${W}" y2="${y}" stroke="#ffffff" stroke-opacity="0.025" stroke-width="1"/>`);
  }
  return `
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  ${lines.join('\n  ')}
  <rect width="${W}" height="${H}" fill="url(#glow)"/>`;
}

function branding(label, accent) {
  return `
  <g>
    <rect x="64" y="72" width="8" height="34" rx="2" fill="url(#accentBar)"/>
    <text x="92" y="99" font-family="${FONT}" font-size="26" font-weight="600" letter-spacing="6" fill="#e6ecf5">${label}</text>
  </g>
  <g>
    <text x="66" y="566" font-family="${FONT}" font-size="30" font-weight="700" letter-spacing="1" fill="#f3f6fb">AEC News Japan</text>
    <text x="66" y="596" font-family="${FONT}" font-size="16" font-weight="400" letter-spacing="3" fill="#8fa3bd">BIM &#183; AEC &#183; CONSTRUCTION DX</text>
  </g>
  <rect x="0" y="${H - 6}" width="${W}" height="6" fill="url(#accentBar)"/>`;
}

function wrap(inner, accent, accent2, label) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  ${defs(accent, accent2)}
  ${background(accent)}
  ${inner}
  ${branding(label, accent)}
</svg>`;
}

// ---- アイソメ描画ヘルパー --------------------------------------------------

const ISO_COS = Math.cos(Math.PI / 6);
const ISO_SIN = Math.sin(Math.PI / 6);

function isoPoint(x, y, z, ox, oy, s) {
  return [ox + (x - y) * ISO_COS * s, oy + (x + y) * ISO_SIN * s - z * s];
}

function isoBox(x, y, z, w, d, h, ox, oy, s, stroke, opacity, fill) {
  const p = (a, b, c) => isoPoint(a, b, c, ox, oy, s).map((v) => v.toFixed(1)).join(',');
  const top = `${p(x, y, z + h)} ${p(x + w, y, z + h)} ${p(x + w, y + d, z + h)} ${p(x, y + d, z + h)}`;
  const left = `${p(x, y + d, z)} ${p(x + w, y + d, z)} ${p(x + w, y + d, z + h)} ${p(x, y + d, z + h)}`;
  const right = `${p(x + w, y, z)} ${p(x + w, y + d, z)} ${p(x + w, y + d, z + h)} ${p(x + w, y, z + h)}`;
  const faceFill = fill || 'none';
  return `
    <polygon points="${left}" fill="${faceFill}" fill-opacity="0.10" stroke="${stroke}" stroke-opacity="${opacity}" stroke-width="1.6"/>
    <polygon points="${right}" fill="${faceFill}" fill-opacity="0.16" stroke="${stroke}" stroke-opacity="${opacity}" stroke-width="1.6"/>
    <polygon points="${top}" fill="${faceFill}" fill-opacity="0.26" stroke="${stroke}" stroke-opacity="${Math.min(1, opacity + 0.2)}" stroke-width="1.8"/>`;
}

// ---- モチーフ --------------------------------------------------------------

// 1. アイソメタワー群
function motifIsoTowers(accent, seed) {
  const rnd = mulberry32(seed);
  const parts = [];
  const ox = 830;
  const oy = 430;
  const s = 3.1;
  const layout = [
    { x: 0, y: 0, w: 34, d: 34, base: 0 },
    { x: 44, y: -8, w: 26, d: 26, base: 0 },
    { x: -6, y: 46, w: 24, d: 24, base: 0 },
    { x: 46, y: 34, w: 20, d: 20, base: 0 },
  ];
  for (const b of layout) {
    const floors = 3 + Math.floor(rnd() * 3);
    let z = b.base;
    for (let f = 0; f < floors; f++) {
      const h = 16 + rnd() * 26;
      const shrink = f * (1.5 + rnd() * 2);
      parts.push(isoBox(b.x + shrink / 2, b.y + shrink / 2, z, b.w - shrink, b.d - shrink, h, ox, oy, s, accent, 0.75, accent));
      z += h;
    }
  }
  // 地面グリッド
  for (let i = -2; i <= 5; i++) {
    const [x1, y1] = isoPoint(i * 22, -30, 0, ox, oy, s);
    const [x2, y2] = isoPoint(i * 22, 90, 0, ox, oy, s);
    parts.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${accent}" stroke-opacity="0.14" stroke-width="1"/>`);
    const [x3, y3] = isoPoint(-30, i * 22, 0, ox, oy, s);
    const [x4, y4] = isoPoint(90, i * 22, 0, ox, oy, s);
    parts.push(`<line x1="${x3}" y1="${y3}" x2="${x4}" y2="${y4}" stroke="${accent}" stroke-opacity="0.14" stroke-width="1"/>`);
  }
  return `<g>${parts.join('\n')}</g>`;
}

// 2. 平面図（フロアプラン）
function motifFloorplan(accent) {
  const g = [];
  const X = 620, Y = 130, Wd = 470, Hd = 360;
  g.push(`<rect x="${X}" y="${Y}" width="${Wd}" height="${Hd}" fill="none" stroke="${accent}" stroke-opacity="0.9" stroke-width="3"/>`);
  // 内壁
  g.push(`<line x1="${X + 180}" y1="${Y}" x2="${X + 180}" y2="${Y + 210}" stroke="${accent}" stroke-opacity="0.75" stroke-width="3"/>`);
  g.push(`<line x1="${X}" y1="${Y + 210}" x2="${X + 300}" y2="${Y + 210}" stroke="${accent}" stroke-opacity="0.75" stroke-width="3"/>`);
  g.push(`<line x1="${X + 300}" y1="${Y + 120}" x2="${X + 300}" y2="${Y + Hd}" stroke="${accent}" stroke-opacity="0.75" stroke-width="3"/>`);
  g.push(`<line x1="${X + 300}" y1="${Y + 120}" x2="${X + Wd}" y2="${Y + 120}" stroke="${accent}" stroke-opacity="0.75" stroke-width="3"/>`);
  // ドア開口＋円弧
  g.push(`<path d="M ${X + 180} ${Y + 100} A 60 60 0 0 1 ${X + 240} ${Y + 160}" fill="none" stroke="${accent}" stroke-opacity="0.55" stroke-width="2"/>`);
  g.push(`<line x1="${X + 180}" y1="${Y + 100}" x2="${X + 180}" y2="${Y + 160}" stroke="#0a1020" stroke-width="5"/>`);
  g.push(`<path d="M ${X + 90} ${Y + 210} A 55 55 0 0 1 ${X + 35} ${Y + 265}" fill="none" stroke="${accent}" stroke-opacity="0.55" stroke-width="2"/>`);
  // 窓（壁の切れ目）
  for (const wx of [60, 250, 380]) {
    g.push(`<line x1="${X + wx}" y1="${Y}" x2="${X + wx + 50}" y2="${Y}" stroke="#9fdcd6" stroke-opacity="0.9" stroke-width="6"/>`);
  }
  // 寸法線
  g.push(`<line x1="${X}" y1="${Y - 34}" x2="${X + Wd}" y2="${Y - 34}" stroke="#8fa3bd" stroke-opacity="0.8" stroke-width="1.4"/>`);
  g.push(`<line x1="${X}" y1="${Y - 42}" x2="${X}" y2="${Y - 26}" stroke="#8fa3bd" stroke-opacity="0.8" stroke-width="1.4"/>`);
  g.push(`<line x1="${X + Wd}" y1="${Y - 42}" x2="${X + Wd}" y2="${Y - 26}" stroke="#8fa3bd" stroke-opacity="0.8" stroke-width="1.4"/>`);
  g.push(`<text x="${X + Wd / 2}" y="${Y - 44}" text-anchor="middle" font-family="${FONT}" font-size="16" fill="#8fa3bd" letter-spacing="2">12,400</text>`);
  g.push(`<line x1="${X - 34}" y1="${Y}" x2="${X - 34}" y2="${Y + Hd}" stroke="#8fa3bd" stroke-opacity="0.8" stroke-width="1.4"/>`);
  g.push(`<text x="${X - 44}" y="${Y + Hd / 2}" text-anchor="middle" font-family="${FONT}" font-size="16" fill="#8fa3bd" letter-spacing="2" transform="rotate(-90 ${X - 44} ${Y + Hd / 2})">9,600</text>`);
  // 通り芯
  for (const cx of [X + 90, X + 390]) {
    g.push(`<line x1="${cx}" y1="${Y - 70}" x2="${cx}" y2="${Y + Hd + 30}" stroke="#8fa3bd" stroke-opacity="0.35" stroke-width="1" stroke-dasharray="14 6 2 6"/>`);
    g.push(`<circle cx="${cx}" cy="${Y - 84}" r="13" fill="none" stroke="#8fa3bd" stroke-opacity="0.6" stroke-width="1.4"/>`);
  }
  // 家具の抽象形
  g.push(`<rect x="${X + 330}" y="${Y + 170}" width="90" height="46" rx="4" fill="${accent}" fill-opacity="0.16" stroke="${accent}" stroke-opacity="0.4" stroke-width="1.5"/>`);
  g.push(`<rect x="${X + 40}" y="${Y + 260}" width="120" height="60" rx="4" fill="${accent}" fill-opacity="0.16" stroke="${accent}" stroke-opacity="0.4" stroke-width="1.5"/>`);
  return `<g>${g.join('\n')}</g>`;
}

// 3. ネットワーク（ノード＋建物）
function motifNetwork(accent, seed) {
  const rnd = mulberry32(seed);
  const nodes = [];
  for (let i = 0; i < 14; i++) {
    nodes.push({ x: 560 + rnd() * 560, y: 100 + rnd() * 420, r: 4 + rnd() * 9 });
  }
  const hub = { x: 850, y: 310, r: 30 };
  const g = [];
  for (const n of nodes) {
    g.push(`<line x1="${hub.x}" y1="${hub.y}" x2="${n.x.toFixed(0)}" y2="${n.y.toFixed(0)}" stroke="${accent}" stroke-opacity="0.22" stroke-width="1.3"/>`);
  }
  for (let i = 0; i < 8; i++) {
    const a = nodes[Math.floor(rnd() * nodes.length)];
    const b = nodes[Math.floor(rnd() * nodes.length)];
    g.push(`<line x1="${a.x.toFixed(0)}" y1="${a.y.toFixed(0)}" x2="${b.x.toFixed(0)}" y2="${b.y.toFixed(0)}" stroke="${accent}" stroke-opacity="0.14" stroke-width="1"/>`);
  }
  for (const n of nodes) {
    g.push(`<circle cx="${n.x.toFixed(0)}" cy="${n.y.toFixed(0)}" r="${n.r.toFixed(1)}" fill="#0a1020" stroke="${accent}" stroke-opacity="0.8" stroke-width="1.6"/>`);
    if (n.r > 9) {
      g.push(`<rect x="${(n.x - 4).toFixed(0)}" y="${(n.y - 4).toFixed(0)}" width="8" height="8" fill="${accent}" fill-opacity="0.9"/>`);
    }
  }
  // ハブ＝建物アイコン
  g.push(`<circle cx="${hub.x}" cy="${hub.y}" r="${hub.r + 14}" fill="none" stroke="${accent}" stroke-opacity="0.35" stroke-width="1.2"/>`);
  g.push(`<circle cx="${hub.x}" cy="${hub.y}" r="${hub.r}" fill="#0a1020" stroke="${accent}" stroke-width="2.4"/>`);
  g.push(`<path d="M ${hub.x - 12} ${hub.y + 13} V ${hub.y - 6} L ${hub.x} ${hub.y - 15} L ${hub.x + 12} ${hub.y - 6} V ${hub.y + 13} Z" fill="none" stroke="${accent}" stroke-width="2"/>`);
  g.push(`<line x1="${hub.x - 5}" y1="${hub.y + 13}" x2="${hub.x - 5}" y2="${hub.y + 4}" stroke="${accent}" stroke-width="2"/>`);
  g.push(`<line x1="${hub.x + 5}" y1="${hub.y + 13}" x2="${hub.x + 5}" y2="${hub.y + 4}" stroke="${accent}" stroke-width="2"/>`);
  return `<g>${g.join('\n')}</g>`;
}

// 4. ニューラルネット＋建物輪郭
function motifNeural(accent, accent2) {
  const g = [];
  const layers = [
    { x: 640, n: 4 },
    { x: 790, n: 6 },
    { x: 940, n: 6 },
    { x: 1090, n: 3 },
  ];
  const nodePos = layers.map((L) => {
    const gap = 420 / (L.n + 1);
    return Array.from({ length: L.n }, (_, i) => ({ x: L.x, y: 130 + gap * (i + 1) }));
  });
  for (let li = 0; li < nodePos.length - 1; li++) {
    for (const a of nodePos[li]) {
      for (const b of nodePos[li + 1]) {
        g.push(`<line x1="${a.x}" y1="${a.y.toFixed(0)}" x2="${b.x}" y2="${b.y.toFixed(0)}" stroke="${accent}" stroke-opacity="0.13" stroke-width="1.1"/>`);
      }
    }
  }
  nodePos.flat().forEach((n, i) => {
    const c = i % 3 === 0 ? accent2 : accent;
    g.push(`<circle cx="${n.x}" cy="${n.y.toFixed(0)}" r="9" fill="#0a1020" stroke="${c}" stroke-width="2"/>`);
    g.push(`<circle cx="${n.x}" cy="${n.y.toFixed(0)}" r="3.4" fill="${c}" fill-opacity="0.9"/>`);
  });
  // 左に建物ワイヤー（入力側）
  g.push(`<path d="M 470 470 V 250 L 510 250 V 190 L 560 190 V 470 Z" fill="none" stroke="${accent}" stroke-opacity="0.8" stroke-width="2.4"/>`);
  for (let y = 220; y < 470; y += 36) {
    g.push(`<line x1="482" y1="${y}" x2="548" y2="${y}" stroke="${accent}" stroke-opacity="0.35" stroke-width="1.4"/>`);
  }
  g.push(`<line x1="560" y1="300" x2="640" y2="235" stroke="${accent}" stroke-opacity="0.4" stroke-width="1.4" stroke-dasharray="5 5"/>`);
  g.push(`<line x1="560" y1="380" x2="640" y2="400" stroke="${accent}" stroke-opacity="0.4" stroke-width="1.4" stroke-dasharray="5 5"/>`);
  return `<g>${g.join('\n')}</g>`;
}

// 5. 回路（サーキット）
function motifCircuit(accent, accent2, seed) {
  const rnd = mulberry32(seed);
  const g = [];
  const cx = 860, cy = 300, cw = 190, ch = 190;
  // チップ
  g.push(`<rect x="${cx - cw / 2}" y="${cy - ch / 2}" width="${cw}" height="${ch}" rx="14" fill="#0a1020" stroke="${accent}" stroke-width="2.6"/>`);
  g.push(`<rect x="${cx - cw / 2 + 22}" y="${cy - ch / 2 + 22}" width="${cw - 44}" height="${ch - 44}" rx="8" fill="none" stroke="${accent}" stroke-opacity="0.4" stroke-width="1.4"/>`);
  // チップ内の建物アイコン
  g.push(`<path d="M ${cx - 34} ${cy + 44} V ${cy - 10} L ${cx - 6} ${cy - 10} V ${cy - 40} L ${cx + 34} ${cy - 40} V ${cy + 44} Z" fill="none" stroke="${accent2}" stroke-width="2.4"/>`);
  for (let y = cy - 24; y < cy + 40; y += 16) {
    g.push(`<line x1="${cx + 4}" y1="${y}" x2="${cx + 26}" y2="${y}" stroke="${accent2}" stroke-opacity="0.6" stroke-width="1.6"/>`);
  }
  // トレース
  const dirs = [
    { sx: cx - cw / 2, sy: 0, horiz: -1 },
    { sx: cx + cw / 2, sy: 0, horiz: 1 },
  ];
  for (const d of dirs) {
    for (let i = 0; i < 6; i++) {
      const y = cy - ch / 2 + 20 + i * 30;
      const len = 90 + rnd() * 200;
      const bend = rnd() > 0.5 ? 40 + rnd() * 100 : 0;
      const ex = d.sx + d.horiz * len;
      let pathStr = `M ${d.sx} ${y} H ${ex}`;
      let px = ex, py = y;
      if (bend) {
        py = y + (rnd() > 0.5 ? bend : -bend);
        pathStr += ` V ${py}`;
        px = ex + d.horiz * (30 + rnd() * 60);
        pathStr += ` H ${px}`;
      }
      g.push(`<path d="${pathStr}" fill="none" stroke="${accent}" stroke-opacity="0.5" stroke-width="2"/>`);
      g.push(`<circle cx="${px.toFixed(0)}" cy="${py.toFixed(0)}" r="5" fill="#0a1020" stroke="${accent}" stroke-width="2"/>`);
    }
  }
  // 上下のピン
  for (let i = 0; i < 5; i++) {
    const x = cx - cw / 2 + 25 + i * 35;
    g.push(`<line x1="${x}" y1="${cy - ch / 2}" x2="${x}" y2="${cy - ch / 2 - 34}" stroke="${accent}" stroke-opacity="0.5" stroke-width="2"/>`);
    g.push(`<line x1="${x}" y1="${cy + ch / 2}" x2="${x}" y2="${cy + ch / 2 + 34}" stroke="${accent}" stroke-opacity="0.5" stroke-width="2"/>`);
  }
  return `<g>${g.join('\n')}</g>`;
}

// 6. 立面図（ブループリント）
function motifElevation(accent) {
  const g = [];
  const X = 660, Y = 120, Wd = 300, Hd = 380;
  g.push(`<rect x="${X}" y="${Y}" width="${Wd}" height="${Hd}" fill="${accent}" fill-opacity="0.06" stroke="${accent}" stroke-width="2.6"/>`);
  // 窓グリッド
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 5; c++) {
      const wx = X + 22 + c * 54;
      const wy = Y + 24 + r * 44;
      g.push(`<rect x="${wx}" y="${wy}" width="34" height="26" fill="${accent}" fill-opacity="${(r + c) % 3 === 0 ? 0.45 : 0.14}" stroke="${accent}" stroke-opacity="0.5" stroke-width="1"/>`);
    }
  }
  // 屋上設備・アンテナ
  g.push(`<rect x="${X + 60}" y="${Y - 26}" width="70" height="26" fill="none" stroke="${accent}" stroke-opacity="0.8" stroke-width="2"/>`);
  g.push(`<line x1="${X + 220}" y1="${Y}" x2="${X + 220}" y2="${Y - 56}" stroke="${accent}" stroke-width="2"/>`);
  g.push(`<circle cx="${X + 220}" cy="${Y - 62}" r="5" fill="${accent}"/>`);
  // 隣の低層棟
  g.push(`<rect x="${X + Wd + 30}" y="${Y + 200}" width="150" height="${Hd - 200}" fill="none" stroke="${accent}" stroke-opacity="0.6" stroke-width="2"/>`);
  for (let r = 0; r < 4; r++) {
    g.push(`<line x1="${X + Wd + 30}" y1="${Y + 240 + r * 36}" x2="${X + Wd + 180}" y2="${Y + 240 + r * 36}" stroke="${accent}" stroke-opacity="0.3" stroke-width="1.2"/>`);
  }
  // GL線と寸法
  g.push(`<line x1="${X - 90}" y1="${Y + Hd}" x2="${X + Wd + 220}" y2="${Y + Hd}" stroke="#c7d3e3" stroke-opacity="0.7" stroke-width="2"/>`);
  g.push(`<text x="${X - 88}" y="${Y + Hd - 10}" font-family="${FONT}" font-size="15" fill="#8fa3bd" letter-spacing="2">GL &#177;0</text>`);
  g.push(`<line x1="${X - 40}" y1="${Y}" x2="${X - 40}" y2="${Y + Hd}" stroke="#8fa3bd" stroke-opacity="0.7" stroke-width="1.3"/>`);
  for (const ty of [Y, Y + Hd]) {
    g.push(`<line x1="${X - 48}" y1="${ty}" x2="${X - 32}" y2="${ty}" stroke="#8fa3bd" stroke-opacity="0.7" stroke-width="1.3"/>`);
  }
  g.push(`<text x="${X - 56}" y="${Y + Hd / 2}" text-anchor="middle" font-family="${FONT}" font-size="15" fill="#8fa3bd" letter-spacing="2" transform="rotate(-90 ${X - 56} ${Y + Hd / 2})">31,200</text>`);
  return `<g>${g.join('\n')}</g>`;
}

// 7. ポイントクラウド（点群ビル）
function motifPointCloud(accent, accent2, seed) {
  const rnd = mulberry32(seed);
  const g = [];
  // タワーのシルエット内にドット
  const towers = [
    { x0: 700, x1: 810, top: 130, base: 500 },
    { x0: 840, x1: 990, top: 210, base: 500 },
    { x0: 1020, x1: 1110, top: 290, base: 500 },
  ];
  for (const t of towers) {
    const count = 420;
    for (let i = 0; i < count; i++) {
      const x = t.x0 + rnd() * (t.x1 - t.x0);
      const y = t.top + rnd() * (t.base - t.top);
      const edge = Math.min(x - t.x0, t.x1 - x) < 10 || y - t.top < 10;
      const r = edge ? 1.9 : 1.1 + rnd() * 1.1;
      const op = edge ? 0.9 : 0.2 + rnd() * 0.5;
      const col = rnd() > 0.85 ? accent2 : accent;
      g.push(`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(1)}" fill="${col}" fill-opacity="${op.toFixed(2)}"/>`);
    }
  }
  // スキャンライン
  g.push(`<line x1="620" y1="330" x2="1160" y2="330" stroke="${accent2}" stroke-opacity="0.65" stroke-width="1.6"/>`);
  g.push(`<rect x="620" y="330" width="540" height="46" fill="url(#fade)" opacity="0.35"/>`);
  // 地面
  g.push(`<line x1="640" y1="500" x2="1160" y2="500" stroke="${accent}" stroke-opacity="0.5" stroke-width="1.6"/>`);
  return `<g>${g.join('\n')}</g>`;
}

// 8. デジタルツイン（実体＋ワイヤーフレームの鏡像）
function motifTwin(accent, accent2) {
  const g = [];
  const cx = 870;
  const mid = 315;
  // 左＝ソリッドな建物
  g.push(`<path d="M ${cx - 230} 470 V 220 L ${cx - 160} 180 V 140 L ${cx - 90} 140 V 470 Z" fill="${accent}" fill-opacity="0.22" stroke="${accent}" stroke-width="2.4"/>`);
  for (let y = 170; y < 460; y += 30) {
    g.push(`<line x1="${cx - 216}" y1="${y}" x2="${cx - 104}" y2="${y}" stroke="${accent}" stroke-opacity="0.3" stroke-width="1.2"/>`);
  }
  // 中央の同期矢印
  g.push(`<path d="M ${cx - 60} ${mid - 26} H ${cx + 30} l -14 -14 M ${cx + 30} ${mid - 26} l -14 14" fill="none" stroke="${accent2}" stroke-width="2.4"/>`);
  g.push(`<path d="M ${cx + 30} ${mid + 26} H ${cx - 60} l 14 -14 M ${cx - 60} ${mid + 26} l 14 14" fill="none" stroke="${accent2}" stroke-width="2.4"/>`);
  // 右＝ワイヤーフレームツイン
  g.push(`<path d="M ${cx + 70} 470 V 220 L ${cx + 140} 180 V 140 L ${cx + 210} 140 V 470 Z" fill="none" stroke="${accent2}" stroke-width="2" stroke-dasharray="7 5"/>`);
  for (let y = 170; y < 460; y += 30) {
    g.push(`<line x1="${cx + 84}" y1="${y}" x2="${cx + 196}" y2="${y}" stroke="${accent2}" stroke-opacity="0.4" stroke-width="1" stroke-dasharray="4 4"/>`);
  }
  for (const vx of [cx + 105, cx + 140, cx + 175]) {
    g.push(`<line x1="${vx}" y1="150" x2="${vx}" y2="470" stroke="${accent2}" stroke-opacity="0.3" stroke-width="1" stroke-dasharray="4 4"/>`);
  }
  // データ粒子
  for (let i = 0; i < 7; i++) {
    const t = i / 6;
    g.push(`<circle cx="${cx - 55 + t * 80}" cy="${mid - 26}" r="2.6" fill="${accent2}" fill-opacity="${0.9 - t * 0.5}"/>`);
    g.push(`<circle cx="${cx + 25 - t * 80}" cy="${mid + 26}" r="2.6" fill="${accent}" fill-opacity="${0.9 - t * 0.5}"/>`);
  }
  return `<g>${g.join('\n')}</g>`;
}

// 9. エディトリアル（タイポグラフィ）
function motifEditorial(accent, accent2, headline, sub) {
  const g = [];
  g.push(`<text x="600" y="330" font-family="${FONT}" font-size="170" font-weight="800" letter-spacing="2" fill="none" stroke="${accent}" stroke-opacity="0.85" stroke-width="2.4">${headline}</text>`);
  g.push(`<text x="612" y="342" font-family="${FONT}" font-size="170" font-weight="800" letter-spacing="2" fill="${accent}" fill-opacity="0.10">${headline}</text>`);
  g.push(`<rect x="604" y="368" width="330" height="10" fill="url(#accentBar)"/>`);
  g.push(`<text x="604" y="425" font-family="${FONT}" font-size="30" font-weight="600" letter-spacing="10" fill="#c7d3e3">${sub}</text>`);
  // 幾何アクセント
  g.push(`<circle cx="1080" cy="160" r="54" fill="none" stroke="${accent2}" stroke-opacity="0.5" stroke-width="1.6"/>`);
  g.push(`<circle cx="1080" cy="160" r="26" fill="none" stroke="${accent2}" stroke-opacity="0.8" stroke-width="1.6"/>`);
  g.push(`<rect x="560" y="140" width="46" height="46" fill="none" stroke="${accent}" stroke-opacity="0.5" stroke-width="1.6" transform="rotate(14 583 163)"/>`);
  return `<g>${g.join('\n')}</g>`;
}

// 10. 断面パース（階段・レベル）
function motifSection(accent, accent2) {
  const g = [];
  const X = 640, Y = 140, Wd = 440, Hd = 350;
  g.push(`<rect x="${X}" y="${Y}" width="${Wd}" height="${Hd}" fill="none" stroke="${accent}" stroke-width="2.6"/>`);
  // 床スラブ
  for (let f = 1; f < 4; f++) {
    const y = Y + (Hd / 4) * f;
    g.push(`<rect x="${X}" y="${y - 5}" width="${Wd}" height="10" fill="${accent}" fill-opacity="0.5"/>`);
  }
  // 階段
  let sx = X + 200, sy = Y + Hd;
  for (let s = 0; s < 8; s++) {
    g.push(`<path d="M ${sx} ${sy} h 18 v -11" fill="none" stroke="${accent2}" stroke-width="2"/>`);
    sx += 18; sy -= 11;
  }
  // 人のスケール figure
  g.push(`<circle cx="${X + 80}" cy="${Y + Hd - 44}" r="8" fill="none" stroke="#c7d3e3" stroke-width="2"/>`);
  g.push(`<line x1="${X + 80}" y1="${Y + Hd - 36}" x2="${X + 80}" y2="${Y + Hd - 12}" stroke="#c7d3e3" stroke-width="2"/>`);
  g.push(`<line x1="${X + 70}" y1="${Y + Hd}" x2="${X + 80}" y2="${Y + Hd - 12}" stroke="#c7d3e3" stroke-width="2"/>`);
  g.push(`<line x1="${X + 90}" y1="${Y + Hd}" x2="${X + 80}" y2="${Y + Hd - 12}" stroke="#c7d3e3" stroke-width="2"/>`);
  // レベル記号
  for (let f = 0; f <= 4; f++) {
    const y = Y + Hd - (Hd / 4) * f;
    g.push(`<line x1="${X + Wd}" y1="${y}" x2="${X + Wd + 60}" y2="${y}" stroke="#8fa3bd" stroke-opacity="0.6" stroke-width="1.3"/>`);
    g.push(`<path d="M ${X + Wd + 60} ${y} l 12 -8 v 16 Z" fill="none" stroke="#8fa3bd" stroke-opacity="0.8" stroke-width="1.3"/>`);
    g.push(`<text x="${X + Wd + 80}" y="${y + 5}" font-family="${FONT}" font-size="15" fill="#8fa3bd" letter-spacing="1">${f}FL</text>`);
  }
  // 屋根の斜線
  g.push(`<path d="M ${X - 20} ${Y} L ${X + Wd / 2} ${Y - 60} L ${X + Wd + 20} ${Y}" fill="none" stroke="${accent}" stroke-width="2.6"/>`);
  return `<g>${g.join('\n')}</g>`;
}

// ---- バリエーション定義 ----------------------------------------------------

const VARIANTS = [
  // ARCHICAD (teal) — 39記事: 3枚追加
  { name: 'archicad-2', accent: '#2dd4bf', accent2: '#5eead4', label: 'ARCHICAD', motif: (a, a2) => motifFloorplan(a) },
  { name: 'archicad-3', accent: '#14b8a6', accent2: '#99f6e4', label: 'ARCHICAD', motif: (a, a2) => motifSection(a, a2) },
  { name: 'archicad-4', accent: '#2dd4bf', accent2: '#0ea5e9', label: 'ARCHICAD', motif: (a, a2) => motifIsoTowers(a, 411) },
  // BIM_ECOSYSTEM (blue) — 34記事: 3枚追加
  { name: 'bim-ecosystem-2', accent: '#60a5fa', accent2: '#93c5fd', label: 'BIM', motif: (a, a2) => motifNetwork(a, 77) },
  { name: 'bim-ecosystem-3', accent: '#3b82f6', accent2: '#60a5fa', label: 'BIM', motif: (a, a2) => motifIsoTowers(a, 129) },
  { name: 'bim-ecosystem-4', accent: '#60a5fa', accent2: '#22d3ee', label: 'BIM', motif: (a, a2) => motifEditorial(a, a2, 'BIM', 'BUILDING INFORMATION MODELING') },
  // REVIT (blue) — 22記事: 2枚追加
  { name: 'revit-2', accent: '#3b82f6', accent2: '#93c5fd', label: 'REVIT', motif: (a, a2) => motifElevation(a) },
  { name: 'revit-3', accent: '#2563eb', accent2: '#60a5fa', label: 'REVIT', motif: (a, a2) => motifIsoTowers(a, 951) },
  // BIM_AI (violet) — 13記事: 2枚追加
  { name: 'bim-ai-2', accent: '#8b5cf6', accent2: '#c4b5fd', label: 'BIM &#215; AI', motif: (a, a2) => motifNeural(a, a2) },
  { name: 'bim-ai-3', accent: '#a78bfa', accent2: '#22d3ee', label: 'BIM &#215; AI', motif: (a, a2) => motifCircuit(a, a2, 33) },
  // AI_DX (violet) — 11記事: 2枚追加
  { name: 'ai-dx-2', accent: '#a78bfa', accent2: '#f0abfc', label: 'AI / DX', motif: (a, a2) => motifCircuit(a, a2, 87) },
  { name: 'ai-dx-3', accent: '#8b5cf6', accent2: '#a78bfa', label: 'AI / DX', motif: (a, a2) => motifEditorial(a, a2, 'AI', 'ARTIFICIAL INTELLIGENCE &#215; AEC') },
  // IFC (cyan) — 1枚追加
  { name: 'ifc-2', accent: '#06b6d4', accent2: '#67e8f9', label: 'IFC / openBIM', motif: (a, a2) => motifElevation(a) },
  // GLOOBE (green) — 1枚追加
  { name: 'gloobe-1', accent: '#10b981', accent2: '#6ee7b7', label: 'GLOOBE', motif: (a, a2) => motifIsoTowers(a, 245) },
  // DIGITAL_TWIN (cyan) — 1枚追加
  { name: 'digital-twin-2', accent: '#22d3ee', accent2: '#67e8f9', label: 'DIGITAL TWIN', motif: (a, a2) => motifTwin(a, a2) },
  // 汎用ニュース — 2枚追加
  { name: 'default-2', accent: '#60a5fa', accent2: '#22d3ee', label: 'AEC NEWS', motif: (a, a2) => motifEditorial(a, a2, 'AEC', 'ARCHITECTURE &#183; ENGINEERING &#183; CONSTRUCTION') },
  { name: 'default-3', accent: '#38bdf8', accent2: '#a5f3fc', label: 'AEC NEWS', motif: (a, a2) => motifPointCloud(a, a2, 501) },
];

// ---- 出力 ------------------------------------------------------------------

function main() {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
  for (const v of VARIANTS) {
    const svg = wrap(v.motif(v.accent, v.accent2), v.accent, v.accent2, v.label);
    fs.writeFileSync(path.join(OUT_DIR, `${v.name}.svg`), svg, 'utf-8');
  }
  const list = VARIANTS.map((v) => v.name);
  fs.writeFileSync(path.join(OUT_DIR, 'manifest.json'), JSON.stringify(list, null, 2), 'utf-8');
  console.log(`[generateOgSvgs] ${VARIANTS.length} SVGs written to og-src/`);
}

main();
