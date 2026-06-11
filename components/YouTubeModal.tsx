'use client';

import { useEffect, useState, useCallback } from 'react';

interface Props {
  open: boolean;
  onClose: () => void;
  locale: string;
  clipTitle: string;
  captureFrames: () => Promise<string[]>;       // base64 jpeg frames of the clip
  recordBlob: (onProgress: (pct: number) => void) => Promise<Blob>;
}

type Phase = 'idle' | 'metadata' | 'recording' | 'uploading' | 'done' | 'error';

const PRESETS: { id: string; ja: string; en: string; calc: () => Date | null }[] = [
  { id: 'now',     ja: '今すぐ公開',  en: 'Publish now', calc: () => null },
  { id: 'tonight', ja: '今夜 19:00',  en: 'Tonight 7pm', calc: () => { const d = new Date(); if (d.getHours() >= 19) d.setDate(d.getDate()+1); d.setHours(19,0,0,0); return d; } },
  { id: 'morning', ja: '明朝 7:00',   en: 'Tomorrow 7am', calc: () => { const d = new Date(); d.setDate(d.getDate()+1); d.setHours(7,0,0,0); return d; } },
  { id: 'noon',    ja: '明日 12:00',  en: 'Tomorrow noon', calc: () => { const d = new Date(); d.setDate(d.getDate()+1); d.setHours(12,0,0,0); return d; } },
  { id: 'weekend', ja: '土曜 10:00',  en: 'Saturday 10am', calc: () => { const d = new Date(); d.setDate(d.getDate() + ((6 - d.getDay() + 7) % 7 || 7)); d.setHours(10,0,0,0); return d; } },
];

