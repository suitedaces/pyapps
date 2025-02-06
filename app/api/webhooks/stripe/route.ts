import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { Database } from '@/lib/database.types';

if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
    throw new Error('Missing Stripe environment variables');
}

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Missing Supabase environment variables');
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(request: Request) {
    const body = await request.text();
    const signature = (await headers()).get('stripe-signature');

    if (!signature) {
        return new NextResponse('Missing stripe-signature', { status: 400 });
    }

    let event: Stripe.Event;

    try {
        event = stripe.webhooks.constructEvent(
            body,
            signature,
            process.env.STRIPE_WEBHOOK_SECRET!
        );
    } catch (err) {
        return new NextResponse('Webhook Error', { status: 400 });
    }

    const subscription = event.data.object as Stripe.Subscription;

    try {
        switch (event.type) {
            case 'customer.subscription.created':
            case 'customer.subscription.updated':
                await handleSubscriptionUpdate(subscription);
                break;

            case 'customer.subscription.deleted':
                await handleSubscriptionDeletion(subscription);
                break;

            case 'customer.subscription.trial_will_end':
                await handleTrialEnding(subscription);
                break;

            case 'invoice.payment_failed':
                await handleFailedPayment(subscription);
                break;
        }

        return new NextResponse(null, { status: 200 });
    } catch (error) {
        console.error('Error processing webhook:', error);
        return new NextResponse('Webhook handler failed', { status: 500 });
    }
}

async function handleSubscriptionUpdate(subscription: Stripe.Subscription) {
    const customer = await stripe.customers.retrieve(subscription.customer as string) as Stripe.Customer;
    if (customer.deleted) return;
    const userId = customer.metadata.userId;

    if (!userId) return;

    const isTrialing = subscription.status === 'trialing';
    const trialEnd = subscription.trial_end 
        ? new Date(subscription.trial_end * 1000).toISOString()
        : null;

    await supabase
        .from('users')
        .update({
            subscription_tier: 'pro',
            subscription_status: subscription.status as 'active' | 'canceled' | 'past_due' | 'trialing',
            current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
            is_in_trial: isTrialing,
            trial_end: trialEnd,
        })
        .eq('id', userId);

    await supabase
        .from('subscriptions')
        .update({
            status: subscription.status as 'active' | 'canceled' | 'past_due' | 'trialing',
            current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
            current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
            is_trialing: isTrialing,
            trial_end: trialEnd,
        })
        .eq('stripe_subscription_id', subscription.id);
}

async function handleTrialEnding(subscription: Stripe.Subscription) {
    const customer = await stripe.customers.retrieve(subscription.customer as string) as Stripe.Customer;
    if (customer.deleted) return;
    const userId = customer.metadata.userId;

    if (!userId) return;

    // You could send an email notification here
    // For now, we'll just update the database
    await supabase
        .from('users')
        .update({
            is_in_trial: false,
        })
        .eq('id', userId);

    await supabase
        .from('subscriptions')
        .update({
            is_trialing: false,
        })
        .eq('stripe_subscription_id', subscription.id);
}

async function handleSubscriptionDeletion(subscription: Stripe.Subscription) {
    const customer = await stripe.customers.retrieve(subscription.customer as string) as Stripe.Customer;
    if (customer.deleted) return;
    const userId = customer.metadata.userId;

    if (!userId) return;

    await supabase
        .from('users')
        .update({
            subscription_tier: 'free',
            subscription_status: 'canceled',
            current_period_end: null,
        })
        .eq('id', userId);

    await supabase
        .from('subscriptions')
        .update({
            status: 'canceled',
            canceled_at: new Date().toISOString(),
        })
        .eq('stripe_subscription_id', subscription.id);
}

async function handleFailedPayment(subscription: Stripe.Subscription) {
    const customer = await stripe.customers.retrieve(subscription.customer as string) as Stripe.Customer;
    if (customer.deleted) return;
    const userId = customer.metadata.userId;

    if (!userId) return;

    await supabase
        .from('users')
        .update({
            subscription_status: 'past_due',
        })
        .eq('id', userId);

    await supabase
        .from('subscriptions')
        .update({
            status: 'past_due',
        })
        .eq('stripe_subscription_id', subscription.id);
} 
