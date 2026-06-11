import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

export const maxDuration = 60;

// クリップごとのフレーム画像（base64 JPEG）を受け取り、内容に合ったキャッチコピーを生成する
export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'AI not configured' }, { status: 503 });
  }

  const { clips, locale } = (await req.json()) as {
    clips: { frames: string[] }[]; // frames: base64 JPEG (no data: prefix)
    locale: string;
  };
  if (!clips?.length || clips.length > 20) {
    return NextResponse.json({ error: 'invalid clips' }, { status: 400 });
  }

  const client = new Anthropic();

  const langNames: Record<string, string> = {
    ja: '日本語', en: 'English', zh: '中文', ko: '한국어', es: 'Español',
    fr: 'Français', de: 'Deutsch', pt: 'Português', vi: 'Tiếng Việt', id: 'Bahasa Indonesia',
  };
  const lang = langNames[locale] ?? '日本語';

  const content: Anthropic.ContentBlockParam[] = [];
  clips.forEach((clip, i) => {
    content.push({ type: 'text', text: `--- クリップ ${i + 1} ---` });
    for (const frame of clip.frames.slice(0, 3)) {
      content.push({
        type: 'image',
        source: { type: 'base64', media_type: 'image/jpeg', data: frame },
      });
    }
  });
  content.push({
    type: 'text',
    text: `上記は1本の動画から切り出した${clips.length}個のショート動画クリップのフレームです。各クリップの実際の映像内容に基づいて、YouTubeショートで視聴者の指を止めるキャッチコピーを${lang}で1つずつ作ってください。

ルール:
- 各クリップの映像に実際に映っているもの・起きていることに即した内容にする
- 13〜20文字程度、改行(\\n)で2行に分ける
- 続きが気になる「フック」のある表現（例:「まさかの結果に\\n全員驚愕。」のようなトーン）
- 映像と無関係な内容は禁止`,
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
              titles: {
                type: 'array',
                items: { type: 'string' },
                description: 'クリップ順のキャッチコピー。改行は\\nで含める',
              },
            },
            required: ['titles'],
            additionalProperties: false,
          },
        },
      },
    });
    const text = response.content.find(b => b.type === 'text')?.text ?? '{}';
    const { titles } = JSON.parse(text) as { titles: string[] };
    return NextResponse.json({ titles: titles.slice(0, clips.length) });
  } catch (e) {
    console.error('AI title generation failed:', e);
    return NextResponse.json({ error: 'generation failed' }, { status: 500 });
  }
}
