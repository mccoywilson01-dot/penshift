import { extractTextFromFile } from "../lib/fileParser.js";

import React, { useState, useRef, useCallback, useEffect } from 'react'
import { Zap, Flame, Target, Briefcase, MessageSquare, Edit3, BarChart2, CheckCircle2, ClipboardList, Bot, BrainCircuit, Search, BookOpen, SearchCode, XCircle, Info, AlertTriangle, Maximize2 } from 'lucide-react'
import { OutputBox, ScorePanel } from '../components/Components.jsx'
import { getAuthHeaders, saveHistory, loadHistory } from '../lib/supabase.js'
import { useStream } from '../hooks/useStream.js'
import { useSettings } from '../hooks/SettingsContext.jsx'
import { countWords } from '../lib/utils.js'
import { useWordCountWorker } from '../hooks/useWorker.js'

const DebouncedTextarea = React.memo(({ value, onChange, ...props }) => {
  const [localValue, setLocalValue] = useState(value || '');
  const timeoutRef = useRef(null);

  useEffect(() => {
    setLocalValue(value || '');
  }, [value]);

  const handleChange = useCallback((e) => {
    const val = e.target.value;
    setLocalValue(val);
    
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      onChange(val);
      timeoutRef.current = null;
    }, 300);
  }, [onChange]);

  useEffect(() => () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  return <textarea value={localValue} onChange={handleChange} {...props} />;
});
DebouncedTextarea.displayName = 'DebouncedTextarea';

const MODES = [
  { id:'standard',   label:'Standard',   icon:<Zap className="w-5 h-5" />, desc:'Natural human flow · clean output',         expect:'80–90%' },
  { id:'aggressive', label:'Aggressive', icon:<Flame className="w-5 h-5" />, desc:'Maximum bypass · deep restructure',        expect:'90–98%' },
  { id:'seo',        label:'SEO Mode',   icon:<Target className="w-5 h-5" />, desc:'Keyword-aware · search optimized',        expect:'80–88%' },
  { id:'formal',     label:'Formal',     icon:<Briefcase className="w-5 h-5" />, desc:'Executive authority · zero hedging',      expect:'75–85%' },
  { id:'casual',     label:'Casual',     icon:<MessageSquare className="w-5 h-5" />, desc:'Smart friend voice · warm & real',        expect:'88–96%' },
]

const MODE_INFO = {
  standard:   'Sentence variety, human connectives, active voice, paragraph rhythm. Professional and clean.',
  aggressive: '8 structural techniques — inversions, Q&A pairs, fragments, em-dashes, extreme burstiness. Every sentence completely restructured.',
  seo:        'Keywords preserved & varied, LSI terms added, featured snippet structure. Ranks AND reads human.',
  formal:     'No contractions, no hedging, precise vocabulary. Board-room and academic paper quality.',
  casual:     'Contractions everywhere, direct address, short paragraphs. Reads like a brilliant friend messaging you.',
}

const MC = {
  standard:   { b:'border-blue-200',   bg:'bg-blue-50',   t:'text-blue-700',   btn:'from-blue-600 to-indigo-600',   badge:'bg-blue-100 text-blue-700',   ring:'ring-blue-100'   },
  aggressive: { b:'border-red-200',    bg:'bg-red-50',    t:'text-red-700',    btn:'from-red-600 to-orange-500',    badge:'bg-red-100 text-red-700',     ring:'ring-red-100'    },
  seo:        { b:'border-green-200',  bg:'bg-green-50',  t:'text-green-700',  btn:'from-green-600 to-emerald-500', badge:'bg-green-100 text-green-700', ring:'ring-green-100'  },
  formal:     { b:'border-slate-300',  bg:'bg-slate-100', t:'text-slate-700',  btn:'from-slate-700 to-slate-900',   badge:'bg-slate-200 text-slate-700', ring:'ring-slate-200'  },
  casual:     { b:'border-purple-200', bg:'bg-purple-50', t:'text-purple-700', btn:'from-violet-600 to-purple-500', badge:'bg-purple-100 text-purple-700',ring:'ring-purple-100' },
}

// Stages shown in the progress indicator while running
const STAGES = [
  { id:'humanize', label:'Humanizing text',        icon:<Edit3 className="w-4 h-4" /> },
  { id:'score',    label:'Analyzing detection',     icon:<BarChart2 className="w-4 h-4" /> },
  { id:'done',     label:'Complete',                icon:<CheckCircle2 className="w-4 h-4" /> },
]

