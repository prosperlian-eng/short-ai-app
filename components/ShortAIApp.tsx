'use client';

import { useRef, useState, useCallback, useEffect } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useRouter, usePathname } from 'next/navigation';
import type { AppState, OutroState, CardData, FontFamily, FontEffect, BorderStyle, PatternMode } from '@/lib/types';
import { FONT_OPTIONS, loadCustomGoogleFont } from '@/lib/fonts';
import { drawFrame, drawOutroFrame, analyzeScenes, fmtTime, W, H, OUT_W, OUT_H } from '@/lib/canvas';
import { createClient } from '@/lib/supabase/client';
import type { User } from '@supabase/supabase-js';
import type { Plan } from '@/lib/plans';
import { canGenerate } from '@/lib/plans';
import { AuthModal } from './AuthModal';
import { PricingModal } from './PricingModal';
import { UserMenu } from './UserMenu';

const CATCHCOPIES = [
  'まさかの結果に\n全員驚愕。','これが本当の\n成長記録。','この一打、\n空気が変わった。',
  'この映像、見る前と\n後で景色が変わる。','親父の一言が\n深すぎた。','100切りを阻む\n意外な原因。',
  'プロが教えてくれた\n本音がヤバい。','こんな打ち方、\n誰も教えてくれなかった。',
  '一瞬で変わった\nスイング動画。','18番ホール、\n奇跡の逆転劇。','この練習法で\nHDCP一桁に。',
  'スコア更新の瞬間を\nリアルタイムで。','ティーショットが\n別人になった理由。',
  'バンカーから\n直接カップイン。','グリップ変えたら\n全てが変わった。',
];
const EN_CATCHCOPIES = [
  'Nobody expected\nthis outcome.','The moment\neverything changed.','One swing.\nCompletely different.',
  'This video will\nchange how you see it.','The pro told me\nthe brutal truth.',
  'What\'s really blocking\nyour improvement.','A technique nobody\never taught me.',
  'My swing transformed\novernight.','18th hole.\nMiracle comeback.',
  'How I broke 80\nin 30 days.','The moment I\nbroke my record.',
  'Why my tee shot\nbecame unrecognizable.','Direct from bunker\ninto the cup.',
  'Changed my grip.\nChanged everything.',
];
const SCENE_LABELS = ['🔥 盛り上がりシーン','⚡ アクション','🎯 決定的瞬間','✨ ハイライト','💡 重要ポイント'];

function pickCopies(n: number, locale: string): string[] {
  const pool = [...(locale !== 'ja' ? EN_CATCHCOPIES : CATCHCOPIES)];
  const result: string[] = [];
  for (let i = 0; i < n; i++) {
    if (!pool.length) pool.push(...(locale !== 'ja' ? EN_CATCHCOPIES : CATCHCOPIES));
    const idx = Math.floor(Math.random() * pool.length);
    result.push(pool.splice(idx, 1)[0]);
  }
  return result;
}

// 各クリップから3フレーム（先頭・中間・終盤）をJPEG base64で抽出してAIに渡す
async function captureClipFrames(
  videoURL: string,
  scenes: { startTime: number; clipDuration: number }[],
): Promise<string[][]> {
  const vid = document.createElement('video');
  vid.src = videoURL; vid.muted = true; vid.preload = 'auto';
  await new Promise<void>((resolve, reject) => {
    vid.addEventListener('loadeddata', () => resolve(), { once: true });
    vid.addEventListener('error', () => reject(new Error('video load failed')), { once: true });
    vid.load();
  });
  const FW = 480;
  const fh = Math.round(FW * (vid.videoHeight / vid.videoWidth)) || 270;
  const c = document.createElement('canvas'); c.width = FW; c.height = fh;
  const ctx = c.getContext('2d')!;
  const seek = (t: number) => new Promise<void>(r => {
    const guard = setTimeout(r, 1000);
    vid.addEventListener('seeked', () => { clearTimeout(guard); r(); }, { once: true });
    vid.currentTime = t;
  });
  const result: string[][] = [];
  for (const s of scenes) {
    const frames: string[] = [];
    for (const frac of [0.1, 0.5, 0.85]) {
      await seek(s.startTime + s.clipDuration * frac);
      ctx.drawImage(vid, 0, 0, FW, fh);
      frames.push(c.toDataURL('image/jpeg', 0.7).split(',')[1]);
    }
    result.push(frames);
  }
  return result;
}

const COLORS = {
  text: ['#ffffff','#FFD700','#FF4500','#00CFFF','#39FF14','#FF69B4'],
  border: ['#FFD700','#ffffff','#4a9eff','#FF4500','#39FF14'],
  cta: ['#FFD700','#ffffff','#FF4500','#00CFFF','#39FF14','#FF69B4'],
  outroBg: ['#0a0a0f','#0a1628','#1a0028','#0a1a00','#1a0a00'],
};

const defaultState: AppState = {
  videoFile: null, videoURL: null, count: 3,
  fontFamily: 'gothic', customFontName: '', fontEffect: 'gothic', fontSize: 54,
  textColor: '#ffffff', textOutline: false, outlineColor: '#000000',
  borderStyle: 'none', borderColor: '#FFD700',
  pattern: 'random', ctaText: '続きは本編で', ctaColor: '#FFD700', hookEnabled: true, copies: [],
};
const defaultOutro: OutroState = {
  mode: 'text', channel: '', sub: '', sns: '', bgColor: '#0a0a0f', videoURL: null, duration: 5,
};

