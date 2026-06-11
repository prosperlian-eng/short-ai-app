import { NextRequest, NextResponse } from 'next/server';
import { ytConfigured, appUrl } from '@/lib/youtube';

export async function GET(req: NextRequest) {
  if (!ytConfigured()) {
    return NextResponse.json({ error: 'YouTube not configured' }, { status: 503 });
  }
  const locale = req.nextUrl.searchParams.get('locale') ?? 'ja';
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: `${appUrl()}/api/youtube/callback`,
    response_type: 'code',
    scope: 'https://www.googleapis.com/auth/youtube.upload',
    access_type: 'offline',
    prompt: 'consent',
    state: locale,
  });
  return NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
}
