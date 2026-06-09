'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useLocale } from 'next-intl';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function AuthModal({ open, onClose }: Props) {
  const locale = useLocale();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  const isJa = locale === 'ja';

  const handleSubmit = async () => {
    setLoading(true); setError('');
    if (mode === 'signup') {
      const { error } = await supabase.auth.signUp({
        email, password,
        options: { emailRedirectTo: `${location.origin}/api/auth/callback?next=/${locale}` },
      });
      if (error) setError(error.message);
      else setSent(true);
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError(isJa ? 'メールアドレスまたはパスワードが違います' : 'Invalid email or password');
      else onClose();
    }
    setLoading(false);
  };

  const handleGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${location.origin}/api/auth/callback?next=/${locale}` },
    });
  };

  if (!open) return null;

  return (
    <div className="modal-overlay open" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 400 }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
          {(['login', 'signup'] as const).map(m => (
            <button key={m} className={`toggle-btn${mode === m ? ' active' : ''}`}
              onClick={() => { setMode(m); setError(''); setSent(false); }}>
              {m === 'login' ? (isJa ? 'ログイン' : 'Login') : (isJa ? '新規登録' : 'Sign up')}
            </button>
          ))}
        </div>

        {sent ? (
          <p style={{ color: '#a78bfa', fontSize: 14, lineHeight: 1.8 }}>
            {isJa
              ? `確認メールを ${email} に送信しました。メール内のリンクをクリックして登録を完了してください。`
              : `Confirmation email sent to ${email}. Click the link to complete registration.`}
          </p>
        ) : (
          <>
            <button onClick={handleGoogle} style={{
              width: '100%', padding: '11px', marginBottom: 16, background: '#fff',
              border: 'none', borderRadius: 8, color: '#111', fontWeight: 700, fontSize: 14,
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}>
              <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.14 0 5.95 1.08 8.17 2.86l6.07-6.07C34.46 3.09 29.51 1 24 1 14.62 1 6.73 6.83 3.12 15.11l7.05 5.48C11.91 14.3 17.45 9.5 24 9.5z"/><path fill="#4285F4" d="M46.47 24.5c0-1.54-.14-3.02-.39-4.45H24v8.41h12.6c-.54 2.88-2.17 5.32-4.63 6.96l7.1 5.52C43.18 37.08 46.47 31.27 46.47 24.5z"/><path fill="#FBBC05" d="M10.17 28.41A14.5 14.5 0 019.5 24c0-1.54.27-3.03.67-4.41L3.12 14.1A22.94 22.94 0 001 24c0 3.65.88 7.1 2.12 10.11l7.05-5.7z"/><path fill="#34A853" d="M24 47c5.51 0 10.14-1.82 13.52-4.96l-7.1-5.52c-1.84 1.24-4.19 1.98-6.42 1.98-6.55 0-12.09-4.8-13.83-11.08l-7.05 5.7C6.73 41.17 14.62 47 24 47z"/><path fill="none" d="M0 0h48v48H0z"/></svg>
              {isJa ? 'Googleでログイン' : 'Continue with Google'}
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
              <span style={{ color: 'var(--muted)', fontSize: 12 }}>{isJa ? 'またはメールで' : 'or with email'}</span>
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            </div>

            <div className="modal-field">
              <label>{isJa ? 'メールアドレス' : 'Email'}</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" onKeyDown={e => e.key === 'Enter' && handleSubmit()} />
            </div>
            <div className="modal-field">
              <label>{isJa ? 'パスワード' : 'Password'}</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" onKeyDown={e => e.key === 'Enter' && handleSubmit()} />
            </div>

            {error && <p style={{ color: '#f87171', fontSize: 13, marginBottom: 12 }}>{error}</p>}

            <div className="modal-btns">
              <button className="modal-btn-primary" onClick={handleSubmit} disabled={loading}>
                {loading ? '...' : (mode === 'login' ? (isJa ? 'ログイン' : 'Login') : (isJa ? '登録する' : 'Sign up'))}
              </button>
              <button className="modal-btn-cancel" onClick={onClose}>{isJa ? 'キャンセル' : 'Cancel'}</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
