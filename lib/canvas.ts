import type { AppState, OutroState, FontEffect, BorderStyle } from './types';
import { buildFont } from './fonts';

export const W = 540, H = 960;
// Output canvases are rendered at SCALE× resolution (1080x1920) for crisper text/edges,
// while all layout math below stays in the original 540x960 logical space.
export const SCALE = 2;
export const OUT_W = W * SCALE, OUT_H = H * SCALE;
const TOP_H = H * 0.28;
const VID_Y = H * 0.28;
const VID_H = H * 0.44;
const BOT_Y = VID_Y + VID_H;
const BOT_H = H - BOT_Y;

// ── seed-based pseudo-random ──────────────────────────────────
let _seed = 42;
function sr(n: number) {
  const x = Math.sin(n + _seed) * 10000;
  return x - Math.floor(x);
}

// ── background patterns (next-gen) ───────────────────────────
type PatternFn = (ctx: CanvasRenderingContext2D) => void;

const PATTERNS: Record<string, PatternFn> = {
  dramatic(ctx) {
    // Deep space: dark with aurora bands and star field
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0,   '#020008');
    g.addColorStop(0.4, '#0d0020');
    g.addColorStop(1,   '#000508');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

    // Aurora band 1
    const a1 = ctx.createLinearGradient(0, H * 0.1, 0, H * 0.5);
    a1.addColorStop(0, 'transparent');
    a1.addColorStop(0.4, 'rgba(120, 0, 255, 0.12)');
    a1.addColorStop(0.6, 'rgba(0, 180, 255, 0.08)');
    a1.addColorStop(1, 'transparent');
    ctx.fillStyle = a1; ctx.fillRect(0, 0, W, H);

    // Aurora band 2
    const a2 = ctx.createLinearGradient(W, H * 0.5, 0, H);
    a2.addColorStop(0, 'transparent');
    a2.addColorStop(0.3, 'rgba(255, 0, 120, 0.08)');
    a2.addColorStop(0.6, 'rgba(80, 0, 220, 0.1)');
    a2.addColorStop(1, 'transparent');
    ctx.fillStyle = a2; ctx.fillRect(0, 0, W, H);

    // Star field
    for (let i = 0; i < 80; i++) {
      const brightness = sr(i * 3 + 2);
      ctx.fillStyle = `rgba(255,255,255,${brightness * 0.6 + 0.1})`;
      const size = sr(i * 3) * 1.8 + 0.3;
      ctx.beginPath();
      ctx.arc(sr(i * 3 + 1) * W, sr(i * 3 + 2) * H, size, 0, Math.PI * 2);
      ctx.fill();
    }

    // Glow orb
    const orb = ctx.createRadialGradient(W * 0.5, H * 0.42, 0, W * 0.5, H * 0.42, W * 0.7);
    orb.addColorStop(0,   'rgba(100, 0, 200, 0.15)');
    orb.addColorStop(0.5, 'rgba(0, 80, 200, 0.06)');
    orb.addColorStop(1,   'transparent');
    ctx.fillStyle = orb; ctx.fillRect(0, 0, W, H);
  },

  clean(ctx) {
    // Minimal cyber: dark with thin neon grid
    ctx.fillStyle = '#03050f'; ctx.fillRect(0, 0, W, H);

    // Perspective grid
    const vp = { x: W / 2, y: H * 0.5 };
    ctx.strokeStyle = 'rgba(0, 180, 255, 0.07)'; ctx.lineWidth = 1;
    for (let i = -6; i <= 6; i++) {
      ctx.beginPath();
      ctx.moveTo(vp.x + i * 60, 0);
      ctx.lineTo(vp.x + i * 300, H);
      ctx.stroke();
    }
    for (let y = 0; y < H; y += 40) {
      const progress = y / H;
      const left  = vp.x - 360 * progress;
      const right = vp.x + 360 * progress;
      ctx.beginPath(); ctx.moveTo(left, y); ctx.lineTo(right, y); ctx.stroke();
    }

    // Accent lines at video boundaries
    const lineGrad1 = ctx.createLinearGradient(0, 0, W, 0);
    lineGrad1.addColorStop(0, 'transparent');
    lineGrad1.addColorStop(0.3, 'rgba(0, 200, 255, 0.7)');
    lineGrad1.addColorStop(0.7, 'rgba(120, 0, 255, 0.7)');
    lineGrad1.addColorStop(1, 'transparent');
    ctx.strokeStyle = lineGrad1; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(0, VID_Y - 2); ctx.lineTo(W, VID_Y - 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, BOT_Y + 2); ctx.lineTo(W, BOT_Y + 2); ctx.stroke();

    // Subtle glow
    const glow = ctx.createRadialGradient(W/2, H/2, 0, W/2, H/2, W);
    glow.addColorStop(0, 'rgba(0, 120, 255, 0.05)');
    glow.addColorStop(1, 'transparent');
    ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H);
  },

  energy(ctx) {
    // High-voltage: electric plasma effect
    ctx.fillStyle = '#000a00'; ctx.fillRect(0, 0, W, H);

    // Base gradient
    const base = ctx.createLinearGradient(0, 0, W, H);
    base.addColorStop(0, 'rgba(0,40,0,0.9)');
    base.addColorStop(0.5, 'rgba(0,20,10,0.9)');
    base.addColorStop(1, 'rgba(0,5,20,0.9)');
    ctx.fillStyle = base; ctx.fillRect(0, 0, W, H);

    // Plasma streaks
    for (let i = 0; i < 8; i++) {
      const x = sr(i * 7 + 1) * W;
      const yStart = sr(i * 7 + 2) * H * 0.3;
      const yEnd   = yStart + sr(i * 7 + 3) * H * 0.6 + H * 0.2;
      const streak = ctx.createLinearGradient(x, yStart, x + 20, yEnd);
      streak.addColorStop(0, 'transparent');
      streak.addColorStop(0.3, `rgba(57,255,20,${0.06 + sr(i * 7 + 4) * 0.06})`);
      streak.addColorStop(0.7, `rgba(0,255,180,${0.04 + sr(i * 7 + 5) * 0.04})`);
      streak.addColorStop(1, 'transparent');
      ctx.strokeStyle = streak; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(x, yStart); ctx.lineTo(x + 15, yEnd); ctx.stroke();
    }

    // Central energy orb
    const orb = ctx.createRadialGradient(W/2, H * 0.5, 0, W/2, H * 0.5, W * 0.5);
    orb.addColorStop(0,   'rgba(57, 255, 20, 0.18)');
    orb.addColorStop(0.4, 'rgba(0, 255, 100, 0.08)');
    orb.addColorStop(1,   'transparent');
    ctx.fillStyle = orb; ctx.fillRect(0, 0, W, H);

    // Scan lines
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    for (let y = 0; y < H; y += 3) ctx.fillRect(0, y, W, 1);
  },

  luxury(ctx) {
    // Gold & obsidian: premium dark with metallic sheen
    ctx.fillStyle = '#060400'; ctx.fillRect(0, 0, W, H);

    // Deep radial bg
    const bg = ctx.createRadialGradient(W/2, H*0.4, 0, W/2, H*0.4, W * 1.1);
    bg.addColorStop(0,   'rgba(60, 40, 0, 0.8)');
    bg.addColorStop(0.5, 'rgba(20, 12, 0, 0.6)');
    bg.addColorStop(1,   'transparent');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

    // Diagonal light sweep
    const sweep = ctx.createLinearGradient(0, 0, W, H);
    sweep.addColorStop(0, 'transparent');
    sweep.addColorStop(0.4, 'rgba(255, 200, 50, 0.04)');
    sweep.addColorStop(0.5, 'rgba(255, 220, 100, 0.08)');
    sweep.addColorStop(0.6, 'rgba(255, 200, 50, 0.04)');
    sweep.addColorStop(1, 'transparent');
    ctx.fillStyle = sweep; ctx.fillRect(0, 0, W, H);

    // Gold dust particles
    for (let i = 0; i < 60; i++) {
      const size = sr(i * 7 + 3) * 2.5 + 0.5;
      const alpha = sr(i * 7 + 4) * 0.5 + 0.1;
      ctx.fillStyle = `rgba(255,215,0,${alpha})`;
      ctx.beginPath();
      ctx.arc(sr(i * 7 + 5) * W, sr(i * 7 + 6) * H, size, 0, Math.PI * 2);
      ctx.fill();
    }

    // Thin gold accent lines
    const gl = ctx.createLinearGradient(0, 0, W, 0);
    gl.addColorStop(0, 'transparent');
    gl.addColorStop(0.2, 'rgba(255,215,0,0.5)');
    gl.addColorStop(0.8, 'rgba(255,180,0,0.5)');
    gl.addColorStop(1, 'transparent');
    ctx.strokeStyle = gl; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, VID_Y - 1); ctx.lineTo(W, VID_Y - 1); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, BOT_Y + 1); ctx.lineTo(W, BOT_Y + 1); ctx.stroke();
  },

  street(ctx) {
    // Urban glitch: lo-fi city vibes with neon pink/cyan
    ctx.fillStyle = '#040408'; ctx.fillRect(0, 0, W, H);

    // Noise texture
    for (let i = 0; i < 200; i++) {
      const a = sr(i * 5 + 2) * 0.08;
      ctx.fillStyle = `rgba(255,255,255,${a})`;
      ctx.fillRect(sr(i * 5) * W, sr(i * 5 + 1) * H, 2, 2);
    }

    // Glitch horizontal bands
    for (let i = 0; i < 5; i++) {
      const y = sr(i * 11 + 7) * H;
      const h = sr(i * 11 + 8) * 4 + 1;
      const shift = (sr(i * 11 + 9) - 0.5) * 20;
      ctx.fillStyle = `rgba(255, 0, 100, ${0.04 + sr(i * 11 + 10) * 0.04})`;
      ctx.fillRect(shift, y, W, h);
    }

    // Neon side bars
    const leftBar = ctx.createLinearGradient(0, 0, 8, 0);
    leftBar.addColorStop(0, 'rgba(255, 0, 128, 0.5)');
    leftBar.addColorStop(1, 'transparent');
    ctx.fillStyle = leftBar; ctx.fillRect(0, 0, 8, H);

    const rightBar = ctx.createLinearGradient(W - 8, 0, W, 0);
    rightBar.addColorStop(0, 'transparent');
    rightBar.addColorStop(1, 'rgba(0, 255, 200, 0.5)');
    ctx.fillStyle = rightBar; ctx.fillRect(W - 8, 0, 8, H);

    // Accent lines
    ctx.strokeStyle = 'rgba(255, 0, 128, 0.5)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, VID_Y - 4); ctx.lineTo(W * 0.6, VID_Y - 4); ctx.stroke();
    ctx.strokeStyle = 'rgba(0, 255, 200, 0.5)';
    ctx.beginPath(); ctx.moveTo(W, BOT_Y + 4); ctx.lineTo(W * 0.4, BOT_Y + 4); ctx.stroke();
  },
};
const PATTERN_KEYS = Object.keys(PATTERNS);