export function ShortAIApp() {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  // ── auth & billing ──
  const [user, setUser] = useState<User | null>(null);
  const [userPlan, setUserPlan] = useState<Plan>('free');
  const [usageCount, setUsageCount] = useState(0);
  const [usageLimit, setUsageLimit] = useState(3);
  const [showAuth, setShowAuth] = useState(false);
  const [showPricing, setShowPricing] = useState(false);
  const supabase = createClient();

  const [state, setState] = useState<AppState>(defaultState);
  const [outro, setOutro] = useState<OutroState>(defaultOutro);
  const [loading, setLoading] = useState(false);
  const [loadingText, setLoadingText] = useState('');
  const [loadingSub, setLoadingSub] = useState('');
  const [progress, setProgress] = useState(0);
  const [showResults, setShowResults] = useState(false);
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [selectedSet, setSelectedSet] = useState<Set<number>>(new Set());
  const [toast, setToast] = useState('');
  const [showToastFlag, setShowToastFlag] = useState(false);
  const [presetSaveOpen, setPresetSaveOpen] = useState(false);
  const [presetLoadOpen, setPresetLoadOpen] = useState(false);
  const [presetName, setPresetName] = useState('');
  const [presets, setPresets] = useState<Record<string, Partial<AppState>>>({});

  const sourceVideoRef = useRef<HTMLVideoElement>(null);
  const outroCanvasRef = useRef<HTMLCanvasElement>(null);
  const outroAnimRef = useRef<number | null>(null);
  const outroVideoRef = useRef<HTMLVideoElement | null>(null);
  const cardDataRef = useRef<CardData[]>([]);
  const resultsRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  // ── auth init ──
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => { if (data.user) setUser(data.user); });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) fetchUsage();
    });
    return () => subscription.unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchUsage = async () => {
    const res = await fetch('/api/user/usage');
    const data = await res.json() as { plan: Plan; count: number; limit: number };
    setUserPlan(data.plan);
    setUsageCount(data.count);
    setUsageLimit(data.limit);
  };

  useEffect(() => { if (user) fetchUsage(); }, [user]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null); setUserPlan('free'); setUsageCount(0); setUsageLimit(3);
  };

  // ── locale switch ──
  const switchLocale = (l: string) => {
    const newPath = pathname.replace(/^\/(ja|en|zh|ko|es|fr|de|pt|vi|id)/, `/${l}`);
    router.push(newPath);
    // update CTA text default per locale
    setState(s => ({ ...s, ctaText: l === 'ja' ? '続きは本編で' : 'Watch the full video' }));
  };

  // ── toast ──
  const showToast = useCallback((msg: string) => {
    setToast(msg); setShowToastFlag(true);
    setTimeout(() => setShowToastFlag(false), 3000);
  }, []);

  // ── presets ──
  useEffect(() => {
    const saved = localStorage.getItem('shortai_presets_v2');
    if (saved) setPresets(JSON.parse(saved));
  }, []);

  const savePreset = () => {
    if (!presetName.trim()) return;
    const updated = { ...presets, [presetName.trim()]: { ...state, videoFile: null, videoURL: null, copies: [] } };
    setPresets(updated);
    localStorage.setItem('shortai_presets_v2', JSON.stringify(updated));
    setPresetSaveOpen(false);
    setPresetName('');
    showToast(t('toast.presetSaved', { name: presetName.trim() }));
  };
  const applyPreset = (name: string) => {
    const p = presets[name]; if (!p) return;
    setState(s => ({ ...s, ...p }));
    setPresetLoadOpen(false);
    showToast(t('toast.presetApplied', { name }));
  };
  const deletePreset = (name: string) => {
    const updated = { ...presets }; delete updated[name];
    setPresets(updated);
    localStorage.setItem('shortai_presets_v2', JSON.stringify(updated));
  };

  // ── upload ──
  const handleFile = (file: File) => {
    if (state.videoURL) URL.revokeObjectURL(state.videoURL);
    const url = URL.createObjectURL(file);
    setState(s => ({ ...s, videoFile: file, videoURL: url }));
    if (sourceVideoRef.current) { sourceVideoRef.current.src = url; sourceVideoRef.current.style.display = 'block'; }
  };

  // ── outro animated preview ──
  const startOutroPreview = useCallback(() => {
    const canvas = outroCanvasRef.current; if (!canvas) return;
    canvas.width = 270; canvas.height = 480;
    if (outroAnimRef.current) cancelAnimationFrame(outroAnimRef.current);

    const PREVIEW_DUR = 6;
    const startTime = performance.now();

    const tick = () => {
      const elapsed = ((performance.now() - startTime) / 1000) % PREVIEW_DUR;
      const ctx = canvas.getContext('2d'); if (!ctx) return;
      ctx.save(); ctx.scale(270/OUT_W, 480/OUT_H);
      const vidEl = outro.mode === 'video' ? outroVideoRef.current : null;
      drawOutroFrame(ctx, elapsed, PREVIEW_DUR, outro, vidEl);
      ctx.restore();
      outroAnimRef.current = requestAnimationFrame(tick);
    };
    outroAnimRef.current = requestAnimationFrame(tick);
  }, [outro]);

  useEffect(() => {
    if (outro.mode === 'none') {
      if (outroAnimRef.current) { cancelAnimationFrame(outroAnimRef.current); outroAnimRef.current = null; }
      return;
    }
    // For video outro: load the video element
    if (outro.mode === 'video' && outro.videoURL) {
      const vid = document.createElement('video');
      vid.src = outro.videoURL; vid.muted = true; vid.loop = true; vid.preload = 'auto';
      vid.addEventListener('loadeddata', () => { vid.play().catch(() => {}); outroVideoRef.current = vid; startOutroPreview(); }, { once: true });
      vid.load();
      return;
    }
    startOutroPreview();
    return () => { if (outroAnimRef.current) cancelAnimationFrame(outroAnimRef.current); };
  }, [outro, startOutroPreview]);

  // ── draw thumbnail ──
  const drawThumbnail = useCallback((canvas: HTMLCanvasElement, videoURL: string | null, seekTime: number, title: string, patIdx: number) => {
    return new Promise<void>(resolve => {
      const ctx = canvas.getContext('2d'); if (!ctx) { resolve(); return; }
      canvas.width = OUT_W; canvas.height = OUT_H;
      if (!videoURL) { drawFrame(ctx, null, title, 0, 0, state, { patIdx }); resolve(); return; }
      const tmp = document.createElement('video');
      tmp.src = videoURL; tmp.muted = true; tmp.preload = 'auto';
      let done = false;
      const finish = () => {
        if (done) return; done = true;
        drawFrame(ctx, tmp, title, 0, 0, state, { patIdx, pattern: state.pattern });
        resolve();
      };
      tmp.addEventListener('seeked', finish, { once: true });
      tmp.addEventListener('loadeddata', () => {
        tmp.currentTime = seekTime;
        // seeked may never fire if currentTime is already at seekTime (e.g. 0)
        setTimeout(finish, 1000);
      }, { once: true });
      tmp.load();
    });
  }, [state]);

  // ── generate ──
  const handleGenerate = async () => {
    // デモ：未ログインでも制限なしで生成可能。ログイン済みユーザーのみ制限チェック
    if (user && !canGenerate(userPlan, usageCount)) { setShowPricing(true); return; }

    setLoading(true); setProgress(0);
    const n = state.count;
    let copies = pickCopies(n, locale);

    let scenes: { startTime: number; clipDuration: number; score: number }[] | null = null;
    if (state.videoURL) {
      setLoadingText(t('step3.analyzing')); setLoadingSub(t('step3.analyzingSub'));
      try {
        scenes = await analyzeScenes(state.videoURL, n, p => setProgress(Math.round(p * 100)));
      } catch { /* fallback */ }

      // AIが映像を見てキャッチコピーを生成（失敗時はランダムプールにフォールバック）
      if (scenes) {
        try {
          setLoadingText(t('step3.aiTitles')); setLoadingSub(t('step3.aiTitlesSub'));
          const frames = await captureClipFrames(state.videoURL, scenes);
          const res = await fetch('/api/ai/titles', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ clips: frames.map(f => ({ frames: f })), locale }),
          });
          if (res.ok) {
            const data = await res.json() as { titles: string[] };
            if (data.titles?.length) {
              copies = copies.map((c, i) => data.titles[i] || c);
            }
          }
        } catch { /* fallback to random pool */ }
      }
    } else {
      setLoadingText(t('step3.generating')); setLoadingSub('');
      await new Promise(r => setTimeout(r, 600));
    }
    setState(s => ({ ...s, copies }));

    await renderPreviews(scenes, copies);

    // 生成カウントを記録（ログイン時のみ）
    if (user) {
      await fetch('/api/user/usage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clips: n }),
      });
      await fetchUsage();
    }

    setLoading(false); setShowResults(true);
    setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
  };

  const renderPreviews = async (
    scenes: { startTime: number; clipDuration: number; score: number }[] | null,
    copies: string[],
  ) => {
    if (!gridRef.current) return;
    gridRef.current.innerHTML = '';
    cardDataRef.current = [];
    setSelectedSet(new Set());

    const n = state.count;
    let vidDuration = 0;
    const sv = sourceVideoRef.current;
    if (sv?.src) {
      await new Promise<void>(r => {
        if (sv.readyState >= 1) { vidDuration = sv.duration; r(); }
        else sv.addEventListener('loadedmetadata', () => { vidDuration = sv.duration; r(); }, { once: true });
      });
    }

    for (let i = 0; i < n; i++) {
      let startTime = 0, clipDuration = 15;
      if (scenes?.[i]) { startTime = scenes[i].startTime; clipDuration = scenes[i].clipDuration; }
      else if (vidDuration > 0) { const seg = vidDuration / n; startTime = seg * i; clipDuration = Math.min(30, Math.max(5, seg)); }

      const title = copies[i] || CATCHCOPIES[i % CATCHCOPIES.length];
      const patIdx = i;

      // Build card DOM
      const card = document.createElement('div');
      card.className = 'short-card'; card.dataset.idx = String(i);

      const selCheck = document.createElement('label');
      selCheck.className = 'card-select-check';
      selCheck.innerHTML = `<input type="checkbox" class="card-checkbox" data-idx="${i}"><span class="card-check-box"></span>`;
      selCheck.addEventListener('click', e => e.stopPropagation());
      selCheck.querySelector('input')!.addEventListener('change', (e) => {
        const checked = (e.target as HTMLInputElement).checked;
        setSelectedSet(prev => { const next = new Set(prev); checked ? next.add(i) : next.delete(i); return next; });
        card.classList.toggle('selected', checked);
      });
      card.appendChild(selCheck);

      const labelEl = document.createElement('div');
      labelEl.className = 'short-card-label';
      labelEl.textContent = `SHORT #${String(i+1).padStart(2,'0')}`;
      card.appendChild(labelEl);

      if (vidDuration > 0) {
        const badge = document.createElement('div'); badge.className = 'scene-badge';
        const sceneLabel = SCENE_LABELS[i % SCENE_LABELS.length];
        badge.innerHTML = `<span class="scene-type">${sceneLabel}</span><span class="scene-time">${fmtTime(startTime)} 〜 ${fmtTime(startTime+clipDuration)}</span>`;
        card.appendChild(badge);
      }

      const wrap = document.createElement('div'); wrap.className = 'short-canvas-wrap';
      const canvas = document.createElement('canvas'); canvas.className = 'short-canvas';
      wrap.appendChild(canvas);
      const playBtn = document.createElement('button'); playBtn.className = 'card-play-btn'; playBtn.innerHTML = '▶';
      playBtn.addEventListener('click', () => togglePreview(i));
      wrap.addEventListener('click', e => {
        const d = cardDataRef.current[i]; if (!d?.playing || !d.previewVid) return;
        const rect = wrap.getBoundingClientRect();
        const relY = (e.clientY - rect.top) / rect.height;
        if (relY < 0.88) return;
        const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        d.previewVid.currentTime = d.startTime + ratio * d.clipDuration;
      });
      wrap.appendChild(playBtn);
      card.appendChild(wrap);

      const listMeta = document.createElement('div'); listMeta.className = 'card-list-meta';
      listMeta.innerHTML = `<div class="list-meta-title">${title}</div><div class="list-meta-scene">${fmtTime(startTime)} 〜 ${fmtTime(startTime+clipDuration)}</div>`;
      card.appendChild(listMeta);

      // ── Editable title ──
      const titleWrap = document.createElement('div'); titleWrap.className = 'card-title-edit-wrap';
      const titleInput = document.createElement('textarea'); titleInput.className = 'card-title-input';
      titleInput.value = title; titleInput.rows = 2; titleInput.maxLength = 60;
      titleInput.placeholder = locale !== 'ja' ? 'Edit title...' : 'テキストを編集...';
      let redrawTimer: ReturnType<typeof setTimeout> | null = null;
      titleInput.addEventListener('input', () => {
        const nt = titleInput.value;
        cardDataRef.current[i].title = nt;
        if (redrawTimer) clearTimeout(redrawTimer);
        redrawTimer = setTimeout(() => drawThumbnail(canvas, state.videoURL, startTime, nt, patIdx), 300);
      });
      titleWrap.appendChild(titleInput);
      card.appendChild(titleWrap);

      const actions = document.createElement('div'); actions.className = 'short-card-actions';
      const dlBtn = document.createElement('button'); dlBtn.className = 'short-dl-btn';
      dlBtn.innerHTML = t('results.dlVideo');
      dlBtn.addEventListener('click', () => downloadShort(i, dlBtn));
      const regenBtn = document.createElement('button'); regenBtn.className = 'short-regen-btn'; regenBtn.textContent = '🎲';
      regenBtn.title = locale !== 'ja' ? 'Random title' : 'ランダムタイトル';
      regenBtn.addEventListener('click', async () => {
        const pool = locale !== 'ja' ? EN_CATCHCOPIES : CATCHCOPIES;
        const nt = pool[Math.floor(Math.random() * pool.length)];
        cardDataRef.current[i].title = nt;
        titleInput.value = nt;
        await drawThumbnail(canvas, state.videoURL, startTime, nt, patIdx);
      });
      actions.appendChild(dlBtn); actions.appendChild(regenBtn); card.appendChild(actions);
      gridRef.current!.appendChild(card);

      setLoadingText(`${t('step3.generating')} (${i+1}/${n})`);
      await drawThumbnail(canvas, state.videoURL, startTime, title, patIdx);
      cardDataRef.current.push({ canvas, startTime, clipDuration, title, patIdx, playing: false, previewVid: null, animRaf: null, playBtn });
    }
  };

  // ── preview playback ──
  const togglePreview = (idx: number) => {
    const d = cardDataRef.current[idx]; if (!d) return;
    if (d.playing) { stopPreview(idx); return; }
    if (!state.videoURL) { showToast(t('toast.uploadFirst')); return; }
    d.playing = true; d.playBtn!.innerHTML = '⏸'; d.playBtn!.classList.add('active');
    d.canvas.parentElement!.classList.add('is-playing');
    const vid = document.createElement('video');
    vid.src = state.videoURL; vid.muted = false; vid.preload = 'auto'; d.previewVid = vid;
    vid.addEventListener('loadeddata', () => {
      vid.currentTime = d.startTime;
      vid.addEventListener('seeked', () => {
        vid.play().catch(() => {});
        const tick = () => {
          if (!d.playing) return;
          const elapsed = Math.max(0, vid.currentTime - d.startTime);
          if (elapsed >= d.clipDuration || vid.ended) { stopPreview(idx); return; }
          const ctx = d.canvas.getContext('2d')!;
          drawFrame(ctx, vid, d.title, elapsed, d.clipDuration, state, { patIdx: d.patIdx });
          d.animRaf = requestAnimationFrame(tick);
        };
        d.animRaf = requestAnimationFrame(tick);
      }, { once: true });
    }, { once: true });
    vid.load();
  };

  const stopPreview = (idx: number) => {
    const d = cardDataRef.current[idx]; if (!d) return;
    if (d.previewVid) { d.previewVid.pause(); d.previewVid = null; }
    if (d.animRaf) { cancelAnimationFrame(d.animRaf); d.animRaf = null; }
    d.playing = false;
    const pb = d.canvas.parentElement?.querySelector('.card-play-btn') as HTMLButtonElement | null;
    if (pb) { pb.innerHTML = '▶'; pb.classList.remove('active'); }
    d.canvas.parentElement?.classList.remove('is-playing');
    drawThumbnail(d.canvas, state.videoURL, d.startTime, d.title, d.patIdx);
  };

  // ── download ──
  const downloadShort = async (idx: number, btn: HTMLButtonElement) => {
    const d = cardDataRef.current[idx]; if (!d || !state.videoURL) { showToast(t('toast.uploadFirst')); return; }
    const origHTML = btn.innerHTML; btn.disabled = true;
    try {
      if (d.playing) stopPreview(idx);
      const canvas = document.createElement('canvas'); canvas.width = OUT_W; canvas.height = OUT_H;
      const ctx = canvas.getContext('2d')!;
      const vid = document.createElement('video'); vid.src = state.videoURL; vid.preload = 'auto';
      btn.innerHTML = `${t('results.recording')} 0%`;
      const startWall = Date.now();
      const timer = setInterval(() => {
        const pct = Math.min(99, Math.round((Date.now()-startWall)/(d.clipDuration*1000)*100));
        btn.innerHTML = `${t('results.recording')} ${pct}%`;
      }, 400);
      await new Promise<void>((resolve, reject) => {
        let audioCtx: AudioContext | undefined, audioDest: MediaStreamAudioDestinationNode | undefined;
        vid.addEventListener('loadeddata', () => {
          try {
            audioCtx = new AudioContext();
            const src = audioCtx.createMediaElementSource(vid);
            audioDest = audioCtx.createMediaStreamDestination();
            src.connect(audioDest);
          } catch { /**/ }
          const canvasStream = canvas.captureStream(30);
          const combined = new MediaStream();
          canvasStream.getVideoTracks().forEach(t => combined.addTrack(t));
          audioDest?.stream.getAudioTracks().forEach(t => combined.addTrack(t));
          const mimeType = ['video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus','video/webm'].find(t => MediaRecorder.isTypeSupported(t)) || 'video/webm';
          const recorder = new MediaRecorder(combined, { mimeType, videoBitsPerSecond: 8_000_000 });
          const chunks: Blob[] = [];
          recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
          recorder.onstop = () => {
            audioCtx?.close();
            const blob = new Blob(chunks, { type: 'video/webm' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a'); a.download = `short_${idx+1}.webm`; a.href = url; a.click();
            setTimeout(() => URL.revokeObjectURL(url), 5000);
            showToast(t('toast.downloaded', { name: `short_${idx+1}.webm` }));
            resolve();
          };
          recorder.onerror = () => { audioCtx?.close(); reject(new Error('recorder error')); };
          const outroDur = outro.mode !== 'none' ? outro.duration : 0;
          const hookEnabled = state.hookEnabled && d.clipDuration > 4;
          const hookDur = hookEnabled ? Math.min(1.5, d.clipDuration * 0.25) : 0;
          const hookStart = Math.min(d.startTime + d.clipDuration * 0.65, Math.max(d.startTime, vid.duration - hookDur - 0.1));
          let phase: 'hook'|'main'|'outro' = hookEnabled ? 'hook' : 'main';
          let hookWall: number | null = null, outroWall: number | null = null;
          const tick = (ts: number) => {
            if (phase === 'hook') {
              hookWall ??= ts;
              const hookElapsed = (ts - hookWall) / 1000;
              if (hookElapsed >= hookDur) {
                phase = 'main';
                vid.pause();
                vid.addEventListener('seeked', () => { vid.play().catch(() => {}); requestAnimationFrame(tick); }, { once: true });
                vid.currentTime = d.startTime;
                return;
              }
              drawFrame(ctx, vid, d.title, hookElapsed, hookDur, state, { patIdx: d.patIdx, hook: { elapsed: hookElapsed, duration: hookDur } });
            } else if (phase === 'main') {
              const elapsed = Math.max(0, vid.currentTime - d.startTime);
              if (elapsed >= d.clipDuration || vid.ended) {
                vid.volume = 0;
                if (outroDur > 0) { phase = 'outro'; outroWall = ts; } else { recorder.stop(); return; }
              } else {
                drawFrame(ctx, vid, d.title, elapsed, d.clipDuration, state, { patIdx: d.patIdx });
              }
            } else {
              const outroElapsed = (ts - (outroWall ?? ts)) / 1000;
              if (outroElapsed >= outroDur) { recorder.stop(); return; }
              drawOutroFrame(ctx, outroElapsed, outroDur, outro, outroVideoRef.current);
            }
            requestAnimationFrame(tick);
          };
          vid.addEventListener('seeked', () => { vid.play().catch(() => {}); recorder.start(100); requestAnimationFrame(tick); }, { once: true });
          vid.currentTime = hookEnabled ? hookStart : d.startTime;
        }, { once: true });
        vid.load();
      });
      clearInterval(timer);
    } catch (e) {
      showToast(t('toast.recordFailed'));
    }
    btn.innerHTML = origHTML; btn.disabled = false;
  };

  const regenAllTitles = async () => {
    const copies = pickCopies(state.count, locale);
    setState(s => ({ ...s, copies }));
    for (let i = 0; i < cardDataRef.current.length; i++) {
      cardDataRef.current[i].title = copies[i];
      await drawThumbnail(cardDataRef.current[i].canvas, state.videoURL, cardDataRef.current[i].startTime, copies[i], cardDataRef.current[i].patIdx);
    }
    showToast(t('toast.regenDone'));
  };

  const dlAll = async () => {
    const btns = gridRef.current?.querySelectorAll('.short-dl-btn') as NodeListOf<HTMLButtonElement>;
    for (let i = 0; i < cardDataRef.current.length; i++) {
      if (btns?.[i]) await downloadShort(i, btns[i]);
      await new Promise(r => setTimeout(r, 800));
    }
  };

  const dlSelected = async () => {
    const indices = [...selectedSet].sort((a,b)=>a-b);
    for (const idx of indices) {
      const btn = gridRef.current?.querySelector(`.short-card[data-idx="${idx}"] .short-dl-btn`) as HTMLButtonElement | null;
      if (btn) await downloadShort(idx, btn);
      await new Promise(r => setTimeout(r, 500));
    }
  };

  // ── color picker helper ──
  const ColorPicker = ({ colors, value, customId, onChange }: { colors: string[]; value: string; customId: string; onChange: (c: string) => void }) => (
    <div className="color-picker-row">
      {colors.map(c => (
        <div key={c} className={`color-dot${value === c ? ' active' : ''}`} style={{ background: c }} onClick={() => onChange(c)} />
      ))}
      <input type="color" id={customId} value={value} onChange={e => onChange(e.target.value)} />
    </div>
  );

  // ── toggle group helper ──
  const ToggleGroup = ({ options, value, onChange }: { options: { value: string; label: string }[]; value: string; onChange: (v: string) => void }) => (
    <div className="btn-group">
      {options.map(o => (
        <button key={o.value} className={`toggle-btn${value === o.value ? ' active' : ''}`} onClick={() => onChange(o.value)}>{o.label}</button>
      ))}
    </div>
  );

  return (
    <>
      {/* Modals */}
      <AuthModal open={showAuth} onClose={() => setShowAuth(false)} />
      <PricingModal open={showPricing} onClose={() => setShowPricing(false)} currentPlan={userPlan} />

      {/* Hero */}
      <header className="hero">
        <div className="locale-switcher" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <select
            className="locale-select"
            value={locale}
            onChange={e => switchLocale(e.target.value)}
            aria-label="Language"
          >
            <option value="ja">🇯🇵 日本語</option>
            <option value="en">🇺🇸 English</option>
            <option value="zh">🇨🇳 中文</option>
            <option value="ko">🇰🇷 한국어</option>
            <option value="es">🇪🇸 Español</option>
            <option value="fr">🇫🇷 Français</option>
            <option value="de">🇩🇪 Deutsch</option>
            <option value="pt">🇵🇹 Português</option>
            <option value="vi">🇻🇳 Tiếng Việt</option>
            <option value="id">🇮🇩 Bahasa Indonesia</option>
          </select>
          {user ? (
            <UserMenu
              email={user.email ?? ''}
              plan={userPlan}
              count={usageCount}
              limit={usageLimit}
              onUpgrade={() => setShowPricing(true)}
              onLogout={handleLogout}
            />
          ) : (
            <button className="locale-btn" onClick={() => setShowAuth(true)}>
              {locale === 'ja' ? 'ログイン' : 'Login'}
            </button>
          )}
        </div>
        <div className="hero-badge">{t('hero.badge')}</div>
        <h1 className="hero-title">{t('hero.title')}<span className="hero-dot">.</span></h1>
        <p className="hero-subtitle">{t('hero.subtitle')}</p>
      </header>

      <main className="app-container">

        {/* STEP 1 */}
        <section className="card">
          <div className="step-badge">{t('step1.badge')}</div>
          <h2 className="card-title">{t('step1.title')}</h2>
          <div className="upload-zone" id="upload-zone"
            onClick={() => document.getElementById('video-input')?.click()}
            onDragOver={e => { e.preventDefault(); (e.currentTarget as HTMLElement).classList.add('drag-over'); }}
            onDragLeave={e => (e.currentTarget as HTMLElement).classList.remove('drag-over')}
            onDrop={e => {
              e.preventDefault(); (e.currentTarget as HTMLElement).classList.remove('drag-over');
              const f = e.dataTransfer.files[0];
              if (f && (f.type.includes('video') || f.name.endsWith('.mov'))) handleFile(f);
            }}>
            <input type="file" id="video-input" accept="video/mp4,video/quicktime,.mov" hidden
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
            <div className="upload-icon">▶</div>
            <p className="upload-hint">{t('step1.hint')}</p>
            <p className="upload-filename">{state.videoFile ? `✓ ${state.videoFile.name}` : ''}</p>
          </div>
          <video ref={sourceVideoRef} controls style={{ display: 'none', marginTop: 20, width: '100%', borderRadius: 10, maxHeight: 300, background: '#000' }} />
        </section>

        {/* STEP 2 */}
        <section className="card">
          <div className="step-badge">{t('step2.badge')}</div>
          <h2 className="card-title">{t('step2.title')}</h2>
          <div className="settings-grid">

            {/* Count */}
            <div className="setting-group">
              <label className="setting-label">{t('step2.count')}</label>
              <div className="count-row">
                <ToggleGroup options={['1','3','5','10','20'].map(v => ({value: v, label: v}))} value={String(state.count)} onChange={v => setState(s => ({...s, count: parseInt(v)}))} />
                <input type="number" className="count-input" min={1} max={50} value={state.count}
                  onChange={e => { const n = Math.max(1, Math.min(50, parseInt(e.target.value) || 1)); setState(s => ({...s, count: n})); }} />
              </div>
            </div>

            {/* Font family */}
            <div className="setting-group setting-group--full">
              <label className="setting-label">{t('step2.font')}</label>
              <div className="font-picker">
                {FONT_OPTIONS.map(f => (
                  <button key={f.value} className={`font-card${state.fontFamily === f.value ? ' active' : ''}`}
                    style={{ fontFamily: f.family, fontWeight: f.weight }}
                    onClick={() => setState(s => ({...s, fontFamily: f.value as FontFamily}))}>
                    {f.label}
                  </button>
                ))}
              </div>
              {state.fontFamily === 'custom' && (
                <input className="setting-text-input" style={{ marginTop: 8 }}
                  placeholder={t('step2.customFontPlaceholder')}
                  value={state.customFontName}
                  onChange={e => {
                    const name = e.target.value;
                    setState(s => ({...s, customFontName: name}));
                    if (name.trim()) loadCustomGoogleFont(name);
                  }} />
              )}
            </div>

            {/* Font effect */}
            <div className="setting-group">
              <label className="setting-label">{t('step2.fontEffect')}</label>
              <ToggleGroup
                options={(['gothic','glow','stroke','box','simple'] as FontEffect[]).map(v => ({ value: v, label: t(`step2.effects.${v === 'gothic' ? 'shadow' : v}`) }))}
                value={state.fontEffect}
                onChange={v => setState(s => ({...s, fontEffect: v as FontEffect}))} />
            </div>

            {/* Font size */}
            <div className="setting-group">
              <label className="setting-label">{t('step2.fontSize')}</label>
              <div className="range-row">
                <input type="range" min={24} max={80} value={state.fontSize}
                  onChange={e => setState(s => ({...s, fontSize: parseInt(e.target.value)}))} />
                <span className="range-val">{state.fontSize}px</span>
              </div>
            </div>

            {/* Text color */}
            <div className="setting-group">
              <label className="setting-label">{t('step2.textColor')}</label>
              <ColorPicker colors={COLORS.text} value={state.textColor} customId="custom-text-color" onChange={c => setState(s => ({...s, textColor: c}))} />
            </div>

            {/* Text outline */}
            <div className="setting-group">
              <label className="setting-label-row">
                <input type="checkbox" checked={state.textOutline}
                  onChange={e => setState(s => ({...s, textOutline: e.target.checked}))} />
                <span>{t('step2.textOutline')}</span>
              </label>
              {state.textOutline && (
                <div style={{ marginTop: 8 }}>
                  <ColorPicker colors={['#000000','#ffffff','#FFD700','#FF4500','#7c3aed']} value={state.outlineColor} customId="custom-outline-color" onChange={c => setState(s => ({...s, outlineColor: c}))} />
                </div>
              )}
            </div>

            {/* Border style */}
            <div className="setting-group">
              <label className="setting-label">{t('step2.borderStyle')}</label>
              <ToggleGroup
                options={(['none','thin','thick','glow','corner'] as BorderStyle[]).map(v => ({ value: v, label: t(`step2.borders.${v}`) }))}
                value={state.borderStyle}
                onChange={v => setState(s => ({...s, borderStyle: v as BorderStyle}))} />
            </div>

            {/* Border color */}
            <div className="setting-group">
              <label className="setting-label">{t('step2.borderColor')}</label>
              <ColorPicker colors={COLORS.border} value={state.borderColor} customId="custom-border-color" onChange={c => setState(s => ({...s, borderColor: c}))} />
            </div>

            {/* Pattern */}
            <div className="setting-group">
              <label className="setting-label">{t('step2.pattern')}</label>
              <ToggleGroup
                options={(['random','dramatic','clean','energy','luxury','street'] as PatternMode[]).map(v => ({ value: v, label: t(`step2.patterns.${v}`) }))}
                value={state.pattern}
                onChange={v => setState(s => ({...s, pattern: v as PatternMode}))} />
            </div>

            {/* Hook */}
            <div className="setting-group">
              <label className="setting-label-row">
                <input type="checkbox" checked={state.hookEnabled}
                  onChange={e => setState(s => ({...s, hookEnabled: e.target.checked}))} />
                <span>{t('step2.hook')}</span>
              </label>
              <p className="setting-hint">{t('step2.hookHint')}</p>
            </div>

            {/* CTA text */}
            <div className="setting-group">
              <label className="setting-label">{t('step2.ctaText')}</label>
              <input className="setting-text-input" value={state.ctaText} maxLength={20}
                onChange={e => setState(s => ({...s, ctaText: e.target.value || (locale !== 'ja' ? 'Watch the full video' : '続きは本編で')}))} />
            </div>

            {/* CTA color */}
            <div className="setting-group">
              <label className="setting-label">{t('step2.ctaColor')}</label>
              <ColorPicker colors={COLORS.cta} value={state.ctaColor} customId="custom-cta-color" onChange={c => setState(s => ({...s, ctaColor: c}))} />
            </div>

          </div>

          {/* Preset bar */}
          <div className="preset-bar">
            <span className="setting-label" style={{ margin: 0 }}>{t('step2.preset')}</span>
            <div className="preset-actions">
              <button className="preset-btn" onClick={() => setPresetSaveOpen(true)}>{t('step2.savePreset')}</button>
              <button className="preset-btn" onClick={() => setPresetLoadOpen(true)}>{t('step2.loadPreset')}</button>
            </div>
          </div>
        </section>

        {/* OUTRO */}
        <section className="card">
          <div className="step-badge">{t('outro.badge')}</div>
          <h2 className="card-title">{t('outro.title')} <span className="card-title-sub">{t('outro.titleSub')}</span></h2>
          <div className="outro-toggle-row">
            {(['text','video','none'] as const).map(m => (
              <button key={m} className={`outro-mode-btn${outro.mode === m ? ' active' : ''}`}
                onClick={() => setOutro(o => ({...o, mode: m}))}>
                {t(`outro.mode${m.charAt(0).toUpperCase() + m.slice(1)}`)}
              </button>
            ))}
          </div>

          {outro.mode === 'text' && (
            <>
              <div className="outro-field-row">
                <div className="outro-field">
                  <label>{t('outro.channel')}</label>
                  <input value={outro.channel} placeholder={t('outro.channelPlaceholder')} maxLength={40}
                    onChange={e => setOutro(o => ({...o, channel: e.target.value}))} />
                </div>
                <div className="outro-field">
                  <label>{t('outro.sub')}</label>
                  <input value={outro.sub} placeholder={t('outro.subPlaceholder')} maxLength={60}
                    onChange={e => setOutro(o => ({...o, sub: e.target.value}))} />
                </div>
              </div>
              <div className="outro-field-row">
                <div className="outro-field">
                  <label>{t('outro.sns')}</label>
                  <input value={outro.sns} placeholder={t('outro.snsPlaceholder')} maxLength={50}
                    onChange={e => setOutro(o => ({...o, sns: e.target.value}))} />
                </div>
                <div className="outro-field">
                  <label>{t('outro.bgColor')}</label>
                  <ColorPicker colors={COLORS.outroBg} value={outro.bgColor} customId="outro-bg-custom" onChange={c => setOutro(o => ({...o, bgColor: c}))} />
                </div>
              </div>
              <div className="outro-preview-wrap">
                <div className="outro-preview-label">{t('outro.preview')}</div>
                <canvas ref={outroCanvasRef} width={270} height={480} style={{ width: 135, borderRadius: 8, border: '1px solid var(--border)' }} />
              </div>
            </>
          )}

          {outro.mode === 'video' && (
            <div>
              <div className="upload-zone upload-zone--sm"
                onClick={() => document.getElementById('outro-video-input')?.click()}
                onDragOver={e => { e.preventDefault(); (e.currentTarget as HTMLElement).classList.add('drag-over'); }}
                onDragLeave={e => (e.currentTarget as HTMLElement).classList.remove('drag-over')}
                onDrop={e => {
                  e.preventDefault(); (e.currentTarget as HTMLElement).classList.remove('drag-over');
                  const f = e.dataTransfer.files[0];
                  if (f && (f.type.includes('video') || f.name.endsWith('.mov'))) {
                    if (outro.videoURL) URL.revokeObjectURL(outro.videoURL);
                    setOutro(o => ({...o, videoURL: URL.createObjectURL(f)}));
                  }
                }}>
                <input type="file" id="outro-video-input" accept="video/mp4,video/quicktime,.mov" hidden
                  onChange={e => {
                    const f = e.target.files?.[0]; if (!f) return;
                    if (outro.videoURL) URL.revokeObjectURL(outro.videoURL);
                    setOutro(o => ({...o, videoURL: URL.createObjectURL(f)}));
                  }} />
                <div className="upload-icon" style={{ fontSize: 24 }}>🎬</div>
                <p className="upload-hint">{t('outro.uploadHint')}</p>
                {outro.videoURL && <p className="upload-filename">✓ loaded</p>}
              </div>
              <p className="outro-note">{t('outro.note')}</p>
            </div>
          )}
        </section>

        {/* STEP 3 */}
        <section className="card center-card">
          <div className="step-badge">{t('step3.badge')}</div>
          <h2 className="card-title">{t('step3.title')}</h2>
          <button className="generate-btn" disabled={loading} onClick={handleGenerate}>
            <span className="generate-icon">✦</span>
            {loading ? loadingText || t('step3.button') : t('step3.button')}
          </button>
        </section>

        {/* Results */}
        {showResults && (
          <section ref={resultsRef}>
            <div className="results-header">
              <h2 className="results-title">{t('results.title')}</h2>
              <div className="results-actions">
                <button className="regen-btn" onClick={regenAllTitles}>{t('results.regenTitles')}</button>
                <button className="regen-btn" onClick={dlAll}>{t('results.dlAll')}</button>
              </div>
            </div>
            <div className="results-toolbar">
              <div className="view-toggle">
                <button className={`view-btn${view === 'grid' ? ' active' : ''}`} onClick={() => { setView('grid'); if (gridRef.current) gridRef.current.className = 'previews-grid'; }}>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><rect x="0" y="0" width="6" height="6" rx="1"/><rect x="10" y="0" width="6" height="6" rx="1"/><rect x="0" y="10" width="6" height="6" rx="1"/><rect x="10" y="10" width="6" height="6" rx="1"/></svg>
                  {t('results.grid')}
                </button>
                <button className={`view-btn${view === 'list' ? ' active' : ''}`} onClick={() => { setView('list'); if (gridRef.current) gridRef.current.className = 'previews-list'; }}>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><rect x="0" y="1" width="16" height="3" rx="1"/><rect x="0" y="7" width="16" height="3" rx="1"/><rect x="0" y="13" width="16" height="3" rx="1"/></svg>
                  {t('results.list')}
                </button>
              </div>
              <div className="select-toolbar">
                <button className="sel-btn" onClick={() => {
                  const all = new Set(cardDataRef.current.map((_,i) => i));
                  setSelectedSet(all);
                  gridRef.current?.querySelectorAll('.card-checkbox').forEach((cb: Element) => { (cb as HTMLInputElement).checked = true; });
                  gridRef.current?.querySelectorAll('.short-card').forEach((c: Element) => c.classList.add('selected'));
                }}>{t('results.selectAll')}</button>
                <button className="sel-btn" onClick={() => {
                  setSelectedSet(new Set());
                  gridRef.current?.querySelectorAll('.card-checkbox').forEach((cb: Element) => { (cb as HTMLInputElement).checked = false; });
                  gridRef.current?.querySelectorAll('.short-card').forEach((c: Element) => c.classList.remove('selected'));
                }}>{t('results.deselectAll')}</button>
                <button className="sel-btn sel-btn--dl" disabled={selectedSet.size === 0} onClick={dlSelected}>
                  {t('results.dlSelected')} ({selectedSet.size})
                </button>
              </div>
            </div>
            <div ref={gridRef} className="previews-grid" />
          </section>
        )}
      </main>

      <footer className="footer"><p>{t('footer')}</p></footer>

      {/* Loading overlay */}
      <div className={`loading-overlay${loading ? ' show' : ''}`}>
        <div className="spinner" />
        <div className="loading-text">{loadingText}</div>
        <div className="loading-sub">{loadingSub}</div>
        <div className="analysis-bar-wrap"><div className="analysis-bar" style={{ width: `${progress}%` }} /></div>
      </div>

      {/* Preset Save Modal */}
      <div className={`modal-overlay${presetSaveOpen ? ' open' : ''}`}>
        <div className="modal">
          <h3>{t('step2.savePreset')}</h3>
          <div className="modal-field">
            <label>プリセット名</label>
            <input value={presetName} onChange={e => setPresetName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && savePreset()} placeholder="例：ゴルフ動画用" />
          </div>
          <div className="modal-btns">
            <button className="modal-btn-primary" onClick={savePreset}>保存</button>
            <button className="modal-btn-cancel" onClick={() => setPresetSaveOpen(false)}>キャンセル</button>
          </div>
        </div>
      </div>

      {/* Preset Load Modal */}
      <div className={`modal-overlay${presetLoadOpen ? ' open' : ''}`}>
        <div className="modal">
          <h3>{t('step2.loadPreset')}</h3>
          <div style={{ maxHeight: 240, overflowY: 'auto', marginBottom: 12 }}>
            {Object.keys(presets).length === 0
              ? <p style={{ color: 'var(--muted)', fontSize: 13, padding: '8px 0' }}>保存されたプリセットはありません</p>
              : Object.keys(presets).map(name => (
                <div key={name} className="preset-item">
                  <span>{name}</span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="preset-apply-btn" onClick={() => applyPreset(name)}>適用</button>
                    <button className="preset-delete-btn" onClick={() => deletePreset(name)}>削除</button>
                  </div>
                </div>
              ))}
          </div>
          <div className="modal-btns">
            <button className="modal-btn-cancel" style={{ flex: 'unset', padding: '10px 24px' }} onClick={() => setPresetLoadOpen(false)}>閉じる</button>
          </div>
        </div>
      </div>

      {/* Toast */}
      <div className={`toast${showToastFlag ? ' show' : ''}`}>{toast}</div>
    </>
  );
}
