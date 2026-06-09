import type { AppState, OutroState, FontEffect, BorderStyle } from './types';
import { buildFont } from './fonts';

export const W = 540, H = 960;
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

// ── background patterns ───────────────────────────────────────
type PatternFn = (ctx: CanvasRenderingContext2D) => void;

const PATTERNS: Record<string, PatternFn> = {
  dramatic(ctx) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#0a0014'); g.addColorStop(0.5, '#1a0030'); g.addColorStop(1, '#000');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    const rg = ctx.createRadialGradient(W/2, H*.5, 0, W/2, H*.5, W*.9);
    rg.addColorStop(0, 'rgba(120,0,180,0.25)'); rg.addColorStop(1, 'transparent');
    ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    for (let i = 0; i < 30; i++) {
      ctx.beginPath(); ctx.arc(sr(i*3)*W, sr(i*3+1)*H, sr(i*3+2)*1.5+.5, 0, Math.PI*2); ctx.fill();
    }
  },
  clean(ctx) {
    ctx.fillStyle = '#080810'; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(255,255,255,0.03)'; ctx.lineWidth = 1;
    for (let y = 0; y < H; y += 20) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(74,158,255,0.18)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(0, VID_Y-2); ctx.lineTo(W, VID_Y-2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, BOT_Y+2); ctx.lineTo(W, BOT_Y+2); ctx.stroke();
  },
  energy(ctx) {
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, '#001a00'); g.addColorStop(1, '#000');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(57,255,20,0.06)'; ctx.lineWidth = 1;
    for (let i = -H; i < W+H; i += 22) {
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i+H, H); ctx.stroke();
    }
    const rg = ctx.createRadialGradient(W/2, H*.5, 0, W/2, H*.5, W*.7);
    rg.addColorStop(0, 'rgba(57,255,20,0.12)'); rg.addColorStop(1, 'transparent');
    ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H);
  },
  luxury(ctx) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#0a0800'); g.addColorStop(1, '#000');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(255,215,0,0.07)';
    for (let i = 0; i < 50; i++) {
      ctx.beginPath(); ctx.arc(sr(i*7+3)*W, sr(i*7+4)*H, 1.5, 0, Math.PI*2); ctx.fill();
    }
    const rg = ctx.createRadialGradient(W/2, H*.5, 0, W/2, H*.5, W*.7);
    rg.addColorStop(0, 'rgba(255,215,0,0.1)'); rg.addColorStop(1, 'transparent');
    ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H);
  },
  street(ctx) {
    ctx.fillStyle = '#060606'; ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 150; i++) {
      ctx.fillStyle = `rgba(255,255,255,${sr(i*5+2)*0.07})`;
      ctx.fillRect(sr(i*5)*W, sr(i*5+1)*H, 2, 2);
    }
    ctx.strokeStyle = 'rgba(255,69,0,0.35)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(0, VID_Y-4); ctx.lineTo(W*0.55, VID_Y-4); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(W, BOT_Y+4); ctx.lineTo(W*0.45, BOT_Y+4); ctx.stroke();
  },
};
const PATTERN_KEYS = Object.keys(PATTERNS);

