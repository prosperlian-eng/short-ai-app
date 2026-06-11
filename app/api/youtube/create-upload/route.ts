import { NextRequest, NextResponse } from 'next/server';
import { getAccessToken, ytConfigured } from '@/lib/youtube';

// メタデータでリザンブルアップロードのセッションを作成し、アップロードURLを返す。
// 動画本体はブラウザから直接そのURLへPUTする（Vercelのボディサイズ制限を回避）
export async function POST(req: NextRequest) {
  if (!ytConfigured()) return NextResponse.json({ error: 'not_configured' }, { status: 503 });
  const token = await getAccessToken();
  if (!token) return NextResponse.json({ error: 'not_connected' }, { status: 401 });

  const { title, description, tags, privacy, publishAt, sizeBytes } = await req.json() as {
    title: string; description: string; tags: string[];
    privacy: 'public' | 'unlisted' | 'private'; publishAt?: string; sizeBytes: number;
  };

  const status: Record<string, unknown> = { privacyStatus: privacy, selfDeclaredMadeForKids: false };
  if (publishAt) { status.privacyStatus = 'private'; status.publishAt = publishAt; }

  const res = await fetch(
    'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Upload-Content-Length': String(sizeBytes),
        'X-Upload-Content-Type': 'video/webm',
      },
      body: JSON.stringify({
        snippet: { title: title.slice(0, 100), description: description.slice(0, 5000), tags: tags.slice(0, 30), categoryId: '24' },
        status,
      }),
    },
  );
  if (!res.ok) {
    const detail = await res.text();
    console.error('YouTube session create failed:', detail);
    return NextResponse.json({ error: 'session_failed', detail }, { status: res.status });
  }
  const uploadUrl = res.headers.get('location');
  if (!uploadUrl) return NextResponse.json({ error: 'no_upload_url' }, { status: 500 });
  return NextResponse.json({ uploadUrl });
}

export async function GET() {
  if (!ytConfigured()) return NextResponse.json({ connected: false, configured: false });
  const token = await getAccessToken();
  return NextResponse.json({ connected: !!token, configured: true });
}
