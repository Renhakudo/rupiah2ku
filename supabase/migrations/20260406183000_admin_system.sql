-- Migration: Admin System, User Management & Smart Logging

-- 1. Modify Profiles to support Active/Inactive and Roles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

-- Update RLS so Admins can manage profiles
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" 
ON public.profiles FOR UPDATE 
USING (auth.uid() = id);

CREATE POLICY "Admins can update all profiles" 
ON public.profiles FOR UPDATE 
USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

-- 2. Wallet Access Table (Many-to-Many Shared Wallets)
CREATE TABLE IF NOT EXISTS public.wallet_access (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_id UUID NOT NULL REFERENCES public.wallets(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    access_level TEXT NOT NULL CHECK (access_level IN ('viewer', 'editor')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(wallet_id, user_id)
);

ALTER TABLE public.wallet_access ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins have full access to wallet_access" 
ON public.wallet_access FOR ALL 
USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));

CREATE POLICY "Users can view their own wallet access" 
ON public.wallet_access FOR SELECT 
USING (user_id = auth.uid());

CREATE POLICY "Wallet owners can manage access" 
ON public.wallet_access FOR ALL 
USING (
  EXISTS (SELECT 1 FROM public.wallets WHERE id = wallet_access.wallet_id AND user_id = auth.uid())
);

-- 3. Activity Logs Table
CREATE TABLE IF NOT EXISTS public.activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    action_type TEXT NOT NULL,          -- e.g., 'CREATE_TRANSACTION', 'DELETE_BUDGET', 'ROLE_CHANGE'
    entity_type TEXT NOT NULL,          -- e.g., 'transaction', 'profile', 'wallet'
    entity_id UUID,                     -- Reference ID
    details JSONB,                      -- Extra metadata (amounts, names)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- Admins can view all logs
CREATE POLICY "Admins can view all activity logs" 
ON public.activity_logs FOR SELECT 
USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));

-- Users can view their own logs
CREATE POLICY "Users can view own logs" 
ON public.activity_logs FOR SELECT 
USING (user_id = auth.uid());

-- Prevent frontend from manually updating/deleting logs
CREATE POLICY "No manual insert to logs" ON public.activity_logs FOR INSERT WITH CHECK (false);

-- 4. Smart Trigger Functions
-- A. Logging Transactions
CREATE OR REPLACE FUNCTION log_transaction_activity()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        INSERT INTO public.activity_logs(user_id, action_type, entity_type, entity_id, details)
        VALUES (auth.uid(), 'CREATE_TRANSACTION', 'transaction', NEW.id, 
                jsonb_build_object('type', NEW.type, 'amount', NEW.amount, 'wallet_id', NEW.wallet_id));
    ELSIF (TG_OP = 'UPDATE') THEN
        INSERT INTO public.activity_logs(user_id, action_type, entity_type, entity_id, details)
        VALUES (auth.uid(), 'UPDATE_TRANSACTION', 'transaction', NEW.id, 
                jsonb_build_object('type', NEW.type, 'amount', NEW.amount));
    ELSIF (TG_OP = 'DELETE') THEN
        INSERT INTO public.activity_logs(user_id, action_type, entity_type, entity_id, details)
        VALUES (auth.uid(), 'DELETE_TRANSACTION', 'transaction', OLD.id, 
                jsonb_build_object('old_amount', OLD.amount));
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS transaction_activity_trigger ON public.transactions;
CREATE TRIGGER transaction_activity_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.transactions
FOR EACH ROW EXECUTE FUNCTION log_transaction_activity();

-- B. Logging Wallets
CREATE OR REPLACE FUNCTION log_wallet_activity()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        INSERT INTO public.activity_logs(user_id, action_type, entity_type, entity_id, details)
        VALUES (auth.uid(), 'CREATE_WALLET', 'wallet', NEW.id, jsonb_build_object('name', NEW.name));
    ELSIF (TG_OP = 'DELETE') THEN
        INSERT INTO public.activity_logs(user_id, action_type, entity_type, entity_id, details)
        VALUES (auth.uid(), 'DELETE_WALLET', 'wallet', OLD.id, jsonb_build_object('name', OLD.name));
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS wallet_activity_trigger ON public.wallets;
CREATE TRIGGER wallet_activity_trigger
AFTER INSERT OR DELETE ON public.wallets
FOR EACH ROW EXECUTE FUNCTION log_wallet_activity();

-- C. Logging Admin Actions (Tracking Profile Status Changes)
CREATE OR REPLACE FUNCTION log_profile_changes()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'UPDATE' AND OLD.is_active IS DISTINCT FROM NEW.is_active) THEN
        INSERT INTO public.activity_logs(user_id, action_type, entity_type, entity_id, details)
        VALUES (
            auth.uid(), 
            CASE WHEN NEW.is_active THEN 'ACTIVATE_USER' ELSE 'SUSPEND_USER' END, 
            'profile', 
            NEW.id, 
            jsonb_build_object('target_user_id', NEW.id)
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS profile_changes_trigger ON public.profiles;
CREATE TRIGGER profile_changes_trigger
AFTER UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION log_profile_changes();

-- 5. Helper Function: Global Statistics (To assist Frontend Admin Panel without heavy querying)
CREATE OR REPLACE FUNCTION get_admin_system_stats()
RETURNS JSONB AS $$
DECLARE
    total_users INT;
    active_users INT;
    total_tx INT;
    total_wallets INT;
BEGIN
    SELECT count(*) INTO total_users FROM public.profiles;
    SELECT count(*) INTO active_users FROM public.profiles WHERE is_active = true;
    SELECT count(*) INTO total_tx FROM public.transactions;
    SELECT count(*) INTO total_wallets FROM public.wallets;
    
    RETURN jsonb_build_object(
        'total_users', total_users,
        'active_users', active_users,
        'total_transactions', total_tx,
        'total_wallets', total_wallets
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
