import { useState, useRef, useCallback, useEffect } from 'react';

export function useStream() {
  const [out, setOutState] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState('');
  const [statusMsg, setStatusMsg] = useState('');
  const [statusLog, setStatusLog] = useState([]);
  const [metadata, setMetadata] = useState({});
  
  const abortControllerRef = useRef(null);
  const outRef = useRef('');
  const metaRef = useRef({});
  const rafRef = useRef(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { 
      mountedRef.current = false; 
    };
  }, []);

  const setOut = useCallback((val) => {
    const newVal = typeof val === 'function' ? val(outRef.current) : val;
    outRef.current = newVal;
    if (mountedRef.current) setOutState(newVal);
  }, []);

  const startStream = useCallback(async (url, options) => {
    const isHandoffReconnect = Boolean(options?._reconnectAttempt);
    if (!isHandoffReconnect && abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    if (rafRef.current) { clearTimeout(rafRef.current); rafRef.current = null; }
    
    const currentAbortController = isHandoffReconnect && abortControllerRef.current 
      ? abortControllerRef.current 
      : new AbortController();
    abortControllerRef.current = currentAbortController;
    
    if (!options?.append) {
      outRef.current = '';
      if (mountedRef.current) {
        setOutState('');
        setStatusMsg('');
        setStatusLog([]);
        setMetadata({});
      }
      metaRef.current = {};
    }
    
    if (mountedRef.current) {
      setError('');
      setIsStreaming(true);
    }

    let reader = null;
    let handoffTarget = null;
    let isTerminal = false;
    let isHandingOff = false;

    try {
      const headers = { ...options?.headers };
      try {
        const { supabase } = await import('../lib/supabase.js');
        if (supabase) {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.access_token) {
            headers['Authorization'] = `Bearer ${session.access_token}`;
          }
        }
      } catch (e) { /* non-critical error ignored */ }

      const res = await fetch(url, {
        ...options,
        headers,
        signal: currentAbortController.signal,
      });

      if (!res.ok && res.status !== 202) {
        const text = await res.text();
        let msg = `API Error (${res.status})`;
        if (res.status === 504) msg = 'Gateway Timeout (504): The AI models took too long to respond. Please try again.';
        else if (res.status === 429) msg = 'Rate Limit Exceeded (429): Too many requests. Please wait a moment.';
        else if (res.status === 503) msg = 'Service Unavailable (503): Service temporarily unavailable. Please retry.';
        else try { msg = JSON.parse(text).error || msg; } catch(e) { /* non-critical error ignored */ }
        throw new Error(msg);
      }

      // Handle HTTP 202 Accepted: Observer attachment to an already-running generation
      if (res.status === 202) {
        const text = await res.text().catch(() => '{}');
        let json = {};
        try { json = JSON.parse(text); } catch (_) {}
        const targetUrl = json.statusUrl || (json.generationId ? `/api/generate?jobId=${json.generationId}` : null);
        if (targetUrl) {
          if (json.generationId) {
            metaRef.current = { ...metaRef.current, generationId: json.generationId };
            setMetadata(prev => ({ ...prev, generationId: json.generationId }));
          }
          if (json.status) {
            setStatusMsg(json.status);
            if (options?.onStatus) options.onStatus(json.status, json);
          }
          // Reconnect observer to the ongoing generation
          return startStream(targetUrl, {
            ...options,
            method: 'GET',
            headers: {
              ...(options?.headers || {}),
              Accept: 'text/event-stream',
            },
            body: undefined,
            append: true,
          });
        }
      }

      const contentType = res.headers.get('content-type') || '';

      // Handle Direct JSON Response (e.g. terminal replay from cache or durable Supabase fallback)
      if (contentType.includes('application/json')) {
        const text = await res.text();
        let json = {};
        try { json = JSON.parse(text); } catch (_) {}
        const finalTxt = json.text || json.output || '';
        outRef.current = finalTxt;
        if (mountedRef.current) setOutState(finalTxt);
        if (json.generationId) {
          metaRef.current = { ...metaRef.current, generationId: json.generationId };
          setMetadata(prev => ({ ...prev, generationId: json.generationId }));
        }
        if (json.scores && options?.onScore) {
          options.onScore(json.scores);
        }
        if (json.status) {
          setStatusMsg(json.status);
          if (options?.onStatus) options.onStatus(json.status, json);
        }
        if (mountedRef.current) setIsStreaming(false);
        return finalTxt;
      }

      reader = res.body.getReader();
      const decoder = new TextDecoder("utf-8");
      
      let done = false;
      let buffer = '';
      let pendingUpdate = false;

      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        
        let chunkStr = '';
        if (value) {
          chunkStr = decoder.decode(value, { stream: true });
        }
        
        // Flush decoder if stream is done
        if (done) {
          chunkStr += decoder.decode();
        }

        if (chunkStr || buffer) {
          buffer += chunkStr;
          
          if (buffer.length > 2_500_000) { // 2.5MB max buffer
            throw new Error("OOM Protection: Stream buffer exceeded limits.");
          }

          let newText = '';
          let matchIndex;
          while ((matchIndex = buffer.indexOf('\n\n')) !== -1) {
            const block = buffer.slice(0, matchIndex);
            buffer = buffer.slice(matchIndex + 2);
            const lines = block.split(/\r?\n/);
            for (const rawLine of lines) {
              const line = rawLine.trim();
              if (line.startsWith('data: ') && line.length > 6) {
                const dataStr = line.slice(6).trim();
                if (dataStr === '[DONE]') continue;
                try {
                  const parsed = JSON.parse(dataStr);
                  if (parsed.error) {
                    if (parsed.status === 'CANCELLED' || parsed.isTerminal) {
                      isTerminal = true;
                      handoffTarget = null;
                    }
                    throw new Error(parsed.error);
                  }

                  if (parsed.handoff === true || parsed.event === 'handoff' || parsed.status === 'OBSERVING') {
                    handoffTarget = parsed.statusUrl || (parsed.jobId || parsed.generationId ? `/api/generate?jobId=${parsed.jobId || parsed.generationId}` : null);
                    if (parsed.status) {
                      setStatusMsg(parsed.status);
                      if (options?.onStatus) options.onStatus(parsed.status, parsed);
                    }
                  }

                  if (parsed.isTerminal || parsed.status === 'COMPLETED' || parsed.status === 'FAILED' || parsed.status === 'CANCELLED') {
                    isTerminal = true;
                    handoffTarget = null;
                  }

                  if (parsed.metadata) {
                    metaRef.current = { ...metaRef.current, ...parsed.metadata };
                    setMetadata(prev => ({ ...prev, ...parsed.metadata }));
                  }
                  if (parsed.generationId) {
                    metaRef.current = { ...metaRef.current, generationId: parsed.generationId };
                    setMetadata(prev => ({ ...prev, generationId: parsed.generationId }));
                  }

                  const textOutput = parsed.text || parsed.output || (parsed.metadata && parsed.metadata.provider ? null : undefined);
                  if (textOutput && typeof textOutput === 'string') {
                    if (parsed.isTerminal || parsed.status === 'COMPLETED') {
                      // Authoritative terminal text replaces partially accumulated buffer to prevent duplicates on reconnect
                      outRef.current = textOutput;
                      if (mountedRef.current) setOutState(textOutput);
                      newText = '';
                    } else {
                      newText += textOutput;
                    }
                  }

                  if (parsed.status && parsed.status !== 'OBSERVING') {
                     setStatusMsg(parsed.status);
                     setStatusLog(prev => {
                       if (prev.length > 0 && prev[prev.length - 1].msg === parsed.status) return prev;
                       return [...prev, { time: Date.now(), msg: parsed.status }];
                     });
                     if (options?.onStatus) {
                       options.onStatus(parsed.status, parsed);
                     }
                  }
                  if (parsed.scores || parsed.inputScore !== undefined || parsed.outputScore !== undefined) {
                    const scoreObj = {
                      ...(parsed.scores || {}),
                      ...(parsed.inputScore !== undefined ? { inputScore: parsed.inputScore } : {}),
                      ...(parsed.outputScore !== undefined ? { outputScore: parsed.outputScore } : {}),
                    };
                    metaRef.current = { ...metaRef.current, scores: { ...(metaRef.current.scores || {}), ...scoreObj } };
                    setMetadata(prev => ({ ...prev, scores: { ...(prev.scores || {}), ...scoreObj } }));
                    if (options?.onScore) {
                      options.onScore(scoreObj);
                    }
                  }
                } catch (err) {
                  if (err.message && err.message !== 'Unexpected end of JSON input') {
                     throw err;
                  }
                }
              }
            }
          }
          
          // Process remaining buffer if stream finished abruptly without final newline
          if (done && buffer.trim().length > 0) {
            const remainingLines = buffer.split(/\r?\n/);
            for (const rawLine of remainingLines) {
              const line = rawLine.trim();
              if (line.startsWith('data: ') && line.length > 6) {
                const dataStr = line.slice(6).trim();
                if (dataStr !== '[DONE]') {
                  try {
                    const data = JSON.parse(dataStr);
                    const textOutput = data.text || data.output;
                    if (textOutput) newText += textOutput;
                    if (data.status) {
                       setStatusMsg(data.status);
                       setStatusLog(prev => {
                         if (prev.length > 0 && prev[prev.length - 1].msg === data.status) return prev;
                         return [...prev, { time: Date.now(), msg: data.status }];
                       });
                    }
                  } catch (e) {
                    // Ignore final unparseable buffer
                  }
                }
              }
            }
          }
          
          if (newText) {
            outRef.current += newText;
            if (!pendingUpdate) {
              pendingUpdate = true;
              rafRef.current = setTimeout(() => {
                if (mountedRef.current) {
                  setOutState(outRef.current);
                }
                pendingUpdate = false;
              }, 80);
            }
          }
        }
      }
      
      if (pendingUpdate && rafRef.current) {
        clearTimeout(rafRef.current);
        if (mountedRef.current) {
          setOutState(outRef.current);
        }
      }

      // Explicitly release reader lock before potential reconnection
      if (reader) {
        try { reader.releaseLock(); } catch (_) {}
        reader = null;
      }

      // Handle transport handoff (HTTP 45s gateway ceiling reached while job continues in background)
      if (handoffTarget && !isTerminal && !currentAbortController.signal.aborted) {
        const reconnectAttempt = (options?._reconnectAttempt || 0) + 1;
        const maxAttempts = 15;
        if (reconnectAttempt <= maxAttempts) {
          isHandingOff = true;
          const backoffMs = Math.min(600 * Math.pow(1.25, reconnectAttempt - 1), 3000);
          await new Promise((r) => setTimeout(r, backoffMs));

          if (!currentAbortController.signal.aborted && mountedRef.current) {
            return startStream(handoffTarget, {
              ...options,
              method: 'GET',
              headers: {
                ...(options?.headers || {}),
                Accept: 'text/event-stream',
              },
              body: undefined,
              append: true,
              _reconnectAttempt: reconnectAttempt,
            });
          }
        }
      }
      
      return outRef.current;
    } catch (e) {
      if (e.name === 'AbortError') return null;
      const reconnectAttempt = options?._reconnectAttempt || 0;
      if (isHandoffReconnect && reconnectAttempt < 5 && !currentAbortController.signal.aborted) {
        // Bounded retry on transient observer network failure
        const backoffMs = Math.min(1000 * reconnectAttempt, 4000);
        await new Promise((r) => setTimeout(r, backoffMs));
        if (!currentAbortController.signal.aborted && mountedRef.current) {
          return startStream(url, {
            ...options,
            _reconnectAttempt: reconnectAttempt + 1,
          });
        }
      }
      if (mountedRef.current) {
        setError(e.message || 'Stream failed.');
      }
      throw e;
    } finally {
      // 1. Always release reader lock!
      if (reader) {
        try { reader.releaseLock(); } catch (e) { /* non-critical error ignored */ }
      }
      
      // 2. Abort stream connection and clear state only if NOT handing off to a reconnect
      if (!isHandingOff && abortControllerRef.current === currentAbortController) {
        if (rafRef.current) {
          clearTimeout(rafRef.current);
          rafRef.current = null;
        }
        try { currentAbortController.abort(); } catch (e) { /* non-critical error ignored */ }
        abortControllerRef.current = null;
        if (mountedRef.current) setIsStreaming(false);
      }
    }
  }, []);

  const stopStream = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    if (rafRef.current) {
      clearTimeout(rafRef.current);
      rafRef.current = null;
    }
    
    // Prevent state mutation on unmount
    if (mountedRef.current) {
      setOutState(outRef.current);
      setIsStreaming(false);
    }
  }, []);

  const continueGeneration = useCallback(async ({ apiProvider, _type, mode, onSaveHistory }) => {
    // We cannot use isStreaming here safely due to closure if we don't include it in deps,
    // but the task assumes we are not streaming when we click it.
    const currentOut = outRef.current;
    if (!currentOut) return;
    setError('');
    try {
      const newOut = await startStream('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: 'continue', apiProvider, mode, task: 'continue', previousOutput: currentOut }),
        append: true
      });
      if (newOut && onSaveHistory && mountedRef.current) {
        onSaveHistory(newOut);
      }
    } catch (e) {
      if (e.name === 'AbortError') return;
      if (mountedRef.current) setError(e?.message || String(e) || 'An unexpected error occurred');
    }
  }, [startStream]);

  useEffect(() => {
    return () => stopStream();
  }, [stopStream]);

  return { out, isStreaming, error, statusMsg, statusLog, metadata, startStream, stopStream, setOut, setError, setStatusMsg, continueGeneration };
}
