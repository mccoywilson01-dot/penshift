import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { ScorePanel, AnimBar } from '../components/Components.jsx'
import { Link } from 'react-router-dom'
import { Sparkles, Zap, Check, AlertCircle, Activity, BookOpen, Target, Shuffle, BarChart2 } from 'lucide-react'
import { saveHistory, loadHistory } from '../lib/supabase.js'
import { useSettings } from '../hooks/SettingsContext.jsx'
import { countWords } from '../lib/utils.js'

const LEVEL_CFG = {
  human: { label:'Human-like', color:'text-emerald-700', bg:'bg-emerald-50 border-emerald-200', tip:'Your text should bypass most AI detectors.' },
  mixed: { label:'Mixed Signal', color:'text-amber-700', bg:'bg-amber-50 border-amber-200',     tip:'May trigger some detectors. Use Humanizer to improve.' },
  ai:    { label:'AI Detected', color:'text-red-700',    bg:'bg-red-50 border-red-200',         tip:'Will likely be flagged. Use Aggressive mode in Humanizer.' },
}

const getScoreTier = (score) => {
  if (score == null) return null;
  const rounded = Math.round(score);
  return rounded >= 80 ? 'human' : rounded >= 50 ? 'mixed' : 'ai';
}

const TIER_CLASSES = {
  emerald: { bg: 'bg-emerald-50', text: 'text-emerald-700', fill: 'bg-emerald-400' },
  amber: { bg: 'bg-amber-50', text: 'text-amber-700', fill: 'bg-amber-400' },
  red: { bg: 'bg-red-50', text: 'text-red-700', fill: 'bg-red-400' }
};

const STORAGE_KEY = 'penshift_history_score';

const timeFormatter = new Intl.DateTimeFormat(undefined, { timeStyle: 'short' });

