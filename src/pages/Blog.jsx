import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { OutputBox, FormSection } from '../components/Components.jsx'
import { useStream } from '../hooks/useStream.js'
import { useSettings } from '../hooks/SettingsContext.jsx'
import { saveHistory, getAuthHeaders } from '../lib/supabase.js'
import { useWordCountWorker } from '../hooks/useWorker.js'

import { FileText, Settings, FlaskConical, ChevronRight, Loader2, Ruler, Smile, Sparkles, Target, AlertCircle, CheckCircle2 } from 'lucide-react'

const TYPES = ['How-To Guide','Listicle','Product Review','Industry News','Opinion Piece','Case Study','Tutorial','Comparison','Ultimate Guide','FAQ Article']
const TONES = ['Conversational','Informative','Professional','Enthusiastic','Authoritative','Friendly','Storytelling','Academic']
const AUDIENCES = ['General Public','Beginners','Professionals','Students','Business Owners','Tech Savvy','Marketers','Entrepreneurs']
const LOCATIONS = ['Global','US','UK','Canada','Australia','India','Europe','Asia']
const READABILITY = ['5th Grade', '8th Grade', 'High School', 'College Level', 'Post-Graduate']
const LENGTHS = [{v:1200,l:'Short',w:'~1,200w',desc:'Quick read'},{v:1800,l:'Medium',w:'~1,800w',desc:'Standard'},{v:2500,l:'Long',w:'~2,500w',desc:'In-depth'},{v:3500,l:'Epic',w:'~3,500w',desc:'Ultimate guide'}]

const STEPS = [
  { n:1, label:'Topic', icon:<FileText className="w-4 h-4" /> },
  { n:2, label:'Settings', icon:<Settings className="w-4 h-4" /> },
  { n:3, label:'Advanced', icon:<FlaskConical className="w-4 h-4" /> },
]

const SEO_OPTIONS = [
  { k:'seo',             label:'SEO Optimization',  desc:'Keyword density & semantic LSI integration' },
  { k:'geo',             label:'Geo Optimization',  desc:'Target regional audience terminology' },
  { k:'faq',             label:'FAQ Section',       desc:'5 real search questions & authoritative answers' },
  { k:'tableOfContents', label:'Table of Contents', desc:'Anchor jump links at top of post' },
  { k:'callToAction',    label:'Call to Action',    desc:'High-conversion conclusion with next steps' },
]


const CharCount = React.memo(function CharCount({ value = '', max }) {
  const valLen = value ? value.length : 0;
  const pct = Math.min((valLen / max) * 100, 100)
  const color = pct > 90 ? 'text-red-500' : pct > 70 ? 'text-amber-500' : 'text-slate-500'
  return (
    <span className={`text-xs font-semibold tabular-nums ${color}`}>{valLen}/{max}</span>
  )
})

