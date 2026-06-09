'use client';

import { useState, useRef, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useLocale } from 'next-intl';
import type { Plan } from '@/lib/plans';

interface Props {
  email: string;
  plan: Plan;
  count: number;
  limit: number;
  onUpgrade: () => void;
  onLogout: () => void;
}

const PLAN_COLORS: Record<string, string> = {
  free: '#6b7280',
  pro: '#7c3aed',
  business: '#f59e0b',
};

export function UserMenu({ email, plan, count, limit, onUpgrade, onLogout }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const isJa = useLocale() === 'ja';

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const initials = email.slice(0, 2).toUpperCase();
  const isUnlimited = limit === -1;
  const remaining = isUnlimited ? '∞' : Math.max(0, limit - count);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button onClick={() => setOpen(o => !o)} style={{
        display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface2)',
        border: '1px solid var(--border)', borderRadius: 20, padding: '5px 12px 5px 5px',
        cursor: 'pointer', color: 'var(--text)',
      }}>
        <div style={{ width: 28, height: 28, borderRadius: '50%', background: PLAN_COLORS[plan], display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#fff' }}>
          {initials}
        </div>
        <span style={{ fontSize: 12, fontWeight: 600 }}>{plan.toUpperCase()}</span>
        <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor" style={{ opacity: 0.5 }}><path d="M1 3l4 4 4-4"/></svg>
      </button>

      {open && (
        <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: 6, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 16, minWidth: 220, zIndex: 999, boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}>
          <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 12, wordBreak: 'break-all' }}>{email}</p>

          {/* Usage bar */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--muted)', marginBottom: 6 }}>
              <span>{isJa ? '今月の生成数' : 'Generations this month'}</span>
              <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                {isUnlimited ? `${count} / ∞` : `${count} / ${limit}`}
              </span>
            </div>
            {!isUnlimited && (
              <div style={{ height: 4, background: 'rgba(255,255,255,0.1)', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${Math.min(100, (count / limit) * 100)}%`, background: count >= limit ? '#f87171' : 'var(--accent)', borderRadius: 2, transition: 'width 0.3s' }} />
              </div>
            )}
            {!isUnlimited && count >= limit && (
              <p style={{ fontSize: 11, color: '#f87171', marginTop: 6 }}>
                {isJa ? '今月の上限に達しました' : 'Monthly limit reached'}
              </p>
            )}
          </div>

          {plan === 'free' && (
            <button onClick={() => { setOpen(false); onUpgrade(); }} style={{ width: '100%', padding: '9px', background: 'linear-gradient(135deg, var(--accent), #4f46e5)', border: 'none', borderRadius: 8, color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', marginBottom: 8 }}>
              ✦ {isJa ? 'Proにアップグレード' : 'Upgrade to Pro'}
            </button>
          )}

          <button onClick={() => { setOpen(false); onLogout(); }} style={{ width: '100%', padding: '8px', background: 'none', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--muted)', fontSize: 12, cursor: 'pointer' }}>
            {isJa ? 'ログアウト' : 'Log out'}
          </button>
        </div>
      )}
    </div>
  );
}
