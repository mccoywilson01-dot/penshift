import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Gracefully handle missing env vars so the app works without Supabase (offline/CI)
export const supabase = (supabaseUrl && supabaseAnonKey)
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

export async function getAuthHeaders() {
  const headers = { 'Content-Type': 'application/json' };
  if (supabase) {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`;
    }
  }
  return headers;
}

export async function saveHistory(item, key = 'penshift_history') {
  let userId = 'guest';
  if (supabase) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        userId = session.user.id;
        // Server auto-persists authenticated generations authoritatively.
        // Browser INSERT is revoked to enforce server-authoritative ledger.
      }
    } catch (e) {
      console.warn('Supabase getSession failed, falling back to local:', e.message);
    }
  }

  const localKey = `${key}_${userId}`;
  try {
    let parsed;
    try {
      const stored = localStorage.getItem(localKey);
      parsed = stored ? JSON.parse(stored) : [];
    } catch (e) {
      if (e.name === 'SecurityError') return;
      parsed = [];
    }
    let history = Array.isArray(parsed) ? parsed : [];

    // O(1) deduplication without expensive JSON.stringify
    const map = new Map();
    history.forEach((h) => {
      const k = h?.id || h?.timestamp || h?.ts;
      if (k) map.set(k, h);
    });

    const uniqueKey = item?.id || item?.timestamp || item?.ts;
    if (item) map.set(uniqueKey || Date.now().toString(), item);

    let updated = Array.from(map.values())
      .sort((a, b) => (new Date(b.timestamp || b.ts || 0).getTime() || 0) - (new Date(a.timestamp || a.ts || 0).getTime() || 0))
      .slice(0, 50);

    // Auto-pruning FIFO Queue for 5MB Limit
    let saved = false;
    while (!saved && updated.length > 0) {
      try {
        localStorage.setItem(localKey, JSON.stringify(updated));
        saved = true;
      } catch (e) {
        if (e.name === 'QuotaExceededError' || e.message.toLowerCase().includes('quota')) {
          updated = updated.slice(0, Math.floor(updated.length / 2));
        } else {
          throw e;
        }
      }
    }
  } catch (e) {
    console.error('localStorage save failed:', e.message);
  }
}

export async function loadHistory(key = 'penshift_history') {
  let cloudData = [];
  let localData = [];
  let userId = 'guest';

  if (supabase) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        userId = session.user.id;
        let query = supabase
          .from('generations')
          .select('id, data, input_text, output_text, scores, metadata, task, type, created_at')
          .eq('user_id', session.user.id)
          .order('created_at', { ascending: false })
          .limit(50);

        if (key === 'penshift_history_humanizer') {
          query = query.or('type.eq.penshift_history_humanizer,and(type.eq.penshift_history,task.eq.humanize)');
        } else if (key === 'penshift_history_score') {
          query = query.or('type.eq.penshift_history_score,and(type.eq.penshift_history,task.eq.score)');
        } else {
          query = query.eq('type', key);
        }

        const { data, error } = await query;

        if (!error && data) {
          cloudData = data.map((d) => (d.data && Object.keys(d.data).length > 0 ? d.data : {
            id: d.id,
            prompt: d.input_text,
            output: d.output_text,
            scores: d.scores,
            timestamp: d.created_at,
            type: d.task,
          }));
        }
      }
    } catch (e) {
      console.error('Supabase load failed:', e.message);
    }
  }

  const localKey = `${key}_${userId}`;
  try {
    let stored;
    try {
      stored = localStorage.getItem(localKey);
    } catch (e) {
      if (e.name === 'SecurityError') return [];
      throw e;
    }
    const parsed = stored ? JSON.parse(stored) : [];
    localData = Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.error('localStorage load failed:', e.message);
  }

  // O(1) deduplication
  const map = new Map();
  [...cloudData, ...localData].forEach((item) => {
    const uniqueKey = item?.id || item?.timestamp || item?.ts || (String(item?.prompt?.slice(0, 20) || item?.input?.slice(0, 20) || '') + String(item?.output?.slice(0, 20) || ''));
    if (item && !map.has(uniqueKey)) {
      map.set(uniqueKey, item);
    }
  });

  return Array.from(map.values())
    .sort((a, b) => (new Date(b.timestamp || b.ts || 0).getTime() || 0) - (new Date(a.timestamp || a.ts || 0).getTime() || 0))
    .slice(0, 50);
}

export async function deleteHistoryItem(id, key = 'penshift_history') {
  let userId = 'guest';
  if (supabase) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        userId = session.user.id;
        await supabase
          .from('generations')
          .delete()
          .eq('id', id)
          .eq('user_id', session.user.id);
      }
    } catch (e) {
      console.warn('Supabase delete failed:', e.message);
    }
  }

  const localKey = `${key}_${userId}`;
  try {
    const stored = localStorage.getItem(localKey);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        const filtered = parsed.filter((item) => (item.id !== id && item.timestamp !== id && item.ts !== id));
        localStorage.setItem(localKey, JSON.stringify(filtered));
      }
    }
  } catch (e) {
    console.error('localStorage delete failed:', e.message);
  }
}

