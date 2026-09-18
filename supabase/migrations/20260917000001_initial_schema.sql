-- ==============================================================================
-- iLock Database Schema Migration: 20260917000001_initial_schema.sql
-- Production-Ready Schema for Remote PC Access & Temporary Authorization
-- ==============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- 1. Profiles Table (Linked with Supabase auth.users)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT,
    avatar_url TEXT,
    mfa_enabled BOOLEAN DEFAULT FALSE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

-- ==============================================================================
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'device_status_type') THEN
        CREATE TYPE device_status_type AS ENUM ('online', 'offline', 'connecting', 'auth_failed', 'outdated', 'revoked');
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    device_name TEXT NOT NULL,
    device_uuid TEXT NOT NULL UNIQUE,
    platform TEXT DEFAULT 'windows' NOT NULL,
    hostname TEXT,
    os_version TEXT,
    agent_version TEXT DEFAULT '1.0.0' NOT NULL,
    public_key TEXT NOT NULL, -- Asymmetric public key (PEM / Base64 SPKI)
    public_key_algorithm TEXT DEFAULT 'RSA-4096' NOT NULL,
    last_seen TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
    status device_status_type DEFAULT 'offline' NOT NULL,
    is_trusted BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

-- Indexes for devices
CREATE INDEX IF NOT EXISTS idx_devices_owner_id ON public.devices(owner_id);
CREATE INDEX IF NOT EXISTS idx_devices_device_uuid ON public.devices(device_uuid);
CREATE INDEX IF NOT EXISTS idx_devices_status ON public.devices(status);

-- ==============================================================================
-- 3. Device Credentials Table (Hashed tokens/challenge nonces for Agent auth)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.device_credentials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id UUID NOT NULL REFERENCES public.devices(id) ON DELETE CASCADE,
    hashed_auth_token TEXT NOT NULL,
    current_challenge_nonce TEXT,
    challenge_expires_at TIMESTAMPTZ,
    last_authenticated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
    CONSTRAINT uq_device_credential_device UNIQUE (device_id)
);

-- ==============================================================================
-- 4. Pairing Requests Table (Short-lived, single-use registration codes)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.pairing_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    pairing_code_hash TEXT NOT NULL, -- SHA-256 hash of the 8-character uppercase code
    device_name TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    is_used BOOLEAN DEFAULT FALSE NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_pairing_requests_code_hash ON public.pairing_requests(pairing_code_hash);
CREATE INDEX IF NOT EXISTS idx_pairing_requests_owner_id ON public.pairing_requests(owner_id);

-- ==============================================================================
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'access_session_status') THEN
        CREATE TYPE access_session_status AS ENUM (
            'PENDING',
            'AUTHORIZED',
            'ACTIVE',
            'EXPIRING',
            'EXPIRED',
            'REVOKED',
            'FAILED'
        );
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.access_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id UUID NOT NULL REFERENCES public.devices(id) ON DELETE CASCADE,
    owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    session_type TEXT DEFAULT 'temporary_access' NOT NULL,
    status access_session_status DEFAULT 'PENDING' NOT NULL,
    duration_minutes INTEGER NOT NULL CHECK (duration_minutes > 0 AND duration_minutes <= 1440),
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
    authorized_at TIMESTAMPTZ,
    activated_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    revoked_by UUID REFERENCES public.profiles(id),
    created_by UUID NOT NULL REFERENCES public.profiles(id),
    failure_reason TEXT,
    metadata JSONB DEFAULT '{}'::jsonb NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_access_sessions_device_id ON public.access_sessions(device_id);
CREATE INDEX IF NOT EXISTS idx_access_sessions_owner_id ON public.access_sessions(owner_id);
CREATE INDEX IF NOT EXISTS idx_access_sessions_status ON public.access_sessions(status);
CREATE INDEX IF NOT EXISTS idx_access_sessions_expires_at ON public.access_sessions(expires_at);

