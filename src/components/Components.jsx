import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { Sparkles, Zap, Copy, Check, AlertCircle, Activity, BookOpen, Target, Shuffle, BarChart2, ChevronDown } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import rehypeSanitize from 'rehype-sanitize'
import remarkGfm from 'remark-gfm'
import { Helmet } from 'react-helmet-async'
import { ExportMenu } from './ExportMenu.jsx'


const STATIC_REHYPE_PLUGINS = [rehypeSanitize]
const STATIC_REMARK_PLUGINS = [remarkGfm]


export const FormSection = React.memo(function FormSection({ title, icon, children, collapsible = false, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen)
  const Tag = collapsible ? 'button' : 'div'
  return (
    <div className="form-section-deep p-5" style={{ contain: 'content', transform: 'none' }}>
      <Tag
        type={collapsible ? "button" : undefined}
        onClick={collapsible ? () => setOpen(v => !v) : undefined}
        aria-expanded={collapsible ? open : undefined}
        className={`flex items-center justify-between w-full transition-all duration-300 ${collapsible ? 'cursor-pointer' : 'cursor-default'} ${open ? 'mb-3.5' : 'mb-0'}`}>
        <div className="flex items-center gap-2.5">
          <span className="text-xl">{icon}</span>
          <span className="text-sm font-extrabold text-slate-900 tracking-normal">{title}</span>
        </div>
        {collapsible && (
          <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-300 ${open ? 'rotate-180' : ''}`} />
        )}
      </Tag>
      <div className={`grid transition-all duration-300 ${open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`} inert={!open ? '' : undefined}>
        <div className="overflow-hidden">
          {children}
        </div>
      </div>
    </div>
  )
})
/* ══════════════════════════════════════════════
   API SELECTOR (DEPRECATED - REMOVED FROM ALL UI)
══════════════════════════════════════════════ */
export const ApiSelector = React.memo(function ApiSelector() {
  return null;
});

/* ══════════════════════════════════════════════
   CUSTOM MARKDOWN RENDERERS (For CTAs and Callouts)
══════════════════════════════════════════════ */
const MARKDOWN_RENDERERS = {
  a: ({ _node, ...props }) => {
    const isCTA = typeof props.children?.[0] === 'string' && props.children[0].startsWith('CTA:');
    if (isCTA) {
      const btnText = props.children[0].replace('CTA:', '').trim();
      return (
        <a href={props.href} target="_blank" rel="sponsored noopener noreferrer" 
           className="inline-flex items-center justify-center px-6 py-3 my-4 text-sm font-extrabold text-white bg-gradient-to-r from-violet-600 to-purple-600 rounded-2xl shadow-lg hover:shadow-xl active:scale-[0.98] transition-all w-full sm:w-auto text-center shine no-underline border border-white/10">
           {btnText} <svg className="w-4 h-4 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3"/></svg>
        </a>
      );
    }
    return <a {...props} target="_blank" rel="noopener noreferrer" className="text-blue-600 font-medium hover:underline hover:text-blue-700 transition-colors" />;
  },
  blockquote: ({ node, ...props }) => {
    // Check inner text for emojis to style Pros/Cons automatically
    const rawText = node?.children?.map(c => {
      if (c.type === 'element' && c.children) return c.children.map(cc => cc.value || '').join('');
      return c.value || '';
    }).join('') || '';
    
    if (rawText.includes('✅') || rawText.includes('Pro:')) {
      return <blockquote {...props} className="p-4 my-4 bg-emerald-50 border-l-4 border-emerald-500 rounded-r-2xl text-emerald-900 shadow-sm not-italic font-medium" />;
    }
    if (rawText.includes('❌') || rawText.includes('Con:')) {
      return <blockquote {...props} className="p-4 my-4 bg-rose-50 border-l-4 border-rose-500 rounded-r-2xl text-rose-900 shadow-sm not-italic font-medium" />;
    }
    if (rawText.includes('Key Takeaway')) {
      return <blockquote {...props} className="p-5 my-5 bg-gradient-to-br from-blue-50 to-sky-50 border-l-4 border-blue-500 rounded-r-3xl text-blue-900 shadow-sm not-italic font-semibold" />;
    }
    return <blockquote {...props} className="border-l-4 border-slate-300 pl-4 py-2 italic text-slate-600 bg-slate-50/50 rounded-r-xl my-4" />;
  },
  table: ({ _node, ...props }) => <div className="overflow-x-auto my-6"><table {...props} className="w-full text-left border-collapse min-w-[500px]" /></div>,
  th: ({ _node, ...props }) => <th {...props} className="p-3 bg-slate-100 border-b-2 border-slate-200 font-bold text-slate-700 text-sm" />,
  td: ({ _node, ...props }) => <td {...props} className="p-3 border-b border-slate-100 text-slate-600 text-sm" />,
};

/* ══════════════════════════════════════════════
   OUTPUT BOX
══════════════════════════════════════════════ */
export const OutputBox = React.memo(function OutputBox({ output, label = 'Output', accent = 'blue', loading = false, onContinue = null, className = '', emptySubtext = 'Configure options and generate content to begin' }) {
  const [copied, setCopied] = useState(false)
  const copyTimeoutRef = useRef(null)

  const mountedRef = useRef(true)

  useEffect(() => {
    const copyTimerRef = copyTimeoutRef;
    return () => { 
      mountedRef.current = false
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current)
    }
  }, [])

  // --- Data derivations (MUST be above callbacks that use cleanOutput) ---
  const { cleanOutput, schemaStr } = useMemo(() => {
    if (!output) return { cleanOutput: '', schemaStr: null }
    let cleanOutput = output
    let schemaStr = null
    
    // Fast path: skip expensive regex if no JSON blocks
    if (cleanOutput.includes('```json')) {
      const schemaMatches = [...cleanOutput.matchAll(/```json\r?\n([\s\S]*?)(?:\r?\n```|$)/g)]
      for (const match of schemaMatches) {
        if (match[1].includes('"@context"')) {
          schemaStr = match[1]
          cleanOutput = cleanOutput.replace(match[0], '')
          break
        }
      }
    }
    
    if (!schemaStr && cleanOutput.includes('<script')) {
      const scriptMatch = cleanOutput.match(/<script\s+type="application\/ld\+json">([\s\S]*?)<\/script>/i)
      if (scriptMatch) {
         schemaStr = scriptMatch[1]
         cleanOutput = cleanOutput.replace(scriptMatch[0], '')
      }
    }
    return { cleanOutput, schemaStr }
  }, [output])

  const safeSchemaJson = useMemo(() => {
    if (!schemaStr) return null;
    try {
      return JSON.stringify(JSON.parse(schemaStr)).replace(/</g, '\\u003c');
    } catch { return null; }
  }, [schemaStr]);

  const stats = useMemo(() => {
    if (!cleanOutput) return { words: 0, chars: 0 }
    return {
      words: cleanOutput.trim().split(/\s+/).filter(Boolean).length,
      chars: cleanOutput.length
    }
  }, [cleanOutput])

  const seoStats = useMemo(() => {
    if (!cleanOutput) return null;
    const words = stats.words;
    const readingTime = Math.max(1, Math.ceil(words / 200));
    
    // Multi-factor content & structural readiness analysis
    const headingMatches = (cleanOutput.match(/^(#{1,6}\s+.+|\*{2}[^*]+\*{2}:?)/gm) || []).length;
    const bulletMatches = (cleanOutput.match(/^(\s*[-*+]\s+|\s*\d+\.\s+)/gm) || []).length;
    const paragraphs = cleanOutput.split(/\n\s*\n/).filter(p => p.trim().length > 0).length;
    
    // Structural score components
    const wordScore = Math.min(40, (words / 800) * 40); // Target at least 800 words
    const structureScore = Math.min(30, (headingMatches * 6) + (bulletMatches * 2));
    const flowScore = paragraphs >= 3 ? 30 : (paragraphs * 10);
    const score = Math.min(100, Math.max(20, Math.round(wordScore + structureScore + flowScore)));

    return { words, readingTime, headingMatches, score, paragraphs };
  }, [cleanOutput, stats.words]);

  // --- Callbacks (depend on cleanOutput) ---
  const copy = useCallback(async () => {
    if (!cleanOutput) return
    try {
      await navigator.clipboard.writeText(cleanOutput)
      if (!mountedRef.current) return;
      setCopied(true)
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current)
      copyTimeoutRef.current = setTimeout(() => {
        if (mountedRef.current) setCopied(false)
      }, 2200)
    } catch {}
  }, [cleanOutput])

  const copyRich = useCallback(async () => {
    if (!cleanOutput) return
    try {
      await navigator.clipboard.writeText(cleanOutput);
      if (!mountedRef.current) return;
      setCopied(true)
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current)
      copyTimeoutRef.current = setTimeout(() => {
        if (mountedRef.current) setCopied(false)
      }, 2200)
    } catch (fallbackErr) {
      console.error('Copy failed completely:', fallbackErr);
    }
  }, [cleanOutput])



  const dotCls = { blue:'bg-blue-500', purple:'bg-violet-500', sky:'bg-sky-500', violet:'bg-purple-500' }[accent] || 'bg-blue-500'

  return (
    <div className={`panel-deep output-panel-glow overflow-hidden transition-all duration-300 flex flex-col ${className}`} style={{ transform: 'none' }}>
      {/* Header */}
      <div className="panel-header">
        <div className="flex items-center gap-2">
          <span className={`w-2.5 h-2.5 rounded-full transition-colors duration-300 ${output && !loading ? `${dotCls} shadow-[0_0_8px_currentColor]` : 'bg-slate-300'}`} />
          <span className="text-sm font-bold text-slate-900 tracking-tight">{label}</span>
          {loading && (
            <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
              <span className="w-3 h-3 rounded-full border-2 border-slate-200 border-t-indigo-500 spin" />
              Generating…
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {output && !loading && (
            <span className="text-xs text-slate-500 font-semibold tabular-nums hidden sm:inline mr-1">
              {stats.words.toLocaleString()} words · {stats.chars.toLocaleString()} chars
            </span>
          )}
          <ExportMenu text={cleanOutput} disabled={!output || loading} />
          {onContinue && output && !loading && !/[.!?"]\s*$/.test(output.trim()) && (
            <button type="button" onClick={onContinue}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl transition-all duration-150 bg-amber-50 text-amber-700 border border-amber-200/80 hover:bg-amber-100 active:scale-95 shadow-sm">
              <Zap size={13} /> Continue
            </button>
          )}
          <button type="button" onClick={copyRich}
            disabled={!output || loading}
            className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl transition-all duration-150
              ${!output || loading
                ? 'opacity-40 bg-slate-50 text-slate-400 cursor-not-allowed border border-slate-200/50'
                : 'bg-violet-50 text-violet-700 border border-violet-200/80 hover:bg-violet-100 active:scale-95 shadow-sm'
              }`}
          >
            <Sparkles size={13} /> Rich Copy
          </button>
          <button type="button" onClick={copy}
            disabled={!output || loading}
            className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl transition-all duration-150
              ${!output || loading
                ? 'opacity-40 bg-slate-50 text-slate-400 cursor-not-allowed border border-slate-200/50'
                : copied
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 scale-95'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200 active:scale-95 border border-slate-200/70 shadow-sm'
              }`}
          >
            {copied
              ? <><Check size={13} />Copied!</>
              : <><Copy size={13} />Copy</>
            }
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="p-5 sm:p-6 min-h-[260px] flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-56 gap-3.5">
            <div className="relative w-10 h-10">
              <div className="absolute inset-0 rounded-full border-2 border-slate-100 border-t-indigo-500 spin" />
              <div className="absolute inset-1.5 rounded-full border-2 border-transparent border-b-violet-400 spin-rev" />
            </div>
            <p className="text-sm text-slate-600 font-medium">AI is crafting your content…</p>
          </div>
        ) : output ? (
          <div className="prose-out text-slate-800 text-sm leading-relaxed anim-fade-in" aria-live="polite" aria-atomic="false">
            {safeSchemaJson && (
              <Helmet>
                <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeSchemaJson }} />
              </Helmet>
            )}
            <ReactMarkdown components={MARKDOWN_RENDERERS} rehypePlugins={STATIC_REHYPE_PLUGINS} remarkPlugins={STATIC_REMARK_PLUGINS}>{cleanOutput}</ReactMarkdown>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center min-h-[300px] h-full gap-3 text-center select-none py-14 px-6">
            <div className="relative flex items-center justify-center mb-1">
              <div className="absolute w-24 h-24 rounded-full bg-violet-500/10 blur-xl pointer-events-none" />
              <div className="relative w-12 h-12 rounded-2xl bg-white/90 border border-slate-200/80 shadow-[0_4px_16px_rgba(15,23,42,0.05),inset_0_1px_1px_rgba(255,255,255,1)] flex items-center justify-center">
                <Activity size={20} className="text-violet-600/80" />
              </div>
            </div>
            <div>
              <p className="text-base text-slate-800 font-bold tracking-tight mb-1">Output will appear here</p>
              <p className="text-xs sm:text-[13px] text-slate-500 font-normal max-w-sm mx-auto leading-relaxed">{emptySubtext}</p>
            </div>
          </div>
        )}
      </div>

      {/* SEO / Content Readiness Score Panel */}
      {output && !loading && seoStats && (
        <div className="panel-footer flex flex-col gap-3">
          <div className="flex items-center gap-2 mb-0.5">
            <Target size={15} className="text-indigo-600 icon-lift" />
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Content &amp; Structure Readiness</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="sidebar-deep p-3.5 rounded-2xl flex flex-col justify-center items-center">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Readiness</span>
              <span className={`font-black text-2xl tracking-tight bg-clip-text text-transparent ${seoStats.score >= 80 ? 'bg-gradient-to-r from-emerald-500 to-teal-600' : seoStats.score >= 50 ? 'bg-gradient-to-r from-amber-500 to-orange-500' : 'bg-gradient-to-r from-red-500 to-rose-600'}`}>{seoStats.score}</span>
            </div>
            <div className="sidebar-deep p-3.5 rounded-2xl flex flex-col justify-center items-center">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Words</span>
              <span className="font-bold text-xl text-slate-800 tabular-nums">{seoStats.words.toLocaleString()}</span>
            </div>
            <div className="sidebar-deep p-3.5 rounded-2xl flex flex-col justify-center items-center">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Read Time</span>
              <span className="font-bold text-xl text-slate-800 tabular-nums">{seoStats.readingTime}m</span>
            </div>
            <div className="sidebar-deep p-3.5 rounded-2xl flex flex-col justify-center items-center">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Headings</span>
              <span className="font-bold text-xl text-slate-800 tabular-nums">{seoStats.headingMatches}</span>
            </div>
          </div>
          <div className="w-full h-1.5 bg-slate-100/80 rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all duration-700 ${seoStats.score >= 80 ? 'bg-gradient-to-r from-emerald-500 to-teal-500' : seoStats.score >= 50 ? 'bg-gradient-to-r from-amber-400 to-orange-500' : 'bg-gradient-to-r from-rose-500 to-red-500'}`} style={{ width: `${seoStats.score}%` }} />
          </div>
        </div>
      )}
    </div>
  )
})