export function YouTubeModal({ open, onClose, locale, clipTitle, captureFrames, recordBlob }: Props) {
  const ja = locale === 'ja';
  const [connected, setConnected] = useState<boolean | null>(null);
  const [configured, setConfigured] = useState(true);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [schedule, setSchedule] = useState<string>('');  // datetime-local value; '' = now
  const [privacy, setPrivacy] = useState<'public' | 'unlisted' | 'private'>('public');
  const [phase, setPhase] = useState<Phase>('idle');
  const [pct, setPct] = useState(0);
  const [videoId, setVideoId] = useState('');
  const [errMsg, setErrMsg] = useState('');
  const [metaLoading, setMetaLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    fetch('/api/youtube/create-upload')
      .then(r => r.json())
      .then(d => { setConnected(d.connected); setConfigured(d.configured); })
      .catch(() => setConnected(false));
  }, [open]);

  // モーダルを開いたら自動でAIメタデータ生成（人間の作業を減らす）
  const genMetadata = useCallback(async () => {
    setMetaLoading(true);
    try {
      const frames = await captureFrames();
      const res = await fetch('/api/ai/metadata', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clipTitle, frames, locale }),
      });
      if (res.ok) {
        const d = await res.json() as { title: string; description: string; hashtags: string[] };
        setTitle(d.title); setDescription(d.description); setHashtags(d.hashtags);
      }
    } catch { /* keep manual */ }
    setMetaLoading(false);
  }, [clipTitle, locale, captureFrames]);

  useEffect(() => {
    if (open && !title && clipTitle) {
      setTitle(clipTitle.replace(/\n/g, ' ') + ' #Shorts');
      genMetadata();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  const applyPreset = (id: string) => {
    const p = PRESETS.find(p => p.id === id)!;
    const d = p.calc();
    if (!d) { setSchedule(''); return; }
    const pad = (n: number) => String(n).padStart(2, '0');
    setSchedule(`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`);
  };

  const upload = async () => {
    setPhase('recording'); setPct(0); setErrMsg('');
    try {
      const blob = await recordBlob(p => setPct(p));
      setPhase('uploading'); setPct(0);
      const fullDesc = description + (hashtags.length ? `\n\n${hashtags.map(h => `#${h.replace(/^#/, '')}`).join(' ')}` : '');
      const res = await fetch('/api/youtube/create-upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title, description: fullDesc,
          tags: hashtags.map(h => h.replace(/^#/, '')),
          privacy,
          publishAt: schedule ? new Date(schedule).toISOString() : undefined,
          sizeBytes: blob.size,
        }),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.error === 'not_connected' ? 'not_connected' : 'session');
      }
      const { uploadUrl } = await res.json() as { uploadUrl: string };
      // ブラウザからYouTubeへ直接アップロード（XHRで進捗を取得）
      const result = await new Promise<{ id: string }>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('PUT', uploadUrl);
        xhr.upload.onprogress = e => { if (e.lengthComputable) setPct(Math.round(e.loaded / e.total * 100)); };
        xhr.onload = () => xhr.status < 300 ? resolve(JSON.parse(xhr.responseText)) : reject(new Error(`upload ${xhr.status}`));
        xhr.onerror = () => reject(new Error('network'));
        xhr.send(blob);
      });
      setVideoId(result.id);
      setPhase('done');
    } catch (e) {
      setErrMsg(e instanceof Error ? e.message : 'unknown');
      setPhase('error');
    }
  };

  return (
    <div className="modal-overlay" style={{ display: 'flex' }} onClick={e => { if (e.target === e.currentTarget && phase !== 'uploading' && phase !== 'recording') onClose(); }}>
      <div className="modal yt-modal">
        <div className="yt-modal-header">
          <h3>▶️ {ja ? 'YouTubeにアップロード' : 'Upload to YouTube'}</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        {!configured ? (
          <p className="yt-note">{ja ? 'YouTube連携が未設定です（GOOGLE_CLIENT_ID/SECRETが必要）' : 'YouTube integration not configured.'}</p>
        ) : connected === false ? (
          <div className="yt-connect">
            <p>{ja ? 'YouTubeアカウントと連携してください' : 'Connect your YouTube account'}</p>
            <a className="yt-connect-btn" href={`/api/youtube/auth?locale=${locale}`}>
              {ja ? '🔗 Googleアカウントで連携' : '🔗 Connect with Google'}
            </a>
          </div>
        ) : phase === 'done' ? (
          <div className="yt-done">
            <div className="yt-done-icon">🎉</div>
            <p>{schedule
              ? (ja ? `予約投稿しました！公開日時: ${new Date(schedule).toLocaleString()}` : `Scheduled for ${new Date(schedule).toLocaleString()}`)
              : (ja ? 'アップロード完了！' : 'Uploaded!')}</p>
            <a href={`https://studio.youtube.com/video/${videoId}/edit`} target="_blank" rel="noreferrer" className="yt-link">
              {ja ? 'YouTube Studioで確認 →' : 'View in YouTube Studio →'}
            </a>
          </div>
        ) : (
          <>
            {/* AI metadata */}
            <div className="yt-field">
              <div className="yt-field-head">
                <label>{ja ? 'タイトル' : 'Title'}</label>
                <button className="yt-ai-btn" onClick={genMetadata} disabled={metaLoading}>
                  {metaLoading ? (ja ? '🤖 AI生成中...' : '🤖 Generating...') : (ja ? '🤖 AIで再生成' : '🤖 Regenerate with AI')}
                </button>
              </div>
              <input value={title} maxLength={100} onChange={e => setTitle(e.target.value)} />
            </div>
            <div className="yt-field">
              <label>{ja ? '説明文（SEO最適化済み）' : 'Description (SEO-optimized)'}</label>
              <textarea rows={5} value={description} onChange={e => setDescription(e.target.value)}
                placeholder={metaLoading ? (ja ? 'AIが映像を見て説明文を作成中...' : 'AI is writing...') : ''} />
            </div>
            <div className="yt-field">
              <label>{ja ? 'ハッシュタグ（クリックで削除）' : 'Hashtags (click to remove)'}</label>
              <div className="yt-tags">
                {hashtags.map((h, i) => (
                  <button key={i} className="yt-tag" onClick={() => setHashtags(t => t.filter((_, j) => j !== i))}>#{h.replace(/^#/, '')} ✕</button>
                ))}
                <input className="yt-tag-input" placeholder={ja ? '+追加してEnter' : '+add & Enter'}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      const v = (e.target as HTMLInputElement).value.trim().replace(/^#/, '');
                      if (v) { setHashtags(t => [...t, v]); (e.target as HTMLInputElement).value = ''; }
                    }
                  }} />
              </div>
            </div>

            {/* Schedule */}
            <div className="yt-field">
              <label>{ja ? '公開タイミング' : 'Publish timing'}</label>
              <div className="yt-presets">
                {PRESETS.map(p => (
                  <button key={p.id}
                    className={`yt-preset${(p.id === 'now' && !schedule) ? ' active' : ''}`}
                    onClick={() => applyPreset(p.id)}>
                    {ja ? p.ja : p.en}
                  </button>
                ))}
              </div>
              <div className="yt-schedule-row">
                <input type="datetime-local" value={schedule} min={new Date().toISOString().slice(0, 16)}
                  onChange={e => setSchedule(e.target.value)} />
                {schedule && <button className="yt-clear" onClick={() => setSchedule('')}>{ja ? '✕ 予約解除' : '✕ clear'}</button>}
              </div>
              {!schedule && (
                <div className="yt-privacy">
                  {(['public', 'unlisted', 'private'] as const).map(p => (
                    <button key={p} className={`yt-preset${privacy === p ? ' active' : ''}`} onClick={() => setPrivacy(p)}>
                      {ja ? { public: '公開', unlisted: '限定公開', private: '非公開' }[p] : p}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {phase === 'error' && (
              <p className="yt-error">{ja ? `エラーが発生しました（${errMsg}）。再試行してください。` : `Error (${errMsg}). Please retry.`}</p>
            )}

            <button className="yt-upload-btn" disabled={phase === 'recording' || phase === 'uploading' || !title}
              onClick={upload}>
              {phase === 'recording' ? (ja ? `⏺ 動画を書き出し中 ${pct}%` : `⏺ Rendering ${pct}%`)
                : phase === 'uploading' ? (ja ? `⬆ アップロード中 ${pct}%` : `⬆ Uploading ${pct}%`)
                : schedule ? (ja ? '🗓 この日時で予約投稿' : '🗓 Schedule upload')
                : (ja ? '🚀 今すぐアップロード' : '🚀 Upload now')}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
