-- Row Level Security (RLS) Policies for Principal Finance
-- CRITICAL: These policies ensure users can only access their household's data

-- ============================================
-- ENABLE RLS ON ALL TABLES
-- ============================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.households ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.household_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.household_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.household_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budget_buckets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bucket_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budget_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investment_holdings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.net_worth_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categorization_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tax_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.category_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ignored_rule_patterns ENABLE ROW LEVEL SECURITY;

-- ============================================
-- HELPER FUNCTION: Get user's household_id
-- ============================================
CREATE OR REPLACE FUNCTION public.get_my_household_id()
RETURNS BIGINT AS $$
    SELECT household_id FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- ============================================
-- HELPER FUNCTION: Check if user is household member
-- ============================================
CREATE OR REPLACE FUNCTION public.is_household_member(check_household_id BIGINT)
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.household_users
        WHERE household_id = check_household_id
        AND user_id = auth.uid()
        AND status = 'active'
    );
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- ============================================
-- PROFILES POLICIES
-- ============================================
CREATE POLICY "Users can view own profile"
    ON public.profiles FOR SELECT
    USING (id = auth.uid());

CREATE POLICY "Users can update own profile"
    ON public.profiles FOR UPDATE
    USING (id = auth.uid());

-- ============================================
-- HOUSEHOLDS POLICIES
-- ============================================
CREATE POLICY "Users can view their household"
    ON public.households FOR SELECT
    USING (id = public.get_my_household_id() OR owner_id = auth.uid());

CREATE POLICY "Users can create households"
    ON public.households FOR INSERT
    WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Owners can update their household"
    ON public.households FOR UPDATE
    USING (owner_id = auth.uid());

-- ============================================
-- HOUSEHOLD USERS POLICIES
-- ============================================
CREATE POLICY "Users can view household members"
    ON public.household_users FOR SELECT
    USING (household_id = public.get_my_household_id());

CREATE POLICY "Owners can manage household users"
    ON public.household_users FOR ALL
    USING (
        household_id IN (
            SELECT id FROM public.households WHERE owner_id = auth.uid()
        )
    );

-- ============================================
-- HOUSEHOLD MEMBERS (Spender Profiles) POLICIES
-- ============================================
CREATE POLICY "Users can view own household members"
    ON public.household_members FOR SELECT
    USING (user_id = auth.uid() OR user_id IN (
        SELECT user_id FROM public.household_users 
        WHERE household_id = public.get_my_household_id()
    ));

CREATE POLICY "Users can manage own household members"
    ON public.household_members FOR ALL
    USING (user_id = auth.uid());

-- ============================================
-- BUDGET BUCKETS POLICIES
-- ============================================
CREATE POLICY "Users can view own buckets"
    ON public.budget_buckets FOR SELECT
    USING (user_id = auth.uid() OR user_id IN (
        SELECT user_id FROM public.household_users 
        WHERE household_id = public.get_my_household_id() AND status = 'active'
    ));

CREATE POLICY "Users can create buckets"
    ON public.budget_buckets FOR INSERT
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own buckets"
    ON public.budget_buckets FOR UPDATE
    USING (user_id = auth.uid());

CREATE POLICY "Users can delete own buckets"
    ON public.budget_buckets FOR DELETE
    USING (user_id = auth.uid());

-- ============================================
-- TRANSACTIONS POLICIES (MOST CRITICAL)
-- ============================================
CREATE POLICY "Users can view household transactions"
    ON public.transactions FOR SELECT
    USING (user_id = auth.uid() OR user_id IN (
        SELECT user_id FROM public.household_users 
        WHERE household_id = public.get_my_household_id() AND status = 'active'
    ));

CREATE POLICY "Users can create transactions"
    ON public.transactions FOR INSERT
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own transactions"
    ON public.transactions FOR UPDATE
    USING (user_id = auth.uid());

CREATE POLICY "Users can delete own transactions"
    ON public.transactions FOR DELETE
    USING (user_id = auth.uid());

-- ============================================
-- ACCOUNTS POLICIES
-- ============================================
CREATE POLICY "Users can view household accounts"
    ON public.accounts FOR SELECT
    USING (user_id = auth.uid() OR user_id IN (
        SELECT user_id FROM public.household_users 
        WHERE household_id = public.get_my_household_id() AND status = 'active'
    ));

CREATE POLICY "Users can manage own accounts"
    ON public.accounts FOR ALL
    USING (user_id = auth.uid());

-- ============================================
-- GOALS POLICIES
-- ============================================
CREATE POLICY "Users can view household goals"
    ON public.goals FOR SELECT
    USING (user_id = auth.uid() OR user_id IN (
        SELECT user_id FROM public.household_users 
        WHERE household_id = public.get_my_household_id() AND status = 'active'
    ));

CREATE POLICY "Users can manage own goals"
    ON public.goals FOR ALL
    USING (user_id = auth.uid());

-- ============================================
-- INVESTMENT HOLDINGS POLICIES
-- ============================================
CREATE POLICY "Users can view household holdings"
    ON public.investment_holdings FOR SELECT
    USING (account_id IN (
        SELECT id FROM public.accounts WHERE user_id = auth.uid()
    ) OR account_id IN (
        SELECT a.id FROM public.accounts a
        JOIN public.household_users hu ON a.user_id = hu.user_id
        WHERE hu.household_id = public.get_my_household_id() AND hu.status = 'active'
    ));

