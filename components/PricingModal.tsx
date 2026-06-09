'use client';

import { useState } from 'react';
import { PLANS } from '@/lib/plans';
import { useLocale } from 'next-intl';

interface Props {
  open: boolean;
  onClose: () => void;
  currentPlan: string;
}

export function PricingModal({ open, onClose, currentPlan }: Props) {
  const locale = useLocale();
  const isJa = locale === 'ja';
  const [loading, setLoading] = useState<string | null>(null);

  const handleUpgrade = async (priceId: string | null, planId: string) => {
    if (!priceId) return;
    setLoading(planId);
    const res = await fetch('/api/stripe/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ priceId, locale }),
    });
    const data = await res.json() as { url?: string; error?: string };
    if (data.url) location.href = data.url;
    else { alert(isJa ? 'ログインが必要です' : 'Please login first'); setLoading(null); }
  };

  if (!open) return null;

  return (
    <div className="modal-overlay open" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 640 }}>
        <h3 style={{ marginBottom: 8 }}>
          {isJa ? 'プランを選択' : 'Choose a Plan'}
        </h3>
        <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 24 }}>
          {isJa ? 'いつでもキャンセル可能です' : 'Cancel anytime'}
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          {PLANS.map(plan => {
            const isCurrent = plan.id === currentPlan;
            const price = isJa ? plan.price : plan.priceEn;
            const name = isJa ? plan.name : plan.nameEn;
            return (
              <div key={plan.id} style={{
                background: plan.badge ? 'rgba(124,58,237,0.12)' : 'var(--surface2)',
                border: `1.5px solid ${plan.badge ? 'var(--accent)' : 'var(--border)'}`,
                borderRadius: 12, padding: 20, position: 'relative',
              }}>
                {plan.badge && (
                  <div style={{ position: 'absolute', top: -10, left: '50%', transform: 'translateX(-50%)', background: 'var(--accent)', color: '#fff', fontSize: 10, fontWeight: 700, padding: '2px 10px', borderRadius: 999, whiteSpace: 'nowrap' }}>
                    {isJa ? '人気' : 'Popular'}
                  </div>
                )}
                <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>{name}</div>
                <div style={{ fontSize: 20, fontWeight: 900, color: '#f1f1f5', marginBottom: 16 }}>{price}</div>
                <ul style={{ listStyle: 'none', fontSize: 12, color: 'var(--muted)', display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 20 }}>
                  <li>✓ {plan.generationsPerMonth === -1 ? (isJa ? '無制限生成' : 'Unlimited') : `${plan.generationsPerMonth}${isJa ? '本/月' : '/mo'}`}</li>
                  <li style={{ color: plan.watermark ? 'var(--muted)' : '#a78bfa' }}>
                    {plan.watermark ? (isJa ? '✗ ウォーターマーク付き' : '✗ Watermark') : (isJa ? '✓ ウォーターマークなし' : '✓ No watermark')}
                  </li>
                  <li style={{ color: plan.allFonts ? '#a78bfa' : 'var(--muted)' }}>
                    {plan.allFonts ? (isJa ? '✓ 全フォント使用可' : '✓ All fonts') : (isJa ? '✗ 標準フォントのみ' : '✗ Basic fonts only')}
                  </li>
                  <li style={{ color: plan.aiTitles ? '#a78bfa' : 'var(--muted)' }}>
                    {plan.aiTitles ? (isJa ? '✓ AIタイトル生成' : '✓ AI titles') : (isJa ? '✗ ランダムタイトル' : '✗ Random titles')}
                  </li>
                </ul>
                {isCurrent ? (
                  <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--muted)', padding: '8px 0' }}>
                    {isJa ? '現在のプラン' : 'Current plan'}
                  </div>
                ) : plan.stripePriceId ? (
                  <button onClick={() => handleUpgrade(plan.stripePriceId, plan.id)} disabled={loading === plan.id}
                    style={{ width: '100%', padding: '10px', background: plan.badge ? 'var(--accent)' : 'var(--surface)', border: `1px solid ${plan.badge ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 8, color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                    {loading === plan.id ? '...' : (isJa ? 'アップグレード' : 'Upgrade')}
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>

        <div className="modal-btns" style={{ marginTop: 20 }}>
          <button className="modal-btn-cancel" style={{ flex: 'unset', padding: '10px 24px' }} onClick={onClose}>
            {isJa ? '閉じる' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
}