export function getPattern(mode: string, idx: number): PatternFn {
  if (mode === 'random') return PATTERNS[PATTERN_KEYS[idx % PATTERN_KEYS.length]];
  return PATTERNS[mode] ?? PATTERNS.dramatic;
}

// ── rounded rect ─────────────────────────────────────────────
type RadiusInput = number | { tl: number; tr: number; br: number; bl: number };
export function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: RadiusInput) {
  const R = typeof r === 'number' ? { tl: r, tr: r, br: r, bl: r } : r;
  ctx.beginPath();
  ctx.moveTo(x+R.tl, y);
  ctx.lineTo(x+w-R.tr, y); ctx.quadraticCurveTo(x+w, y, x+w, y+R.tr);
  ctx.lineTo(x+w, y+h-R.br); ctx.quadraticCurveTo(x+w, y+h, x+w-R.br, y+h);
  ctx.lineTo(x+R.bl, y+h); ctx.quadraticCurveTo(x, y+h, x, y+h-R.bl);
  ctx.lineTo(x, y+R.tl); ctx.quadraticCurveTo(x, y, x+R.tl, y);
  ctx.closePath();
}

// ── text effect ───────────────────────────────────────────────
function drawText(
  ctx: CanvasRenderingContext2D,
  effect: FontEffect,
  color: string,
  text: string,
  x: number, y: number,
  size: number,
  outline?: { color: string },
) {
  // 文字自体の縁取り（エフェクトとは独立して適用可能）
  if (outline) {
    ctx.strokeStyle = outline.color;
    ctx.lineWidth = size * 0.1;
    ctx.lineJoin = 'round';
    ctx.strokeText(text, x, y);
  }
  ctx.fillStyle = color;
  switch (effect) {
    case 'stroke':
      ctx.strokeStyle = '#000'; ctx.lineWidth = size * 0.12; ctx.lineJoin = 'round';
      ctx.strokeText(text, x, y); ctx.fillText(text, x, y); break;
    case 'glow':
      ctx.shadowColor = color; ctx.shadowBlur = size * 0.5;
      ctx.fillText(text, x, y); ctx.shadowBlur = 0; break;
    case 'box': {
      const m = ctx.measureText(text), p = size * 0.2;
      ctx.fillStyle = 'rgba(0,0,0,0.65)';
      rr(ctx, x-m.width/2-p, y-size-p/2, m.width+p*2, size+p*1.5, 6); ctx.fill();
      ctx.fillStyle = color; ctx.fillText(text, x, y); break;
    }
    case 'simple':
      ctx.fillText(text, x, y); break;
    default: // shadow
      ctx.shadowColor = 'rgba(0,0,0,0.9)'; ctx.shadowBlur = size * 0.35;
      ctx.shadowOffsetX = 2; ctx.shadowOffsetY = 3;
      ctx.fillText(text, x, y);
      ctx.shadowBlur = 0; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0;
  }
}

