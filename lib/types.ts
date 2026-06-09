export type FontFamily =
  | 'gothic' | 'mincho' | 'dela' | 'reggae' | 'rampart' | 'rock3d'
  | 'mplus' | 'rounded' | 'dot' | 'yomogi' | 'zen' | 'zenold' | 'impact';

export type FontEffect = 'gothic' | 'glow' | 'stroke' | 'box' | 'simple';
export type BorderStyle = 'none' | 'thin' | 'thick' | 'glow' | 'corner';
export type PatternMode = 'random' | 'dramatic' | 'clean' | 'energy' | 'luxury' | 'street';
export type OutroMode = 'text' | 'video' | 'none';

export interface AppState {
  videoFile: File | null;
  videoURL: string | null;
  count: number;
  fontFamily: FontFamily;
  fontEffect: FontEffect;
  fontSize: number;
  textColor: string;
  borderStyle: BorderStyle;
  borderColor: string;
  pattern: PatternMode;
  ctaText: string;
  ctaColor: string;
  copies: string[];
}

export interface OutroState {
  mode: OutroMode;
  channel: string;
  sub: string;
  sns: string;
  bgColor: string;
  videoURL: string | null;
  duration: number;
}

export interface SceneInfo {
  startTime: number;
  clipDuration: number;
  score: number;
}

export interface CardData {
  canvas: HTMLCanvasElement;
  startTime: number;
  clipDuration: number;
  title: string;
  patIdx: number;
  playing: boolean;
  previewVid: HTMLVideoElement | null;
  animRaf: number | null;
  playBtn?: HTMLButtonElement;
}

export interface FontOption {
  value: FontFamily;
  label: string;
  family: string;
  weight: string;
}