CREATE POLICY "Users can manage own holdings"
    ON public.investment_holdings FOR ALL
    USING (account_id IN (SELECT id FROM public.accounts WHERE user_id = auth.uid()));

-- ============================================
-- NOTIFICATIONS POLICIES
-- ============================================
CREATE POLICY "Users can view own notifications"
    ON public.notifications FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Users can manage own notifications"
    ON public.notifications FOR ALL
    USING (user_id = auth.uid());

-- ============================================
-- SUBSCRIPTIONS POLICIES
-- ============================================
CREATE POLICY "Users can view household subscriptions"
    ON public.subscriptions FOR SELECT
    USING (user_id = auth.uid() OR user_id IN (
        SELECT user_id FROM public.household_users 
        WHERE household_id = public.get_my_household_id() AND status = 'active'
    ));

CREATE POLICY "Users can manage own subscriptions"
    ON public.subscriptions FOR ALL
    USING (user_id = auth.uid());

-- ============================================
-- CATEGORIZATION RULES POLICIES
-- ============================================
CREATE POLICY "Users can view own rules"
    ON public.categorization_rules FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Users can manage own rules"
    ON public.categorization_rules FOR ALL
    USING (user_id = auth.uid());

-- ============================================
-- API KEYS POLICIES
-- ============================================
CREATE POLICY "Users can view own API keys"
    ON public.api_keys FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Users can manage own API keys"
    ON public.api_keys FOR ALL
    USING (user_id = auth.uid());

-- ============================================
-- NET WORTH SNAPSHOTS POLICIES
-- ============================================
CREATE POLICY "Users can view household snapshots"
    ON public.net_worth_snapshots FOR SELECT
    USING (user_id = auth.uid() OR user_id IN (
        SELECT user_id FROM public.household_users 
        WHERE household_id = public.get_my_household_id() AND status = 'active'
    ));

CREATE POLICY "Users can manage own snapshots"
    ON public.net_worth_snapshots FOR ALL
    USING (user_id = auth.uid());

-- ============================================
-- TAGS POLICIES (shared across users)
-- ============================================
CREATE POLICY "Anyone can view tags"
    ON public.tags FOR SELECT
    USING (true);

CREATE POLICY "Authenticated users can create tags"
    ON public.tags FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);

-- ============================================
-- OTHER TABLES: Default user-scoped policies
-- ============================================

-- Tax Settings
CREATE POLICY "Users can manage own tax settings"
    ON public.tax_settings FOR ALL
    USING (user_id = auth.uid());

-- Notification Settings
CREATE POLICY "Users can manage own notification settings"
    ON public.notification_settings FOR ALL
    USING (user_id = auth.uid());

-- Category Goals
CREATE POLICY "Users can manage own category goals"
    ON public.category_goals FOR ALL
    USING (user_id = auth.uid());

-- Budget Limits
CREATE POLICY "Users can view household budget limits"
    ON public.budget_limits FOR SELECT
    USING (bucket_id IN (
        SELECT id FROM public.budget_buckets WHERE user_id = auth.uid()
    ));

CREATE POLICY "Users can manage own budget limits"
    ON public.budget_limits FOR ALL
    USING (bucket_id IN (SELECT id FROM public.budget_buckets WHERE user_id = auth.uid()));

-- Account Balances
CREATE POLICY "Users can view household account balances"
    ON public.account_balances FOR SELECT
    USING (snapshot_id IN (
        SELECT id FROM public.net_worth_snapshots WHERE user_id = auth.uid()
    ) OR snapshot_id IN (
        SELECT nws.id FROM public.net_worth_snapshots nws
        JOIN public.household_users hu ON nws.user_id = hu.user_id
        WHERE hu.household_id = public.get_my_household_id() AND hu.status = 'active'
    ));

CREATE POLICY "Users can manage own account balances"
    ON public.account_balances FOR ALL
    USING (snapshot_id IN (SELECT id FROM public.net_worth_snapshots WHERE user_id = auth.uid()));

-- Ignored Rule Patterns
CREATE POLICY "Users can manage own ignored patterns"
    ON public.ignored_rule_patterns FOR ALL
    USING (user_id = auth.uid());

-- Household Invites
CREATE POLICY "Users can view invites for their household"
    ON public.household_invites FOR SELECT
    USING (household_id = public.get_my_household_id());

CREATE POLICY "Household owners can manage invites"
    ON public.household_invites FOR ALL
    USING (invited_by_id = auth.uid());

-- Bucket Tags
CREATE POLICY "Users can view bucket tags for own buckets"
    ON public.bucket_tags FOR SELECT
    USING (bucket_id IN (SELECT id FROM public.budget_buckets WHERE user_id = auth.uid()));

CREATE POLICY "Users can manage bucket tags for own buckets"
    ON public.bucket_tags FOR ALL
    USING (bucket_id IN (SELECT id FROM public.budget_buckets WHERE user_id = auth.uid()));
