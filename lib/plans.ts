export type Plan = 'free' | 'pro' | 'business';

export interface PlanConfig {
  id: Plan;
  name: string;
  nameEn: string;
  price: string;
  priceEn: string;
  generationsPerMonth: number;   // -1 = unlimited
  watermark: boolean;
  allFonts: boolean;
  aiTitles: boolean;
  stripePriceId: string | null;
  badge?: string;
}

export const PLANS: PlanConfig[] = [
  {
    id: 'free',
    name: '無料',
    nameEn: 'Free',
    price: '¥0 / 月',
    priceEn: '$0 / mo',
    generationsPerMonth: 3,
    watermark: true,
    allFonts: false,
    aiTitles: false,
    stripePriceId: null,
  },
  {
    id: 'pro',
    name: 'Pro',
    nameEn: 'Pro',
    price: '¥1,500 / 月',
    priceEn: '$12 / mo',
    generationsPerMonth: -1,
    watermark: false,
    allFonts: true,
    aiTitles: true,
    stripePriceId: process.env.STRIPE_PRO_PRICE_ID ?? null,
    badge: '人気',
  },
  {
    id: 'business',
    name: 'Business',
    nameEn: 'Business',
    price: '¥3,000 / 月',
    priceEn: '$29 / mo',
    generationsPerMonth: -1,
    watermark: false,
    allFonts: true,
    aiTitles: true,
    stripePriceId: process.env.STRIPE_BUSINESS_PRICE_ID ?? null,
  },
];

export function getPlan(id: Plan): PlanConfig {
  return PLANS.find(p => p.id === id) ?? PLANS[0];
}

export function canGenerate(plan: Plan, currentCount: number): boolean {
  const p = getPlan(plan);
  if (p.generationsPerMonth === -1) return true;
  return currentCount < p.generationsPerMonth;
}

export function remainingGenerations(plan: Plan, currentCount: number): number {
  const p = getPlan(plan);
  if (p.generationsPerMonth === -1) return Infinity;
  return Math.max(0, p.generationsPerMonth - currentCount);
}