function getPattern(mode: string, idx: number): PatternFn {
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
) {
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
    ctx.fillStyle = '#111'; ctx.fillRect(0, VID_Y, W, VID_H);
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.font = '13px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('動画をアップロードしてください', W/2, VID_Y + VID_H/2);
  }

  // Gradients
  const topGrad = ctx.createLinearGradient(0, 0, 0, VID_Y + 70);
  topGrad.addColorStop(0, 'rgba(0,0,0,0.9)'); topGrad.addColorStop(1, 'transparent');
  ctx.fillStyle = topGrad; ctx.fillRect(0, 0, W, VID_Y + 70);
  const botGrad = ctx.createLinearGradient(0, BOT_Y - 70, 0, H);
  botGrad.addColorStop(0, 'transparent'); botGrad.addColorStop(1, 'rgba(0,0,0,0.93)');
  ctx.fillStyle = botGrad; ctx.fillRect(0, BOT_Y - 70, W, H - BOT_Y + 70);

  // Title
  const MAX_TEXT_W = W - 40;
  const rawLines = title.split('\n').filter(l => l.trim());
  let fSize = fontSize ?? (rawLines.length > 1 ? 54 : 60);
  const MIN_SIZE = 28;
  outer: while (fSize >= MIN_SIZE) {
    ctx.font = buildFont(fontFamily, fSize);
    for (const line of rawLines) {
      if (ctx.measureText(line).width > MAX_TEXT_W) { fSize -= 2; continue outer; }
    }
    break;
  }
  const finalLines: string[] = [];
  ctx.font = buildFont(fontFamily, fSize);
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
    ctx.font = buildFont(fontFamily, fSize);
    drawText(ctx, fontEffect, textColor, line, W/2, titleStartY + i * lineH, fSize);
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
  ctx.fillStyle = 'rgba(124,58,237,0.8)';
  rr(ctx, W-88, H-40, 68, 26, 6); ctx.fill();
  ctx.font = '600 12px "Noto Sans JP",sans-serif';
  ctx.textAlign = 'center'; ctx.fillStyle = '#fff';
  ctx.fillText('AI生成', W-54, H-22);

  drawBorder(ctx, borderStyle, borderColor);
}

// ── outro frame ───────────────────────────────────────────────
export function drawOutroFrame(
  ctx: CanvasRenderingContext2D,
  elapsed: number,
  totalDuration: number,
  outro: OutroState,
) {
  ctx.fillStyle = outro.bgColor; ctx.fillRect(0, 0, W, H);
  const rg = ctx.createRadialGradient(W/2, H/2, 0, W/2, H/2, W*0.9);
  rg.addColorStop(0, 'rgba(124,58,237,0.18)'); rg.addColorStop(1, 'transparent');
  ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = 'rgba(255,255,255,0.06)'; ctx.lineWidth = 1;
  for (let y = 0; y < H; y += 22) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  }
  const opacity = Math.min(1, elapsed * 2);
  ctx.globalAlpha = opacity;
  const iconY = H * 0.28;
  ctx.fillStyle = '#ff0000';
  rr(ctx, W/2 - 54, iconY - 30, 108, 60, 12); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.font = '700 28px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('▶', W/2 + 2, iconY + 12);
  ctx.fillStyle = '#ffffff';
  let cSize = 40;
  const chName = outro.channel || 'CHANNEL NAME';
  ctx.font = `900 ${cSize}px "Noto Sans JP",sans-serif`;
  ctx.shadowColor = 'rgba(0,0,0,0.8)'; ctx.shadowBlur = 16;
  while (cSize > 20 && ctx.measureText(chName).width > W - 60) {
    cSize -= 2; ctx.font = `900 ${cSize}px "Noto Sans JP",sans-serif`;
  }
  ctx.fillText(chName, W/2, H * 0.48); ctx.shadowBlur = 0;
  ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(W*0.2, H*0.52); ctx.lineTo(W*0.8, H*0.52); ctx.stroke();
  if (outro.sub) {
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    let subSize = 22;
    ctx.font = `400 ${subSize}px "Noto Sans JP",sans-serif`;
    while (subSize > 14 && ctx.measureText(outro.sub).width > W - 60) {
      subSize -= 1; ctx.font = `400 ${subSize}px "Noto Sans JP",sans-serif`;
    }
    ctx.fillText(outro.sub, W/2, H * 0.57);
  }
  if (outro.sns) {
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = '600 18px "Noto Sans JP",sans-serif';
    ctx.fillText(outro.sns, W/2, H * 0.63);
  }
  ctx.globalAlpha = 1;
  const prog = Math.min(elapsed / totalDuration, 1);
  ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.fillRect(0, H-6, W, 6);
  ctx.fillStyle = '#7c3aed'; ctx.fillRect(0, H-6, W * prog, 6);
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
          vid.addEventListener('seeked', () => r(), { once: true });
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
