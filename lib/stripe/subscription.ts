import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { Database } from '../database.types';

if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('Missing STRIPE_SECRET_KEY');
}

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Missing Supabase credentials');
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Subscription tiers configuration
export const SUBSCRIPTION_TIERS = {
    FREE: {
        name: 'Free',
        maxAppsPerMonth: 3,
        maxFileSize: 5 * 1024 * 1024, // 5MB in bytes
    },
    PRO: {
        name: 'Pro',
        maxAppsPerMonth: Infinity,
        maxFileSize: 1024 * 1024 * 1024, // 1GB in bytes
        stripePriceId: process.env.STRIPE_PRO_PRICE_ID,
        trialDays: 7,
    },
} as const;

export async function createStripeCustomer(userId: string, email: string) {
    try {
        const customer = await stripe.customers.create({
            email,
            metadata: {
                userId,
            },
        });

        await supabase
            .from('users')
            .update({
                stripe_customer_id: customer.id,
                subscription_tier: 'free',
                subscription_status: 'active',
            })
            .eq('id', userId);

        return customer;
    } catch (error) {
        console.error('Error creating Stripe customer:', error);
        throw error;
    }
}

export async function createSubscription(
    userId: string,
    priceId: string,
    customerEmail: string
) {
    try {
        // Get or create Stripe customer
        let user = await supabase
            .from('users')
            .select('stripe_customer_id, subscription_tier')
            .eq('id', userId)
            .single();

        let customerId = user.data?.stripe_customer_id;

        if (!customerId) {
            const customer = await createStripeCustomer(userId, customerEmail);
            customerId = customer.id;
        }

        // Check if user has had a trial before
        const { data: existingSubscriptions } = await supabase
            .from('subscriptions')
            .select('id')
            .eq('user_id', userId)
            .limit(1);

        const hasHadTrial = existingSubscriptions && existingSubscriptions.length > 0;

        // Create the subscription with trial if eligible
        const subscription = await stripe.subscriptions.create({
            customer: customerId,
            items: [{ price: priceId }],
            payment_behavior: 'default_incomplete',
            payment_settings: { save_default_payment_method: 'on_subscription' },
            expand: ['latest_invoice.payment_intent'],
            trial_period_days: !hasHadTrial ? SUBSCRIPTION_TIERS.PRO.trialDays : undefined,
        });

        // Store subscription in database
        await supabase.from('subscriptions').insert({
            user_id: userId,
            stripe_subscription_id: subscription.id,
            stripe_price_id: priceId,
            status: subscription.status as 'active' | 'canceled' | 'past_due' | 'trialing',
            current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
            current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
            trial_end: subscription.trial_end 
                ? new Date(subscription.trial_end * 1000).toISOString() 
                : null,
            is_trialing: subscription.status === 'trialing',
        });

        // Update user's subscription status
        await supabase
            .from('users')
            .update({
                subscription_tier: 'pro',
                subscription_status: subscription.status as 'active' | 'canceled' | 'past_due' | 'trialing',
                current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
                is_in_trial: subscription.status === 'trialing',
                trial_end: subscription.trial_end 
                    ? new Date(subscription.trial_end * 1000).toISOString() 
                    : null,
            })
            .eq('id', userId);

        return subscription;
    } catch (error) {
        console.error('Error creating subscription:', error);
        throw error;
    }
}

export async function cancelSubscription(subscriptionId: string, userId: string) {
    try {
        const subscription = await stripe.subscriptions.cancel(subscriptionId);

        await supabase
            .from('subscriptions')
            .update({
                status: 'canceled',
                canceled_at: new Date().toISOString(),
            })
            .eq('stripe_subscription_id', subscriptionId)
            .eq('user_id', userId);

        await supabase
            .from('users')
            .update({
                subscription_status: 'canceled',
                subscription_tier: 'free',
            })
            .eq('id', userId);

        return subscription;
    } catch (error) {
        console.error('Error canceling subscription:', error);
        throw error;
    }
}

// Utility function to check subscription limits
export async function checkSubscriptionLimits(userId: string) {
    const { data: user } = await supabase
        .from('users')
        .select('subscription_tier, subscription_status')
        .eq('id', userId)
        .single();

    if (!user) throw new Error('User not found');

    const tier = SUBSCRIPTION_TIERS[user.subscription_tier?.toUpperCase() as keyof typeof SUBSCRIPTION_TIERS];
    
    if (!tier) throw new Error('Invalid subscription tier');

    // Get current month's app count
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const { count } = await supabase
        .from('apps')
        .select('id', { count: 'exact' })
        .eq('user_id', userId)
        .gte('created_at', startOfMonth.toISOString());

    return {
        canCreateApp: (count || 0) < tier.maxAppsPerMonth,
        maxFileSize: tier.maxFileSize,
        currentAppsCount: count || 0,
        maxAppsPerMonth: tier.maxAppsPerMonth,
    };
}
