-- ==============================================================================
-- iLock Database Seed Data
-- Useful for testing local Supabase environments and demo validation
-- ==============================================================================

-- Demo User Profile (Mock Supabase Auth User)
-- In production, Supabase Auth handles user record creation in auth.users
DO $$
DECLARE
    demo_user_id UUID := 'a0000000-0000-0000-0000-000000000001';
    demo_device_id UUID := 'b0000000-0000-0000-0000-000000000001';
    demo_device_2_id UUID := 'b0000000-0000-0000-0000-000000000002';
BEGIN
    -- Check if auth.users table is available (when running inside Supabase runtime)
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'auth' AND tablename = 'users') THEN
        INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
        VALUES (
            demo_user_id,
            'demo@ilock.security',
            crypt('SecurePassword123!', gen_salt('bf')),
            NOW(),
            '{"provider":"email","providers":["email"]}',
            '{"full_name":"Vidarbh"}',
            NOW(),
            NOW()
        ) ON CONFLICT (id) DO NOTHING;
    END IF;

    -- Insert Demo Profile
    INSERT INTO public.profiles (id, email, full_name, mfa_enabled, created_at)
    VALUES (
        demo_user_id,
        'demo@ilock.security',
        'Vidarbh (Owner)',
        false,
        NOW() - INTERVAL '7 days'
    ) ON CONFLICT (id) DO NOTHING;

    -- Insert Demo Devices
    -- Device 1: OMEN 16 (Online)
    INSERT INTO public.devices (
        id, owner_id, device_name, device_uuid, platform, hostname, os_version,
        agent_version, public_key, public_key_algorithm, last_seen, status, is_trusted
    ) VALUES (
        demo_device_id,
        demo_user_id,
        'Vidarbh''s OMEN 16',
        'omen-16-win11-prod-001',
        'windows',
        'OMEN-16-PRO',
        'Windows 11 Pro 23H2 (Build 22631.3007)',
        '1.2.0',
        '-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAyN6K71DemoPublicKey\n-----END PUBLIC KEY-----',
        'RSA-4096',
        NOW(),
        'online',
        true
    ) ON CONFLICT (id) DO NOTHING;

    -- Device 2: ThinkPad X1 (Offline)
    INSERT INTO public.devices (
        id, owner_id, device_name, device_uuid, platform, hostname, os_version,
        agent_version, public_key, public_key_algorithm, last_seen, status, is_trusted
    ) VALUES (
        demo_device_2_id,
        demo_user_id,
        'Workstation ThinkPad X1',
        'thinkpad-x1-win11-002',
        'windows',
        'THINKPAD-X1',
        'Windows 11 Enterprise 22H2',
        '1.1.8',
        '-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAzXDemoKey2\n-----END PUBLIC KEY-----',
        'RSA-4096',
        NOW() - INTERVAL '2 hours',
        'offline',
        true
    ) ON CONFLICT (id) DO NOTHING;

    -- Device Status Telemetry
    INSERT INTO public.device_status (
        device_id, ip_hash, cpu_usage_pct, memory_usage_pct, battery_pct,
        is_charging, active_user, workstation_locked, last_heartbeat
    ) VALUES (
        demo_device_id,
        encode(digest('192.168.1.100', 'sha256'), 'hex'),
        14.2,
        46.8,
        88.0,
        true,
        'vidarbh',
        true,
        NOW()
    ) ON CONFLICT (device_id) DO NOTHING;

    -- Seed Access Session (Past Expired Session)
    INSERT INTO public.access_sessions (
        id, device_id, owner_id, session_type, status, duration_minutes,
        created_at, authorized_at, activated_at, expires_at, created_by
    ) VALUES (
        gen_random_uuid(),
        demo_device_id,
        demo_user_id,
        'temporary_access',
        'EXPIRED',
        30,
        NOW() - INTERVAL '90 minutes',
        NOW() - INTERVAL '90 minutes',
        NOW() - INTERVAL '89 minutes',
        NOW() - INTERVAL '60 minutes',
        demo_user_id
    );

    -- Seed Audit Logs
    INSERT INTO public.audit_logs (user_id, device_id, event_type, timestamp, success, reason, details)
    VALUES
        (demo_user_id, demo_device_id, 'DEVICE_REGISTERED', NOW() - INTERVAL '3 days', true, 'Paired successfully', '{"hostname":"OMEN-16-PRO"}'::jsonb),
        (demo_user_id, demo_device_id, 'ACCESS_CREATED', NOW() - INTERVAL '90 minutes', true, 'Session granted for 30m', '{"duration_minutes":30}'::jsonb),
        (demo_user_id, demo_device_id, 'ACCESS_EXPIRED', NOW() - INTERVAL '60 minutes', true, 'Session reached time limit', '{"status":"EXPIRED"}'::jsonb);

END $$;
