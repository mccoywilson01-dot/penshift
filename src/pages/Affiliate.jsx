import { useState, useRef, useMemo, useCallback, useEffect } from 'react'
import { OutputBox } from '../components/Components.jsx'
import { useStream } from '../hooks/useStream.js'
import { useSettings } from '../hooks/SettingsContext.jsx'
import { useWordCountWorker } from '../hooks/useWorker.js'
import { saveHistory, getAuthHeaders } from '../lib/supabase.js'
import { Zap, Flame, Target, Briefcase, MessageCircle, CircleDashed, CircleDot, Circle, Pill, Monitor, Box, Users, Settings, ChevronRight, AlertCircle, Loader2, CheckCircle2 } from 'lucide-react'

const TONES     = ['Persuasive','Honest & Balanced','Enthusiastic','Expert Authority','Friendly','Storytelling']
const AUDIENCES = ['General Consumer','Health-Conscious','Tech Savvy','Fitness Enthusiast','Business Professional','Budget Shopper','Luxury Buyer']
const LOCATIONS = ['Global','US','UK','Canada','Australia','India','Europe']
const NICHES    = ['Health & Wellness','Software & SaaS','Physical Products','Finance','Education','Beauty','Fitness','Food & Supplements','Technology','Home & Garden']
const MODES     = [
  {id:'standard',  label:'Standard',   icon:<Zap className="w-4 h-4" />, desc:'Authentic reviewer voice'},
  {id:'aggressive',label:'Aggressive', icon:<Flame className="w-4 h-4" />, desc:'High-energy, urgency-driven'},
  {id:'seo',       label:'SEO',        icon:<Target className="w-4 h-4" />, desc:'Keyword-rich + comparison'},
  {id:'formal',    label:'Formal',     icon:<Briefcase className="w-4 h-4" />, desc:'Professional analyst tone'},
  {id:'casual',    label:'Casual',     icon:<MessageCircle className="w-4 h-4" />, desc:'Friendly recommendation'},
]
const MODE_COLORS = {
  standard:  {btn:'from-purple-600 to-violet-600'},
  aggressive:{btn:'from-red-600 to-orange-500'},
  seo:       {btn:'from-green-600 to-emerald-500'},
  formal:    {btn:'from-slate-700 to-slate-900'},
  casual:    {btn:'from-violet-600 to-purple-500'},
}

const CTA_MODES = [
  {id:'low',   label:'Low',    desc:'2 CTAs total',        icon:<CircleDashed className="w-5 h-5" />, color:'text-slate-500'},
  {id:'medium',label:'Medium', desc:'4 strategic CTAs',    icon:<CircleDot className="w-5 h-5" />, color:'text-blue-500'},
  {id:'high',  label:'High',   desc:'After every section', icon:<Circle className="w-5 h-5" />, color:'text-violet-600'},
]

const AFFILIATE_STEPS = [
  {n:1,label:'Product',icon:<Box className="w-4 h-4" />},
  {n:2,label:'Strategy',icon:<Target className="w-4 h-4" />},
  {n:3,label:'Advanced',icon:<Settings className="w-4 h-4" />}
];

function detectType(name) {
  if (!name) return 'physical'
  const n = String(name).toLowerCase()
  if (/\b(supplement|vitamin|protein|collagen|probiotic|omega|keto|detox|fat|testosterone|pills|capsules|extract|ashwagandha|turmeric|creatine|whey|powder)\b/.test(n)) return 'supplement'
  if (/\b(app|software|course|program|membership|subscription|tool|platform|ebook|guide|training|blueprint|masterclass|saas|plugin|digital)\b/.test(n)) return 'digital'
  return 'physical'
}

const TYPE_ICONS = { supplement:<Pill className="w-3 h-3" />, digital:<Monitor className="w-3 h-3" />, physical:<Box className="w-3 h-3" /> }
const TYPE_COLORS = { supplement:'bg-emerald-50 text-emerald-700 border-emerald-200', digital:'bg-blue-50 text-blue-700 border-blue-200', physical:'bg-orange-50 text-orange-700 border-orange-200' }