-- ==============================================================================
-- 6. Authorization Requests Table (Outbound command queue & tracking)
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'authorization_command_type') THEN
        CREATE TYPE authorization_command_type AS ENUM (
            'DEVICE_PING',
            'GET_DEVICE_STATUS',
            'CREATE_ACCESS_SESSION',
            'REVOKE_ACCESS_SESSION',
            'GET_ACTIVE_SESSIONS',
            'LOCK_REQUEST',
            'HEARTBEAT'
        );
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.authorization_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id UUID NOT NULL REFERENCES public.devices(id) ON DELETE CASCADE,
    session_id UUID REFERENCES public.access_sessions(id) ON DELETE SET NULL,
    command_type authorization_command_type NOT NULL,
    nonce TEXT NOT NULL UNIQUE,
    payload JSONB DEFAULT '{}'::jsonb NOT NULL,
    signature TEXT, -- Cloud signed hash
    is_dispatched BOOLEAN DEFAULT FALSE NOT NULL,
    dispatched_at TIMESTAMPTZ,
    is_acknowledged BOOLEAN DEFAULT FALSE NOT NULL,
    acknowledged_at TIMESTAMPTZ,
    result_status TEXT,
    result_error TEXT,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_auth_requests_device_id ON public.authorization_requests(device_id);
CREATE INDEX IF NOT EXISTS idx_auth_requests_nonce ON public.authorization_requests(nonce);

-- ==============================================================================
-- 7. Device Status Table (Detailed real-time telemetry)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.device_status (
    device_id UUID PRIMARY KEY REFERENCES public.devices(id) ON DELETE CASCADE,
    ip_hash TEXT, -- Privacy preserving hash of the public outbound IP
    cpu_usage_pct REAL,
    memory_usage_pct REAL,
    battery_pct REAL,
    is_charging BOOLEAN,
    active_user TEXT,
    workstation_locked BOOLEAN DEFAULT TRUE NOT NULL,
    last_heartbeat TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
    consecutive_failed_heartbeats INTEGER DEFAULT 0 NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

-- ==============================================================================
-- 8. Audit Logs Table (Append-only immutable audit trail)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    device_id UUID REFERENCES public.devices(id) ON DELETE SET NULL,
    event_type TEXT NOT NULL,
    timestamp TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
    ip_hash TEXT,
    user_agent TEXT,
    success BOOLEAN DEFAULT TRUE NOT NULL,
    reason TEXT,
    details JSONB DEFAULT '{}'::jsonb NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_device_id ON public.audit_logs(device_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON public.audit_logs(timestamp DESC);

-- ==============================================================================
-- 9. Security Events Table (High-priority alert triggers)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.security_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id UUID REFERENCES public.devices(id) ON DELETE SET NULL,
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    event_type TEXT NOT NULL,
    severity TEXT DEFAULT 'warning' NOT NULL, -- info, warning, critical
    details JSONB DEFAULT '{}'::jsonb NOT NULL,
    timestamp TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_security_events_severity ON public.security_events(severity);
CREATE INDEX IF NOT EXISTS idx_security_events_timestamp ON public.security_events(timestamp DESC);

-- ==============================================================================
-- 10. Automatic Timestamp Trigger
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc', NOW());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS update_devices_updated_at ON public.devices;
CREATE TRIGGER update_devices_updated_at BEFORE UPDATE ON public.devices FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS update_access_sessions_updated_at ON public.access_sessions;
CREATE TRIGGER update_access_sessions_updated_at BEFORE UPDATE ON public.access_sessions FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS update_device_status_updated_at ON public.device_status;
CREATE TRIGGER update_device_status_updated_at BEFORE UPDATE ON public.device_status FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ==============================================================================
-- 11. Profile Creation Trigger on Auth Signup
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, avatar_url)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
        NEW.raw_user_meta_data->>'avatar_url'
    )
    ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger only if auth.users exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'auth' AND tablename = 'users') THEN
        DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
        CREATE TRIGGER on_auth_user_created
            AFTER INSERT ON auth.users
            FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
    END IF;
END $$;

-- ==============================================================================
-- 12. Automated State Transitions: Expiration Function
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.expire_stale_access_sessions()
RETURNS INTEGER AS $$
DECLARE
    expired_count INTEGER := 0;
BEGIN
    -- Transition ACTIVE or EXPIRING to EXPIRED if now >= expires_at
    WITH updated AS (
        UPDATE public.access_sessions
        SET status = 'EXPIRED',
            updated_at = TIMEZONE('utc', NOW())
        WHERE status IN ('ACTIVE', 'EXPIRING', 'AUTHORIZED', 'PENDING')
          AND expires_at <= TIMEZONE('utc', NOW())
        RETURNING id, device_id, owner_id
    )
    SELECT COUNT(*) INTO expired_count FROM updated;

    -- Update active sessions to EXPIRING if within 5 minutes of expiration
    UPDATE public.access_sessions
    SET status = 'EXPIRING',
        updated_at = TIMEZONE('utc', NOW())
    WHERE status = 'ACTIVE'
      AND expires_at > TIMEZONE('utc', NOW())
      AND expires_at <= (TIMEZONE('utc', NOW()) + INTERVAL '5 minutes');

    RETURN expired_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================================================
