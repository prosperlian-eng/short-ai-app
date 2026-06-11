import { NextRequest, NextResponse } from 'next/server';
import { appUrl } from '@/lib/youtube';

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code');
  const locale = req.nextUrl.searchParams.get('state') ?? 'ja';
  const back = `${appUrl()}/${locale}`;
  if (!code) return NextResponse.redirect(`${back}?yt=error`);

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      code,
      grant_type: 'authorization_code',
      redirect_uri: `${appUrl()}/api/youtube/callback`,
    }),
  });
  if (!res.ok) return NextResponse.redirect(`${back}?yt=error`);
  const data = await res.json() as { access_token: string; refresh_token?: string; expires_in: number };

  const redirect = NextResponse.redirect(`${back}?yt=connected`);
  const opts = { httpOnly: true, secure: true, sameSite: 'lax' as const, path: '/' };
  redirect.cookies.set('yt_access', data.access_token, { ...opts, maxAge: data.expires_in });
  redirect.cookies.set('yt_expiry', String(Date.now() + data.expires_in * 1000), opts);
  if (data.refresh_token) {
    redirect.cookies.set('yt_refresh', data.refresh_token, { ...opts, maxAge: 60 * 60 * 24 * 180 });
  }
  return redirect;
}
