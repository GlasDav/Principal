-- Supabase Schema Migration: Initial Setup
-- Converted from backend/models.py (27+ SQLAlchemy models)
-- This migration creates all tables needed for Principal Finance

-- ============================================
-- EXTENSIONS
-- ============================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- CUSTOM TYPES (optional, for future use)
-- ============================================
-- Note: We'll use TEXT with constraints instead of enums for flexibility

-- ============================================
-- PROFILES (extends auth.users)
-- ============================================
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    name TEXT,
    currency_symbol TEXT DEFAULT 'AUD',
    is_email_verified BOOLEAN DEFAULT FALSE,
    household_id BIGINT,  -- FK added after households table
    mfa_enabled BOOLEAN DEFAULT FALSE,
    mfa_secret TEXT,
    mfa_backup_codes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- HOUSEHOLDS (Family Sharing)
-- ============================================
CREATE TABLE IF NOT EXISTS public.households (
    id BIGSERIAL PRIMARY KEY,
    name TEXT DEFAULT 'My Household',
    owner_id UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add FK from profiles to households
ALTER TABLE public.profiles 
ADD CONSTRAINT fk_profile_household 
FOREIGN KEY (household_id) REFERENCES public.households(id);

-- ============================================
-- HOUSEHOLD MEMBERS (Spender Profiles)
-- ============================================
CREATE TABLE IF NOT EXISTS public.household_members (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    color TEXT DEFAULT '#6366f1',
    avatar TEXT DEFAULT 'User',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- HOUSEHOLD USERS (Membership Junction)
-- ============================================
CREATE TABLE IF NOT EXISTS public.household_users (
    id BIGSERIAL PRIMARY KEY,
    household_id BIGINT REFERENCES public.households(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    member_id BIGINT REFERENCES public.household_members(id),
    role TEXT DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'pending', 'invited')),
    invited_at TIMESTAMPTZ DEFAULT NOW(),
    joined_at TIMESTAMPTZ,
    UNIQUE(household_id, user_id)
);

-- ============================================
-- HOUSEHOLD INVITES
-- ============================================
CREATE TABLE IF NOT EXISTS public.household_invites (
    id BIGSERIAL PRIMARY KEY,
    household_id BIGINT REFERENCES public.households(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    token_hash TEXT UNIQUE NOT NULL,
    role TEXT DEFAULT 'member',
    expires_at TIMESTAMPTZ NOT NULL,
    accepted_at TIMESTAMPTZ,
    invited_by_id UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_household_invites_email ON public.household_invites(email);

-- ============================================
-- TAGS
-- ============================================
CREATE TABLE IF NOT EXISTS public.tags (
    id BIGSERIAL PRIMARY KEY,
    name TEXT UNIQUE NOT NULL
);

-- ============================================
-- BUDGET BUCKETS (Categories)
-- ============================================
CREATE TABLE IF NOT EXISTS public.budget_buckets (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    icon_name TEXT DEFAULT 'Wallet',
    is_shared BOOLEAN DEFAULT FALSE,
    is_rollover BOOLEAN DEFAULT FALSE,
    is_transfer BOOLEAN DEFAULT FALSE,
    is_investment BOOLEAN DEFAULT FALSE,
    is_hidden BOOLEAN DEFAULT FALSE,
    is_one_off BOOLEAN DEFAULT FALSE,
    is_group_budget BOOLEAN DEFAULT FALSE,
    "group" TEXT DEFAULT 'Discretionary' CHECK ("group" IN ('Discretionary', 'Non-Discretionary')),
    parent_id BIGINT REFERENCES public.budget_buckets(id),
    display_order INTEGER DEFAULT 0,
    target_amount REAL,
    target_date DATE
);

CREATE INDEX idx_budget_buckets_user ON public.budget_buckets(user_id);
CREATE INDEX idx_budget_buckets_name ON public.budget_buckets(name);

-- ============================================
-- BUCKET TAGS (Many-to-Many Junction)
-- ============================================
CREATE TABLE IF NOT EXISTS public.bucket_tags (
    bucket_id BIGINT REFERENCES public.budget_buckets(id) ON DELETE CASCADE,
    tag_id BIGINT REFERENCES public.tags(id) ON DELETE CASCADE,
    PRIMARY KEY (bucket_id, tag_id)
);

-- ============================================
-- BUDGET LIMITS (Per-Member Limits)
-- ============================================
CREATE TABLE IF NOT EXISTS public.budget_limits (
    id BIGSERIAL PRIMARY KEY,
    bucket_id BIGINT REFERENCES public.budget_buckets(id) ON DELETE CASCADE,
    member_id BIGINT REFERENCES public.household_members(id),  -- NULL = shared
    amount REAL DEFAULT 0.0
);

-- ============================================
-- ACCOUNTS (Bank/Investment/Liability)
-- ============================================
CREATE TABLE IF NOT EXISTS public.accounts (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('Asset', 'Liability')),
    category TEXT,
    balance REAL DEFAULT 0.0,
    is_active BOOLEAN DEFAULT TRUE,
    connection_id TEXT,
    target_balance REAL,
    target_date DATE
);

CREATE INDEX idx_accounts_user ON public.accounts(user_id);
CREATE INDEX idx_accounts_name ON public.accounts(name);

-- ============================================
-- GOALS
-- ============================================
CREATE TABLE IF NOT EXISTS public.goals (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    target_amount REAL NOT NULL,
    target_date DATE,
    linked_account_id BIGINT REFERENCES public.accounts(id)
);

CREATE INDEX idx_goals_user ON public.goals(user_id);
CREATE INDEX idx_goals_name ON public.goals(name);

-- ============================================
-- TRANSACTIONS
-- ============================================
CREATE TABLE IF NOT EXISTS public.transactions (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    date TIMESTAMPTZ NOT NULL,
    description TEXT,
    raw_description TEXT,
    amount REAL NOT NULL,
    category_confidence REAL DEFAULT 0.0,
    is_verified BOOLEAN DEFAULT FALSE,
    bucket_id BIGINT REFERENCES public.budget_buckets(id),
    parent_transaction_id BIGINT REFERENCES public.transactions(id),
    spender TEXT DEFAULT 'Joint',
    goal_id BIGINT REFERENCES public.goals(id),
    account_id BIGINT REFERENCES public.accounts(id),
    external_id TEXT UNIQUE,
    transaction_hash TEXT,
    assigned_to TEXT,
    tags TEXT,
    notes TEXT
);

CREATE INDEX idx_transactions_user ON public.transactions(user_id);
CREATE INDEX idx_transactions_date ON public.transactions(date);
CREATE INDEX idx_transactions_hash ON public.transactions(transaction_hash);

-- ============================================
-- INVESTMENT HOLDINGS
-- ============================================
CREATE TABLE IF NOT EXISTS public.investment_holdings (
    id BIGSERIAL PRIMARY KEY,
    account_id BIGINT REFERENCES public.accounts(id) ON DELETE CASCADE,
    ticker TEXT NOT NULL,
    name TEXT,
    quantity REAL NOT NULL,
    price REAL,
    cost_basis REAL,
    currency TEXT DEFAULT 'USD',
    exchange_rate REAL DEFAULT 1.0,
    value REAL,
    asset_type TEXT DEFAULT 'Stock',
    sector TEXT
);

-- ============================================
-- NET WORTH SNAPSHOTS
-- ============================================
CREATE TABLE IF NOT EXISTS public.net_worth_snapshots (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    total_assets REAL NOT NULL,
    total_liabilities REAL NOT NULL,
    net_worth REAL NOT NULL
);

CREATE INDEX idx_net_worth_user ON public.net_worth_snapshots(user_id);
CREATE INDEX idx_net_worth_date ON public.net_worth_snapshots(date);

-- ============================================
-- ACCOUNT BALANCES (Snapshot Details)
-- ============================================
CREATE TABLE IF NOT EXISTS public.account_balances (
    snapshot_id BIGINT REFERENCES public.net_worth_snapshots(id) ON DELETE CASCADE,
    account_id BIGINT REFERENCES public.accounts(id) ON DELETE CASCADE,
    balance REAL NOT NULL,
    PRIMARY KEY (snapshot_id, account_id)
);

-- ============================================
-- CATEGORIZATION RULES
-- ============================================
CREATE TABLE IF NOT EXISTS public.categorization_rules (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    bucket_id BIGINT REFERENCES public.budget_buckets(id),
    keywords TEXT NOT NULL,
    priority INTEGER DEFAULT 0,
    min_amount REAL,
    max_amount REAL,
    apply_tags TEXT,
    mark_for_review BOOLEAN DEFAULT FALSE,
    assign_to TEXT
);

-- ============================================
-- SUBSCRIPTIONS
-- ============================================
CREATE TABLE IF NOT EXISTS public.subscriptions (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    amount REAL NOT NULL,
    type TEXT DEFAULT 'Expense' CHECK (type IN ('Expense', 'Income')),
    frequency TEXT NOT NULL,
    next_due_date DATE NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    description_keyword TEXT,
    bucket_id BIGINT REFERENCES public.budget_buckets(id),
    parent_id BIGINT REFERENCES public.subscriptions(id)
);

-- ============================================
-- TAX SETTINGS
-- ============================================
CREATE TABLE IF NOT EXISTS public.tax_settings (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE UNIQUE,
    filing_status TEXT DEFAULT 'Resident',
    use_standard_deduction BOOLEAN DEFAULT FALSE,
    custom_deduction REAL DEFAULT 0.0,
    state TEXT DEFAULT 'VIC'
);

-- ============================================
-- NOTIFICATIONS
-- ============================================
CREATE TABLE IF NOT EXISTS public.notifications (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    meta_data TEXT
);

-- ============================================
-- NOTIFICATION SETTINGS
-- ============================================
CREATE TABLE IF NOT EXISTS public.notification_settings (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE UNIQUE,
    budget_alerts BOOLEAN DEFAULT TRUE,
    bill_reminders BOOLEAN DEFAULT TRUE,
    goal_milestones BOOLEAN DEFAULT TRUE,
    bill_reminder_days INTEGER DEFAULT 3
);

-- ============================================
-- CATEGORY GOALS
-- ============================================
CREATE TABLE IF NOT EXISTS public.category_goals (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    bucket_id BIGINT REFERENCES public.budget_buckets(id),
    target_amount REAL,
    start_date DATE DEFAULT CURRENT_DATE
);

-- ============================================
-- API KEYS
-- ============================================
CREATE TABLE IF NOT EXISTS public.api_keys (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    key_prefix TEXT NOT NULL,
    key_hash TEXT UNIQUE NOT NULL,
    scopes TEXT DEFAULT 'read',
    is_active BOOLEAN DEFAULT TRUE,
    expires_at TIMESTAMPTZ,
    last_used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    rate_limit_requests INTEGER DEFAULT 1000,
    rate_limit_remaining INTEGER DEFAULT 1000,
    rate_limit_reset_at TIMESTAMPTZ
);

CREATE INDEX idx_api_keys_prefix ON public.api_keys(key_prefix);
CREATE INDEX idx_api_keys_hash ON public.api_keys(key_hash);

-- ============================================
-- IGNORED RULE PATTERNS
-- ============================================
CREATE TABLE IF NOT EXISTS public.ignored_rule_patterns (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    keyword TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ignored_patterns_keyword ON public.ignored_rule_patterns(keyword);

-- ============================================
-- PASSWORD RESET TOKENS (may not be needed with Supabase Auth)
-- ============================================
CREATE TABLE IF NOT EXISTS public.password_reset_tokens (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_password_reset_hash ON public.password_reset_tokens(token_hash);

-- ============================================
-- EMAIL VERIFICATION TOKENS (may not be needed with Supabase Auth)
-- ============================================
CREATE TABLE IF NOT EXISTS public.email_verification_tokens (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_email_verification_hash ON public.email_verification_tokens(token_hash);

-- ============================================
-- TRIGGER: Auto-create profile on user signup
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email)
    VALUES (NEW.id, NEW.email);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
