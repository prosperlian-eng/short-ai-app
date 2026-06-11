import type { FontFamily, FontOption } from './types';

export const FONT_OPTIONS: FontOption[] = [
  { value: 'gothic',  label: 'ゴシック',     family: '"Noto Sans JP",sans-serif',                   weight: '900' },
  { value: 'mincho',  label: '明朝体',       family: '"Noto Serif JP",serif',                       weight: '700' },
  { value: 'dela',    label: 'デラゴシック', family: '"Dela Gothic One",cursive',                   weight: '400' },
  { value: 'reggae',  label: 'レゲエ',       family: '"Reggae One",cursive',                        weight: '400' },
  { value: 'rampart', label: 'ランパート',   family: '"Rampart One",cursive',                       weight: '400' },
  { value: 'rock3d',  label: 'Rock 3D',      family: '"Rock 3D",cursive',                           weight: '400' },
  { value: 'mplus',   label: 'M PLUS',       family: '"M PLUS 1p",sans-serif',                      weight: '900' },
  { value: 'rounded', label: '丸ゴシック',   family: '"M PLUS Rounded 1c",sans-serif',              weight: '700' },
  { value: 'dot',     label: 'ドットゴシック',family: '"DotGothic16",sans-serif',                   weight: '400' },
  { value: 'yomogi',  label: 'よもぎ',       family: '"Yomogi",cursive',                            weight: '400' },
  { value: 'zen',     label: '禅角ゴシック', family: '"Zen Kaku Gothic New",sans-serif',            weight: '900' },
  { value: 'zenold',  label: '禅旧明朝',     family: '"Zen Old Mincho",serif',                      weight: '700' },
  { value: 'impact',  label: 'IMPACT',       family: 'Impact,"Arial Narrow",sans-serif',            weight: '900' },
  // ── YouTube人気フォント（2026年トレンド） ──
  { value: 'kaisei',    label: '解星デコール', family: '"Kaisei Decol",serif',          weight: '700' },
  { value: 'mochiy',    label: 'モッチーポップ', family: '"Mochiy Pop One",sans-serif', weight: '400' },
  { value: 'rocknroll', label: 'ロックンロール', family: '"RocknRoll One",sans-serif',  weight: '400' },
  { value: 'trainone',  label: 'トレイン',      family: '"Train One",cursive',          weight: '400' },
  { value: 'stick',     label: 'ステッキ',      family: '"Stick",sans-serif',           weight: '400' },
  { value: 'hachimaru', label: 'はちまるポップ', family: '"Hachi Maru Pop",cursive',    weight: '400' },
  { value: 'shippori',  label: 'しっぽり明朝',  family: '"Shippori Mincho B1",serif',   weight: '800' },
  { value: 'anton',     label: 'ANTON',         family: '"Anton",sans-serif',           weight: '400' },
  { value: 'bebas',     label: 'BEBAS',         family: '"Bebas Neue",cursive',         weight: '400' },
  { value: 'custom',    label: '＋カスタム',    family: '"Noto Sans JP",sans-serif',    weight: '900' },
];

export const GOOGLE_FONTS_URL =
  'https://fonts.googleapis.com/css2?family=Dela+Gothic+One&family=DotGothic16&family=M+PLUS+1p:wght@900&family=M+PLUS+Rounded+1c:wght@700&family=Noto+Sans+JP:wght@900&family=Noto+Serif+JP:wght@700&family=Rampart+One&family=Reggae+One&family=Rock+3D&family=Yomogi&family=Zen+Kaku+Gothic+New:wght@900&family=Zen+Old+Mincho:wght@700&family=Oswald:wght@700&family=Bebas+Neue&family=Black+Han+Sans&family=Noto+Sans+KR:wght@900&family=Noto+Sans+SC:wght@900&family=Kaisei+Decol:wght@700&family=Mochiy+Pop+One&family=RocknRoll+One&family=Train+One&family=Stick&family=Hachi+Maru+Pop&family=Shippori+Mincho+B1:wght@800&family=Anton&display=swap';

// カスタムGoogle Fontを動的に読み込む（フォント名を入力すれば何でも使える＝古くならない仕組み）
const loadedCustomFonts = new Set<string>();
export function loadCustomGoogleFont(name: string) {
  const trimmed = name.trim();
  if (!trimmed || loadedCustomFonts.has(trimmed)) return;
  loadedCustomFonts.add(trimmed);
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(trimmed).replace(/%20/g, '+')}:wght@400;700;900&display=swap`;
  document.head.appendChild(link);
}

export function buildFont(fontFamily: FontFamily, size: number, customFontName?: string): string {
  if (fontFamily === 'custom' && customFontName?.trim()) {
    return `700 ${size}px "${customFontName.trim()}","Noto Sans JP",sans-serif`;
  }
  const opt = FONT_OPTIONS.find(f => f.value === fontFamily);
  if (!opt) return `900 ${size}px "Noto Sans JP",sans-serif`;
  return `${opt.weight} ${size}px ${opt.family}`;
}