// ── border ────────────────────────────────────────────────────
function drawBorder(ctx: CanvasRenderingContext2D, style: BorderStyle, color: string) {
  if (style === 'none') return;
  ctx.strokeStyle = color;
  switch (style) {
    case 'thin':  ctx.lineWidth = 2; ctx.strokeRect(3, 3, W-6, H-6); break;
    case 'thick': ctx.lineWidth = 7; ctx.strokeRect(4, 4, W-8, H-8); break;
    case 'glow':
      ctx.shadowColor = color; ctx.shadowBlur = 24; ctx.lineWidth = 3;
      ctx.strokeRect(4, 4, W-8, H-8); ctx.shadowBlur = 0; break;
    case 'corner': {
      const l = 60, lw = 6, c = 22; ctx.lineWidth = lw;
      const corners: [number,number,number,number,number,number][] = [
        [c,c,c+l,c,c,c+l], [W-c,c,W-c-l,c,W-c,c+l],
        [c,H-c,c+l,H-c,c,H-c-l], [W-c,H-c,W-c-l,H-c,W-c,H-c-l],
      ];
      corners.forEach(([ax,ay,bx,by,cx2,cy]) => {
        ctx.beginPath(); ctx.moveTo(ax,ay); ctx.lineTo(bx,by); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(ax,ay); ctx.lineTo(cx2,cy); ctx.stroke();
      }); break;
    }
  }
}

