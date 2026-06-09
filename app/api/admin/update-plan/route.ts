import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

const ADMIN_EMAIL = 'prosper.lian@gmail.com';

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user || user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { userId, plan } = await req.json() as { userId: string; plan: string };
  if (!userId || !['free', 'pro', 'business'].includes(plan)) {
    return NextResponse.json({ error: 'Invalid params' }, { status: 400 });
  }

  const admin = await createAdminClient();
  const { error } = await admin
    .from('profiles')
    .update({ plan, updated_at: new Date().toISOString() })
    .eq('id', userId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
