import { cookies } from 'next/headers';

const TOKEN_URL = 'https://oauth2.googleapis.com/token';

export function ytConfigured(): boolean {
  return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
}

// 有効なアクセストークンを返す（期限切れならリフレッシュ）。未接続なら null
export async function getAccessToken(): Promise<string | null> {
  const jar = await cookies();
  const access = jar.get('yt_access')?.value;
  const expiry = Number(jar.get('yt_expiry')?.value ?? 0);
  if (access && Date.now() < expiry - 60_000) return access;

  const refresh = jar.get('yt_refresh')?.value;
  if (!refresh) return null;

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: refresh,
      grant_type: 'refresh_token',
    }),
  });
  if (!res.ok) return null;
  const data = await res.json() as { access_token: string; expires_in: number };
  jar.set('yt_access', data.access_token, { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: data.expires_in });
  jar.set('yt_expiry', String(Date.now() + data.expires_in * 1000), { httpOnly: true, secure: true, sameSite: 'lax', path: '/' });
  return data.access_token;
}
