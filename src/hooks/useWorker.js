import { useState, useEffect, useRef } from 'react';

let globalWorker = null;
const callbackMap = new Map();
let messageIdCounter = 0;

function getWorker() {
  if (typeof window === 'undefined') return null;
  if (!globalWorker) {
    try {
      globalWorker = new Worker(new URL('../workers/textWorker.js', import.meta.url), { type: 'module' });
      globalWorker.onmessage = (e) => {
        const { id, result } = e.data || {};
        if (id && callbackMap.has(id)) {
          const cb = callbackMap.get(id);
          callbackMap.delete(id);
          cb(result);
        }
      };
      globalWorker.onerror = (err) => {
        console.warn('TextWorker error:', err);
      };
    } catch (e) {
      console.warn('Worker initialization failed, fallback to main thread:', e);
      globalWorker = null;
    }
  }
  return globalWorker;
}

export function useWordCountWorker(text, bypassForShortText = true) {
  const [count, setCount] = useState(0);
  const workerRef = useRef(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    workerRef.current = getWorker();
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!text) {
      setCount(0);
      return;
    }
    
    // Fast path for very short text to avoid worker latency
    if (bypassForShortText && text.length < 500) {
      const basicCount = text.trim().split(/\s+/).filter(Boolean).length;
      setCount(basicCount);
      return;
    }

    let pendingId = null;
    if (workerRef.current) {
      pendingId = ++messageIdCounter;
      callbackMap.set(pendingId, (result) => {
        if (mountedRef.current) {
          setCount(result);
        }
      });
      workerRef.current.postMessage({ type: 'countWords', payload: text, id: pendingId });
    } else {
      // Fallback
      setCount(text.trim().split(/\s+/).filter(Boolean).length);
    }

    return () => {
      if (pendingId !== null) {
        callbackMap.delete(pendingId);
      }
    };
  }, [text, bypassForShortText]);

  return count;
}