// ── format time ───────────────────────────────────────────────
export function fmtTime(sec: number): string {
  const s = Math.floor(sec % 60);
  const m = Math.floor(sec / 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

// ── draw main frame ───────────────────────────────────────────
interface DrawFrameOptions {
  fontFamily?: AppState['fontFamily'];
  fontEffect?: AppState['fontEffect'];
  fontSize?: number;
  textColor?: string;
  borderStyle?: BorderStyle;
  borderColor?: string;
  pattern?: string;
  ctaText?: string;
  ctaColor?: string;
  patIdx?: number;
  hook?: { elapsed: number; duration: number };
}

export function drawFrame(
  ctx: CanvasRenderingContext2D,
  videoEl: HTMLVideoElement | null,
  title: string,
  elapsed: number,
  clipDuration: number,
  state: AppState,
  options: DrawFrameOptions = {},
) {
  const fontFamily  = options.fontFamily  ?? state.fontFamily;
  const fontEffect  = options.fontEffect  ?? state.fontEffect;
  const fontSize    = options.fontSize    ?? state.fontSize;
  const textColor   = options.textColor   ?? state.textColor;
  const borderStyle = options.borderStyle ?? state.borderStyle;
  const borderColor = options.borderColor ?? state.borderColor;
  const pattern     = options.pattern     ?? state.pattern;
  const ctaText     = options.ctaText     ?? state.ctaText;
  const ctaColor    = options.ctaColor    ?? state.ctaColor;
  const patIdx      = options.patIdx      ?? 0;
  const customFontName = state.customFontName;
  const outline = state.textOutline ? { color: state.outlineColor } : undefined;

  ctx.save();
  ctx.scale(SCALE, SCALE);

  _seed = patIdx * 137 + 29;

  // Background
  getPattern(pattern, patIdx)(ctx);

  // Video
  if (videoEl && videoEl.readyState >= 2) {
    const vw = videoEl.videoWidth || 1280;
    const vh = videoEl.videoHeight || 720;
    const scale = Math.min(W / vw, VID_H / vh);
    const dw = vw * scale, dh = vh * scale;
    const dx = (W - dw) / 2, dy = VID_Y + (VID_H - dh) / 2;
    ctx.fillStyle = '#000'; ctx.fillRect(0, VID_Y, W, VID_H);
    ctx.drawImage(videoEl, dx, dy, dw, dh);
  } else {
    ctx.fillStyle = '#0a0a14'; ctx.fillRect(0, VID_Y, W, VID_H);
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.font = '13px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('動画をアップロードしてください', W/2, VID_Y + VID_H/2);
  }

  // Gradients over video edges
  const topGrad = ctx.createLinearGradient(0, 0, 0, VID_Y + 80);
  topGrad.addColorStop(0, 'rgba(0,0,0,0.92)'); topGrad.addColorStop(1, 'transparent');
  ctx.fillStyle = topGrad; ctx.fillRect(0, 0, W, VID_Y + 80);
  const botGrad = ctx.createLinearGradient(0, BOT_Y - 80, 0, H);
  botGrad.addColorStop(0, 'transparent'); botGrad.addColorStop(1, 'rgba(0,0,0,0.95)');
  ctx.fillStyle = botGrad; ctx.fillRect(0, BOT_Y - 80, W, H - BOT_Y + 80);

  // Title
  const MAX_TEXT_W = W - 40;
  const rawLines = title.split('\n').filter(l => l.trim());
  let fSize = fontSize ?? (rawLines.length > 1 ? 54 : 60);
  const MIN_SIZE = 28;
  outer: while (fSize >= MIN_SIZE) {
    ctx.font = buildFont(fontFamily, fSize, customFontName);
    for (const line of rawLines) {
      if (ctx.measureText(line).width > MAX_TEXT_W) { fSize -= 2; continue outer; }
    }
    break;
  }
  const finalLines: string[] = [];
  ctx.font = buildFont(fontFamily, fSize, customFontName);
  for (const line of rawLines) {
    if (ctx.measureText(line).width <= MAX_TEXT_W) { finalLines.push(line); continue; }
    const mid = Math.ceil(line.length / 2);
    finalLines.push(line.slice(0, mid), line.slice(mid));
  }
  ctx.textAlign = 'center';
  const lineH = fSize * 1.28;
  const totalTextH = finalLines.length * lineH;
  const titleStartY = Math.max(fSize + 10, (TOP_H - totalTextH) / 2 + fSize);
  finalLines.forEach((line, i) => {
    ctx.font = buildFont(fontFamily, fSize, customFontName);
    drawText(ctx, fontEffect, textColor, line, W/2, titleStartY + i * lineH, fSize, outline);
  });

  // CTA
  const ctaY = BOT_Y + BOT_H * 0.38;
  ctx.font = '700 30px "Noto Sans JP",sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = ctaColor;
  ctx.shadowColor = 'rgba(0,0,0,0.9)'; ctx.shadowBlur = 10;
  ctx.fillText(ctaText, W/2, ctaY);
  ctx.font = '700 26px sans-serif';
  ctx.fillText('▼', W/2, ctaY + 36);
  ctx.shadowBlur = 0;

  // Progress bar
  if (clipDuration > 0) {
    const cur = fmtTime(elapsed), tot = fmtTime(clipDuration);
    const text = `${cur} / ${tot}`;
    ctx.font = '700 18px "SF Mono","Courier New",monospace';
    ctx.textAlign = 'right';
    const tw = ctx.measureText(text).width;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    rr(ctx, W - tw - 22, BOT_Y - 34, tw + 16, 26, 6); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.fillText(text, W - 13, BOT_Y - 14);
    const prog = Math.min(elapsed / clipDuration, 1);
    ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.fillRect(0, BOT_Y - 8, W, 8);
    ctx.fillStyle = '#FFD700'; ctx.fillRect(0, BOT_Y - 8, W * prog, 8);
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(W * prog, BOT_Y - 4, 7, 0, Math.PI * 2); ctx.fill();
  }

  // AI badge
  ctx.fillStyle = 'rgba(124,58,237,0.85)';
  rr(ctx, W-88, H-40, 68, 26, 6); ctx.fill();
  ctx.font = '600 12px "Noto Sans JP",sans-serif';
  ctx.textAlign = 'center'; ctx.fillStyle = '#fff';
  ctx.fillText('AI生成', W-54, H-22);

  drawBorder(ctx, borderStyle, borderColor);

  if (options.hook) drawHookOverlay(ctx, options.hook.elapsed, options.hook.duration);

  ctx.restore();
}

// ── opening hook overlay ──────────────────────────────────────
function drawHookOverlay(ctx: CanvasRenderingContext2D, elapsed: number, duration: number) {
  const prog = Math.min(elapsed / duration, 1);

  // Pulsing badge
  const pulse = 1 + Math.sin(elapsed * 10) * 0.04;
  ctx.save();
  ctx.translate(W / 2, 54);
  ctx.scale(pulse, pulse);
  ctx.font = '900 26px "Noto Sans JP",sans-serif';
  ctx.textAlign = 'center';
  const label = '⚡ この後、衝撃の展開…';
  const tw = ctx.measureText(label).width;
  const grad = ctx.createLinearGradient(-tw/2 - 16, 0, tw/2 + 16, 0);
  grad.addColorStop(0, '#ff3d6e'); grad.addColorStop(1, '#7c3aed');
  ctx.fillStyle = grad;
  rr(ctx, -tw/2 - 16, -22, tw + 32, 44, 22); ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 6;
  ctx.fillText(label, 0, 9);
  ctx.shadowBlur = 0;
  ctx.restore();

  // Countdown progress ring (top-right)
  const cx = W - 40, cy = 54, r = 18;
  ctx.lineWidth = 4;
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = '#FFD700';
  ctx.beginPath(); ctx.arc(cx, cy, r, -Math.PI/2, -Math.PI/2 + (1 - prog) * Math.PI * 2); ctx.stroke();

  // Vignette flash on edges
  const flash = ctx.createRadialGradient(W/2, H/2, H*0.35, W/2, H/2, H*0.7);
  flash.addColorStop(0, 'transparent');
  flash.addColorStop(1, `rgba(255,61,110,${0.15 * (1 - prog)})`);
  ctx.fillStyle = flash; ctx.fillRect(0, 0, W, H);
}

// ── outro frame ───────────────────────────────────────────────
export function drawOutroFrame(
  ctx: CanvasRenderingContext2D,
  elapsed: number,
  totalDuration: number,
  outro: OutroState,
  videoEl?: HTMLVideoElement | null,
) {
  const totalD = totalDuration > 0 ? totalDuration : 5;

  ctx.save();
  ctx.scale(SCALE, SCALE);

  // ── video outro ──
  if (outro.mode === 'video' && videoEl && videoEl.readyState >= 2) {
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    const vw = videoEl.videoWidth || W;
    const vh = videoEl.videoHeight || H;
    const scale = Math.max(W / vw, H / vh);
    const dw = vw * scale, dh = vh * scale;
    ctx.drawImage(videoEl, (W - dw) / 2, (H - dh) / 2, dw, dh);
    // Progress bar
    const prog = Math.min(elapsed / totalD, 1);
    ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(0, H - 8, W, 8);
    const barGrad = ctx.createLinearGradient(0, 0, W * prog, 0);
    barGrad.addColorStop(0, '#7c3aed'); barGrad.addColorStop(1, '#06b6d4');
    ctx.fillStyle = barGrad; ctx.fillRect(0, H - 8, W * prog, 8);
    ctx.restore();
    return;
  }

  // ── text outro ──
  const fadeIn   = Math.min(1, elapsed / 0.6);
  const fadeOut  = elapsed > totalD - 0.5 ? Math.max(0, (totalD - elapsed) / 0.5) : 1;
  const opacity  = fadeIn * fadeOut;

  // Background
  ctx.fillStyle = outro.bgColor; ctx.fillRect(0, 0, W, H);

  // Animated radial pulse
  const pulseScale = 0.8 + Math.sin(elapsed * 1.5) * 0.08;
  const orb = ctx.createRadialGradient(W/2, H/2, 0, W/2, H/2, W * pulseScale);
  orb.addColorStop(0,   'rgba(124, 58, 237, 0.2)');
  orb.addColorStop(0.4, 'rgba(6, 182, 212, 0.08)');
  orb.addColorStop(1,   'transparent');
  ctx.fillStyle = orb; ctx.fillRect(0, 0, W, H);

  // Grid lines
  ctx.strokeStyle = 'rgba(255,255,255,0.05)'; ctx.lineWidth = 1;
  for (let y = 0; y < H; y += 28) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  }
  for (let x = 0; x < W; x += 28) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
  }

  // Glow corner accents
  const cornerAccent = (x: number, y: number, ax: number, ay: number) => {
    const cg = ctx.createRadialGradient(x, y, 0, x, y, 120);
    cg.addColorStop(0, 'rgba(124,58,237,0.25)');
    cg.addColorStop(1, 'transparent');
    ctx.fillStyle = cg; ctx.fillRect(ax, ay, 120, 120);
  };
  cornerAccent(0, 0, 0, 0);
  cornerAccent(W, H, W - 120, H - 120);

  ctx.globalAlpha = opacity;

  // Subscribe button
  const btnY = H * 0.29;
  const btnW = 200, btnH = 64;
  const btnX = W/2 - btnW/2;
  const btnGrad = ctx.createLinearGradient(btnX, 0, btnX + btnW, 0);
  btnGrad.addColorStop(0, '#ff0000');
  btnGrad.addColorStop(1, '#cc0000');
  ctx.fillStyle = btnGrad;
  rr(ctx, btnX, btnY - btnH/2, btnW, btnH, 16); ctx.fill();

  // Play icon inside button
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.moveTo(W/2 - 16, btnY - 16);
  ctx.lineTo(W/2 - 16, btnY + 16);
  ctx.lineTo(W/2 + 18, btnY);
  ctx.closePath(); ctx.fill();

  // Channel name
  const chName = outro.channel || 'CHANNEL NAME';
  ctx.fillStyle = '#ffffff';
  let cSize = 44;
  ctx.font = `900 ${cSize}px "Noto Sans JP",sans-serif`;
  ctx.textAlign = 'center';
  ctx.shadowColor = 'rgba(0,0,0,0.8)'; ctx.shadowBlur = 20;
  while (cSize > 18 && ctx.measureText(chName).width > W - 64) {
    cSize -= 2; ctx.font = `900 ${cSize}px "Noto Sans JP",sans-serif`;
  }
  ctx.fillText(chName, W/2, H * 0.49);
  ctx.shadowBlur = 0;

  // Divider
  const divGrad = ctx.createLinearGradient(W * 0.15, 0, W * 0.85, 0);
  divGrad.addColorStop(0, 'transparent');
  divGrad.addColorStop(0.3, 'rgba(255,255,255,0.4)');
  divGrad.addColorStop(0.7, 'rgba(255,255,255,0.4)');
  divGrad.addColorStop(1, 'transparent');
  ctx.strokeStyle = divGrad; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(W*0.15, H*0.535); ctx.lineTo(W*0.85, H*0.535); ctx.stroke();

  // Sub text
  if (outro.sub) {
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    let subSize = 24;
    ctx.font = `400 ${subSize}px "Noto Sans JP",sans-serif`;
    while (subSize > 14 && ctx.measureText(outro.sub).width > W - 64) {
      subSize -= 1; ctx.font = `400 ${subSize}px "Noto Sans JP",sans-serif`;
    }
    ctx.fillText(outro.sub, W/2, H * 0.585);
  }

  // SNS
  if (outro.sns) {
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.font = '500 20px "Noto Sans JP",sans-serif';
    ctx.fillText(outro.sns, W/2, H * 0.64);
  }

  // Subscribe prompt (animated pulse)
  const subAlpha = 0.7 + Math.sin(elapsed * 3) * 0.3;
  ctx.fillStyle = `rgba(255,255,255,${subAlpha * opacity})`;
  ctx.font = '700 22px "Noto Sans JP",sans-serif';
  ctx.fillText('チャンネル登録お願いします！', W/2, H * 0.76);

  ctx.globalAlpha = 1;

  // Progress bar (gradient)
  const prog = Math.min(elapsed / totalD, 1);
  ctx.fillStyle = 'rgba(255,255,255,0.1)'; ctx.fillRect(0, H - 8, W, 8);
  const barGrad = ctx.createLinearGradient(0, 0, W * prog, 0);
  barGrad.addColorStop(0, '#7c3aed');
  barGrad.addColorStop(1, '#06b6d4');
  ctx.fillStyle = barGrad; ctx.fillRect(0, H - 8, W * prog, 8);
  ctx.restore();
}

