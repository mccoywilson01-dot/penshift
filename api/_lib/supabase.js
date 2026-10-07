import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

let supabaseServerClient = null;
let supabaseServiceClient = null;
let currentConfigHash = null;

/**
 * Returns a cached Supabase client with anon key for serverless execution.
 */
export function getSupabaseServerClient() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  const hash = crypto.createHash('sha256').update(`${supabaseUrl}:${supabaseAnonKey}`).digest('hex');
  if (!supabaseServerClient || currentConfigHash !== hash) {
    supabaseServerClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
    currentConfigHash = hash;
  }

  return supabaseServerClient;
}

/**
 * Returns service-role client for authoritative database operations.
 */
export function getSupabaseServiceClient() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;

  if (!serviceKey || typeof serviceKey !== 'string' || serviceKey.trim().length === 0) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('SupabaseConfigurationError: SUPABASE_SERVICE_ROLE_KEY is missing for authoritative server operations.');
    }
    return null;
  }

  if (!supabaseUrl) {
    return null;
  }

  if (!supabaseServiceClient) {
    supabaseServiceClient = createClient(supabaseUrl, serviceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
  }

  return supabaseServiceClient;
}

/**
 * Verifies a Bearer token and returns the user object, or null if invalid.
 */
export async function verifyBearerToken(authHeader) {
  if (!authHeader || typeof authHeader !== 'string' || !/^Bearer\s+/i.test(authHeader)) {
    return null;
  }
  const client = getSupabaseServerClient();
  if (!client) return null;

  try {
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (!token) return null;
    const { data: { user }, error } = await client.auth.getUser(token);
    if (error || !user) return null;
    return user;
  } catch {
    return null;
  }
}

/**
 * Looks up existing generation row by user_id and idempotency_key.
 * Used for durable recovery after Redis cache expiration.
 */
export async function findGenerationByUserAndIdempotencyKey(userId, idempotencyKey) {
  const client = getSupabaseServiceClient();
  if (!client || !userId || !idempotencyKey) return null;

  try {
    const { data, error } = await client
      .from('generations')
      .select('id, user_id, status, output_text, input_text, scores, metadata, actual_provider, actual_model, task, requested_mode, requested_provider, created_at')
      .eq('user_id', userId)
      .eq('idempotency_key', idempotencyKey)
      .maybeSingle();

    if (error || !data) return null;
    return data;
  } catch (err) {
    console.warn('[supabase] findGenerationByUserAndIdempotencyKey error:', err.message);
    return null;
  }
}

/**
 * Looks up generation row by generation ID.
 */
export async function findGenerationById(generationId) {
  const client = getSupabaseServiceClient();
  if (!client || !generationId) return null;

  try {
    const { data, error } = await client
      .from('generations')
      .select('*')
      .eq('id', generationId)
      .maybeSingle();

    if (error || !data) return null;
    return data;
  } catch (err) {
    console.warn('[supabase] findGenerationById error:', err.message);
    return null;
  }
}

/**
 * Writes or updates generation row authoritatively.
 * NEVER writes to generated columns 'provider' or 'mode'.
 */
export async function persistGenerationRow(payload = {}) {
  const client = getSupabaseServiceClient();
  if (!client || !payload.user_id) return null;

  // Filter payload to only backend-writable columns
  const writableRecord = {
    id: payload.id,
    user_id: payload.user_id,
    idempotency_key: payload.idempotency_key,
    type: payload.type || 'penshift_history',
    task: payload.task || 'humanize',
    requested_mode: payload.requested_mode || 'standard',
    requested_provider: payload.requested_provider || 'auto',
    actual_provider: payload.actual_provider || null,
    actual_model: payload.actual_model || null,
    input_text: payload.input_text || '',
    output_text: payload.output_text || null,
    input_word_count: payload.input_word_count || 0,
    output_word_count: payload.output_word_count || 0,
    scores: payload.scores || {},
    metadata: payload.metadata || {},
    token_usage: payload.token_usage || { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
    data: payload.data || {},
    status: payload.status || 'QUEUED',
  };

  // Remove undefined keys
  Object.keys(writableRecord).forEach((k) => {
    if (writableRecord[k] === undefined) delete writableRecord[k];
  });

  try {
    const { data, error } = await client
      .from('generations')
      .upsert(writableRecord, { onConflict: 'user_id, idempotency_key' })
      .select()
      .maybeSingle();

    if (error) {
      console.warn('[supabase] persistGenerationRow error:', error.message);
      return null;
    }
    return data;
  } catch (err) {
    console.warn('[supabase] persistGenerationRow exception:', err.message);
    return null;
  }
}
