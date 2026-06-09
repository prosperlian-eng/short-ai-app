'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

interface Profile {
  id: string;
  email: string;
  plan: string;
  generation_count: number;
  stripe_customer_id: string | null;
  stripe_sub_id: string | null;
  created_at: string;
  reset_at: string;
}

interface Stats {
  total: number;
  byPlan: { free: number; pro: number; business: number };
  totalGenerations: number;
  recentGens: number;
}

const PLAN_COLORS: Record<string, string> = {
  free: '#6b7280',
  pro: '#7c3aed',
  business: '#f59e0b',
};

export default function AdminPage() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [updating, setUpdating] = useState<string | null>(null);

  const supabase = createClient();

  const load = async () => {
    setLoading(true);
    const res = await fetch('/api/admin/stats');
    if (!res.ok) {
      setError('管理者権限がありません');
      setLoading(false);
      return;
    }
    const data = await res.json() as { profiles: Profile[]; stats: Stats };
    setProfiles(data.profiles);
    setStats(data.stats);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const updatePlan = async (userId: string, plan: string) => {
    setUpdating(userId);
    await fetch('/api/admin/update-plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, plan }),
    });
    await load();
    setUpdating(null);
  };

  const filtered = profiles.filter(p =>
    !search || p.email?.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#0a0a0f', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
      読み込み中...
    </div>
  );

  if (error) return (
    <div style={{ minHeight: '100vh', background: '#0a0a0f', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f87171', fontSize: 18 }}>
      {error}
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0f', color: '#f1f1f5', padding: '32px 24px', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>⚡ Admin Dashboard</h1>
            <p style={{ color: '#6b7280', fontSize: 13, marginTop: 4 }}>ShortAI 管理パネル</p>
          </div>
          <a href="/ja" style={{ color: '#7c3aed', fontSize: 13, textDecoration: 'none' }}>← アプリに戻る</a>
        </div>

        {/* Stats cards */}
        {stats && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 32 }}>
            <StatCard label="総ユーザー数" value={stats.total} icon="👥" color="#7c3aed" />
            <StatCard label="Free プラン" value={stats.byPlan.free} icon="🆓" color="#6b7280" />
            <StatCard label="Pro プラン" value={stats.byPlan.pro} icon="✨" color="#7c3aed" />
            <StatCard label="Business プラン" value={stats.byPlan.business} icon="💼" color="#f59e0b" />
            <StatCard label="今月の生成数" value={stats.recentGens} icon="🎬" color="#10b981" />
            <StatCard label="累計生成数" value={stats.totalGenerations} icon="📊" color="#3b82f6" />
          </div>
        )}

        {/* User table */}
        <div style={{ background: '#111118', border: '1px solid #1e1e2e', borderRadius: 16, overflow: 'hidden' }}>
          <div style={{ padding: '20px 24px', borderBottom: '1px solid #1e1e2e', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>ユーザー一覧</h2>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="メールで検索..."
              style={{ background: '#1a1a2e', border: '1px solid #2e2e4e', borderRadius: 8, padding: '7px 12px', color: '#f1f1f5', fontSize: 13, width: 220, outline: 'none' }}
            />
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#0f0f1a' }}>
                  {['メール', 'プラン', '今月の生成', 'Stripe ID', '登録日', '変更'].map(h => (
                    <th key={h} style={{ padding: '12px 16px', textAlign: 'left', color: '#6b7280', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((p, i) => (
                  <tr key={p.id} style={{ borderTop: '1px solid #1e1e2e', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}>
                    <td style={{ padding: '12px 16px', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {p.email ?? '—'}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ background: `${PLAN_COLORS[p.plan]}22`, color: PLAN_COLORS[p.plan], padding: '3px 10px', borderRadius: 999, fontWeight: 700, fontSize: 11, textTransform: 'uppercase' }}>
                        {p.plan}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', color: '#a1a1aa' }}>{p.generation_count}</td>
                    <td style={{ padding: '12px 16px', color: '#4b5563', fontSize: 11, fontFamily: 'monospace' }}>
                      {p.stripe_customer_id ? p.stripe_customer_id.slice(0, 14) + '…' : '—'}
                    </td>
                    <td style={{ padding: '12px 16px', color: '#6b7280', whiteSpace: 'nowrap' }}>
                      {new Date(p.created_at).toLocaleDateString('ja-JP')}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <select
                        value={p.plan}
                        disabled={updating === p.id}
                        onChange={e => updatePlan(p.id, e.target.value)}
                        style={{ background: '#1a1a2e', border: '1px solid #2e2e4e', borderRadius: 6, color: '#f1f1f5', padding: '4px 8px', fontSize: 12, cursor: 'pointer' }}
                      >
                        <option value="free">Free</option>
                        <option value="pro">Pro</option>
                        <option value="business">Business</option>
                      </select>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ padding: 40, textAlign: 'center', color: '#4b5563' }}>ユーザーが見つかりません</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}

function StatCard({ label, value, icon, color }: { label: string; value: number; icon: string; color: string }) {
  return (
    <div style={{ background: '#111118', border: `1px solid ${color}33`, borderRadius: 12, padding: '18px 20px' }}>
      <div style={{ fontSize: 22, marginBottom: 8 }}>{icon}</div>
      <div style={{ fontSize: 28, fontWeight: 900, color, lineHeight: 1 }}>{value.toLocaleString()}</div>
      <div style={{ fontSize: 12, color: '#6b7280', marginTop: 6 }}>{label}</div>
    </div>
  );
}