-- 13. ROW LEVEL SECURITY (RLS) POLICIES
-- Strict Isolation: Users can ONLY access records belonging to them
-- ==============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pairing_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.access_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.authorization_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;

-- Profiles: Users view/update their own profile
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Devices: Users view, update, delete their own devices
DROP POLICY IF EXISTS "Users can view own devices" ON public.devices;
CREATE POLICY "Users can view own devices" ON public.devices FOR SELECT USING (auth.uid() = owner_id);
DROP POLICY IF EXISTS "Users can insert own devices" ON public.devices;
CREATE POLICY "Users can insert own devices" ON public.devices FOR INSERT WITH CHECK (auth.uid() = owner_id);
DROP POLICY IF EXISTS "Users can update own devices" ON public.devices;
CREATE POLICY "Users can update own devices" ON public.devices FOR UPDATE USING (auth.uid() = owner_id);
DROP POLICY IF EXISTS "Users can delete own devices" ON public.devices;
CREATE POLICY "Users can delete own devices" ON public.devices FOR DELETE USING (auth.uid() = owner_id);

-- Device Credentials: Users cannot view raw credentials directly; server-side functions only
DROP POLICY IF EXISTS "Device credentials restricted to service role" ON public.device_credentials;
CREATE POLICY "Device credentials restricted to service role" ON public.device_credentials FOR ALL USING (false);

-- Pairing Requests: Users manage their own pairing requests
DROP POLICY IF EXISTS "Users can view own pairing requests" ON public.pairing_requests;
CREATE POLICY "Users can view own pairing requests" ON public.pairing_requests FOR SELECT USING (auth.uid() = owner_id);
DROP POLICY IF EXISTS "Users can create own pairing requests" ON public.pairing_requests;
CREATE POLICY "Users can create own pairing requests" ON public.pairing_requests FOR INSERT WITH CHECK (auth.uid() = owner_id);
DROP POLICY IF EXISTS "Users can update own pairing requests" ON public.pairing_requests;
CREATE POLICY "Users can update own pairing requests" ON public.pairing_requests FOR UPDATE USING (auth.uid() = owner_id);

-- Access Sessions: Users manage access sessions for their own devices
DROP POLICY IF EXISTS "Users can view own access sessions" ON public.access_sessions;
CREATE POLICY "Users can view own access sessions" ON public.access_sessions FOR SELECT USING (auth.uid() = owner_id);
DROP POLICY IF EXISTS "Users can create own access sessions" ON public.access_sessions;
CREATE POLICY "Users can create own access sessions" ON public.access_sessions FOR INSERT WITH CHECK (auth.uid() = owner_id);
DROP POLICY IF EXISTS "Users can update own access sessions" ON public.access_sessions;
CREATE POLICY "Users can update own access sessions" ON public.access_sessions FOR UPDATE USING (auth.uid() = owner_id);

-- Authorization Requests: Owners can view command history for their devices
DROP POLICY IF EXISTS "Users can view commands for their devices" ON public.authorization_requests;
CREATE POLICY "Users can view commands for their devices" ON public.authorization_requests FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.devices WHERE id = device_id AND owner_id = auth.uid())
);

-- Device Status: Users can view status of their own devices
DROP POLICY IF EXISTS "Users can view own device status" ON public.device_status;
CREATE POLICY "Users can view own device status" ON public.device_status FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.devices WHERE id = device_id AND owner_id = auth.uid())
);

-- Audit Logs: Users can view their own audit logs
DROP POLICY IF EXISTS "Users can view own audit logs" ON public.audit_logs;
CREATE POLICY "Users can view own audit logs" ON public.audit_logs FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "System can insert audit logs" ON public.audit_logs;
CREATE POLICY "System can insert audit logs" ON public.audit_logs FOR INSERT WITH CHECK (true);

-- Security Events: Users can view security events for their devices
DROP POLICY IF EXISTS "Users can view own security events" ON public.security_events;
CREATE POLICY "Users can view own security events" ON public.security_events FOR SELECT USING (
    auth.uid() = user_id OR EXISTS (SELECT 1 FROM public.devices WHERE id = device_id AND owner_id = auth.uid())
);