export default function Score() {
  const [input,    setInput]    = useState('')
  const [loading,  setLoading]  = useState(false)
  const [scores,   setScores]   = useState(null)
  const [error,    setError]    = useState('')
  const [history,  setHistory]  = useState([])
  
  useEffect(() => {
    loadHistory(STORAGE_KEY).then(data => {
      if (data && data.length > 0) setHistory(data)
    })
  }, [])
  const [tab,      setTab]      = useState('analyzer') // analyzer | history | guide

  const { apiProvider } = useSettings()

  const abortControllerRef = useRef(null)

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
        abortControllerRef.current = null
      }
    }
  }, [])

  const handleInputUpdate = useCallback((val) => {
    setInput(val)
  }, [])

  const handleClearStates = useCallback(() => {
    setScores(null)
    setError('')
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
    setLoading(false)
  }, [])

  const inputWords = useMemo(() => countWords(input), [input])

  const currentIdempotencyKeyRef = useRef(null);
  const lastRequestParamsRef = useRef(null);

  const analyze = useCallback(async () => {
    if (!input.trim() || loading) return
    setLoading(true); setError(''); setScores(null)
    if (abortControllerRef.current) abortControllerRef.current.abort()
    const controller = new AbortController()
    abortControllerRef.current = controller

    const timeoutId = setTimeout(() => controller.abort(), 60000)

    try {
      const trimmedInput = input.trim();
      const paramsKey = JSON.stringify({ prompt: trimmedInput, apiProvider });
      const isRetry = Boolean(
        currentIdempotencyKeyRef.current &&
        lastRequestParamsRef.current === paramsKey
      );

      const idempotencyKey = isRetry
        ? currentIdempotencyKeyRef.current
        : ((typeof crypto !== 'undefined' && crypto.randomUUID)
            ? crypto.randomUUID()
            : `idemp-score-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`);

      currentIdempotencyKeyRef.current = idempotencyKey;
      lastRequestParamsRef.current = paramsKey;

      const headers = {
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey,
      };
      try {
        const { getAuthHeaders } = await import('../lib/supabase.js');
        const authHeaders = await getAuthHeaders();
        Object.assign(headers, authHeaders);
      } catch (e) {
        console.error('Failed to get auth headers', e);
      }

      const res  = await fetch('/api/generate', {
        method: 'POST',
        headers,
        signal: controller.signal,
        body: JSON.stringify({ prompt: trimmedInput, apiProvider: apiProvider, task: 'score', idempotencyKey }),
      })
      let data;
      try {
        if (res.headers.get('content-type')?.includes('application/json')) data = await res.json();
      } catch (err) { /* non-critical error ignored */ }
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      if (!data) throw new Error('Invalid response from server.');

      const scoreObj = (data?.score && typeof data.score.humanScore === 'number')
        ? data.score
        : (typeof data?.humanScore === 'number' ? data : null);

      if (scoreObj && typeof scoreObj.humanScore === 'number') {
        if (controller.signal.aborted) return;
        setScores(scoreObj);
        const newItem = {
          id: Date.now(),
          type: 'Score',
          prompt: input,
          output: JSON.stringify(scoreObj),
          score: scoreObj,
          words: inputWords,
          timestamp: new Date().toISOString(),
        };
        setHistory(prev => [newItem, ...prev].slice(0, 50));
        saveHistory(newItem, STORAGE_KEY);
      } else {
        throw new Error(data?.message || data?.error || 'Score unavailable. AI detection scoring is temporarily unavailable.');
      }
    } catch (e) {
      if (e.name === 'AbortError' || controller.signal.aborted) return;
      setError(e.message || 'Analysis failed.')
    } finally {
      clearTimeout(timeoutId)
      if (abortControllerRef.current === controller) setLoading(false)
    }
  }, [input, loading, apiProvider, inputWords])

  const level = scores ? getScoreTier(scores.humanScore) : null

  return (
    <div className="ps-page pt-20 pb-24">
      <div className="relative max-w-5xl mx-auto px-4 sm:px-8 lg:px-14">

        {/* Header */}
        <div className="pt-6 mb-7 anim-fade-up">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-100 text-emerald-700 text-xs font-semibold mb-2.5 gradient-border">
            <span className="relative flex h-2 w-2">
              <span className="ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            AI Detection Analyzer · 5-Signal Breakdown · History
          </div>
          <div className="flex flex-wrap items-end gap-4 justify-between">
            <div>
              <h1 className="font-display font-extrabold text-3xl sm:text-4xl lg:text-[2.75rem] text-slate-950 tracking-[-0.03em] mb-1.5 leading-tight">
                AI Detection <span className="g-emerald">Score</span>
              </h1>
              <p className="page-subheading text-slate-600 max-w-xl">Instant Human% / AI% with 5-signal breakdown. Know exactly what detectors will flag.</p>
            </div>
            <div className="seg-ctrl" role="tablist" aria-label="Score Tabs">
              {[{id:'analyzer',label:'Analyzer',icon:<BarChart2 size={16} />},{id:'history',label:`History (${history.length})`,icon:<BookOpen size={16} />},{id:'guide',label:'Guide',icon:<BookOpen size={16} />}].map((t, idx, arr)=>(
                <button type="button"                   key={t.id} 
                  id={`tab-${t.id}`}
                  role="tab"
                  aria-selected={tab === t.id}
                  aria-controls={`panel-${t.id}`}
                  tabIndex={tab === t.id ? 0 : -1}
                  onKeyDown={(e) => {
                    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
                      e.preventDefault();
                      const nextIdx = e.key === 'ArrowRight' ? (idx + 1) % arr.length : (idx - 1 + arr.length) % arr.length;
                      const nextId = arr[nextIdx].id;
                      setTab(nextId);
                      document.getElementById(`tab-${nextId}`)?.focus();
                    }
                  }}
                  onClick={()=>setTab(t.id)} 
                  className={`seg-btn flex items-center gap-1.5 ${tab===t.id?'active':''}`}>
                  {t.icon} {t.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Score legend */}
        <div className="flex flex-wrap gap-2.5 mb-6 anim-fade-up-1">
          {[
            {range:'80–100', label: <span className="flex items-center gap-1">Human-like <Check size={13} /></span>, cls:'bg-emerald-50 border-emerald-200 text-emerald-700'},
            {range:'50–79',  label:'Mixed Signal',  cls:'bg-amber-50 border-amber-200 text-amber-700'},
            {range:'0–49',   label:'AI-like',        cls:'bg-red-50 border-red-200 text-red-700'},
          ].map(({range,label,cls})=>(
            <span key={range} className={`inline-flex items-center gap-2 text-xs font-semibold px-3 py-1 rounded-full border ${cls}`}>
              <span className="font-black">{range}</span> → {label}
            </span>
          ))}
        </div>

        {/* ── ANALYZER TAB ── */}
        <div id="panel-analyzer" role="tabpanel" aria-labelledby="tab-analyzer" style={{ display: tab === 'analyzer' ? 'grid' : 'none' }} className="grid-cols-1 lg:grid-cols-3 gap-6 min-h-[calc(100vh-250px)]">

          <div className="lg:col-span-2 space-y-4 flex flex-col anim-fade-up-1">

              {/* Input */}
              <div className="panel-deep overflow-hidden transition-all duration-300 flex-1 flex flex-col h-full min-h-[420px]">
                <div className="panel-header">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
                    <label htmlFor="analyzer-input" className="text-sm font-bold text-slate-800 tracking-tight">Text to Analyze</label>
                    <span className="text-xs text-slate-400 font-medium">Min. 60 words</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <span className={`text-xs px-2.5 py-0.5 rounded-lg font-bold ${inputWords >= 60 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60' : inputWords > 20 ? 'bg-amber-50 text-amber-700 border border-amber-200/60' : 'bg-slate-100 text-slate-500'}`}>
                      {inputWords} words
                    </span>
                    {input && <button type="button" onClick={() => { if (abortControllerRef.current) abortControllerRef.current.abort(); setLoading(false); setInput(''); setScores(null); setError('') }} className="text-xs text-slate-400 hover:text-rose-500 font-medium transition-colors">Clear</button>}
                  </div>
                </div>
                <textarea
                  id="analyzer-input"
                  value={input}
                  maxLength={40000}
                  onChange={e => { handleInputUpdate(e.target.value); handleClearStates(); }}
                  placeholder="Paste any text — AI-generated or human-written — to get an instant detection score with 5-signal breakdown including sentence variation, vocabulary diversity, burstiness, predictability, and structure randomness…"
                  className="w-full flex-1 px-5 py-4 text-sm text-slate-800 bg-transparent placeholder-slate-400 leading-relaxed focus:outline-none resize-none min-h-[350px]"
                />
                {/* Word progress */}
                <div className="panel-footer">
                  <div className="flex justify-between text-xs text-slate-500 mb-1.5 font-medium">
                    <span>Min. recommended: 60 words</span>
                    <span className={inputWords >= 60 ? 'text-emerald-600 font-bold' : 'text-slate-400'}>{inputWords >= 60 ? '✓ Good length' : `${Math.max(0, 60-inputWords)} more words needed`}</span>
                  </div>
                  <AnimBar to={Math.min((inputWords/60)*100, 100)} color={inputWords >= 60 ? 'bg-emerald-400' : 'bg-amber-400'} height="h-2" />
                </div>
              </div>

              {/* Error */}
              {error && (
                <div className="flex items-start gap-3 px-4 py-3 bg-rose-50/90 border border-rose-200 rounded-2xl text-xs sm:text-sm text-rose-700 anim-scale-in">
                  <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" className="shrink-0 mt-0.5">
                    <circle cx="12" cy="12" r="10"/><path strokeLinecap="round" d="M12 8v4m0 4h.01"/>
                  </svg>
                  <div>
                    <p className="font-semibold mb-0.5">Analysis failed</p>
                    <p className="text-xs sm:text-sm opacity-80">{error}</p>
                    <p className="text-xs opacity-70 mt-1">Multi-signal neural probability analysis</p>
                  </div>
                </div>
              )}

              {/* Analyze button */}
              <button type="button" onClick={analyze} disabled={loading || !input.trim()}
                className={`shimmer-btn w-full py-3.5 rounded-2xl font-bold text-sm tracking-tight transition-all duration-200 active:scale-[0.98]
                  ${loading || !input.trim()
                    ? 'bg-slate-100/90 text-slate-400 cursor-not-allowed border border-slate-200/70 shadow-xs'
                    : 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-[0_10px_24px_-4px_rgba(16,185,129,0.36),0_2px_6px_-1px_rgba(15,23,42,0.08),inset_0_1px_1.5px_rgba(255,255,255,0.3)] hover:shadow-[0_14px_30px_-4px_rgba(16,185,129,0.48)] hover:-translate-y-0.5 active:translate-y-0'}`}>
                {loading ? (
                  <span className="flex items-center justify-center gap-2.5">
                    <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full spin" />
                    Analyzing 5 detection signals…
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2.5">
                    <BarChart2 size={18} /> Analyze AI Probability
                  </span>
                )}
              </button>

              {/* Breakdown cards when score available */}
              {scores?.breakdown && (
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 anim-fade-in">
                  {[
                    {k:'sentenceVariation',   label:'Sentence Var.',  icon: <Activity size={20} className="mx-auto" />},
                    {k:'vocabularyDiversity', label:'Vocabulary',     icon: <BookOpen size={20} className="mx-auto" />},
                    {k:'burstiness',          label:'Burstiness',     icon: <Zap size={20} className="mx-auto" />},
                    {k:'predictability',      label:'Predict.',       icon: <Target size={20} className="mx-auto" />},
                    {k:'structureRandomness', label:'Structure',      icon: <Shuffle size={20} className="mx-auto" />},
                  ].map(({k,label,icon}, i) => {
                    const val = scores.breakdown[k] ?? 0
                    const pct = (val/20)*100
                    const color = pct >= 70 ? 'bg-gradient-to-br from-emerald-400 to-teal-500' : pct >= 40 ? 'bg-gradient-to-br from-amber-400 to-orange-400' : 'bg-gradient-to-br from-rose-400 to-red-500'
                    const textColor = pct >= 70 ? 'text-emerald-600' : pct >= 40 ? 'text-amber-600' : 'text-rose-500'
                    return (
                      <div key={k} className="sidebar-deep rounded-2xl p-3.5 text-center glow-card card-enter" style={{animationDelay:`${i*80}ms`}}>
                        <div className={`mb-1.5 icon-lift ${textColor}`}>{icon}</div>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-0.5">{label}</p>
                        <p className="font-bold text-base text-slate-900 tabular-nums leading-none mb-1.5">{val}<span className="text-[10px] text-slate-400 font-normal ml-0.5">/20</span></p>
                        <div className="h-1.5 bg-slate-100/80 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${color}`} style={{width:'100%',transform:`scaleX(${pct / 100})`,transformOrigin:'left',transition:'transform 1.1s cubic-bezier(0.16,1,0.3,1)'}} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Result summary */}
              {scores && level && (
                <div className={`panel-deep output-panel-glow p-5 anim-scale-in border-l-4 ${level==='human'?'border-emerald-400':level==='mixed'?'border-amber-400':'border-rose-400'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-bold text-slate-800">Result: <span className={LEVEL_CFG[level].color}>{LEVEL_CFG[level].label}</span></p>
                    <span className={`font-bold text-xl ${LEVEL_CFG[level].color} tabular-nums tracking-tight`}>{Math.round(scores.humanScore)}% Human</span>
                  </div>
                  <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">{LEVEL_CFG[level].tip}</p>
                  {level !== 'human' && (
                    <Link to="/humanizer" className="inline-flex items-center gap-1.5 mt-3 text-xs font-bold text-violet-700 bg-white border border-violet-200/80 px-3.5 py-1.5 rounded-xl hover:bg-violet-50 hover:shadow-md transition-all shadow-sm">
                      <Zap size={14} /> Humanize this text →
                    </Link>
                  )}
                </div>
              )}
            </div>

            {/* Score Panel */}
            <div className="lg:col-span-1 anim-fade-up-2">
              {!scores && (
                <div className="sidebar-deep rounded-3xl p-5 mb-4">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3.5">What We Analyze</p>
                  <div className="space-y-3.5">
                    {[
                      {icon:<Activity size={17} className="text-emerald-600" />, t:'Sentence Variation', d:'Length diversity — human writing fluctuates wildly'},
                      {icon:<BookOpen size={17} className="text-indigo-600" />, t:'Vocabulary Diversity', d:'Word richness — AI repeats predictable patterns'},
                      {icon:<Zap size={17} className="text-amber-500" />, t:'Burstiness', d:'Short + long sentence mix — #1 detector signal'},
                      {icon:<Target size={17} className="text-rose-500" />, t:'Predictability', d:'Next-word likelihood — AI scores very high here'},
                      {icon:<Shuffle size={17} className="text-violet-600" />, t:'Structure Randomness', d:'Paragraph and section variety'},
                    ].map(({icon,t,d})=>(
                      <div key={t} className="flex items-start gap-2.5 group">
                        <span className="shrink-0 mt-0.5 icon-lift">{icon}</span>
                        <div>
                          <p className="text-xs sm:text-sm font-bold text-slate-800">{t}</p>
                          <p className="text-xs text-slate-500 leading-relaxed mt-0.5">{d}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <ScorePanel scores={scores} loading={loading} stage={loading ? 'score' : scores ? 'done' : null} />
            </div>
          </div>

        {/* ── HISTORY TAB ── */}
        {tab === 'history' && (
          <div id="panel-history" role="tabpanel" aria-labelledby="tab-history" className="anim-fade-up">
            {history.length > 0 && (
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-slate-800">Your Recent Scores</h3>
                <button type="button" onClick={() => { setHistory([]); try { localStorage.removeItem(STORAGE_KEY); localStorage.removeItem(`${STORAGE_KEY}_guest`); } catch(e){ /* non-critical error ignored */ } }} className="text-xs text-red-600 hover:text-red-700 font-semibold transition-colors px-3 py-1.5 rounded-xl hover:bg-red-50">
                  Clear History
                </button>
              </div>
            )}
            {history.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <div className="w-16 h-16 rounded-2xl panel-deep flex items-center justify-center mb-4 shadow-md"><BookOpen size={28} className="text-slate-400" /></div>
                <p className="text-slate-700 font-bold text-sm">No analysis history yet</p>
                <p className="text-slate-500 text-xs mt-1">Your scored texts will appear here</p>
              </div>
            ) : (
              <div className="space-y-3">
                {history.map(item => {
                  const itemTier = getScoreTier(item?.score?.humanScore) || 'ai';
                  const tierColor = itemTier === 'human' ? 'emerald' : itemTier === 'mixed' ? 'amber' : 'red';
                  const tierText = itemTier === 'human' ? 'Human-like' : itemTier === 'mixed' ? 'Mixed' : 'AI-like';
                  const tc = TIER_CLASSES[tierColor];
                  return (
                  <button type="button" tabIndex={0} key={item.id}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { setInput(item.prompt || item.text || item.input || ''); setScores(item.score); setError(''); setLoading(false); setTab('analyzer'); } }}
                    onClick={() => { setInput(item.prompt || item.text || item.input || ''); setScores(item.score); setError(''); setLoading(false); setTab('analyzer'); }}
                    className="w-full text-left panel-deep glow-card rounded-3xl p-4.5 flex items-center gap-3.5 cursor-pointer transition-all">
                      <div className={`shrink-0 w-14 h-14 rounded-2xl flex items-center justify-center font-black text-lg ${tc.bg} ${tc.text}`}>
                        {Math.round(item?.score?.humanScore || 0)}%
                      </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs sm:text-sm font-semibold text-slate-800 truncate">{((item.prompt || item.text || item.input) || '').slice(0,100)}…</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[11px] text-slate-400 font-medium">{item.timestamp ? timeFormatter.format(new Date(item.timestamp)) : item.ts}</span>
                        <span className="text-xs text-slate-300">·</span>
                        <span className="text-[11px] text-slate-400 font-medium">{item.words} words</span>
                        <span className="text-xs text-slate-300">·</span>
                        <span className={`text-[11px] font-bold ${tc.text}`}>
                          {tierText}
                        </span>
                      </div>
                    </div>
                    <div className="w-20">
                      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${tc.fill}`}
                          style={{width:`${Math.round(item?.score?.humanScore || 0)}%`}} />
                      </div>
                    </div>
                  </button>
                )})}
              </div>
            )}
          </div>
        )}

        {/* ── GUIDE TAB ── */}
        {tab === 'guide' && (
          <div id="panel-guide" role="tabpanel" aria-labelledby="tab-guide" className="anim-fade-up">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {[
                { icon: <Activity size={24} />, title:'Sentence Variation', score:'0–20', desc:'Measures how much your sentence lengths vary. Human writers naturally mix very short sentences (4-8 words) with long ones (25-40 words). AI tends to produce consistent medium-length sentences. Score below 10 = robotic rhythm.', tip:'Use Aggressive mode — it forces extreme length variance.' },
                { icon: <BookOpen size={24} />, title:'Vocabulary Diversity', score:'0–20', desc:'Analyzes how often unique words appear vs repeated ones. AI models overuse certain words and phrases. High vocabulary diversity means rich, varied word choice. Score below 10 = word repetition patterns.', tip:'Try Casual or Standard mode to increase natural vocabulary variety.' },
                { icon: <Zap size={24} />, title:'Burstiness', score:'0–20', desc:'The single most important signal. Measures the "burst" pattern — alternating between dense information-heavy sections and light, punchy ones. Pure AI text is uniformly dense. Human writing breathes.', tip:'Aggressive mode injects maximum burstiness through clause separation and fragment sentences.' },
                { icon: <Target size={24} />, title:'Predictability', score:'0–20', desc:'How likely is each word given the previous context? AI is extremely predictable — it always picks the most statistically likely next word. Humans make unexpected, creative word choices. Score below 10 = very AI-like.', tip:'Aggressive mode restructures word order and uses unexpected vocabulary.' },
                { icon: <Shuffle size={24} />, title:'Structure Randomness', score:'0–20', desc:'Evaluates paragraph lengths, section transitions, and structural patterns. AI uses very regular structure. Human writing has organic variation in paragraph size, frequent non-sequiturs, and natural section breaks.', tip:'All modes improve structure randomness vs raw AI output.' },
              ].map(({icon,title,score,desc,tip})=>(
                <div key={title} className="sidebar-deep rounded-3xl p-5 glow-card transition-all duration-300">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-violet-600 icon-lift" aria-hidden="true">{icon}</span>
                    <div>
                      <p className="text-sm font-bold text-slate-900">{title}</p>
                      <p className="text-[11px] text-slate-400 font-semibold tracking-wide">Signal Weight: {score}</p>
                    </div>
                  </div>
                  <p className="text-xs sm:text-sm text-slate-600 leading-relaxed mb-3.5">{desc}</p>
                  <div className="px-3.5 py-2.5 bg-violet-50/90 border border-violet-100 rounded-2xl">
                    <p className="flex items-center gap-2 text-xs text-violet-700 font-semibold"><Sparkles size={13} className="shrink-0" /> {tip}</p>
                  </div>
                </div>
              ))}
              {/* Detectors card */}
              <div className="sidebar-deep rounded-3xl p-6 col-span-full shadow-md">
                <p className="flex items-center gap-2 text-sm font-bold text-slate-900 mb-4"><AlertCircle size={17} className="text-emerald-600" /> What Detectors This Affects</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {['GPTZero','Originality.ai','Copyleaks','ZeroGPT','Turnitin','Writer.com','Sapling','Content at Scale'].map(d=>(
                    <div key={d} className="flex items-center gap-2.5 p-3 bg-white/80 border border-slate-200/70 rounded-2xl hover:bg-white hover:border-emerald-300 hover:shadow-sm transition-all">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)] shrink-0" />
                      <span className="text-xs sm:text-sm font-semibold text-slate-800">{d}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
