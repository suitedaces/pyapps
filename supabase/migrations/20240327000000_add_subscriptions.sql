-- Add subscription-related columns to users table
ALTER TABLE users
ADD COLUMN stripe_customer_id TEXT,
ADD COLUMN subscription_tier TEXT CHECK (subscription_tier IN ('free', 'pro')),
ADD COLUMN subscription_status TEXT CHECK (subscription_status IN ('active', 'canceled', 'past_due', 'trialing')),
ADD COLUMN current_period_end TIMESTAMP WITH TIME ZONE,
ADD COLUMN is_in_trial BOOLEAN DEFAULT FALSE,
ADD COLUMN trial_end TIMESTAMP WITH TIME ZONE;

-- Create subscriptions table
CREATE TABLE subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    stripe_subscription_id TEXT NOT NULL,
    stripe_price_id TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('active', 'canceled', 'past_due', 'trialing')),
    current_period_start TIMESTAMP WITH TIME ZONE NOT NULL,
    current_period_end TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    canceled_at TIMESTAMP WITH TIME ZONE,
    is_trialing BOOLEAN DEFAULT FALSE,
    trial_end TIMESTAMP WITH TIME ZONE,
    UNIQUE(stripe_subscription_id)
);

-- Create index for faster lookups
CREATE INDEX idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_stripe_subscription_id ON subscriptions(stripe_subscription_id);

-- Set default subscription tier for existing users
UPDATE users SET subscription_tier = 'free', subscription_status = 'active' WHERE subscription_tier IS NULL; 
