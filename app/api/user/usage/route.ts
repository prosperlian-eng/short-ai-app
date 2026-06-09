import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ plan: 'free', count: 0, limit: 3 });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('plan, generation_count, reset_at')
    .eq('id', user.id)
    .single();

  if (!profile) {
    return NextResponse.json({ plan: 'free', count: 0, limit: 3 });
  }

  // 月が変わっていたらリセット
  const resetAt = new Date(profile.reset_at);
  const now = new Date();
  if (resetAt.getMonth() !== now.getMonth() || resetAt.getFullYear() !== now.getFullYear()) {
    await supabase
      .from('profiles')
      .update({ generation_count: 0, reset_at: now.toISOString() })
      .eq('id', user.id);
    profile.generation_count = 0;
  }

  const limits: Record<string, number> = { free: 3, pro: -1, business: -1 };
  const limit = limits[profile.plan] ?? 3;

  return NextResponse.json({
    plan: profile.plan,
    count: profile.generation_count,
    limit,
  });
}

// 生成後に呼ぶ（カウントを増やす）
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { clips } = await req.json() as { clips: number };

  const { data: profile } = await supabase
    .from('profiles')
    .select('plan, generation_count')
    .eq('id', user.id)
    .single();

  if (!profile) return NextResponse.json({ error: 'profile not found' }, { status: 404 });

  // 無制限プランはカウントしない
  if (profile.plan !== 'free') {
    return NextResponse.json({ ok: true });
  }

  await supabase
    .from('profiles')
    .update({ generation_count: profile.generation_count + 1 })
    .eq('id', user.id);

  await supabase
    .from('generations')
    .insert({ user_id: user.id, count: clips });

  return NextResponse.json({ ok: true });
}
