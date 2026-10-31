-- ==============================================================================
-- iLock Device Location (Live + Last Known Location)
-- ==============================================================================
-- device_status carries the latest known fix. It is never cleared when a
-- heartbeat arrives without a fix, which is what makes "last location" work
-- once the laptop goes offline.
-- device_locations is a throttled movement trail (retained for 7 days; the
-- heartbeat route purges older rows whenever it appends a new one).
-- ==============================================================================

ALTER TABLE public.device_status
    ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS location_accuracy_m REAL,
    ADD COLUMN IF NOT EXISTS location_source TEXT, -- 'windows' (Wi-Fi/GPS via Windows Location) or 'ip'
    ADD COLUMN IF NOT EXISTS location_city TEXT,
    ADD COLUMN IF NOT EXISTS location_fixed_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS public.device_locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id UUID NOT NULL REFERENCES public.devices(id) ON DELETE CASCADE,
    latitude DOUBLE PRECISION NOT NULL CHECK (latitude BETWEEN -90 AND 90),
    longitude DOUBLE PRECISION NOT NULL CHECK (longitude BETWEEN -180 AND 180),
    accuracy_m REAL,
    source TEXT NOT NULL,
    city TEXT,
    recorded_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_device_locations_device_time ON public.device_locations(device_id, recorded_at DESC);

ALTER TABLE public.device_locations ENABLE ROW LEVEL SECURITY;

-- Device Locations: Owners can view the location trail of their own devices (writes are service-role only)
DROP POLICY IF EXISTS "Users can view own device locations" ON public.device_locations;
CREATE POLICY "Users can view own device locations" ON public.device_locations FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.devices WHERE id = device_id AND owner_id = auth.uid())
);