const defaults = {
  productName:'', keywords:'', ctaLabel:'Get It Now →',
  location:'US', length:2500, tone:'Persuasive', audience:'General Consumer',
  ctaIntensity:'medium', productType:'auto', niche:'Health & Wellness',
  uniqueAngle:'', targetPrice:'', competitorA:'', competitorB:'',
  trustBadges:true, urgency:false, moneyBackGuarantee:true, starRatings:true,
  includeIngredients:false, includePricing:true, schemaMarkup:true, prosConsMatrix:true,
  affiliateLink:''
}

export default function Affiliate() {
  const [f, setF] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('penshift_affiliate_draft');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (typeof parsed === 'object' && !Array.isArray(parsed)) {
            return { ...defaults, ...parsed };
          }
        }
      } catch (e) {
        console.warn('Failed to load draft:', e);
      }
    }
    return defaults;
  });

  const fRef = useRef(f);
  useEffect(() => { fRef.current = f; }, [f]);

  useEffect(() => {
    return () => {
      try { localStorage.setItem('penshift_affiliate_draft', JSON.stringify(fRef.current)); } catch(e){ /* non-critical error ignored */ }
    };
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      try {
        if (typeof window !== 'undefined') {
          localStorage.setItem('penshift_affiliate_draft', JSON.stringify(f))
        }
      } catch (e) { /* non-critical error ignored */ }
    }, 500)
    return () => clearTimeout(t)
  }, [f])

  const [mode, setMode] = useState(() => {
    if (typeof window !== 'undefined') {
      try { return localStorage.getItem('penshift_affiliate_mode') || 'standard'; } catch (e) { /* non-critical error ignored */ }
    }
    return 'standard';
  });
  
  const [step, setStep] = useState(() => {
    if (typeof window !== 'undefined') {
      try { return parseInt(localStorage.getItem('penshift_affiliate_step')) || 1; } catch (e) { /* non-critical error ignored */ }
    }
    return 1;
  });

  useEffect(() => {
    try { localStorage.setItem('penshift_affiliate_mode', mode); } catch (e) { /* non-critical error ignored */ }
  }, [mode]);

  useEffect(() => {
    try { localStorage.setItem('penshift_affiliate_step', step.toString()); } catch (e) { /* non-critical error ignored */ }
  }, [step]);
  const { apiProvider } = useSettings()
  
  const { out, isStreaming, error: err, startStream, stopStream, setOut, setError: setErr, continueGeneration } = useStream()
  
  const asyncCount = useWordCountWorker(!isStreaming ? out : '');
  const wordCount = isStreaming ? 0 : asyncCount;
  
  const s = useCallback((k,v) => setF(p=>({...p,[k]:v})), [])

  useEffect(() => {
    return () => stopStream()
  }, [stopStream])
  const detectedType = useMemo(() => f.productType === 'auto' ? detectType(f.productName) : f.productType, [f.productType, f.productName])

  const advancedSettings = useMemo(() => [
    {k:'trustBadges',        label:'Trust Badges',          desc:'Security, certifications, seals'},
    {k:'urgency',            label:'Urgency / Scarcity',    desc:'Limited time offer, stock warning'},
    {k:'moneyBackGuarantee', label:'Money-Back Guarantee',  desc:'Reduce buyer hesitation'},
    {k:'starRatings',        label:'Star Ratings',          desc:'★★★★★ on customer reviews'},
    detectedType === 'supplement' ? {k:'includeIngredients', label:'Ingredient Breakdown',  desc:'Only applies to supplements'} : null,
    {k:'includePricing',     label:'Pricing & Packages',    desc:'Price comparison and tiers'},
    {k:'schemaMarkup',       label:'Auto Schema Markup',    desc:'JSON-LD SEO markup structure'},
    {k:'prosConsMatrix',     label:'Pros & Cons Matrix',    desc:'High-converting summary table'},
  ].filter(Boolean), [detectedType]);

  const handleContinue = useCallback(() => {
    continueGeneration({
      apiProvider,
      type: 'Affiliate (Continued)',
      mode,
      onSaveHistory: (newOut) => {
        saveHistory({
          id: Date.now(),
          type: 'Affiliate (Continued)',
          prompt: 'Continued Generation',
          output: newOut,
          mode,
          timestamp: new Date().toISOString()
        }).catch(console.error)
      }
    });
  }, [continueGeneration, apiProvider, mode]);

  const mc = MODE_COLORS[mode]
  const currentIdempotencyKeyRef = useRef(null);
  const lastRequestParamsRef = useRef(null);

  const canGenerate = (f.productName || '').trim().length > 2

  const generate = useCallback(async () => {
    if (!canGenerate) return
    setErr(''); setOut('');

    if (f.affiliateLink && f.affiliateLink.trim()) {
      const trimmed = f.affiliateLink.trim()
      if (/^javascript:/i.test(trimmed) || /^data:/i.test(trimmed) || /^vbscript:/i.test(trimmed)) {
        setErr('Invalid affiliate URL. Only http:// or https:// links are permitted.')
        return
      }
    }

    const ctx = {
      productName: f.productName,
      type: detectedType,
      niche: f.niche,
      keywords: f.keywords || undefined,
      uniqueAngle: f.uniqueAngle || undefined,
      targetPrice: f.targetPrice || undefined,
      competitors: [f.competitorA, f.competitorB].filter(Boolean),
      cta: {
        label: f.ctaLabel || 'Get It Now',
        intensity: f.ctaIntensity,
        targetLink: f.affiliateLink || undefined
      },
      demographics: {
        location: f.location,
        audience: f.audience
      },
      content: {
        length: f.length,
        tone: f.tone,
        trustBadges: !!f.trustBadges,
        urgency: !!f.urgency,
        moneyBackGuarantee: !!f.moneyBackGuarantee,
        starRatings: !!f.starRatings,
        includeIngredients: f.includeIngredients && detectedType === 'supplement',
        includePricing: !!f.includePricing,
        schemaMarkup: !!f.schemaMarkup,
        prosConsMatrix: !!f.prosConsMatrix
      }
    };

    const payload = {
      prompt: f.productName,
      context: ctx,
      apiProvider,
      task: 'affiliate',
      mode,
      length: f.length,
      affiliateLink: f.affiliateLink,
      schemaMarkup: f.schemaMarkup,
      prosCons: f.prosConsMatrix
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
          : `idemp-aff-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`);

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
          type: 'Affiliate',
          mode,
          prompt: typeof ctx === 'object' ? JSON.stringify(ctx) : ctx,
          output: fullOutput,
          timestamp: new Date().toISOString()
        }).catch(console.error)
      }
    } catch(e) {
      if (e.name === 'AbortError') return;
      setErr(e?.message || String(e) || 'An unexpected error occurred')
    }
  }, [canGenerate, f, mode, detectedType, apiProvider, startStream, setErr, setOut])

  const SidebarForm = useMemo(() => (
          <div className="lg:col-span-1 space-y-4 anim-fade-up-1">

            {/* Step tabs: Elegant Segmented Glass Navigation */}
            <div className="p-1 rounded-2xl bg-white/70 backdrop-blur-xl border border-slate-200/70 shadow-[0_2px_8px_rgba(15,23,42,0.04)] flex items-center gap-1">
              {AFFILIATE_STEPS.map(st=>(
                <button type="button" key={st.n} onClick={()=>setStep(st.n)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl text-xs sm:text-[13px] font-semibold transition-all duration-200 ${
                    step===st.n
                      ? 'bg-white text-violet-700 shadow-[0_2px_6px_rgba(15,23,42,0.06),0_1px_2px_rgba(15,23,42,0.04)] border border-violet-100/90 font-bold'
                      : 'text-slate-500 hover:text-slate-800 hover:bg-white/50 font-medium'
                  }`}>
                  <span className={step===st.n ? 'text-violet-600' : 'text-slate-400'}>{st.icon}</span>
                  <span className="hidden sm:inline">{st.label}</span>
                </button>
              ))}
            </div>

            <div className="grid">
              {/* Step 1: Product & Competitor Unified Console */}
              <div className={`col-start-1 row-start-1 transition-all duration-300 ${step === 1 ? 'opacity-100 z-10 translate-x-0' : 'opacity-0 z-0 pointer-events-none -translate-x-4'}`} inert={step !== 1 ? '' : undefined}>
                <div className="panel-deep p-5 sm:p-5.5 rounded-3xl shadow-[0_16px_40px_-10px_rgba(15,23,42,0.06),inset_0_1px_1px_rgba(255,255,255,1)] space-y-3.5">
                  <div className="flex items-center gap-2 pb-2.5 border-b border-slate-200/60">
                    <Box className="w-4 h-4 text-violet-600" />
                    <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">Product Info</span>
                  </div>

                  <div>
                    <label htmlFor="aff-product" className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">Product Name *</label>
                    <input id="aff-product" type="text" value={f.productName} onChange={e=>s('productName',e.target.value)}
                      placeholder="e.g. TrimTone Fat Burner" className="inp inp-violet text-sm" />
                    {f.productName && (
                      <div className={`inline-flex items-center gap-1.5 mt-2 px-2.5 py-0.5 rounded-xl text-xs font-bold border ${TYPE_COLORS[detectedType]}`}>
                        <span>{TYPE_ICONS[detectedType]}</span>
                        Auto-detected: <span className="capitalize">{detectedType}</span>
                      </div>
                    )}
                  </div>

                  <div>
                    <label htmlFor="aff-niche" className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">Niche / Category</label>
                    <select id="aff-niche" value={f.niche} onChange={e=>s('niche',e.target.value)} className="inp inp-violet text-sm">
                      {NICHES.map(n=><option key={n}>{n}</option>)}
                    </select>
                  </div>

                  <div>
                    <label htmlFor="aff-keywords" className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">Keywords</label>
                    <input id="aff-keywords" type="text" value={f.keywords} onChange={e=>s('keywords',e.target.value)}
                      placeholder="e.g. fat burner, weight loss supplement" className="inp inp-violet text-sm" />
                  </div>

                  <div>
                    <label htmlFor="aff-price" className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">Price Point (optional)</label>
                    <input id="aff-price" type="text" value={f.targetPrice} onChange={e=>s('targetPrice',e.target.value)}
                      placeholder="e.g. $49/month or $149 one-time" className="inp inp-violet text-sm" />
                  </div>

                  <div>
                    <label htmlFor="aff-angle" className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">Unique Selling Angle</label>
                    <input id="aff-angle" type="text" value={f.uniqueAngle} onChange={e=>s('uniqueAngle',e.target.value)}
                      placeholder="e.g. clinically tested, 30-day results" className="inp inp-violet text-sm" />
                  </div>

                  {/* Competitor Benchmark — Unified Sub-group */}
                  <div className="pt-3.5 mt-3.5 border-t border-slate-200/60">
                    <div className="flex items-center gap-2 mb-2.5">
                      <Users className="w-4 h-4 text-violet-600" />
                      <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">Competitor Comparison</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div>
                        <label htmlFor="aff-compa" className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">Competitor A</label>
                        <input id="aff-compa" type="text" value={f.competitorA} onChange={e=>s('competitorA',e.target.value)}
                          placeholder="e.g. LeanBean" className="inp inp-violet text-sm" />
                      </div>
                      <div>
                        <label htmlFor="aff-compb" className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">Competitor B</label>
                        <input id="aff-compb" type="text" value={f.competitorB} onChange={e=>s('competitorB',e.target.value)}
                          placeholder="e.g. PhenQ" className="inp inp-violet text-sm" />
                      </div>
                    </div>
                  </div>

                  <div className="pt-2">
                    <button type="button" onClick={() => setStep(2)}
                      className="w-full py-3 rounded-xl bg-violet-600 hover:bg-violet-700 active:scale-[0.99] text-white text-xs sm:text-sm font-bold shadow-[0_4px_14px_rgba(124,58,237,0.25)] transition-all flex items-center justify-center gap-2">
                      Next: Strategy <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Step 2: Strategy */}
              <div className={`col-start-1 row-start-1 transition-all duration-300 ${step === 2 ? 'opacity-100 z-10 translate-x-0' : 'opacity-0 z-0 pointer-events-none translate-x-4'}`} inert={step !== 2 ? '' : undefined}>
                <div className="panel-deep p-5 sm:p-5.5 rounded-3xl shadow-[0_16px_40px_-10px_rgba(15,23,42,0.06),inset_0_1px_1px_rgba(255,255,255,1)] space-y-3.5">
                  <div className="flex items-center gap-2 pb-2.5 border-b border-slate-200/60">
                    <Target className="w-4 h-4 text-violet-600" />
                    <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">Copy Strategy</span>
                  </div>

                  <div>
                    <label htmlFor="aff-cta" className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">CTA Button Label</label>
                    <input id="aff-cta" type="text" value={f.ctaLabel} onChange={e=>s('ctaLabel',e.target.value)}
                      placeholder="e.g. Get It Now →" className="inp inp-violet text-sm" />
                  </div>

                  <div>
                    <label htmlFor="aff-link" className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">Target Affiliate Link</label>
                    <input id="aff-link" type="url" value={f.affiliateLink} onChange={e=>s('affiliateLink',e.target.value)}
                      placeholder="e.g. https://go.product.com/aff123" className="inp inp-violet text-sm" />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">CTA Intensity</label>
                    <div className="space-y-1.5">
                      {CTA_MODES.map(({id,label,desc,icon,color})=>(
                        <button type="button" key={id} onClick={()=>s('ctaIntensity',id)}
                          role="radio" aria-checked={f.ctaIntensity === id}
                          className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl border transition-all text-left ${f.ctaIntensity===id?'border-violet-300 bg-violet-50/70 shadow-2xs':'border-slate-200/80 bg-white/70 hover:border-slate-300'}`}>
                          <span className={`text-base ${color}`}>{icon}</span>
                          <div className="flex-1 min-w-0">
                            <p className={`text-xs font-bold ${f.ctaIntensity===id?'text-violet-900':'text-slate-900'}`}>{label}</p>
                            <p className="text-[11px] text-slate-500 font-normal truncate">{desc}</p>
                          </div>
                          {f.ctaIntensity===id && <CheckCircle2 className="w-3.5 h-3.5 ml-auto text-emerald-600 shrink-0" />}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">Tone of Voice</label>
                    <div className="flex flex-wrap gap-1.5">
                      {TONES.map(t=>(
                        <button type="button" key={t} onClick={()=>s('tone',t)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all ${f.tone===t?'border-violet-300 bg-violet-50 text-violet-700 shadow-2xs':'border-slate-200/80 text-slate-700 hover:border-slate-300 bg-white/70'}`}>
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label htmlFor="aff-audience" className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">Audience</label>
                      <select id="aff-audience" value={f.audience} onChange={e=>s('audience',e.target.value)} className="inp inp-violet text-sm">
                        {AUDIENCES.map(a=><option key={a}>{a}</option>)}
                      </select>
                    </div>
                    <div>
                      <label htmlFor="aff-location" className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">Location</label>
                      <select id="aff-location" value={f.location} onChange={e=>s('location',e.target.value)} className="inp inp-violet text-sm">
                        {LOCATIONS.map(l=><option key={l}>{l}</option>)}
                      </select>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label htmlFor="aff-length" className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Article Length</label>
                      <span className="text-xs font-semibold text-violet-700 bg-violet-50 px-2 py-0.5 rounded-full border border-violet-200/60 tabular-nums">~{f.length.toLocaleString()} words</span>
                    </div>
                    <input id="aff-length" type="range" min="1500" max="4000" step="250" value={f.length} onChange={e=>s('length',+e.target.value)} className="apple-slider w-full" />
                    <div className="flex justify-between text-[10px] text-slate-400 font-semibold uppercase tracking-wider mt-1"><span>1,500w</span><span>4,000w</span></div>
                  </div>

                  <div className="pt-2">
                    <button type="button" onClick={() => setStep(3)}
                      className="w-full py-3 rounded-xl bg-violet-600 hover:bg-violet-700 active:scale-[0.99] text-white text-xs sm:text-sm font-bold shadow-[0_4px_14px_rgba(124,58,237,0.25)] transition-all flex items-center justify-center gap-2">
                      Next: Advanced <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Step 3: Advanced */}
              <div className={`col-start-1 row-start-1 transition-all duration-300 ${step === 3 ? 'opacity-100 z-10 translate-x-0' : 'opacity-0 z-0 pointer-events-none translate-x-4'}`} inert={step !== 3 ? '' : undefined}>
                <div className="panel-deep p-5 sm:p-5.5 rounded-3xl shadow-[0_16px_40px_-10px_rgba(15,23,42,0.06),inset_0_1px_1px_rgba(255,255,255,1)] space-y-3.5">
                  <div className="flex items-center gap-2 pb-2.5 border-b border-slate-200/60">
                    <Settings className="w-4 h-4 text-violet-600" />
                    <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">Trust &amp; Conversion Elements</span>
                  </div>

                  <div className="space-y-2">
                    {advancedSettings.map(({k,label,desc})=>(
                      <div key={k} onClick={()=>s(k,!f[k])}
                        role="switch" aria-checked={!!f[k]}
                        tabIndex={0}
                        onKeyDown={e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); s(k, !f[k]) } }}
                        className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer ${
                          f[k] ? 'border-violet-300/80 bg-violet-50/70 shadow-2xs' : 'border-slate-200/80 bg-white/70 hover:border-slate-300'
                        }`}>
                        <div className="text-left pr-2">
                          <p className={`text-xs font-semibold ${f[k]?'text-violet-900':'text-slate-900'}`}>{label}</p>
                          <p className="text-[11px] text-slate-500 font-normal">{desc}</p>
                        </div>
                        <div className={`toggle on-purple ${f[k] ? 'on' : ''}`} />
                      </div>
                    ))}
                  </div>

                  {/* Summary */}
                  <div className="pt-3.5 mt-3.5 border-t border-slate-200/60">
                    <div className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">Generation Summary</div>
                    <div className="space-y-1.5 text-xs">
                      <div className="flex justify-between py-1 border-b border-slate-100"><span className="text-slate-500">Product</span><span className="font-semibold text-slate-800 truncate max-w-[160px]">{f.productName||'—'}</span></div>
                      <div className="flex justify-between py-1 border-b border-slate-100"><span className="text-slate-500">Type</span><span className="font-semibold text-slate-700 capitalize">{detectedType}</span></div>
                      <div className="flex justify-between py-1 border-b border-slate-100"><span className="text-slate-500">Mode</span><span className="font-semibold text-slate-700 capitalize">{mode}</span></div>
                      <div className="flex justify-between py-1 border-b border-slate-100"><span className="text-slate-500">CTA Intensity</span><span className="font-semibold text-slate-700 capitalize">{f.ctaIntensity}</span></div>
                      <div className="flex justify-between py-1 border-b border-slate-100"><span className="text-slate-500">Competitors</span><span className="font-semibold text-slate-700 truncate max-w-[160px]">{[f.competitorA,f.competitorB].filter(Boolean).length > 0 ? [f.competitorA,f.competitorB].filter(Boolean).join(', ') : 'None'}</span></div>
                      <div className="flex justify-between py-1"><span className="text-slate-500">Length</span><span className="font-semibold text-slate-700">~{f.length.toLocaleString()}w</span></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {err && (
              <div className="flex items-start gap-3 px-4 py-3 bg-rose-50/90 border border-rose-200 rounded-2xl text-xs sm:text-sm text-rose-700 anim-scale-in">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-500 mt-0.5" />
                <div><p className="font-bold mb-0.5">Generation failed</p><p className="opacity-80">{err}</p></div>
              </div>
            )}

            <button type="button" onClick={generate} disabled={isStreaming||!canGenerate}
              className={`shimmer-btn w-full py-3.5 rounded-2xl font-bold text-sm tracking-tight transition-all duration-200 active:scale-[0.98]
                ${isStreaming||!canGenerate
                  ? 'bg-slate-100/90 text-slate-400 cursor-not-allowed border border-slate-200/70 shadow-xs'
                  : `bg-gradient-to-r ${mc.btn} text-white shadow-[0_10px_24px_-4px_rgba(109,40,217,0.36),0_2px_6px_-1px_rgba(15,23,42,0.08),inset_0_1px_1.5px_rgba(255,255,255,0.3)] hover:shadow-[0_14px_30px_-4px_rgba(109,40,217,0.48)] hover:-translate-y-0.5 active:translate-y-0`}`}>
              {isStreaming ? (
                <span className="flex items-center justify-center gap-2.5">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Writing Review...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2.5">
                  {MODES.find(m=>m.id===mode)?.icon} Generate · {MODES.find(m=>m.id===mode)?.label} Mode
                </span>
              )}
            </button>
          </div>
          ), [step, f, mode, detectedType, err, isStreaming, canGenerate, mc.btn, generate, s, advancedSettings]);

  return (
    <div className="ps-page pt-20 pb-24">
      <div className="relative max-w-7xl mx-auto px-4 sm:px-8 lg:px-14">

        {/* Header */}
        <div className="pt-6 mb-7 anim-fade-up">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-50 border border-purple-100 text-purple-700 text-xs font-semibold mb-2.5 gradient-border">
            <span className="relative flex h-2 w-2">
              <span className="ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-purple-500" />
            </span>
            Affiliate Generator · Smart Detection · 5 Modes · Advanced Form
          </div>
          <div className="flex flex-wrap items-end gap-4 justify-between">
            <div>
              <h1 className="font-display font-extrabold text-3xl sm:text-4xl lg:text-[2.75rem] text-slate-950 tracking-[-0.03em] mb-1.5 leading-tight">
                Affiliate <span className="g-violet">Generator</span>
              </h1>
              <p className="page-subheading text-slate-600 max-w-xl">High-converting affiliate reviews. Competitor comparison, trust signals, urgency triggers — all configurable.</p>
            </div>
            <div className="seg-ctrl">
              {MODES.map(m => (
                <button type="button" key={m.id} onClick={() => setMode(m.id)} className={`seg-btn ${mode === m.id ? 'active' : ''}`}>
                  {m.icon} {m.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">

          {/* FORM */}
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
                    <div className="h-full bg-gradient-to-r from-purple-500 to-violet-600 rounded-full transition-all duration-700"
                      style={{width: `${Math.min((wordCount/f.length)*100, 100)}%`}} />
                  </div>
                </div>
              </div>
            )}
            <OutputBox output={out} label="Affiliate Article Output" accent="violet" loading={isStreaming} onContinue={handleContinue} emptySubtext="Configure product details and click Generate to begin" className="flex-1 h-full" />
          </div>
        </div>
      </div>
    </div>
  )
}
