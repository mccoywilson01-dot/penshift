-- =============================================================================
-- Migration: 20261001000000_create_generations_table.sql
-- Description: Server-authoritative generations ledger with principal-scoped idempotency.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.generations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    idempotency_key VARCHAR(128) NOT NULL,
    type VARCHAR(50) NOT NULL DEFAULT 'penshift_history',
    task VARCHAR(50) NOT NULL DEFAULT 'humanize',
    requested_mode VARCHAR(50) NOT NULL DEFAULT 'standard',
    requested_provider VARCHAR(50) NOT NULL DEFAULT 'auto',
    actual_provider VARCHAR(50),
    actual_model VARCHAR(100),
    input_text TEXT NOT NULL,
    output_text TEXT,
    input_word_count INTEGER DEFAULT 0,
    output_word_count INTEGER DEFAULT 0,
    scores JSONB DEFAULT '{}'::jsonb,
    metadata JSONB DEFAULT '{}'::jsonb,
    token_usage JSONB DEFAULT '{"promptTokens": 0, "completionTokens": 0, "totalTokens": 0}'::jsonb,
    data JSONB NOT NULL DEFAULT '{}'::jsonb,
    status VARCHAR(30) NOT NULL DEFAULT 'QUEUED',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),

    -- Generated read-only columns for backward-compatibility with legacy frontend queries:
    provider VARCHAR(50) GENERATED ALWAYS AS (COALESCE(actual_provider, requested_provider)) STORED,
    mode VARCHAR(50) GENERATED ALWAYS AS (requested_mode) STORED,

    -- Completion integrity:
    CONSTRAINT chk_completed_provider_model CHECK (
        status != 'COMPLETED' OR (actual_provider IS NOT NULL AND actual_model IS NOT NULL)
    )
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_generations_user_created 
    ON public.generations (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_generations_user_type_created 
    ON public.generations (user_id, type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_generations_reconciliation 
    ON public.generations (status, created_at) 
    WHERE status IN ('QUEUED', 'DISPATCHING');

-- Principal-Scoped Idempotency Index
CREATE UNIQUE INDEX IF NOT EXISTS idx_generations_user_idempotency
    ON public.generations (user_id, idempotency_key);

-- Enable Row Level Security (RLS)
ALTER TABLE public.generations ENABLE ROW LEVEL SECURITY;

-- 1. SELECT: Authenticated users can view ONLY their own rows
CREATE POLICY "Users can view own generations" 
    ON public.generations 
    FOR SELECT 
    USING (auth.uid() = user_id);

-- 2. DELETE: Users can delete rows from their own history
CREATE POLICY "Users can delete own generations" 
    ON public.generations 
    FOR DELETE 
    USING (auth.uid() = user_id);

-- 3. REVOKE INSERT & UPDATE from browser clients
-- Generation records are created and updated EXCLUSIVELY by the backend service-role path.
REVOKE INSERT, UPDATE ON public.generations FROM anon, authenticated;

-- Automatic updated_at trigger
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_generations_updated_at ON public.generations;
CREATE TRIGGER trigger_generations_updated_at
    BEFORE UPDATE ON public.generations
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();
