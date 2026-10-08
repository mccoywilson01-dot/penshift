import crypto from 'crypto';
import { Receiver } from '@upstash/qstash';
import { getSupabaseServiceClient } from '../_lib/supabase.js';
import { getJobState, dispatchGenerationToQStash } from '../_lib/ai/asyncExecutor.js';
import { isTerminalStatus, getJobLockKey } from '../_lib/ai/generationLifecycle.js';
import { getRedis } from '../_lib/rateLimiter.js';

const defaultReconcileBase = (process.env.RENDER_EXTERNAL_URL || 'https://penshift.onrender.com').replace(/\/+$/, '');
export const CANONICAL_RECONCILE_URL = process.env.PENSHIFT_RECONCILE_URL || `${defaultReconcileBase}/api/internal/reconcile`;

export default async function handler(req, res) {
  const signature = req.headers['upstash-signature'];
  const authHeader = req.headers.authorization;
  const cronSecret = process.env.CRON_SECRET;

  let isAuthorized = false;

  // 1. Upstash QStash cryptographic signature verification
  if (signature) {
    const rawBody = req.rawBody ? req.rawBody.toString('utf-8') : '';
    const upstashRegion = req.headers['upstash-region'];
    const receiver = new Receiver({
      currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY || '',
      nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY || '',
    });

    const isValid = await receiver.verify({
      signature,
      body: rawBody,
      url: CANONICAL_RECONCILE_URL,
      upstashRegion,
    }).catch(() => false);

    if (!isValid) {
      return res.status(401).json({ error: 'INVALID_QSTASH_SIGNATURE' });
    }
    isAuthorized = true;
  } else if (cronSecret && typeof authHeader === 'string') {
    // 2. Authorization Bearer CRON_SECRET fallback (e.g. manual diagnostics)
    // Uses constant-time digest comparison to prevent timing side channels
    const expectedHeader = `Bearer ${cronSecret}`;
    const authDigest = crypto.createHash('sha256').update(authHeader).digest();
    const expectedDigest = crypto.createHash('sha256').update(expectedHeader).digest();
    if (crypto.timingSafeEqual(authDigest, expectedDigest)) {
      isAuthorized = true;
    }
  }

  if (!isAuthorized) {
    return res.status(401).json({ error: 'UNAUTHORIZED_RECONCILE' });
  }

  const client = getSupabaseServiceClient();
  if (!client) {
    return res.status(200).json({ message: 'Supabase client not configured. Reconciler skipped.' });
  }

  try {
    // 2 minutes ago per Section 7.4
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
    const fifteenMinutesAgoMs = Date.now() - 15 * 60 * 1000;
    const redis = getRedis();

    // Query stranded non-terminal jobs
    const { data: strandedJobs, error } = await client
      .from('generations')
      .select('id, user_id, idempotency_key, task, requested_mode, requested_provider, input_text, status, created_at, metadata')
      .in('status', ['QUEUED', 'DISPATCHING'])
      .lt('created_at', twoMinutesAgo)
      .limit(25);

    if (error) {
      if (error.code === 'PGRST205' || error.message?.includes('schema cache')) {
        console.warn('[reconcile] Table public.generations not yet found in Supabase schema cache. Migration pending.');
        return res.status(200).json({
          reconciledCount: 0,
          pendingMigration: true,
          message: 'Table public.generations not yet found in Supabase schema cache. Run migration to enable durable reconciliation.',
        });
      }
      return res.status(500).json({ error: 'DATABASE_QUERY_ERROR', details: error.message });
    }

    if (!strandedJobs || strandedJobs.length === 0) {
      return res.status(200).json({ reconciledCount: 0, message: 'Zero stranded jobs found.' });
    }

    let reDispatched = 0;
    let terminalSyncs = 0;
    let markedFailed = 0;

    for (const job of strandedJobs) {
      // 1. Authoritative check: Check if job completed in Redis cache
      const cachedState = await getJobState(job.id);
      if (cachedState && isTerminalStatus(cachedState.status)) {
        const updatePayload = {
          status: cachedState.status,
          output_text: cachedState.output_text || null,
          scores: cachedState.scores || {},
        };
        if (cachedState.status === 'COMPLETED') {
          updatePayload.actual_provider = cachedState.actual_provider || job.actual_provider || job.requested_provider || 'groq';
          updatePayload.actual_model = cachedState.actual_model || job.actual_model || 'openai/gpt-oss-120b';
        }
        await client
          .from('generations')
          .update(updatePayload)
          .eq('id', job.id);
        terminalSyncs++;
        continue;
      }

      // Check if an active worker currently holds the execution lock
      let isLocked = false;
      if (redis) {
        try {
          const lockVal = await redis.get(getJobLockKey(job.id));
          isLocked = Boolean(lockVal);
        } catch (_) {}
      }

      const jobCreatedMs = new Date(job.created_at).getTime();

      // 2. If stranded job exceeds 15 minutes and lock is NOT held: atomically mark FAILED
      if (jobCreatedMs < fifteenMinutesAgoMs && !isLocked) {
        await client
          .from('generations')
          .update({
            status: 'FAILED',
            metadata: { failureReason: 'STRANDED_TIMEOUT_15M' },
          })
          .eq('id', job.id);
        markedFailed++;
        continue;
      }

      // 3. If worker is actively locked, skip to avoid race
      if (isLocked) {
        continue;
      }

      // 4. Safe Re-dispatch under the SAME generationId with preserved metadata
      const dispatchResult = await dispatchGenerationToQStash({
        generationId: job.id,
        principalId: `user:${job.user_id}`,
        userId: job.user_id,
        idempotencyKey: job.idempotency_key,
        task: job.task,
        mode: job.requested_mode,
        inputText: job.input_text,
        requestedProvider: job.requested_provider,
        metadata: job.metadata || cachedState?.metadata || {},
      });

      if (dispatchResult.success) {
        reDispatched++;
      }
    }

    return res.status(200).json({
      reconciledCount: strandedJobs.length,
      reDispatched,
      terminalSyncs,
      markedFailed,
    });
  } catch (err) {
    console.error('[reconcile] Error in reconciliation sweeper:', err);
    return res.status(500).json({ error: 'RECONCILIATION_ERROR', message: err.message });
  }
}