/* ══════════════════════════════════════════════════════════════
   SCORE PANEL — Industrial-grade detection score for Humanizer
   Shows: animated gauge, 5-signal breakdown, verdict, tips
══════════════════════════════════════════════════════════════ */

export const AnimBar = React.memo(function AnimBar({ to, color, height = 'h-2', delay = 0 }) {
  const [scale, setScale] = useState(0)
  useEffect(() => {
    const t = setTimeout(() => {
      setScale(to)
    }, delay + 80)
    return () => clearTimeout(t)
  }, [to, delay])
  return (
    <div className={`${height} bg-slate-100/90 rounded-full overflow-hidden border border-slate-200/50 shadow-inner`}>
      <div className={`h-full rounded-full ${color}`}
        style={{ width: '100%', transform: `scaleX(${scale / 100})`, transformOrigin: 'left', transition: 'transform 1.1s cubic-bezier(.22,1,.36,1)' }} />
    </div>
  )
})

// Circular gauge for the big score
const ScoreGauge = React.memo(function ScoreGauge({ score, size = 100 }) {
  const numRef = useRef(null)
  const prevScoreRef = useRef(0)
  
  useEffect(() => {
    const t0 = performance.now()
    const startScore = prevScoreRef.current
    const currentNumRef = numRef.current
    let raf
    const tick = (now) => {
      const p = Math.min((now - t0) / 1000, 1)
      const ease = 1 - Math.pow(1 - p, 3)
      if (currentNumRef) {
        currentNumRef.textContent = Math.round(startScore + (score - startScore) * ease)
      }
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      prevScoreRef.current = score
    }
  }, [score])

  const r      = 38
  const circ   = 2 * Math.PI * r
  const fill   = (score / 100) * circ
  const color  = score >= 80 ? '#10b981' : score >= 60 ? '#f59e0b' : score >= 40 ? '#f97316' : '#ef4444'
  const trackColor = score >= 80 ? '#d1fae5' : score >= 60 ? '#fef3c7' : score >= 40 ? '#ffedd5' : '#fee2e2'

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg aria-hidden="true" width={size} height={size} viewBox="0 0 100 100" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="50" cy="50" r={r} fill="none" stroke={trackColor} strokeWidth="8" />
        <circle cx="50" cy="50" r={r} fill="none" stroke={color} strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={`${fill} ${circ}`}
          style={{ transition: 'stroke-dasharray 1.1s cubic-bezier(.22,1,.36,1)' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span ref={numRef} className="font-display font-black leading-none tabular-nums" style={{ fontSize: size * 0.26, color }} />
        <span className="text-slate-400 font-semibold" style={{ fontSize: size * 0.10 }}>/ 100</span>
      </div>
    </div>
  )
})

const SIGNAL_META = [
  { key:'sentenceVariation',   label:'Sentence Variation',   icon: <Activity size={16} />, tip:'Mix of short + long sentences. Low = AI robotic rhythm.' },
  { key:'vocabularyDiversity', label:'Vocabulary Diversity',  icon: <BookOpen size={16} />, tip:'Word choice richness. AI repeats words predictably.' },
  { key:'burstiness',          label:'Burstiness',            icon: <Zap size={16} />, tip:'#1 detector signal — variance in sentence lengths.' },
  { key:'predictability',      label:'Predictability',        icon: <Target size={16} />, tip:'How predictable the next word is. High = AI-like.' },
  { key:'structureRandomness', label:'Structure Randomness',  icon: <Shuffle size={16} />, tip:'Paragraph + section structure variety.' },
]

export const ScorePanel = React.memo(function ScorePanel({ scores, loading, stage, onReScore, wordStats }) {
  const [showBreakdown, setShowBreakdown] = useState(false)
  const [tooltipKey, setTooltipKey]       = useState(null)

  // Auto-expand breakdown when score arrives
  useEffect(() => {
    if (scores && !scores.unavailable) setShowBreakdown(true)
  }, [scores])

  // ── Loading skeleton
  if (loading) {
    return (
      <div className="sidebar-deep rounded-3xl p-5 space-y-4">
        <div className="flex items-center gap-2.5">
          <div className="w-4 h-4 rounded-full border-2 border-slate-300 border-t-blue-600 spin" />
          <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">Analyzing detection…</span>
        </div>
        <div className="flex justify-center py-3">
          <div className="w-24 h-24 rounded-full skeleton" />
        </div>
        {[80,60,75,55,70].map((w,i) => (
          <div key={i}>
            <div className="h-2.5 rounded mb-1.5 skeleton" style={{ width:`${w}%` }} />
            <div className="h-2 bg-slate-100/80 rounded-full" />
          </div>
        ))}
      </div>
    )
  }

  // ── Not yet run
  if (!scores && stage !== 'done') {
    return (
      <div className="sidebar-deep rounded-3xl p-5">
        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Detection Score</p>
        <div className="flex flex-col items-center py-5 gap-2.5 text-center">
          <div className="w-14 h-14 rounded-2xl sidebar-deep flex items-center justify-center text-xl"><BarChart2 size={24} className="text-slate-400" /></div>
          <p className="text-sm font-bold text-slate-700">Score runs automatically</p>
          <p className="text-xs text-slate-500">after humanization completes</p>
        </div>
        <div className="space-y-2 mt-3">
          {[
            { label:'80–100', cls:'text-emerald-700 bg-emerald-50/90 border border-emerald-200/70', tag: <span className="flex items-center gap-1">Human-like <Check size={13} /></span> },
            { label:'50–79',  cls:'text-amber-700 bg-amber-50/90 border border-amber-200/70',     tag:'Mixed Signal'  },
            { label:'0–49',   cls:'text-rose-700 bg-rose-50/90 border border-rose-200/70',         tag:'AI Detected'   },
          ].map(({ label, cls, tag }) => (
            <div key={label} className="flex items-center justify-between text-xs">
              <span className={`font-bold px-2 py-0.5 rounded-md ${cls}`}>{label}</span>
              <span className="text-slate-600 font-medium">{tag}</span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // ── Unavailable
  if (scores?.unavailable) {
    return (
      <div className="sidebar-deep rounded-3xl p-5">
        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2.5">Detection Score</p>
        <div className="flex items-center gap-2.5 px-3.5 py-3 bg-amber-50/90 border border-amber-200/80 rounded-2xl mb-3">
          <AlertCircle size={18} className="text-amber-500 shrink-0" />
          <p className="text-xs sm:text-sm text-amber-800 font-medium">Score analysis paused — high network traffic</p>
        </div>
        <p className="text-xs text-slate-500 mb-3.5 leading-relaxed">Your text was humanized successfully. Click below to re-run the detection pass.</p>
        {onReScore && (
          <button type="button" onClick={onReScore}
            className="shimmer-btn w-full py-2.5 text-xs sm:text-sm font-bold rounded-2xl border border-blue-200/80 bg-blue-50/80 text-blue-700 hover:bg-blue-100 transition-all flex justify-center items-center gap-2">
            <BarChart2 size={16} /> Try Score Again
          </button>
        )}
      </div>
    )
  }

  if (!scores) return null

  const { humanScore = 0, aiScore = 0, reasons = [], verdict = '', breakdown } = scores
  const level  = humanScore >= 80 ? 'human' : humanScore >= 50 ? 'mixed' : 'ai'
  const cfg = {
    human: { border:'border-emerald-200/80', badge:'bg-emerald-50 text-emerald-700 border-emerald-200', label: <span className="flex items-center gap-1">Human-like <Check size={12} /></span>,  barColor:'bg-gradient-to-r from-emerald-500 to-teal-500',   tip:'Great! Should bypass most detectors.' },
    mixed: { border:'border-amber-200/80',   badge:'bg-amber-50  text-amber-700  border-amber-200',   label:'Mixed Signal',   barColor:'bg-gradient-to-r from-amber-400 to-orange-400',    tip:'May trigger some detectors. Try Aggressive mode.' },
    ai:    { border:'border-rose-200/80',     badge:'bg-rose-50    text-rose-700    border-rose-200',     label:'AI Detected',    barColor:'bg-gradient-to-r from-red-400 to-rose-500',         tip:'Will be flagged. Use Aggressive mode and retry.' },
  }[level]

  return (
    <div className={`panel-deep overflow-hidden anim-fade-in border-l-4 ${level==='human'?'border-l-emerald-400':level==='mixed'?'border-l-amber-400':'border-l-rose-400'}`}>
      {/* Header */}
      <div className="panel-header mb-4">
        <div className="flex items-center gap-2">
          <span className={`w-2.5 h-2.5 rounded-full ${level==='human' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]' : level==='mixed' ? 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.6)]' : 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)]'}`} />
          <span className="text-xs font-bold text-slate-700 uppercase tracking-wider pl-0.5">Detection Score</span>
        </div>
        <span className={`text-xs font-bold px-2.5 py-1 rounded-xl border ${cfg.badge}`}>{cfg.label}</span>
      </div>

      {/* Gauge + dual scores */}
      <div className="flex items-center gap-4 px-5 pb-4">
        <ScoreGauge score={humanScore} size={92} />
        <div className="flex-1 space-y-2.5">
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-slate-600 font-semibold">Human</span>
              <span className="font-black text-emerald-600">{humanScore}%</span>
            </div>
            <AnimBar to={humanScore} color="bg-gradient-to-r from-emerald-400 to-teal-500" />
          </div>
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-slate-600 font-semibold">AI Detected</span>
              <span className="font-black text-slate-600">{aiScore}%</span>
            </div>
            <AnimBar to={aiScore} color="bg-gradient-to-r from-red-400 to-rose-400" />
          </div>
          {/* Spectrum bar */}
          <div className="h-2.5 rounded-full overflow-hidden bg-gradient-to-r from-red-200 via-amber-200 to-emerald-200 relative">
            <div className="absolute h-full w-1.5 bg-slate-800 rounded-full -translate-x-1/2 transition-all duration-1000"
              style={{ left: `${humanScore}%` }} />
          </div>
          <div className="flex justify-between">
            <span className="text-[10px] text-slate-400 font-bold uppercase">AI</span>
            <span className="text-[10px] text-slate-400 font-bold uppercase">Human</span>
          </div>
        </div>
      </div>

      {/* Tip */}
      <div className="mx-5 mb-3.5 px-3.5 py-2.5 sidebar-deep rounded-2xl">
        <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">{cfg.tip}</p>
      </div>

      {/* Word stats */}
      {wordStats && (
        <div className="mx-5 mb-3.5 flex gap-2">
          <div className="flex-1 text-center py-2.5 sidebar-deep rounded-2xl">
            <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Input</p>
            <p className="font-bold text-sm text-slate-800 tabular-nums">{wordStats.input}w</p>
          </div>
          <div className="flex items-center text-slate-400 text-sm">→</div>
          <div className="flex-1 text-center py-2.5 sidebar-deep rounded-2xl">
            <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Output</p>
            <p className="font-bold text-sm text-slate-800 tabular-nums">{wordStats.output}w</p>
          </div>
          <div className="flex items-center text-slate-400 text-sm">·</div>
          <div className="flex-1 text-center py-2.5 sidebar-deep rounded-2xl">
            <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Diff</p>
            <p className={`font-bold text-sm tabular-nums ${Math.abs(wordStats.output - wordStats.input) / (wordStats.input || 1) < 0.15 ? 'text-emerald-600' : 'text-amber-600'}`}>
              {wordStats.output - wordStats.input > 0 ? '+' : ''}{wordStats.output - wordStats.input}
            </p>
          </div>
        </div>
      )}

      {/* 5-signal breakdown toggle */}
      <button type="button"
        onClick={() => setShowBreakdown(v => !v)}
        aria-expanded={showBreakdown}
        aria-controls="score-breakdown-details"
        className="w-full flex items-center justify-between px-5 py-3 border-t border-slate-100/80 bg-white/40 hover:bg-white/60 transition-colors text-left">
        <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">5-Signal Breakdown</span>
        <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"
          className={`text-slate-400 transition-transform ${showBreakdown ? 'rotate-180' : ''}`}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/>
        </svg>
      </button>

      {showBreakdown && (
        <div id="score-breakdown-details" className="px-5 pb-4 pt-1.5 space-y-3 border-t border-slate-100/80">
          {SIGNAL_META.map(({ key, label, icon, tip }, i) => {
            const val = breakdown?.[key] ?? Math.round(humanScore * 0.2)
            const pct = (val / 20) * 100
            const color = pct >= 70 ? 'bg-gradient-to-r from-emerald-500 to-teal-500'
                        : pct >= 45 ? 'bg-gradient-to-r from-amber-400 to-orange-400'
                        :             'bg-gradient-to-r from-red-400 to-rose-500'
            return (
              <div key={key} className="relative">
                <button type="button"
                  aria-expanded={tooltipKey === key}
                  aria-controls={`score-tip-${key}`}
                  className="w-full flex items-center justify-between mb-1.5 text-left group focus:outline-none focus-visible:ring-1 focus-visible:ring-blue-400 rounded"
                  onClick={() => setTooltipKey(tooltipKey === key ? null : key)}>
                  <div className="flex items-center gap-2">
                    <span className="text-base text-slate-500">{icon}</span>
                    <span className="text-xs font-semibold text-slate-700 group-hover:text-slate-900 transition-colors">{label}</span>
                    <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" className="text-slate-300">
                      <circle cx="12" cy="12" r="10"/><path strokeLinecap="round" d="M12 8v4m0 4h.01"/>
                    </svg>
                  </div>
                  <span className="text-xs font-black text-slate-800 tabular-nums">{val}<span className="font-normal text-slate-400">/20</span></span>
                </button>
                <AnimBar to={pct} color={color} height="h-2" delay={i * 80} />
                {tooltipKey === key && (
                  <div id={`score-tip-${key}`} role="tooltip" className="mt-1.5 px-3.5 py-2.5 bg-slate-900/95 backdrop-blur-md text-white text-xs rounded-xl shadow-lg leading-relaxed anim-scale-in">
                    {tip}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Verdict */}
      {verdict && (
        <div className="mx-5 mb-3.5 mt-2 px-4 py-3 bg-white/80 border border-slate-200/60 rounded-2xl">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Verdict</p>
          <p className="text-xs sm:text-sm text-slate-700 italic leading-relaxed">"{verdict}"</p>
        </div>
      )}

      {/* Analysis reasons */}
      {reasons.length > 0 && (
        <div className="mx-5 mb-3.5 space-y-2">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Analysis</p>
          {reasons.map((r, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${
                level === 'human' ? 'bg-emerald-400' : level === 'mixed' ? 'bg-amber-400' : 'bg-red-400'
              }`} />
              <span className="text-xs sm:text-[13px] text-slate-700 leading-relaxed">{r}</span>
            </div>
          ))}
        </div>
      )}

      {/* Re-score + improvement tip */}
      <div className="px-5 pb-5 flex flex-col gap-2.5">
        {level !== 'human' && (
          <div className="px-3.5 py-2.5 bg-violet-50/90 border border-violet-100 rounded-2xl">
            <p className="flex items-center gap-1.5 text-xs text-violet-700 font-semibold">
              <Sparkles size={14} /> {level === 'ai' ? 'Switch to Aggressive mode for max bypass power' : 'Aggressive mode can push this above 90%'}
            </p>
          </div>
        )}
        {onReScore && (
          <button type="button" onClick={onReScore}
            className="w-full py-2.5 text-xs sm:text-sm font-bold rounded-2xl border border-slate-200 text-slate-600 hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50 transition-all flex items-center justify-center gap-2">
            <Activity size={14} /> Re-analyze score
          </button>
        )}
      </div>
    </div>
  )
})

