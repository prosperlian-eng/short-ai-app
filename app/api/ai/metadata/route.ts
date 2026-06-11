import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

export const maxDuration = 60;

// クリップのフレーム＋キャッチコピーから、バズる・検索に強いYouTubeタイトル/説明文/ハッシュタグを生成
export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'AI not configured' }, { status: 503 });
  }
  const { clipTitle, frames, locale } = await req.json() as {
    clipTitle: string; frames: string[]; locale: string;
  };

  const langNames: Record<string, string> = {
    ja: '日本語', en: 'English', zh: '中文', ko: '한국어', es: 'Español',
    fr: 'Français', de: 'Deutsch', pt: 'Português', vi: 'Tiếng Việt', id: 'Bahasa Indonesia',
  };
  const lang = langNames[locale] ?? '日本語';

  const client = new Anthropic();
  const content: Anthropic.ContentBlockParam[] = (frames ?? []).slice(0, 3).map(f => ({
    type: 'image' as const,
    source: { type: 'base64' as const, media_type: 'image/jpeg' as const, data: f },
  }));
  content.push({
    type: 'text',
    text: `これはYouTubeショート動画のフレームです。サムネイルのキャッチコピーは「${clipTitle}」。
この動画をYouTubeに投稿するための最適なメタデータを${lang}で生成してください。

要件:
- title: クリックされやすく検索にも強いタイトル（60文字以内、#Shortsを末尾に含める）
- description: 検索アルゴリズムに強い説明文。冒頭1行はフック、続けて内容の要約、関連キーワードを自然に織り込む（300〜500文字）。最後にハッシュタグ行
- hashtags: 動画内容に即したもの＋トレンド性のあるもの計10個（#は付けない単語のみ）`,
  });

  try {
    const response = await client.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 2000,
      messages: [{ role: 'user', content }],
      output_config: {
        format: {
          type: 'json_schema',
          schema: {
            type: 'object',
            properties: {
              title: { type: 'string' },
              description: { type: 'string' },
              hashtags: { type: 'array', items: { type: 'string' } },
            },
            required: ['title', 'description', 'hashtags'],
            additionalProperties: false,
          },
        },
      },
    });
    const text = response.content.find(b => b.type === 'text')?.text ?? '{}';
    return NextResponse.json(JSON.parse(text));
  } catch (e) {
    console.error('AI metadata generation failed:', e);
    return NextResponse.json({ error: 'generation failed' }, { status: 500 });
  }
}