export default function Blog() {
  const defaultState = {
    articleType:'How-To Guide', topic:'', keywords:'', subTopics:'',
    location:'Global', length:1800, tone:'Conversational', audience:'General Public',
    seo:true, geo:false, faq:true, tableOfContents:false, callToAction:false,
    targetKeyword:'', secondaryKeywords:'', writingStyle:'third-person',
    referenceToneUrl:'', readabilityTarget:'8th Grade', imagePrompts:false, schemaMarkup:true
  }
  const [f, setF] = useState(() => {
    try {
      const saved = localStorage.getItem('penshift_blog_draft');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          return { ...defaultState, ...parsed };
        }
      }
    } catch (e) { /* non-critical error ignored */ }
    return defaultState;
  })

  const fRef = useRef(f);
  useEffect(() => { fRef.current = f; }, [f]);

  useEffect(() => {
    return () => {
      try { localStorage.setItem('penshift_blog_draft', JSON.stringify(fRef.current)); } catch(e){ /* non-critical error ignored */ }
    };
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      try {
        localStorage.setItem('penshift_blog_draft', JSON.stringify(f)) } catch (e) { /* non-critical error ignored */ }
    }, 500)
    return () => clearTimeout(t) }, [f])

  const mode = 'seo';
  
  const [step, setStep] = useState(() => {
    if (typeof window !== 'undefined') {
      try { return parseInt(localStorage.getItem('penshift_blog_step')) || 1; } catch (e) { /* non-critical error ignored */ }
    }
    return 1;
  });

  useEffect(() => {
    try { localStorage.setItem('penshift_blog_step', step.toString()); } catch (e) { /* non-critical error ignored */ }
  }, [step]);
  
  const { apiProvider } = useSettings()
  
  const { out, isStreaming, error: err, startStream, stopStream, setOut, setError: setErr, continueGeneration } = useStream()
  const s = useCallback((k, v) => setF(p => ({ ...p, [k]: v })), [])

  useEffect(() => {
    return () => stopStream() }, [stopStream])

  const asyncCount = useWordCountWorker(!isStreaming ? out : '');
  const wordCount = isStreaming ? 0 : asyncCount;

  const handleContinue = useCallback(() => {
    continueGeneration({
      apiProvider,
      type: 'Blog (Continued)',
      mode,
      onSaveHistory: (newOut) => {
        saveHistory({
          id: Date.now(),
          type: 'Blog (Continued)',
          prompt: 'Continued Generation',
          mode,
          output: newOut,
          timestamp: new Date().toISOString()
}).catch(err => console.error('Failed to save history', err))
      }
    })
  }, [continueGeneration, apiProvider, mode]);

  const currentIdempotencyKeyRef = useRef(null);
  const lastRequestParamsRef = useRef(null);

  const canGenerate = (f.topic || '').trim().length >= 3

  const generate = useCallback(async () => {
    if (!canGenerate) return
    setErr(''); setOut('')

    if (f.referenceToneUrl && f.referenceToneUrl.trim()) {
      const trimmed = f.referenceToneUrl.trim()
      if (/^javascript:/i.test(trimmed) || /^data:/i.test(trimmed) || /^vbscript:/i.test(trimmed)) {
        setErr('Invalid reference tone URL. Only http:// or https:// links are permitted.')
        return
      }
    }

    const topicFull = {
      articleType: f.articleType,
      topic: f.topic,
      seo: {
        keywords: f.keywords || undefined,
        targetKeyword: f.targetKeyword || undefined,
        secondaryKeywords: f.secondaryKeywords || undefined,
        isOptimized: !!f.seo
      },
      content: {
        subTopics: f.subTopics || undefined,
        audience: f.audience,
        tone: f.tone,
        writingStyle: f.writingStyle,
        readabilityTarget: f.readabilityTarget,
        length: f.length
      },
      demographics: {
        location: f.location,
        geoTarget: !!f.geo
      },
      features: {
        faq: !!f.faq,
        tableOfContents: !!f.tableOfContents,
        callToAction: !!f.callToAction,
        autoImagePrompts: !!f.autoImagePrompts,
        schemaMarkup: !!f.schemaMarkup
      },
      referenceToneUrl: f.referenceToneUrl || undefined
    };

    const payload = {
      prompt: f.topic,
      context: topicFull,
      apiProvider,
      task: 'blog',
      mode,
      length: f.length,
      toneUrl: f.referenceToneUrl,
      readabilityTarget: f.readabilityTarget,
      autoImagePrompts: f.autoImagePrompts,
      schemaMarkup: f.schemaMarkup
    };

    const paramsKey = JSON.stringify(payload);
    const isRetry = Boolean(
      currentIdempotencyKeyRef.current &&
      lastRequestParamsRef.current === paramsKey
    );

    const idempotencyKey = isRetry
      ? currentIdempotencyKeyRef.current
      : ((typeof crypto !== 'undefined' && crypto.randomUUID)
          ? crypto.randomUUID()
          : `idemp-blog-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`);

    currentIdempotencyKeyRef.current = idempotencyKey;
    lastRequestParamsRef.current = paramsKey;

    let authHeaders = {};
    try {
      authHeaders = await getAuthHeaders();
    } catch (_) {}

    try {
      const fullOutput = await startStream('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey,
          ...authHeaders,
        },
        body: JSON.stringify({ ...payload, idempotencyKey })
      })

      if (fullOutput) {
        saveHistory({
          id: Date.now(),
          type: 'Blog',
          prompt: typeof topicFull === 'object' ? JSON.stringify(topicFull) : topicFull,
          output: fullOutput,
          timestamp: new Date().toISOString()
        }).catch(console.error)
      }
    } catch(e) { 
      if (e.name === 'AbortError') return;
      setErr(e?.message || String(e) || 'An unexpected error occurred')
    }
  }, [canGenerate, f, apiProvider, mode, startStream, setErr, setOut])

  const SidebarForm = useMemo(() => (
          <div className="lg:col-span-1 space-y-4 anim-fade-up-1">
            {/* Step nav */}
            <div className="sidebar-deep p-1.5 rounded-2xl flex items-center gap-1.5 shadow-sm border border-white/90">
              {STEPS.map(st => (
                <button type="button" key={st.n} onClick={() => setStep(st.n)}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all ${step === st.n ? 'bg-white text-sky-600 border border-sky-200/80 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>
                  <span>{st.icon}</span>
                  <span className="hidden sm:inline">{st.label}</span>
                </button>
              ))}
            </div>

            <div className="grid">
              {/* Step 1: Topic */}
              <div className={`col-start-1 row-start-1 transition-all duration-300 ${step === 1 ? 'opacity-100 z-10 translate-x-0' : 'opacity-0 z-0 pointer-events-none -translate-x-4'}`} inert={step !== 1 ? '' : undefined}>
                <div className="space-y-4">
                  <FormSection title="Article Topic" icon={<FileText className="w-5 h-5 text-sky-600" />}>
                    <div className="space-y-4">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label htmlFor="blog-articleType" className="text-sm font-bold text-slate-800 tracking-tight">Article Type</label>
                        </div>
                        <select id="blog-articleType" disabled={isStreaming} value={f.articleType} onChange={e=>s('articleType',e.target.value)} className="inp inp-sky text-sm">
                          {TYPES.map(t=><option key={t}>{t}</option>)}
                        </select>
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label htmlFor="blog-topic" className="text-sm font-bold text-slate-800 tracking-tight">Topic *</label>
                          <CharCount value={f.topic} max={120} />
                        </div>
                        <textarea
                          id="blog-topic"
                          disabled={isStreaming}
                          value={f.topic}
                          onChange={e=>s('topic',e.target.value)}
                          placeholder="e.g. Best SEO strategies for SaaS companies in 2025"
                          maxLength={120}
                          rows={2}
                          className="inp inp-sky resize-none text-sm leading-relaxed"
                        />
                        {(f.topic || '').trim().length < 15 && (f.topic || '').length > 0 && (
                          <p className="text-sm text-amber-700 mt-1.5 font-medium">Add more detail for better results (min 15 chars)</p>
                        )}
                      </div>
                      <div className="space-y-4 border-t border-sky-100/80 pt-4 mt-4">
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <label htmlFor="blog-target" className="text-sm font-bold text-slate-800 tracking-tight">Primary Target Keyword *</label>
                            <span className="text-sm text-slate-400 font-medium">Main SEO focus</span>
                          </div>
                          <input id="blog-target" disabled={isStreaming} type="text" value={f.targetKeyword} onChange={e=>s('targetKeyword',e.target.value)}
                            placeholder="e.g. best email marketing software" className="inp inp-sky text-sm" />
                        </div>
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <label htmlFor="blog-secondary" className="text-sm font-bold text-slate-800 tracking-tight">Secondary Keywords</label>
                            <span className="text-sm text-slate-400 font-medium">comma separated</span>
                          </div>
                          <input id="blog-secondary" disabled={isStreaming} type="text" value={f.secondaryKeywords} onChange={e=>s('secondaryKeywords',e.target.value)}
                            placeholder="e.g. cheap email tools, newsletter software" className="inp inp-sky text-sm" />
                        </div>
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <label htmlFor="blog-keywords" className="text-sm font-bold text-slate-800 tracking-tight">LSI / Semantic Terms</label>
                            <span className="text-sm text-slate-400 font-medium">comma separated</span>
                          </div>
                          <input id="blog-keywords" disabled={isStreaming} type="text" value={f.keywords} onChange={e=>s('keywords',e.target.value)}
                            placeholder="e.g. deliverability, open rates, SMTP" className="inp inp-sky text-sm" />
                        </div>
                      </div>
                      <div>
                        <label htmlFor="blog-subTopics" className="block text-sm font-bold text-slate-800 tracking-tight mb-2">Sub-Topics to Cover</label>
                        <input id="blog-subTopics" disabled={isStreaming} type="text" value={f.subTopics} onChange={e=>s('subTopics',e.target.value)}
                          placeholder="e.g. on-page SEO, link building, technical SEO" className="inp inp-sky text-sm" />
                      </div>
                    </div>
                  </FormSection>

                  <FormSection title="Article Length" icon={<Ruler className="w-5 h-5 text-sky-600" />}>
                    <div className="grid grid-cols-2 gap-3">
                      {LENGTHS.map(({v,l,w,desc})=>(
                        <button type="button" key={v} onClick={() => s('length', v)}
                          className={`p-3.5 rounded-2xl border text-left transition-all ${f.length===v?'border-sky-400 bg-sky-50/90 shadow-sm ring-2 ring-sky-100':'border-slate-200/80 bg-white/70 hover:border-slate-300'}`}>
                          <div className="flex items-center justify-between">
                            <span className={`text-sm font-bold ${f.length===v?'text-sky-700':'text-slate-900'}`}>{l}</span>
                            {f.length===v && <CheckCircle2 className="w-4 h-4 text-sky-600 shrink-0" />}
                          </div>
                          <div className="text-xs text-slate-600 font-semibold mt-1">{w}</div>
                          <div className="text-xs text-slate-500 mt-0.5 leading-snug">{desc}</div>
                        </button>
                      ))}
                    </div>
                  </FormSection>

                  <button type="button" onClick={() => setStep(2)}
                    className="w-full py-3.5 rounded-2xl bg-sky-50/90 border border-sky-200/80 text-sky-700 text-sm font-bold hover:bg-sky-100 transition-all flex items-center justify-center gap-2 shadow-sm">
                    Next: Settings <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Step 2: Settings (Advanced Apple UI) */}
              <div className={`col-start-1 row-start-1 transition-all duration-300 ${step === 2 ? 'opacity-100 z-10 translate-x-0' : 'opacity-0 z-0 pointer-events-none translate-x-4'}`} inert={step !== 2 ? '' : undefined}>
                <div className="space-y-4">
                  <FormSection title="Tone & Audience Configuration" icon={<Smile className="w-5 h-5 text-sky-600" />}>
                    <div className="space-y-4">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-sm font-bold text-slate-800 tracking-tight">Tone of Voice</label>
                          <span className="text-sm font-bold text-sky-700 bg-sky-50 px-2.5 py-0.5 rounded-lg border border-sky-200/60">{f.tone}</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {TONES.map(t=>(
                            <button type="button" key={t} onClick={() => s('tone', t)}
                              className={`px-3 py-1.5 rounded-xl font-semibold border transition-all text-center ${f.tone===t?'border-sky-500 bg-sky-50 text-sky-700 shadow-sm ring-2 ring-sky-100':'border-slate-200/80 text-slate-700 hover:border-slate-300 bg-white/70'}`}>
                              {t}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3 pt-1">
                        <div>
                          <label htmlFor="blog-audience" className="block text-sm font-bold text-slate-800 tracking-tight mb-2">Target Audience</label>
                          <select id="blog-audience" disabled={isStreaming} value={f.audience} onChange={e=>s('audience',e.target.value)} className="inp inp-sky text-sm">
                            {AUDIENCES.map(a=><option key={a}>{a}</option>)}
                          </select>
                        </div>
                        <div>
                          <label htmlFor="blog-readabilityTarget" className="block text-sm font-bold text-slate-800 tracking-tight mb-2">Readability Target</label>
                          <select id="blog-readabilityTarget" disabled={isStreaming} value={f.readabilityTarget} onChange={e=>s('readabilityTarget',e.target.value)} className="inp inp-sky text-sm">
                            {READABILITY.map(a=><option key={a}>{a}</option>)}
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label htmlFor="blog-location" className="block text-sm font-bold text-slate-800 tracking-tight mb-2">Target Geography</label>
                          <select id="blog-location" disabled={isStreaming} value={f.location} onChange={e=>s('location',e.target.value)} className="inp inp-sky text-sm">
                            {LOCATIONS.map(l=><option key={l}>{l}</option>)}
                          </select>
                        </div>
                        <div>
                          <label htmlFor="blog-writingStyle" className="block text-sm font-bold text-slate-800 tracking-tight mb-2">Perspective Style</label>
                          <select id="blog-writingStyle" disabled={isStreaming} value={f.writingStyle} onChange={e=>s('writingStyle',e.target.value)} className="inp inp-sky text-sm">
                            {['third-person','first-person','second-person','neutral'].map(v=><option key={v}>{v}</option>)}
                          </select>
                        </div>
                      </div>

                      <div>
                        <label htmlFor="blog-referenceToneUrl" className="block text-sm font-bold text-slate-800 tracking-tight mb-2">Reference URL (Optional Mimic)</label>
                        <input id="blog-referenceToneUrl" disabled={isStreaming} type="text" value={f.referenceToneUrl} onChange={e=>s('referenceToneUrl',e.target.value)}
                          placeholder="https://example.com/blog-post-to-mimic" className="inp inp-sky text-sm" />
                      </div>
                    </div>
                  </FormSection>

                  <FormSection title="SEO Engine Directives" icon={<Target className="w-5 h-5 text-sky-600" />}>
                    <div className="space-y-3">
                      {SEO_OPTIONS.map(({k,label,desc}) => {
                        const displayDesc = k === 'geo' ? `Target ${f.location} readers` : desc;
                        return (
                          <button type="button" key={k} onClick={()=>s(k,!f[k])}
                            role="switch"
                            aria-checked={!!f[k]}
                            className={`w-full flex items-center justify-between p-4 rounded-2xl border transition-all text-left ${f[k]?'border-sky-300 bg-sky-50/70 shadow-sm ring-1 ring-sky-200/60':'border-slate-200/80 bg-white/70 hover:border-slate-300'}`}>
                            <div className="min-w-0 pr-4">
                              <p className={`text-sm font-bold ${f[k]?'text-sky-950':'text-slate-900'}`}>{label}</p>
                              <p className="text-sm text-slate-500 mt-1 font-normal leading-relaxed">{displayDesc}</p>
                            </div>
                            <div className={`toggle on-sky shrink-0 ${f[k] ? 'on' : ''}`} />
                          </button>
                        )
                      })}
                    </div>
                  </FormSection>

                  <button type="button" onClick={() => setStep(3)}
                    className="w-full py-3.5 rounded-2xl bg-sky-50/90 border border-sky-200/80 text-sky-700 text-sm font-bold hover:bg-sky-100 transition-all flex items-center justify-center gap-2 shadow-sm">
                    Next: Advanced Directives <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Step 3: Advanced */}
              <div className={`col-start-1 row-start-1 transition-all duration-300 ${step === 3 ? 'opacity-100 z-10 translate-x-0' : 'opacity-0 z-0 pointer-events-none translate-x-4'}`} inert={step !== 3 ? '' : undefined}>
                <div className="space-y-4">
                  <FormSection title="Advanced Output Configuration" icon={<FlaskConical className="w-5 h-5 text-sky-600" />}>
                    <div className="space-y-3">
                      <button
                        type="button"
                        onClick={() => s('schemaMarkup', f.schemaMarkup === false ? true : false)}
                        role="switch" aria-checked={f.schemaMarkup !== false}
                        className={`w-full flex items-center justify-between p-4 rounded-2xl border transition-all text-left shadow-sm ${
                          f.schemaMarkup !== false ? 'border-sky-300 bg-sky-50/70 ring-1 ring-sky-200/60' : 'border-slate-200/80 bg-white/70 hover:border-slate-300'
                        }`}>
                        <div className="min-w-0 pr-4">
                          <p className={`text-sm font-bold ${f.schemaMarkup !== false ? 'text-sky-950' : 'text-slate-900'}`}>Auto Schema Markup (JSON-LD)</p>
                          <p className="text-sm text-slate-500 font-normal mt-1 leading-relaxed">Embed Google-compliant Article rich snippets</p>
                        </div>
                        <div className={`toggle on-sky shrink-0 ${f.schemaMarkup !== false ? 'on' : ''}`} />
                      </button>
                      <button
                        type="button"
                        onClick={() => s('imagePrompts', !f.imagePrompts)}
                        role="switch" aria-checked={!!f.imagePrompts}
                        className={`w-full flex items-center justify-between p-4 rounded-2xl border transition-all text-left shadow-sm ${
                          f.imagePrompts ? 'border-sky-300 bg-sky-50/70 ring-1 ring-sky-200/60' : 'border-slate-200/80 bg-white/70 hover:border-slate-300'
                        }`}>
                        <div className="min-w-0 pr-4">
                          <p className={`text-sm font-bold ${f.imagePrompts ? 'text-sky-950' : 'text-slate-900'}`}>Generate Image Prompts</p>
                          <p className="text-sm text-slate-500 font-normal mt-1 leading-relaxed">Midjourney & DALL-E visual scene prompts for sections</p>
                        </div>
                        <div className={`toggle on-sky shrink-0 ${f.imagePrompts ? 'on' : ''}`} />
                      </button>
                    </div>
                  </FormSection>
                  <div className="pt-2 flex items-center justify-between gap-3">
                    <button type="button" onClick={() => setStep(2)} className="px-5 py-3 text-slate-700 rounded-xl text-sm font-bold hover:bg-slate-200/80 border border-slate-200/70 transition-all active:scale-98">Back</button>
                    <button type="button" onClick={generate} disabled={isStreaming || !canGenerate} className={`flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl font-bold text-sm tracking-tight transition-all active:scale-[0.98] ${isStreaming || !canGenerate ? 'bg-slate-100/90 text-slate-400 cursor-not-allowed border border-slate-200/70 shadow-xs' : 'bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-[0_10px_24px_-4px_rgba(2,132,199,0.36),0_2px_6px_-1px_rgba(15,23,42,0.08),inset_0_1px_1.5px_rgba(255,255,255,0.3)] hover:shadow-[0_14px_30px_-4px_rgba(2,132,199,0.48)] hover:-translate-y-0.5 active:translate-y-0'}`}>
                      {isStreaming ? <><Loader2 className="w-5 h-5 animate-spin" /> Writing Article...</> : <><Sparkles className="w-5 h-5" /> Generate Post</>}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
  ), [step, f, isStreaming, canGenerate, generate, s]);

  return (
    <div className="ps-page pt-20 pb-24">
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-10 anim-fade-up">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-100 text-sky-700 text-xs font-bold mb-3 gradient-border">
            <Sparkles className="w-3.5 h-3.5" /> SEO-Optimized Content
          </div>
          <h1 className="font-display font-extrabold text-3xl sm:text-4xl lg:text-[2.75rem] text-slate-950 mb-1.5 leading-tight tracking-[-0.03em]">
            Blog <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-500 to-blue-600">Writer</span>
          </h1>
          <p className="page-subheading text-slate-600 max-w-xl mx-auto">
            Generate high-quality, long-form articles that rank on Google.
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-6 lg:gap-8 max-w-6xl mx-auto items-start">
          {SidebarForm}

          {/* Output */}
          <div className="lg:col-span-2 anim-fade-up-2 flex flex-col h-full min-h-[500px]">
            {out && !isStreaming && (
              <div className="mb-4 p-5 panel-deep flex items-center gap-3 shrink-0">
                <div className="flex-1">
                  <div className="flex justify-between text-xs sm:text-sm text-slate-600 mb-2 font-medium">
                    <span>Generated Content Length</span>
                    <span className={`font-bold tabular-nums ${wordCount >= f.length * 0.85 ? 'text-emerald-600' : 'text-amber-600'}`}>
                      {wordCount.toLocaleString()} / ~{f.length.toLocaleString()} words
                    </span>
                  </div>
                  <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-sky-500 to-blue-600 rounded-full transition-all duration-700"
                      style={{width: `${Math.min((wordCount/f.length)*100, 100)}%`}} />
                  </div>
                </div>
              </div>
            )}
            {err && (
              <div className="mb-4 p-4.5 rounded-2xl bg-rose-50/90 border border-rose-200 text-rose-700 text-sm flex items-center gap-3 shrink-0 anim-scale-in">
                <AlertCircle className="w-5 h-5 shrink-0 text-rose-500" />
                <span>{err}</span>
              </div>
            )}
            <OutputBox output={out} label="Blog Article Output" accent="sky" loading={isStreaming} onContinue={handleContinue} emptySubtext="Configure article options and click Generate Post to begin" className="flex-1 h-full" />
          </div>
        </div>
      </div>
    </div>
  )
}