// ── scene analysis ────────────────────────────────────────────
export async function analyzeScenes(
  videoURL: string,
  n: number,
  onProgress?: (p: number) => void,
): Promise<{ startTime: number; clipDuration: number; score: number }[]> {
  return new Promise(resolve => {
    const vid = document.createElement('video');
    vid.src = videoURL; vid.muted = true; vid.preload = 'auto';
    vid.addEventListener('loadedmetadata', async () => {
      const duration = vid.duration;
      const clipLen = Math.min(28, Math.max(5, duration / n));
      const AW = 128, AH = 72;
      const ac = document.createElement('canvas'); ac.width = AW; ac.height = AH;
      const actx = ac.getContext('2d', { willReadFrequently: true })!;
      const STEP = Math.max(0.4, duration / 100);
      const scores: { t: number; score: number }[] = [];
      let prevData: Uint8ClampedArray | null = null;
      for (let t = 0; t < duration - clipLen; t += STEP) {
        await new Promise<void>(r => {
          let done = false;
          const finish = () => { if (!done) { done = true; r(); } };
          // seeked may never fire if currentTime is already at t (e.g. first iteration at 0)
          const guard = setTimeout(finish, 800);
          vid.addEventListener('seeked', () => { clearTimeout(guard); finish(); }, { once: true });
          vid.currentTime = t;
        });
        actx.drawImage(vid, 0, 0, AW, AH);
        const raw = actx.getImageData(0, 0, AW, AH).data;
        let motion = 0;
        if (prevData) {
          for (let i = 0; i < raw.length; i += 4)
            motion += Math.abs(raw[i]-prevData[i]) + Math.abs(raw[i+1]-prevData[i+1]) + Math.abs(raw[i+2]-prevData[i+2]);
          motion /= (raw.length / 4) * 3 * 255;
        }
        let sum = 0;
        for (let i = 0; i < raw.length; i += 4) sum += (raw[i]+raw[i+1]+raw[i+2]) / 3;
        const mean = sum / (raw.length / 4);
        let variance = 0;
        for (let i = 0; i < raw.length; i += 4) {
          const b = (raw[i]+raw[i+1]+raw[i+2])/3; variance += (b - mean) ** 2;
        }
        variance = Math.sqrt(variance / (raw.length / 4)) / 255;
        scores.push({ t, score: motion * 0.65 + variance * 0.35 });
        prevData = raw.slice();
        onProgress?.(t / (duration - clipLen));
      }
      const smoothed = scores.map((s, i) => ({
        t: s.t,
        score: scores.slice(Math.max(0,i-3), i+4).reduce((a,b)=>a+b.score,0) / Math.min(7, scores.length),
      }));
      const zoneSize = duration / n;
      const selected = [];
      for (let z = 0; z < n; z++) {
        const zStart = zoneSize * z, zEnd = zoneSize * (z + 1);
        const inZone = smoothed.filter(s => s.t >= zStart && s.t < zEnd);
        if (!inZone.length) { selected.push({ startTime: Math.max(0, zStart+(zoneSize-clipLen)/2), clipDuration: clipLen, score: 0 }); continue; }
        const best = inZone.reduce((a, b) => b.score > a.score ? b : a);
        const tStart = Math.min(Math.max(zStart, best.t - 2), zEnd - clipLen);
        selected.push({ startTime: Math.max(0, Math.min(tStart, duration - clipLen)), clipDuration: clipLen, score: best.score });
      }
      selected.sort((a, b) => a.startTime - b.startTime);
      resolve(selected);
    });
    vid.load();
  });
}