// AnimCount removed
export default function Humanizer() {
  const [input,      setInput]      = useState('')
  const { out: output, setOut: setOutput, startStream, stopStream, statusMsg, statusLog, continueGeneration } = useStream()
  const outputRef = useRef(output)
  useEffect(() => { outputRef.current = output }, [output])
  const [mode,       setMode]       = useState('standard')
  const [stage,      setStage]      = useState(null)   // null | 'humanize' | 'score' | 'done'
  const [inputScores, setInputScores] = useState(null)
  const [outputScores, setOutputScores] = useState(null)
  const [vocab, setVocab] = useState(50)
  const [sentenceLength, setSentenceLength] = useState(50)
  const [error,      setError]      = useState('')
  const [wordStats,  setWordStats]  = useState(null)
  
  const handleInputChange = useCallback((val) => setInput(val), [])
  const [history,    setHistory]    = useState(() => {
    try { 
      const parsed = JSON.parse(localStorage.getItem('penshift_history_humanizer') || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch { return [] }
  })
  const [activeTab,  setActiveTab]  = useState('editor') // 'editor' | 'history'
  const [useDebate,  setUseDebate]  = useState(false)
  const [userMemory, setUserMemory] = useState(() => {
    try { return localStorage.getItem('penshift_tone_memory') || '' }
    catch(e) { return '' }
  })
  const [showMemory, setShowMemory] = useState(false)
  const [reScoring,  setReScoring]  = useState(false)
  const [toast,      setToast]      = useState(null)
  const [checking,   setChecking]   = useState({ grammar: false, readability: false, plagiarism: false })
  const toastTimerRef = useRef(null)

  const showToast = useCallback((title, message, type = 'info') => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    setToast({ title, message, type })
    toastTimerRef.current = setTimeout(() => setToast(null), 5000)
  }, [])

  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef(null)

  const handleDragOver = useCallback((e) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])
  const handleDragLeave = useCallback((e) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])
  const handleDrop = useCallback(async (e) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (!file) return
    try {
      const text = await extractTextFromFile(file)
      setInput(text)
      showToast('File loaded', `Loaded ${file.name} successfully`, 'success')
    } catch (err) {
      showToast('Upload failed', err.message, 'error')
    }
  }, [showToast])
  const handleFileSelect = useCallback(async (e) => {
    const file = e.target.files[0]
    if (!file) return
    try {
      const text = await extractTextFromFile(file)
      setInput(text)
      showToast('File loaded', `Loaded ${file.name} successfully`, 'success')
    } catch (err) {
      showToast('Upload failed', err.message, 'error')
    }
    // reset input so same file can be selected again
    e.target.value = ''
  }, [showToast])

  useEffect(() => {
    let mounted = true
    loadHistory('penshift_history_humanizer').then(data => {
      if (mounted && Array.isArray(data) && data.length > 0) {
        setHistory(data)
      }
    }).catch(console.error)
    return () => { mounted = false }
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => {
      try { localStorage.setItem('penshift_tone_memory', userMemory) } catch (e) { /* non-critical error ignored */ }
    }, 1000)
    return () => clearTimeout(timer)
  }, [userMemory])

  const { apiProvider: providerLabel } = useSettings()

  const handleContinue = useCallback(async () => {
    if (!continueGeneration) return;
    await continueGeneration({
      apiProvider: providerLabel,
      mode,
      onSaveHistory: (newOut) => {
        const item = { prompt: input, output: newOut, mode, provider: providerLabel, timestamp: new Date().toISOString() };
        saveHistory(item, 'penshift_history_humanizer');
        setHistory(prev => [item, ...(Array.isArray(prev) ? prev : [])].slice(0, 50));
      }
    });
  }, [continueGeneration, providerLabel, mode, input]);

  const currentIdempotencyKeyRef = useRef(null)
  const currentJobIdRef = useRef(null)
  const lastRequestParamsRef = useRef(null)

  const abortControllerRef = useRef(null)
  const rescoreAbortRef = useRef(null)
  const grammarAbortRef = useRef(null)
  const readabilityAbortRef = useRef(null)
  const plagiarismAbortRef = useRef(null)

  const cancelAllRequests = useCallback(async () => {
    const activeJobId = currentJobIdRef.current
    if (activeJobId) {
      try {
        const authHeaders = await getAuthHeaders()
        fetch(`/api/generate?action=cancel&jobId=${encodeURIComponent(activeJobId)}`, {
          method: 'POST',
          headers: { ...authHeaders },
        }).catch(() => {})
      } catch (_) {}
    }
    stopStream()
    if (abortControllerRef.current) { abortControllerRef.current.abort(); abortControllerRef.current = null; }
    if (rescoreAbortRef.current) { rescoreAbortRef.current.abort(); rescoreAbortRef.current = null; }
    if (grammarAbortRef.current) { grammarAbortRef.current.abort(); grammarAbortRef.current = null; }
    if (readabilityAbortRef.current) { readabilityAbortRef.current.abort(); readabilityAbortRef.current = null; }
    if (plagiarismAbortRef.current) { plagiarismAbortRef.current.abort(); plagiarismAbortRef.current = null; }
  }, [stopStream])

  useEffect(() => {
    return () => {
      cancelAllRequests()
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    }
  }, [cancelAllRequests])

  const loading   = stage === 'humanize'
  const scoreLoad = stage === 'score' || reScoring
  const inputWords = useWordCountWorker(input || '')
  const mc = MC[mode] || MC.standard

  // ── MAIN RUN ──────────────────────────────────────────────────
  const run = async () => {
    const actualInput = document.getElementById('input-text')?.value || input;
    if (!actualInput.trim() || loading || scoreLoad) return
    if (actualInput !== input) setInput(actualInput); // flush to state
    
    const provider = providerLabel
    const iw = countWords(actualInput)

    setStage('humanize')
    setError('')
    setOutput('')
    setInputScores(null)
    setOutputScores(null)
    setWordStats(null)

    cancelAllRequests()
    
    const controller = new AbortController()
    abortControllerRef.current = controller

    let humanizedText = ''
    let finalScores = null
    let finalInScores = null

    try {
      // 1. Idempotency Key Management: Reuse existing key on retry of same parameters, generate fresh UUID for new inputs
      const isRetry = Boolean(
        currentIdempotencyKeyRef.current &&
        lastRequestParamsRef.current &&
        lastRequestParamsRef.current.prompt === actualInput &&
        lastRequestParamsRef.current.mode === mode &&
        lastRequestParamsRef.current.provider === provider &&
        lastRequestParamsRef.current.vocab === vocab &&
        lastRequestParamsRef.current.sentenceLength === sentenceLength
      );

      const idempotencyKey = isRetry
        ? currentIdempotencyKeyRef.current
        : ((typeof crypto !== 'undefined' && crypto.randomUUID)
            ? crypto.randomUUID()
            : `idemp-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`);

      currentIdempotencyKeyRef.current = idempotencyKey;
      lastRequestParamsRef.current = { prompt: actualInput, mode, provider, vocab, sentenceLength };

      const payload = {
        prompt: actualInput,
        apiProvider: provider,
        mode,
        task: 'humanize',
        useDebate,
        userMemory,
        idempotencyKey,
        context: JSON.stringify({ vocab, sentenceLength }),
      };

      const authHeaders = await getAuthHeaders();

      const finalOut = await startStream('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey,
          ...authHeaders,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
        onStatus: (status, data) => {
          if (data?.generationId) {
            currentJobIdRef.current = data.generationId;
          }
          if (status === 'QUEUED' || status === 'DISPATCHING' || status === 'RUNNING' || status === 'STREAMING' || status === 'ANALYZING' || status === 'DRAFTING') {
            setStage('humanize');
          } else if (status === 'VERIFYING' || status === 'REFINING' || status === 'FINAL_AUDIT' || status === 'VALIDATING' || status === 'FINALIZING') {
            setStage('score');
          } else if (status === 'COMPLETED') {
            setStage('done');
          } else if (status === 'FAILED') {
            setError(data?.error || 'Generation failed.');
            setStage(null);
          } else if (status === 'CANCELLED') {
            showToast('Cancelled', 'Generation was cancelled.', 'info');
            setStage(null);
          }
        },
        onScore: (scoreData) => {
          if (scoreData?.unavailable) {
            setOutputScores({ unavailable: true });
            finalScores = { unavailable: true };
            return;
          }
          if (scoreData?.inputScore != null || scoreData?.inputScores != null) {
            const h = scoreData.inputScore ?? scoreData.inputScores?.humanScore;
            if (typeof h === 'number') {
              const inSc = scoreData.inputScores || {
                humanScore: h,
                aiScore: scoreData.aiScore ?? (100 - h),
                breakdown: scoreData.breakdown || null,
              };
              setInputScores(inSc);
              finalInScores = inSc;
            }
          }
          if (scoreData?.outputScore != null || scoreData?.outputScores != null) {
            const h = scoreData.outputScore ?? scoreData.outputScores?.humanScore;
            if (typeof h === 'number') {
              const outSc = scoreData.outputScores || {
                humanScore: h,
                aiScore: scoreData.aiScore ?? (100 - h),
                breakdown: scoreData.breakdown || null,
              };
              setOutputScores(outSc);
              finalScores = outSc;
            }
          }
        },
      });

      if (controller.signal.aborted) return;
      if (!finalOut) throw new Error('Empty output — please try again.');
      humanizedText = finalOut;
      setOutput(humanizedText);
      const ow = countWords(humanizedText);
      setWordStats({ input: iw, output: ow, ratio: ow / (iw || 1) });
    } catch (e) {
      if (e.name === 'AbortError' || controller.signal.aborted) return;
      setError(e.message || 'Humanization failed. Check your API key.');
      setStage(null);
      return;
    }

    if (!finalScores) {
      finalScores = { unavailable: true };
      setOutputScores(finalScores);
    }
    if (!finalInScores) {
      finalInScores = null;
      setInputScores(null);
    }

    if (controller.signal.aborted) return;
    setStage('done');

    // Save to history using functional state update to avoid stale closures
    const newItem = {
      id: Date.now(),
      type: 'Humanizer',
      prompt: actualInput,
      output: humanizedText,
      mode,
      scores: finalScores,
      inputScores: finalInScores,
      wordStats: { input: iw, output: countWords(humanizedText) },
      provider,
      timestamp: new Date().toISOString(),
    };
    
    setHistory(prev => {
      const isDup = prev.length > 0 && (prev[0].prompt || prev[0].input) === actualInput && prev[0].mode === mode;
      if (isDup) return prev;
      saveHistory(newItem, 'penshift_history_humanizer').catch(console.error);
      return [newItem, ...prev].slice(0, 50);
    });
  }

  // Re-score only (without re-humanizing)
  const reScore = useCallback(async () => {
    const currentOutput = outputRef.current;
    if (!currentOutput) return
    setReScoring(true)
    if (rescoreAbortRef.current) rescoreAbortRef.current.abort()
    const ctrl = new AbortController()
    rescoreAbortRef.current = ctrl
    
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: ctrl.signal,
        body: JSON.stringify({ prompt: currentOutput, apiProvider: providerLabel, task: 'score' })
      })
      const data = await res.json()
      const scoreObj = (data?.score && typeof data.score.humanScore === 'number')
        ? data.score
        : (typeof data?.humanScore === 'number' ? data : null);
      if (res.ok && scoreObj) {
        setOutputScores(scoreObj)
        showToast('Rescore Complete', 'Score updated successfully', 'success')
      } else {
        setOutputScores({ unavailable: true })
        showToast('Rescore Failed', data?.error || 'Score unavailable', 'error')
      }
    } catch (e) {
      if (e.name === 'AbortError' || ctrl.signal.aborted) return;
      console.error('Rescore failed', e)
      showToast('Rescore Failed', 'Network or server error', 'error')
    } finally {
      if (rescoreAbortRef.current === ctrl) {
        setReScoring(false)
      }
    }
  }, [showToast, providerLabel])

  const handleGrammar = useCallback(async () => {
    const currentOutput = outputRef.current;
    setChecking(p => ({ ...p, grammar: true }))
    if (grammarAbortRef.current) grammarAbortRef.current.abort()
    const ctrl = new AbortController()
    grammarAbortRef.current = ctrl
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/grammar', { method: 'POST', headers, signal: ctrl.signal, body: JSON.stringify({ text: currentOutput }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Grammar check failed')
      showToast('Grammar Check Complete', `Issues found: ${data.matches?.length || 0}\n${data.matches?.[0] ? `First issue: ${data.matches[0].message}` : 'No issues detected.'}`, data.matches?.length ? 'info' : 'success')
    } catch (e) { 
      if (e.name === 'AbortError' || ctrl.signal.aborted) return;
      showToast('Grammar Check Failed', e.message || 'Could not verify grammar', 'error')
    } finally {
      if (grammarAbortRef.current === ctrl) {
        setChecking(p => ({ ...p, grammar: false }))
      }
    }
  }, [showToast])

  const handleReadability = useCallback(async () => {
    const currentOutput = outputRef.current;
    setChecking(p => ({ ...p, readability: true }))
    if (readabilityAbortRef.current) readabilityAbortRef.current.abort()
    const ctrl = new AbortController()
    readabilityAbortRef.current = ctrl
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/readability', { method: 'POST', headers, signal: ctrl.signal, body: JSON.stringify({ text: currentOutput }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Readability check failed')
      showToast('Readability Metrics', `Grade Level: ${data.metrics?.fleschKincaidGrade ?? 'N/A'}\nReading Ease: ${data.metrics?.fleschReadingEase ?? 'N/A'}/100\nAvg Sentence Length: ${data.metrics?.avgSentenceLength ?? 'N/A'} words\nGunning Fog: ${data.metrics?.gunningFog ?? 'N/A'}`, 'success')
    } catch (e) {
      if (e.name === 'AbortError' || ctrl.signal.aborted) return;
      showToast('Check Failed', 'Readability check failed', 'error')
    } finally {
      if (readabilityAbortRef.current === ctrl) {
        setChecking(p => ({ ...p, readability: false }))
      }
    }
  }, [showToast])

  const handlePlagiarism = useCallback(async () => {
    const currentOutput = outputRef.current;
    setChecking(p => ({ ...p, plagiarism: true }))
    if (plagiarismAbortRef.current) plagiarismAbortRef.current.abort()
    const ctrl = new AbortController()
    plagiarismAbortRef.current = ctrl
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/plagiarism', { method: 'POST', headers, signal: ctrl.signal, body: JSON.stringify({ text: currentOutput }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Plagiarism check failed')
      let msg = `Uniqueness Score: ${data.unique}%\n`
      if (data.matches && data.matches.length > 0) {
        msg += `Found matching phrases online:\n${data.matches.slice(0, 3).map(m => `"${m.sentence}"`).join('\n')}${data.matches.length > 3 ? `\n...and ${data.matches.length - 3} more` : ''}`
        showToast('Plagiarism Check', msg, 'error')
      } else {
        msg += `Checked a sample of ${data.checkedCount || 5} sentences. No matches found.`
        showToast('Plagiarism Check', msg, 'success')
      }
    } catch (e) { 
      if (e.name === 'AbortError' || ctrl.signal.aborted) return;
      showToast('Check Failed', 'Plagiarism check failed', 'error')
    } finally {
      if (plagiarismAbortRef.current === ctrl) {
        setChecking(p => ({ ...p, plagiarism: false }))
      }
    }
  }, [showToast])

  const clearAll = () => {
    stopStream()
    cancelAllRequests()
    setInput(''); setOutput(''); setError('')
    setInputScores(null); setOutputScores(null); setWordStats(null); setStage(null)
  }

  const loadFromHistory = (item) => {
    if (input.trim() || output.trim()) {
      if (!window.confirm('Overwrite current draft and load this history item?')) return;
    }
    stopStream()
    cancelAllRequests()
    setInput(item.prompt || item.input)
    setOutput(item.output)
    setMode(item.mode)
    setInputScores(item.inputScores || null)
    setOutputScores(item.scores || null)
    setWordStats(item.wordStats)
    setStage('done')
    setActiveTab('editor')
  }

  const wordDiff    = wordStats ? wordStats.output - wordStats.input : 0
  const wordOk      = wordStats && wordStats.input > 0 ? Math.abs((wordStats.output / wordStats.input) - 1) < 0.15 : true

  const SidebarForm = (
            <div className="xl:col-span-3 space-y-4 anim-fade-up-1">

              {/* Mode selector */}
              <div className="sidebar-deep rounded-3xl p-5" style={{ transform: 'none' }}>
                <label className="block text-sm font-bold text-slate-700 tracking-wide mb-2.5">Humanize Mode</label>
                <div className="space-y-2.5" role="radiogroup">
                  {MODES.map(m => (
                    <button type="button" key={m.id} onClick={() => setMode(m.id)} role="radio" aria-checked={mode === m.id}
                      className={`w-full p-3.5 rounded-2xl border transition-all duration-200 text-left group
                        ${mode === m.id 
                          ? `${MC[m.id].b} ${MC[m.id].bg} shadow-[0_6px_18px_-3px_rgba(15,23,42,0.10),inset_0_1px_1px_rgba(255,255,255,0.95)]` 
                          : 'border-slate-200/90 bg-white/85 shadow-[0_2px_6px_rgba(15,23,42,0.03),inset_0_1px_1px_rgba(255,255,255,0.9)] backdrop-blur-sm hover:border-slate-300 hover:bg-white hover:shadow-sm'}`}>
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <div className="flex items-center gap-2.5">
                          <span className="text-base shrink-0">{m.icon}</span>
                          <span className={`font-bold leading-tight ${mode === m.id ? MC[m.id].t : 'text-slate-900 group-hover:text-slate-950'}`}>{m.label}</span>
                        </div>
                        <span className={`shrink-0 font-bold px-2 py-0.5 rounded-lg transition-all ${mode === m.id ? MC[m.id].badge : 'opacity-0'}`}>
                          {m.expect}
                        </span>
                      </div>
                      <p className="text-slate-500 font-normal pl-6 leading-snug">{m.desc}</p>
                    </button>
                  ))}
                </div>
                {/* Active mode info */}
                <div className={`mt-3 p-3.5 rounded-2xl border ${mc.b} ${mc.bg} backdrop-blur-sm transition-all duration-300`}>
                  <p className={`text-xs font-bold tracking-wide mb-1 flex items-center gap-1.5 ${mc.t}`}>
                    <span>{MODES.find(m=>m.id===mode)?.icon}</span>
                    <span>{MODES.find(m=>m.id===mode)?.label} Mode</span>
                  </p>
                  <p className="text-xs text-slate-600 leading-relaxed font-normal">{MODE_INFO[mode]}</p>
                </div>
              </div>

              {/* Tone Sliders */}
              <div className="sidebar-deep rounded-3xl p-5" style={{ transform: 'none' }}>
                <label className="block text-sm font-bold text-slate-700 tracking-wide mb-2.5">Granular Tone Controls</label>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between items-center mb-1.5">
                      <span className="text-sm font-bold text-slate-700">Vocabulary</span>
                      <span className="text-xs font-semibold text-slate-800 bg-white/95 px-2.5 py-0.5 rounded-full border border-slate-200/90 shadow-sm">{vocab == 50 ? 'Standard' : vocab < 50 ? 'Accessible' : 'Academic'}</span>
                    </div>
                    <input type="range" min="0" max="100" value={vocab} onChange={(e) => setVocab(e.target.value)}
                           className="apple-slider w-full" />
                    <div className="flex justify-between mt-1 text-slate-400 font-medium text-xs">
                      <span>Simple</span>
                      <span>Scholarly</span>
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between items-center mb-1.5">
                      <span className="text-sm font-bold text-slate-700">Sentence Pacing</span>
                      <span className="text-xs font-semibold text-slate-800 bg-white/95 px-2.5 py-0.5 rounded-full border border-slate-200/90 shadow-sm">{sentenceLength == 50 ? 'Balanced' : sentenceLength < 50 ? 'Punchy' : 'Flowing'}</span>
                    </div>
                    <input type="range" min="0" max="100" value={sentenceLength} onChange={(e) => setSentenceLength(e.target.value)}
                           className="apple-slider w-full" />
                    <div className="flex justify-between mt-1 text-slate-400 font-medium text-xs">
                      <span>Punchy</span>
                      <span>Flowing</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Advanced Settings */}
              <div className="sidebar-deep rounded-3xl p-5" style={{ transform: 'none' }}>
                <label className="block text-sm font-bold text-slate-700 tracking-wide mb-2.5">Advanced Engine Controls</label>
                <div className="space-y-2.5">
                  <div
                    onClick={() => setUseDebate(!useDebate)}
                    role="switch"
                    aria-checked={useDebate}
                    tabIndex={0}
                    onKeyDown={e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); setUseDebate(!useDebate) } }}
                    className={`flex items-center justify-between p-3.5 rounded-2xl border transition-all cursor-pointer ${
                      useDebate ? 'border-violet-300/90 bg-violet-50/80 shadow-sm' : 'border-slate-200/80 bg-white/80 hover:border-slate-300'
                    }`}>
                    <div>
                      <p className="text-sm font-bold text-slate-900 flex items-center gap-2">
                        <Bot className="w-4 h-4 text-violet-600" /> Stylometric Verification
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5 font-normal">Adversarial check against detector markers.</p>
                    </div>
                    <div className={`toggle on-purple ${useDebate ? 'on' : ''}`} />
                  </div>
                  
                  <div className="rounded-2xl border border-slate-200/80 bg-white/80 backdrop-blur-md overflow-hidden transition-all shadow-sm">
                    <button type="button" onClick={() => setShowMemory(!showMemory)} aria-expanded={showMemory} aria-label="Toggle Personal Tone Memory" className="w-full flex items-center justify-between p-3.5 hover:bg-slate-50/60 transition-colors">
                      <div>
                        <p className="text-sm font-bold text-slate-900 flex items-center gap-2 text-left">
                          <BrainCircuit className="w-4 h-4 text-indigo-600" /> Personal Tone Memory
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5 text-left font-normal">Match your exact writing style and cadence.</p>
                      </div>
                      <span className="text-xs text-slate-400 font-bold">{showMemory ? '▲' : '▼'}</span>
                    </button>
                    {showMemory && (
                      <div className="p-3.5 pt-0 border-t border-slate-100 bg-slate-50/50">
                        <DebouncedTextarea
                          value={userMemory}
                          onChange={val => setUserMemory(val)}
                          aria-label="Personal Tone Memory"
                          placeholder="Paste 1-3 paragraphs of your own writing here. The AI will analyze and mimic this exact style, vocabulary, and tone..."
                          className="w-full h-24 p-3 text-sm text-slate-800 bg-white/90 placeholder-slate-400 rounded-xl border border-slate-200/80 focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-400/10 resize-none transition-all leading-relaxed"
                        />
                        <p className="text-xs text-emerald-600 font-semibold mt-1.5 text-right">{userMemory.length > 0 ? '✓ Tone style saved locally' : ''}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* ── SCORE PANEL — full industrial version ── */}
              {(inputScores || outputScores || stage === 'score') && (
                <div className="space-y-4 pt-2">
                  {inputScores && (
                    <div className="relative">
                      <div className="absolute -top-2.5 left-4 px-2.5 py-0.5 bg-slate-800 text-white text-xs font-bold uppercase rounded-md z-10 shadow-sm border border-slate-700">Before (Original Input)</div>
                      <div className="pt-1"><ScorePanel scores={inputScores} loading={false} stage="done" onReScore={null} /></div>
                    </div>
                  )}
                  <div className="relative">
                    {(outputScores || stage === 'score') && <div className="absolute -top-2.5 left-4 px-2.5 py-0.5 bg-emerald-600 text-white text-xs font-bold uppercase rounded-md z-10 shadow-sm border border-emerald-500">After (Humanized)</div>}
                    <div className="pt-1">
                      <ScorePanel
                        scores={outputScores}
                        loading={scoreLoad}
                        stage={stage}
                        onReScore={outputRef.current ? reScore : null}
                        wordStats={wordStats}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
            );

  return (
    <div className="ps-page pt-20 pb-24">
      <div className="relative max-w-7xl mx-auto px-4 sm:px-8 lg:px-14">

        {/* ── HEADER ── */}
        <div className="pt-6 mb-7 anim-fade-up">
          <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border text-xs font-semibold mb-2.5 gradient-border ${mc.b} ${mc.bg} ${mc.t}`}>
            <span className="relative flex h-2 w-2">
              <span className="ping absolute inline-flex h-full w-full rounded-full bg-current opacity-50" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-current" />
            </span>
            Advanced Humanizer · 5 Modes · Word Count Preserved
          </div>
          <div className="flex flex-wrap items-end gap-4 justify-between">
            <div>
              <h1 className="font-display font-extrabold text-3xl sm:text-4xl lg:text-[2.65rem] text-slate-950 tracking-[-0.03em] mb-1.5 leading-tight">
                AI Text <span className="g-purple">Humanizer</span>
              </h1>
              <p className="page-subheading text-slate-600 max-w-xl">
                Select mode · Paste AI text · Get a real score with breakdown. Industrial-grade bypass engine.
              </p>
            </div>
            {/* Tabs */}
            <div className="flex items-center gap-1.5 p-1.5 bg-slate-100/80 backdrop-blur-md rounded-2xl border border-slate-200/50" role="tablist">
              <button type="button" onClick={() => setActiveTab('editor')} role="tab" aria-selected={activeTab === 'editor'}
                className={`px-4 py-2 rounded-xl text-xs sm:text-[13px] font-bold transition-all ${activeTab==='editor' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                Editor
              </button>
              <button type="button" onClick={() => setActiveTab('history')} role="tab" aria-selected={activeTab === 'history'}
                className={`px-4 py-2 rounded-xl text-xs sm:text-[13px] font-bold transition-all ${activeTab==='history' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                History {history.length > 0 ? `(${history.length})` : ''}
              </button>
            </div>
          </div>
        </div>

          {/* ── HISTORY TAB ── */}
          {activeTab === 'history' && (
            <div className="anim-fade-up">
              {history.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 text-center">
                  <div className="w-16 h-16 rounded-2xl panel-deep flex items-center justify-center mb-4 text-slate-400 shadow-md">
                    <ClipboardList className="w-8 h-8" />
                  </div>
                  <p className="text-slate-700 font-semibold text-sm">No history yet</p>
                  <p className="text-slate-500 text-xs mt-1">Your recent humanizations will appear here</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {history.map(item => (
                    <div key={item.id} className="panel-deep rounded-3xl p-5 glow-card transition-all">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-bold px-3 py-1 rounded-full ${MC[item.mode]?.badge || 'bg-slate-100 text-slate-600'}`}>
                          {MODES.find(m=>m.id===item.mode)?.icon} {item.mode}
                        </span>
                        <span className="text-xs text-slate-400 font-medium">{item.timestamp ? new Date(item.timestamp).toLocaleTimeString() : item.ts} · Neural Core</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {item.scores && !item.scores.unavailable && (
                          <span className={`text-xs font-black px-2.5 py-1 rounded-xl ${item.scores.humanScore >= 75 ? 'bg-emerald-50 text-emerald-700' : item.scores.humanScore >= 50 ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'}`}>
                            {item.scores.humanScore}% human
                          </span>
                        )}
                        <button type="button" onClick={() => loadFromHistory(item)}
                          className="text-xs sm:text-sm font-semibold text-blue-600 hover:text-blue-700 px-3 py-1.5 rounded-xl hover:bg-blue-50 transition-all">
                          Load →
                        </button>
                      </div>
                    </div>
                    <p className="text-sm text-slate-600 truncate">{item.prompt || item.input}…</p>
                    <p className="text-xs text-slate-400 mt-1.5 font-medium">
                      {item.wordStats?.input}w → {item.wordStats?.output}w
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
          )}

          {/* ── EDITOR TAB ── */}
          {activeTab === 'editor' && (
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 min-h-[calc(100vh-220px)]">

            {/* ── SIDEBAR ── */}
            {SidebarForm}

            {/* ── MAIN AREA (SPLIT SCREEN) ── */}
            <div className="xl:col-span-9 flex flex-col lg:flex-row gap-6 anim-fade-up-2">
              
              {/* LEFT: INPUT AREA */}
              <div className="flex-1 space-y-3.5 flex flex-col">

              {/* Progress indicator */}
              {stage && stage !== 'done' && !useDebate && (
                <div className={`flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 px-5 py-3.5 sidebar-deep rounded-2xl border ${mc.b} anim-fade-in shadow-sm`}>
                  <div className="flex items-center gap-3.5 flex-wrap">
                    {STAGES.map((s, i) => {
                      const idx   = STAGES.findIndex(x => x.id === stage)
                      const sDone = i < idx
                      const sCurr = s.id === stage
                      return (
                        <React.Fragment key={s.id}>
                          <div className={`flex items-center gap-1.5 text-xs sm:text-sm font-semibold transition-all ${sCurr ? mc.t : sDone ? 'text-emerald-600' : 'text-slate-400'}`}>
                            {sDone ? '✓' : sCurr ? <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full spin inline-block" /> : s.icon}
                            <span>{s.label}</span>
                          </div>
                          {i < STAGES.length - 1 && <span className="text-slate-300 text-xs">→</span>}
                        </React.Fragment>
                      )
                    })}
                  </div>
                  {statusMsg && (
                    <span className="text-xs font-bold text-violet-700 bg-violet-100/90 px-3 py-1 rounded-full animate-pulse border border-violet-200">
                      {statusMsg.replace(/_/g, ' ')}
                    </span>
                  )}
                </div>
              )}
              {stage && stage !== 'done' && useDebate && (
                <div className="bg-slate-900 rounded-3xl p-5 font-mono text-xs text-green-400 overflow-hidden relative shadow-inner anim-fade-in border border-slate-800">
                  <div className="flex items-center justify-between mb-3 border-b border-slate-800 pb-2.5">
                    <span className="flex items-center gap-2">
                      <Bot className="w-4 h-4 text-green-500" />
                      <span className="font-bold text-slate-300 uppercase tracking-wider text-xs">Stylometric Verification Pass</span>
                    </span>
                    <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />
                  </div>
                  <div className="space-y-1.5 max-h-32 overflow-y-auto flex flex-col-reverse text-xs">
                    <div className="flex gap-2">
                       <span className="text-slate-500">[{new Date().toISOString().split('T')[1].slice(0,8)}]</span>
                       <span className="text-green-400 animate-pulse">&gt; _</span>
                    </div>
                    {[...(statusLog || [])].reverse().map((log, i) => (
                      <div key={i} className="flex gap-2 opacity-80">
                        <span className="text-slate-500">[{new Date(log.time).toISOString().split('T')[1].slice(0,8)}]</span>
                        <span className={log.msg.includes('critique') ? 'text-amber-400' : log.msg.includes('drafting') ? 'text-blue-400' : log.msg.includes('healing') ? 'text-fuchsia-400' : 'text-green-400'}>
                          &gt; {log.msg.toUpperCase().replace(/_/g, ' ')}...
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Status bar */}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-1">
                <span className="flex items-center gap-1.5 text-xs sm:text-sm">
                  <span className="text-slate-500 font-medium">Engine:</span>
                  <span className="font-bold text-slate-800 px-2 py-0.5 bg-slate-100 rounded-lg">Neural v8.4</span>
                </span>
                <span className="text-slate-300">·</span>
                <span className="flex items-center gap-1.5 text-xs sm:text-sm">
                  <span className="text-slate-500 font-medium">Mode:</span>
                  <span className={`font-bold px-2 py-0.5 rounded-lg capitalize ${mc.badge}`}>{mode}</span>
                </span>
                <span className="text-slate-300">·</span>
                <span className="text-xs sm:text-sm text-slate-500 font-medium">Expected: <span className="font-bold text-emerald-600">{MODES.find(m=>m.id===mode)?.expect}</span></span>
                {wordStats && (
                  <>
                    <span className="text-slate-300">·</span>
                    <span className={`text-xs sm:text-sm font-semibold ${wordOk ? 'text-emerald-600' : 'text-amber-600'}`}>
                      {wordStats.input}w → {wordStats.output}w ({wordDiff > 0 ? '+' : ''}{wordDiff}) {wordOk ? '✓' : '⚠️'}
                    </span>
                  </>
                )}
              </div>

              {/* Input */}
              <div className={`panel-deep overflow-hidden ring-4 ring-transparent transition-all duration-300 flex-1 flex flex-col h-full ${loading ? `ring-4 ${mc.ring}` : ''}`} style={{ transform: 'none' }}>
                <div className="panel-header">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-violet-500 shadow-[0_0_8px_rgba(139,92,246,0.6)]" />
                    <label htmlFor="input-text" className="text-sm font-bold text-slate-900 tracking-tight">Input — AI Text</label>
                    {mode === 'aggressive' && (
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-600 border border-rose-200 flex items-center gap-1">
                        <Flame className="w-3 h-3" /> MAX POWER
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2.5">
                    <span className={`text-xs font-semibold tabular-nums ${inputWords > 50 ? 'text-slate-700' : 'text-slate-400'}`}>
                      {inputWords.toLocaleString()} words
                    </span>
                    {inputWords > 0 && (
                      <span className={`text-xs px-2 py-0.5 rounded-lg font-bold ${
                        inputWords < 60  ? 'bg-amber-50 text-amber-600 border border-amber-200/60' :
                        inputWords < 500 ? 'bg-emerald-50 text-emerald-600 border border-emerald-200/60' :
                                           'bg-blue-50 text-blue-600 border border-blue-200/60'
                      }`}>
                        {inputWords < 60 ? <AlertTriangle className="w-3 h-3 inline mr-1" /> : inputWords < 500 ? <CheckCircle2 className="w-3 h-3 inline mr-1" /> : <Maximize2 className="w-3 h-3 inline mr-1" />}
                        {inputWords < 60  ? 'Too short' : inputWords < 500 ? 'Optimal' : 'Long'}
                      </span>
                    )}
                    {(input || output) && (
                      <button type="button" onClick={clearAll} className="text-xs text-slate-400 hover:text-rose-500 transition-colors font-medium">Clear</button>
                    )}
                    <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" accept=".txt,.md,.pdf,.docx,.csv,.json" />
                    <button type="button" onClick={() => fileInputRef.current?.click()} className="text-xs font-semibold text-blue-600 hover:text-blue-700 transition-colors">Upload file</button>
                  </div>
                </div>
                <div 
                  className="relative flex-1 flex flex-col h-full"
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                >
                  <DebouncedTextarea
                    id="input-text"
                    value={input}
                    onChange={handleInputChange}
                    maxLength={40000}
                    placeholder={
                      mode === 'aggressive' ? 'Paste AI text or drop a file — every sentence will be completely restructured...'
                      : mode === 'seo'      ? 'Paste AI content or drop a file with keywords — optimized for humans and search...'
                      : mode === 'formal'   ? 'Paste AI text or drop a file — rewritten to executive-level precision...'
                      : mode === 'casual'   ? 'Paste AI text or drop a file — will sound like a brilliant friend explaining it...'
                      : 'Paste AI text or drag & drop a .txt, .pdf, or .docx file here. Minimum 60 words recommended...'
                    }
                    className="w-full px-5 py-4 text-sm text-slate-800 placeholder-slate-400 bg-transparent leading-relaxed focus:outline-none resize-none flex-1 min-h-[420px] lg:min-h-[520px]"
                  />
                  {isDragging && (
                    <div className="absolute inset-0 bg-blue-600/10 backdrop-blur-md border-2 border-dashed border-blue-500 flex flex-col items-center justify-center z-10 transition-all duration-300 rounded-3xl">
                      <Zap className="w-12 h-12 text-blue-600 mb-2 animate-bounce" />
                      <p className="text-blue-700 font-bold text-xl drop-shadow-sm">Drop file to extract text</p>
                      <p className="text-blue-600/80 text-sm mt-1">Supports PDF, DOCX, TXT, MD</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Short word warning */}
              {input.trim() && inputWords < 60 && (
                <div className="flex items-center gap-2.5 px-4 py-2.5 bg-amber-50/90 border border-amber-200/80 rounded-2xl text-xs sm:text-sm text-amber-800 anim-fade-in font-medium">
                  <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" className="shrink-0">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
                  </svg>
                  <span>Paste at least 60 words for strong humanization. Short inputs produce weaker results.</span>
                </div>
              )}

              {/* Error */}
              {error && (
                <div className="flex items-start gap-3 px-4 py-3 bg-rose-50/90 border border-rose-200 rounded-2xl text-xs sm:text-sm text-rose-700 anim-scale-in">
                  <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" className="shrink-0 mt-0.5">
                    <circle cx="12" cy="12" r="10"/><path strokeLinecap="round" d="M12 8v4m0 4h.01"/>
                  </svg>
                  <div>
                    <p className="font-semibold mb-0.5">Generation failed</p>
                    <p className="text-xs sm:text-sm opacity-80">{error}</p>
                    <p className="text-xs opacity-70 mt-1">Automatic engine failover active · Please retry generation.</p>
                  </div>
                </div>
              )}

              {/* Humanize button */}
              <button type="button" onClick={run} disabled={loading || scoreLoad || !input.trim()}
                className={`shimmer-btn w-full py-3.5 rounded-2xl font-bold text-sm tracking-tight transition-all duration-200 active:scale-[0.98]
                  ${loading || scoreLoad || !input.trim()
                    ? 'bg-slate-100/90 text-slate-400 cursor-not-allowed border border-slate-200/70 shadow-xs'
                    : `bg-gradient-to-r ${mc.btn} text-white shadow-[0_10px_24px_-4px_rgba(99,102,241,0.36),0_2px_6px_-1px_rgba(15,23,42,0.08),inset_0_1px_1.5px_rgba(255,255,255,0.3)] hover:shadow-[0_14px_30px_-4px_rgba(99,102,241,0.48)] hover:-translate-y-0.5 active:translate-y-0`
                  }`}>
                {loading ? (
                  <span className="flex items-center justify-center gap-2.5">
                    <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full spin" />
                    {mode === 'aggressive' ? 'Restructuring every sentence…'
                     : mode === 'seo'      ? 'Optimizing for humans + search…'
                     : mode === 'formal'   ? 'Crafting executive prose…'
                     : mode === 'casual'   ? 'Making it sound human…'
                     : 'Humanizing text…'}
                  </span>
                ) : scoreLoad ? (
                  <span className="flex items-center justify-center gap-2.5">
                    <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full spin" />
                    Running detection analysis…
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2.5">
                    {MODES.find(m=>m.id===mode)?.icon}
                    Humanize with {MODES.find(m=>m.id===mode)?.label} Mode
                  </span>
                )}
              </button>
            </div>

            {/* RIGHT: OUTPUT AREA */}
            <div className="flex-1 space-y-3.5 flex flex-col">

              {/* Output */}
              <OutputBox output={output} label="Humanized Output" accent="purple" loading={loading} onContinue={handleContinue} emptySubtext="Paste AI text and click Humanize to begin" className="flex-1 h-full" />

              {/* Action buttons (shown after output) */}
              {output && !loading && (
                <div className="flex flex-wrap items-center justify-between gap-3 mt-2">
                  <div className="flex gap-2">
                    <button type="button" onClick={handleGrammar} disabled={checking.grammar} className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-xl bg-sky-50 text-sky-700 border border-sky-200/80 hover:bg-sky-100 transition-all disabled:opacity-50">
                      {checking.grammar ? <span className="w-3.5 h-3.5 border-2 border-sky-700 border-t-transparent rounded-full spin" /> : <Search className="w-4 h-4" />} Grammar
                    </button>
                    <button type="button" onClick={handleReadability} disabled={checking.readability} className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-200/80 hover:bg-indigo-100 transition-all disabled:opacity-50">
                      {checking.readability ? <span className="w-3.5 h-3.5 border-2 border-indigo-700 border-t-transparent rounded-full spin" /> : <BookOpen className="w-4 h-4" />} Readability
                    </button>
                    <button type="button" onClick={handlePlagiarism} disabled={checking.plagiarism} className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200/80 hover:bg-emerald-100 transition-all disabled:opacity-50">
                      {checking.plagiarism ? <span className="w-3.5 h-3.5 border-2 border-emerald-700 border-t-transparent rounded-full spin" /> : <SearchCode className="w-4 h-4" />} Check Plagiarism
                    </button>
                  </div>
                  {stage !== 'score' && (
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={reScore} disabled={scoreLoad}
                        className={`flex items-center gap-2 text-sm font-semibold px-4 py-2.5 rounded-xl border transition-all
                          ${scoreLoad ? 'opacity-50 cursor-not-allowed border-slate-200 text-slate-400' : 'border-slate-200/80 text-slate-600 hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50/60'}`}>
                        {scoreLoad ? <span className="w-3.5 h-3.5 border border-current border-t-transparent rounded-full spin" /> : <BarChart2 className="w-4 h-4" />}
                        Re-analyze score
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          </div>
        )}
      </div>

      {/* Toast Notification */}
      {toast && (
        <div aria-live="assertive" className="fixed bottom-6 right-6 z-50 anim-fade-up max-w-sm w-full bg-white border border-slate-200 rounded-2xl shadow-2xl p-4 flex gap-3">
          <div className="mt-0.5 flex items-center justify-center">
            {toast.type === 'error' ? <XCircle className="w-6 h-6 text-red-500" /> : toast.type === 'success' ? <CheckCircle2 className="w-6 h-6 text-emerald-500" /> : <Info className="w-6 h-6 text-blue-500" />}
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-800">{toast.title}</h4>
            <p className="text-xs text-slate-500 mt-1 whitespace-pre-wrap leading-relaxed">{toast.message}</p>
          </div>
          <button type="button" onClick={() => { if (toastTimerRef.current) clearTimeout(toastTimerRef.current); setToast(null); }} className="ml-auto text-slate-400 hover:text-slate-600 transition-colors">✕</button>
        </div>
      )}
    </div>
  )
}
