import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/server';

const ADMIN_EMAIL = 'prosper.lian@gmail.com';

export async function GET() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user || user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = createAdminClient();

  // Get all profiles
  const { data: profiles } = await admin
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false });

  // Stats
  const total = profiles?.length ?? 0;
  const byPlan = { free: 0, pro: 0, business: 0 };
  let totalGenerations = 0;

  for (const p of profiles ?? []) {
    if (p.plan in byPlan) byPlan[p.plan as keyof typeof byPlan]++;
    totalGenerations += p.generation_count ?? 0;
  }

  // Recent generations (last 30 days)
  const since = new Date();
  since.setDate(since.getDate() - 30);
  const { count: recentGens } = await admin
    .from('generations')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', since.toISOString());

  return NextResponse.json({
    profiles: profiles ?? [],
    stats: {
      total,
      byPlan,
      totalGenerations,
      recentGens: recentGens ?? 0,
    },
  });
}
