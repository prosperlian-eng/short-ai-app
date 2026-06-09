import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { createAdminClient } from '@/lib/supabase/server';
import type Stripe from 'stripe';

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get('stripe-signature')!;

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  const supabase = await createAdminClient();

  // サブスクリプション→プランのマッピング
  async function updatePlan(subscription: Stripe.Subscription, plan: 'free' | 'pro' | 'business') {
    const userId = subscription.metadata.supabase_user_id;
    if (!userId) return;
    await supabase
      .from('profiles')
      .update({ plan, stripe_sub_id: subscription.id })
      .eq('id', userId);
  }

  function detectPlan(subscription: Stripe.Subscription): 'pro' | 'business' {
    const priceId = subscription.items.data[0]?.price.id;
    if (priceId === process.env.STRIPE_BUSINESS_PRICE_ID) return 'business';
    return 'pro';
  }

  switch (event.type) {
    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
      const sub = event.data.object as Stripe.Subscription;
      const plan = sub.status === 'active' ? detectPlan(sub) : 'free';
      await updatePlan(sub, plan);
      break;
    }
    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription;
      await updatePlan(sub, 'free');
      break;
    }
  }

  return NextResponse.json({ received: true });
}
