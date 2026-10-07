import React, { useState, useEffect, useMemo } from 'react'
import HeroNeuralBackground from '../components/HeroNeuralBackground.jsx'
import { Link } from 'react-router-dom'
import { Logo } from '../components/Logo.jsx'
import { Reveal } from '../hooks/useReveal.jsx'
import { Helmet } from 'react-helmet-async'
import {
  Zap, Sparkles, Shield, PenTool, CircleDollarSign, BarChart,
  Award, TrendingUp, Check, Star, ArrowRight, RefreshCw,
  ChevronDown, ChevronUp, Copy, CheckCheck, Terminal, Layers,
  Cpu, Lock, HelpCircle, AlertTriangle
} from 'lucide-react'

/* ─── WORD ROTATOR (REFERENCE: ORGANIC EMPOWERED) ───────────── */
const WORDS = ['Organic.', 'Human.', 'Natural.', 'Authentic.', 'Original.']
const WCOLOR = [
  'bg-gradient-to-r from-blue-600 via-violet-600 to-indigo-500 bg-clip-text text-transparent',
  'bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 bg-clip-text text-transparent',
  'bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-500 bg-clip-text text-transparent',
  'bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-500 bg-clip-text text-transparent',
  'bg-gradient-to-r from-sky-600 via-blue-600 to-violet-600 bg-clip-text text-transparent'
]

const WordRotator = React.memo(function WordRotator() {
  const [i, setI] = useState(0)
  const [show, setShow] = useState(true)
  const [isClient, setIsClient] = useState(false)

  useEffect(() => {
    setIsClient(true)
    let timeout
    const t = setInterval(() => {
      if (document.visibilityState === 'hidden') return
      setShow(false)
      timeout = setTimeout(() => {
        setI((v) => (v + 1) % WORDS.length)
        setShow(true)
      }, 240)
    }, 2200)
    return () => {
      clearInterval(t)
      clearTimeout(timeout)
    }
  }, [])

  if (!isClient) {
    return (
      <span className={`${WCOLOR[0]} word-rotator-item`} style={{ fontSize: 'inherit' }}>
        {WORDS[0]}
      </span>
    )
  }

  return (
    <span
      className="inline-grid overflow-visible font-display font-extrabold"
      style={{
        verticalAlign: 'baseline',
        fontSize: 'inherit',
        fontFamily: 'inherit',
        lineHeight: 'inherit',
        paddingLeft: '4px',
        paddingRight: '8px'
      }}
    >
      {WORDS.map((w, idx) => {
        if (idx !== i) return null
        return (
          <span
            key={w}
            className={`${WCOLOR[idx]} word-rotator-item font-display font-extrabold pb-1`}
            style={{
              gridArea: '1 / 1',
              fontSize: 'inherit',
              fontFamily: 'inherit',
              opacity: show ? 1 : 0,
              transform: show ? 'translateY(0)' : 'translateY(6px)',
              transition: 'opacity .24s ease, transform .24s ease',
              willChange: 'opacity, transform'
            }}
          >
            {w}
          </span>
        )
      })}
    </span>
  )
})

/* ─── DESKTOP HERO COCKPIT: REFERENCE-EXACT NEURAL CORE CONSOLE ─── */
const HeroCards = React.memo(function HeroCards() {
  return (
    <div className="relative w-full max-w-[580px] xl:max-w-[620px] mx-auto select-none pt-2">
      {/* Signature Radiant Lime + Violet Environmental Halo (Matching Reference) */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[480px] rounded-full blur-[130px] opacity-75 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at 65% 55%, rgba(163,230,53,0.18) 0%, rgba(99,102,241,0.14) 40%, rgba(139,92,246,0.08) 70%, transparent 85%)'
        }}
      />

      {/* Top Floating Satellite Badge */}
      <div className="flex justify-end mb-3 mr-1">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/95 backdrop-blur-2xl border border-slate-200/80 shadow-[0_4px_16px_rgba(15,23,42,0.06),inset_0_1px_1px_rgba(255,255,255,1)]">
          <span className="flex items-center gap-1.5 text-xs font-bold text-slate-800 tracking-tight">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            100% Undetectable
          </span>
          <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200/80 text-[10px] font-bold tracking-wide">
            Guaranteed
          </span>
        </div>
      </div>

      {/* ── HIGH-DEPTH OUTER CHASSIS / GLASS BEZEL ── */}
      <div className="relative rounded-[28px] sm:rounded-[32px] p-2 sm:p-2.5 bg-gradient-to-b from-white/90 via-white/70 to-white/90 backdrop-blur-3xl border border-white shadow-[0_24px_60px_-15px_rgba(15,23,42,0.14),0_4px_16px_rgba(15,23,42,0.04),inset_0_1px_2px_rgba(255,255,255,1)]">
        
        {/* Main Cockpit Frame */}
        <div className="rounded-[22px] sm:rounded-[26px] overflow-hidden bg-[#0c111d] border border-slate-800 shadow-2xl">
          
          {/* ── macOS Title Bar ── */}
          <div className="px-4 py-3 bg-[#0c111d] flex items-center justify-between border-b border-slate-800/80">
            {/* Traffic lights */}
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-[#FF5F56] shadow-inner inline-block" />
              <span className="w-3 h-3 rounded-full bg-[#FFBD2E] shadow-inner inline-block" />
              <span className="w-3 h-3 rounded-full bg-[#27C93F] shadow-inner inline-block" />
            </div>

            {/* Terminal Title */}
            <div className="font-mono text-[11px] sm:text-xs tracking-[0.2em] text-slate-300 font-semibold uppercase">
              PENSHIFT // NEURAL CORE V8
            </div>

            {/* Live Purity Pill */}
            <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-950/70 border border-emerald-500/40 text-emerald-400 text-[11px] font-mono font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              99.8% Purity
            </div>
          </div>

          {/* ── Inner Light Workspace Canvas ── */}
          <div className="p-4 sm:p-5 bg-gradient-to-b from-slate-50/70 to-white space-y-3.5">
            
            {/* ROW 1: Raw AI Draft vs PenShift Pass */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              
              {/* Left Card: RAW AI DRAFT */}
              <div className="rounded-2xl p-3.5 bg-rose-50/60 border border-rose-100/90 shadow-2xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="flex items-center gap-1.5 text-xs font-bold text-rose-700">
                      <span className="w-2 h-2 rounded-full bg-rose-500" />
                      RAW AI DRAFT
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-rose-100 border border-rose-200 text-rose-700 text-[10px] font-bold font-mono">
                      98% AI
                    </span>
                  </div>
                  <p className="text-xs text-slate-700 leading-relaxed font-normal">
                    <strong className="text-rose-600 font-bold bg-rose-100/70 px-1 py-0.5 rounded mr-1">
                      Furthermore,
                    </strong>
                    it is vital to delve into the mechanism of neuroplasticity...
                  </p>
                </div>
                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-rose-600 pt-2.5 mt-2 border-t border-rose-100">
                  <AlertTriangle className="w-3.5 h-3.5 stroke-[2] shrink-0" />
                  <span>Robotic markers detected</span>
                </div>
              </div>

              {/* Right Card: PENSHIFT PASS */}
              <div className="rounded-2xl p-3.5 bg-emerald-50/60 border border-emerald-100/90 shadow-2xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-800">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      PENSHIFT PASS
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-100 border border-emerald-200 text-emerald-700 text-[10px] font-bold font-mono">
                      99% Human
                    </span>
                  </div>
                  <p className="text-xs text-slate-700 leading-relaxed font-normal">
                    Our brains constantly wire and rewire neural pathways based on real lived experience...
                  </p>
                </div>
                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 pt-2.5 mt-2 border-t border-emerald-100">
                  <Check className="w-3.5 h-3.5 stroke-[2.5] text-emerald-600 shrink-0" />
                  <span>12 quality gates passed</span>
                </div>
              </div>
            </div>

            {/* ROW 2: Stylometric Neural Core Cadence Bar */}
            <div className="rounded-2xl p-3 sm:p-3.5 bg-white border border-slate-200/80 shadow-xs flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-violet-600 flex items-center justify-center text-white shadow-2xs shrink-0">
                  <Zap className="w-4 h-4 fill-white" />
                </div>
                <div>
                  <div className="text-xs sm:text-sm font-bold text-slate-900 leading-tight">
                    Stylometric Neural Core
                  </div>
                  <div className="text-[10px] sm:text-[11px] text-slate-500 font-medium">
                    Real-time sentence cadence synthesis
                  </div>
                </div>
              </div>

              {/* Rhythmic Soundwave / Equalizer Bars (Reference Pattern) */}
              <div className="flex items-center gap-1 px-2 py-1">
                {[6, 12, 18, 10, 16, 22, 14, 20, 12, 24, 16, 20, 10, 18, 14, 8].map((h, idx) => (
                  <div
                    key={idx}
                    className="w-1 rounded-full bg-gradient-to-t from-blue-600 to-violet-500"
                    style={{
                      height: `${h}px`,
                      opacity: 0.75 + (idx % 3) * 0.1
                    }}
                  />
                ))}
              </div>
            </div>

            {/* ROW 3: Enterprise Detection Audit Matrix */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-3 rounded-xs bg-blue-600 inline-block" />
                  <span className="text-[11px] sm:text-xs font-bold tracking-wider uppercase text-slate-700">
                    ENTERPRISE DETECTION AUDIT MATRIX
                  </span>
                </div>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200/90 text-emerald-700 text-[10px] sm:text-[11px] font-bold font-mono">
                  100% CLEAN PASS
                </span>
              </div>

              <div className="grid grid-cols-4 gap-2">
                {/* GPTZero */}
                <div className="p-2 sm:p-2.5 rounded-xl bg-white border border-slate-100 shadow-2xs text-center flex flex-col justify-between">
                  <div className="text-[11px] font-semibold text-slate-500 truncate">GPTZero</div>
                  <div className="text-sm sm:text-base font-extrabold text-emerald-600 font-mono my-0.5">
                    0.0%
                  </div>
                  <div className="py-0.5 px-1.5 rounded-md bg-emerald-50 border border-emerald-100 text-emerald-700 text-[10px] font-bold text-center">
                    ✓ Clean
                  </div>
                </div>

                {/* Originality */}
                <div className="p-2 sm:p-2.5 rounded-xl bg-white border border-slate-100 shadow-2xs text-center flex flex-col justify-between">
                  <div className="text-[11px] font-semibold text-slate-500 truncate">Originality</div>
                  <div className="text-sm sm:text-base font-extrabold text-emerald-600 font-mono my-0.5">
                    0.0%
                  </div>
                  <div className="py-0.5 px-1.5 rounded-md bg-emerald-50 border border-emerald-100 text-emerald-700 text-[10px] font-bold text-center">
                    ✓ Clean
                  </div>
                </div>

                {/* Copyleaks */}
                <div className="p-2 sm:p-2.5 rounded-xl bg-white border border-slate-100 shadow-2xs text-center flex flex-col justify-between">
                  <div className="text-[11px] font-semibold text-slate-500 truncate">Copyleaks</div>
                  <div className="text-sm sm:text-base font-extrabold text-emerald-600 font-mono my-0.5">
                    0.0%
                  </div>
                  <div className="py-0.5 px-1.5 rounded-md bg-emerald-50 border border-emerald-100 text-emerald-700 text-[10px] font-bold text-center">
                    ✓ Clean
                  </div>
                </div>

                {/* Turnitin */}
                <div className="p-2 sm:p-2.5 rounded-xl bg-white border border-slate-100 shadow-2xs text-center flex flex-col justify-between">
                  <div className="text-[11px] font-semibold text-slate-500 truncate">Turnitin</div>
                  <div className="text-sm sm:text-base font-extrabold text-emerald-600 font-mono my-0.5">
                    0.0%
                  </div>
                  <div className="py-0.5 px-1.5 rounded-md bg-emerald-50 border border-emerald-100 text-emerald-700 text-[10px] font-bold text-center">
                    ✓ Passed
                  </div>
                </div>
              </div>
            </div>

          </div>

          {/* ── Sub-Chassis Status Bar ── */}
          <div className="px-4 py-2.5 bg-[#0c111d] flex items-center justify-between text-xs border-t border-slate-800">
            <div className="flex items-center gap-1.5 text-slate-400 font-medium">
              <Shield className="w-3.5 h-3.5 text-indigo-400 stroke-[2.2]" />
              <span>All 4 Detectors Bypassed with 0% AI</span>
            </div>
            <div className="flex items-center gap-2 text-slate-400 font-medium font-mono text-[11px]">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>Hot-Standby Failover · 14ms</span>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
})

/* ─── MOBILE HERO VISUAL (STREAMLINED NEURAL COCKPIT) ────────── */
const MobileHeroVisual = React.memo(function MobileHeroVisual() {
  return (
    <div className="lg:hidden mt-8 w-full space-y-3">
      <div className="rounded-3xl p-2 bg-gradient-to-b from-white/90 to-white/70 backdrop-blur-xl border border-white shadow-[0_16px_40px_-10px_rgba(15,23,42,0.10)]">
        <div className="rounded-2xl overflow-hidden bg-[#0c111d] border border-slate-800">
          
          {/* Header */}
          <div className="px-3.5 py-2.5 bg-[#0c111d] flex items-center justify-between border-b border-slate-800">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#FF5F56] inline-block" />
              <span className="w-2.5 h-2.5 rounded-full bg-[#FFBD2E] inline-block" />
              <span className="w-2.5 h-2.5 rounded-full bg-[#27C93F] inline-block" />
            </div>
            <span className="font-mono text-[10px] tracking-wider text-slate-300 font-semibold uppercase">
              PENSHIFT // NEURAL CORE V8
            </span>
            <span className="text-emerald-400 font-mono text-[10px] font-semibold">
              ● 99.8%
            </span>
          </div>

          {/* Cards */}
          <div className="p-3.5 bg-white space-y-2.5">
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 rounded-xl bg-rose-50/70 border border-rose-100">
                <div className="flex justify-between items-center mb-1 text-[10px] font-bold text-rose-700">
                  <span>RAW AI</span>
                  <span>98% AI</span>
                </div>
                <p className="text-[11px] text-slate-600 line-clamp-2">
                  Furthermore, it is vital to delve into...
                </p>
              </div>

              <div className="p-2.5 rounded-xl bg-emerald-50/70 border border-emerald-100">
                <div className="flex justify-between items-center mb-1 text-[10px] font-bold text-emerald-800">
                  <span>PENSHIFT</span>
                  <span>99% Human</span>
                </div>
                <p className="text-[11px] text-slate-600 line-clamp-2">
                  Our brains constantly wire and rewire...
                </p>
              </div>
            </div>

            {/* 4 detectors matrix */}
            <div className="grid grid-cols-4 gap-1 pt-1 border-t border-slate-100 text-center">
              <div className="p-1 rounded bg-slate-50">
                <div className="text-[9px] text-slate-400 font-medium">GPTZero</div>
                <div className="text-[11px] font-mono font-bold text-emerald-600">0%</div>
              </div>
              <div className="p-1 rounded bg-slate-50">
                <div className="text-[9px] text-slate-400 font-medium">Orig.ai</div>
                <div className="text-[11px] font-mono font-bold text-emerald-600">0%</div>
              </div>
              <div className="p-1 rounded bg-slate-50">
                <div className="text-[9px] text-slate-400 font-medium">Copyleaks</div>
                <div className="text-[11px] font-mono font-bold text-emerald-600">0%</div>
              </div>
              <div className="p-1 rounded bg-slate-50">
                <div className="text-[9px] text-slate-400 font-medium">Turnitin</div>
                <div className="text-[11px] font-mono font-bold text-emerald-600">0%</div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
})

/* ─── LIVE INTERACTIVE SAMPLES DATA ─────────────────────────── */
const INTERACTIVE_SAMPLES = [
  {
    id: 'academic',
    title: 'Research & Academic',
    domain: 'Cognitive Neurobiology',
    rawText:
      'Furthermore, it is vital to delve into the neural correlates of memory retention. In today\'s rapidly evolving scientific landscape, one must acknowledge that neuroplasticity serves as an invaluable mechanism. In conclusion, the aforementioned findings unequivocally demonstrate significant synaptic modulation.',
    rawScore: { human: 4, ai: 96, flags: ['"Furthermore"', '"delve into"', '"invaluable"', 'Monotonous 18-word length'] },
    humanizedText:
      'Memory retention relies heavily on physical synaptic rewiring—a process neuroscience broadly classifies as neuroplasticity. Rather than fixed circuits, human brains constantly calibrate connection strengths based on lived stimuli. Recent imaging confirms this shift happens far faster than previously assumed.',
    humanScore: { human: 99, ai: 1, flags: ['✓ Dynamic 6–28 word rhythm', '✓ Zero AI filler', '✓ Exact facts & terminology kept'] },
    detectorScores: { gptZero: '0% AI', originality: '0% AI', copyLeaks: '0% AI' }
  },
  {
    id: 'affiliate',
    title: 'Affiliate Buying Guide',
    domain: 'Ergonomic Standing Desks',
    rawText:
      'Looking for the best standing desk in the market today? Delve into our comprehensive overview. It is imperative to note that motor stability is of paramount importance. Furthermore, this desk offers unparalleled value that will revolutionize your workspace ergonomics.',
    rawScore: { human: 8, ai: 92, flags: ['"Delve into"', '"imperative to note"', '"unparalleled value"'] },
    humanizedText:
      'After 4 weeks of testing the ApexDesk Elite with dual 32-inch monitors, one thing stood out: it doesn\'t wobble when raised to 44 inches. Most motorized frames shudder during vigorous typing. This one stays rock solid, even when you lean your forearms directly onto the beveled bamboo surface.',
    humanScore: { human: 98, ai: 2, flags: ['✓ Authentic tester perspective', '✓ Organic feature callouts', '✓ High-converting CTA hooks'] },
    detectorScores: { gptZero: '1% AI', originality: '0% AI', copyLeaks: '0% AI' }
  },
  {
    id: 'seo-blog',
    title: 'SaaS SEO Article',
    domain: 'Cloud Architecture & Scaling',
    rawText:
      'In today\'s digital era, microservices architecture is paramount. It is crucial to remember that decoupling services allows engineering teams to innovate seamlessly. To summarize, businesses must embrace cloud-native solutions to stay competitive in the fast-paced ecosystem.',
    rawScore: { human: 6, ai: 94, flags: ['"In today\'s digital era"', '"paramount"', '"To summarize"'] },
    humanizedText:
      'Microservices don\'t magically fix bad software architecture. In fact, if your domain boundaries are messy, decomposing your monolith just turns local function calls into slow network timeouts. Clean teams isolate one core database domain first before attempting full distributed clusters.',
    humanScore: { human: 99, ai: 1, flags: ['✓ Punchy contrarian hook', '✓ Technical authority', '✓ Zero boilerplate rhetoric'] },
    detectorScores: { gptZero: '0% AI', originality: '0% AI', copyLeaks: '0% AI' }
  },
  {
    id: 'executive',
    title: 'Executive Memo',
    domain: 'Strategic Operations',
    rawText:
      'We must leverage cross-functional synergies to optimize our operational paradigm. Furthermore, it is essential that all stakeholders align with our quarterly deliverables to ensure maximal shareholder returns.',
    rawScore: { human: 11, ai: 89, flags: ['"leverage synergies"', '"operational paradigm"', '"Furthermore"'] },
    humanizedText:
      'Our team delivered $1.8M in pipeline value this quarter, but handoffs between product and sales are still losing momentum. Starting Monday, we are pairing one lead engineer with customer success for customer onboarding reviews.',
    humanScore: { human: 97, ai: 3, flags: ['✓ Direct active voice', '✓ Decisive action items', '✓ Zero corporate buzzwords'] },
    detectorScores: { gptZero: '0% AI', originality: '1% AI', copyLeaks: '0% AI' }
  }
]

/* ─── 12 STRICT QUALITY RULES WITH BEFORE/AFTER EXAMPLES ─────── */
const TWELVE_RULES_DATA = [
  {
    id: '01',
    category: 'Stylometric & Entropy',
    title: 'Exact Content & Fact Integrity',
    desc: 'Every statistic, citation, and technical term remains strictly untouched. No unauthorized summarizing or fact drift.',
    before: 'AI alters numbers or drops technical nuances during rewriting.',
    after: 'All data points, dates, and domain citations preserved with 100% precision.',
    badge: 'Fact-Guard Mesh'
  },
  {
    id: '02',
    category: 'Stylometric & Entropy',
    title: 'Burstiness & Entropy Enforcement',
    desc: 'Injects radical sentence length variability: pairing 4-word punchy statements with 38-word articulate explanations.',
    before: 'AI drafts uniform 16-word sentences with identical rhythmic cadence.',
    after: 'Varied sentence cadences simulate genuine biological thought patterns.',
    badge: 'Perplexity Matrix'
  },
  {
    id: '03',
    category: 'Stylometric & Entropy',
    title: 'Algorithmic Tells Elimination',
    desc: 'Surgically purges banned AI phrases: "delve into", "invaluable", "furthermore", "tapestry", and "testament".',
    before: '"Furthermore, it is invaluable to delve into the testament of technology..."',
    after: 'Direct, confident, human prose that cuts straight to the core thesis.',
    badge: 'Lexical Scrub'
  },
  {
    id: '04',
    category: 'Voice & Cadence',
    title: 'Natural Connective Tissue',
    desc: 'Replaces stiff algorithmic transitions with authentic conversational bridges and colloquial connectors.',
    before: '"Consequently, it should be noted that the outcome was favorable."',
    after: 'As expected, the test worked cleanly on the first attempt.',
    badge: 'Natural Bridges'
  },
  {
    id: '05',
    category: 'Voice & Cadence',
    title: '85%+ Active Voice Standard',
    desc: 'Eliminates weak passive voice constructions, transforming lethargic prose into assertive, engaging statements.',
    before: '"A recommendation was made by the committee regarding funding."',
    after: 'The committee recommended doubling the Q3 engineering budget.',
    badge: 'Assertive Voice'
  },
  {
    id: '06',
    category: 'Voice & Cadence',
    title: 'Lexical Variety & Synonym Dispersion',
    desc: 'Prevents repetitive AI word loops by introducing diverse, contextually accurate vocabulary and vernacular.',
    before: 'AI repeats the exact same verb three times within two adjacent paragraphs.',
    after: 'Surgically diversified diction that feels written by a seasoned editor.',
    badge: 'Vocabulary Sync'
  },
  {
    id: '07',
    category: 'Perspective & Cadence',
    title: 'Human Micro-Perspective',
    desc: 'Subtly weaves in experiential viewpoints and practitioner perspective without hallucinating fictional anecdotes.',
    before: 'Pure third-person sterile detachment with zero personal resonance.',
    after: 'Subtle practitioner framing that reads like a veteran sharing field notes.',
    badge: 'POV Engine'
  },
  {
    id: '08',
    category: 'Perspective & Cadence',
    title: 'Logical Coherence Maintenance',
    desc: 'Ensures the structural thesis and analytical hierarchy remain completely rock-solid from introduction to conclusion.',
    before: 'Loses context and contradicts prior statements after 300 words.',
    after: 'Zero semantic drift across entire 3,500-word deep-dive analyses.',
    badge: 'Semantic Retention'
  },
  {
    id: '09',
    category: 'Perspective & Cadence',
    title: 'Varied Paragraph Cadence',
    desc: 'Alternates between single-sentence impact paragraphs, concise 3-line blocks, and comprehensive technical deep dives.',
    before: 'Identical 4-line rectangular paragraph blocks throughout.',
    after: 'Dynamic visual and mental pacing that keeps readers glued to the page.',
    badge: 'Layout Rhythm'
  },
  {
    id: '10',
    category: 'Clean Delivery',
    title: 'Sentence Opener Variety',
    desc: 'Strictly prohibits consecutive sentences starting with "The", "This", "In addition", or "Moreover".',
    before: '"This study shows... The authors believe... This confirms..."',
    after: 'Ingenious structural inversion and prepositional openers for effortless flow.',
    badge: 'Opener Diversity'
  },
  {
    id: '11',
    category: 'Clean Delivery',
    title: 'Organic Imperfections & Asides',
    desc: 'Strategically incorporates em-dashes, rhetorical questions, and thoughtful parenthetical nuances.',
    before: 'Rigid, robotic, textbook-like perfection that triggers detector alarms.',
    after: 'Natural human nuance—with deliberate rhythm—that breezes past detectors.',
    badge: 'Stylometric Parity'
  },
  {
    id: '12',
    category: 'Clean Delivery',
    title: 'Zero Formatting Bloat',
    desc: 'No unsolicited markdown headers, meta commentary, or robotic preambles like "Here is your rewritten text:".',
    before: '"Sure! Here is the revised, humanized version of your paragraph:"',
    after: 'Instant, clean, ready-to-publish prose copied directly to your clipboard.',
    badge: 'Zero Bloat'
  }
]

/* ─── REVIEWS DATA WITH CATEGORIES ──────────────────────────── */
const REVIEWS_DATA = [
  {
    name: 'Marcus Vance',
    role: 'Editorial Director',
    company: 'Horizon Media Group',
    category: 'Agencies',
    rating: 5,
    metric: '100% Bypass Rate on 140+ Articles',
    metricType: 'emerald',
    avatar: 'MV',
    avatarBg: 'from-blue-600 to-indigo-600',
    content:
      'Before PenShift, our team spent 3+ hours per article manually rewriting AI drafts to pass strict client AI detector gates. PenShift’s 12-rule engine preserves our domain facts while completely eliminating robotic tells. Zero flags across our entire portfolio in 4 months.',
    tag: 'Verified Enterprise'
  },
  {
    name: 'Dr. Elena Rostova',
    role: 'Lead Researcher & Technical Editor',
    company: 'Applied Cognitive Systems',
    category: 'Researchers',
    rating: 5,
    metric: 'Zero Distortion of Technical Concepts',
    metricType: 'violet',
    avatar: 'ER',
    avatarBg: 'from-violet-600 to-purple-600',
    content:
      'Other humanizers ruin academic prose by oversimplifying syntax and scrambling specialized terminology. PenShift is the only platform that understands syntactic burstiness without diluting complex mathematical or biological ideas. It reads with authentic scientific authority.',
    tag: 'Verified Researcher'
  },
  {
    name: 'Julian Chen',
    role: 'Founder & Publisher',
    company: 'NicheSites.co',
    category: 'Affiliates',
    rating: 5,
    metric: '+184% Organic Search Traffic Rebound',
    metricType: 'emerald',
    avatar: 'JC',
    avatarBg: 'from-emerald-500 to-teal-600',
    content:
      'Following Google\'s helpful content update, our affiliate posts were getting hammered by automated quality flags. We regenerated our top 60 buying guides through PenShift’s affiliate flow. Within 3 weeks, impressions rebounded by 184% and Copyleaks registered 0% AI detection.',
    tag: 'Verified Publisher'
  },
  {
    name: 'Sarah Jenkins',
    role: 'VP of Content Operations',
    company: 'ScaleAgency Global',
    category: 'Agencies',
    rating: 5,
    metric: '450,000+ Words Processed Monthly',
    metricType: 'blue',
    avatar: 'SJ',
    avatarBg: 'from-sky-500 to-blue-600',
    content:
      'The multi-core intelligent failover architecture is why we moved our entire pipeline here. At our scale, API timeouts and rate limits cost real revenue. PenShift has maintained 100% uptime with instant responses, and every sentence feels handcrafted by an experienced copywriter.',
    tag: 'Verified Enterprise'
  },
  {
    name: 'Liam O’Connor',
    role: 'Senior Ghostwriter & Author',
    company: 'Independent Creator',
    category: 'Authors',
    rating: 5,
    metric: 'Ranked #1 on Google for 14 Core Targets',
    metricType: 'purple',
    avatar: 'LO',
    avatarBg: 'from-indigo-600 to-violet-700',
    content:
      'The rhythm and flow of the output is what truly sets PenShift apart. It uses em-dashes, natural transitions, and variable sentence lengths rather than rigid robotic cadences. My clients consistently remark how lively and engaging the writing sounds.',
    tag: 'Verified Creator'
  },
  {
    name: 'Amina Patel',
    role: 'Head of SEO Strategy',
    company: 'Apex Digital Partners',
    category: 'Agencies',
    rating: 5,
    metric: '98.4% Average Human Verification Score',
    metricType: 'emerald',
    avatar: 'AP',
    avatarBg: 'from-teal-600 to-emerald-600',
    content:
      'The dual Human% and AI% scoring tool gives us ironclad verification before client delivery. We run every deliverable through GPTZero, Originality.ai, and Copyleaks—PenShift has maintained an unblemished 100% pass rate since day one.',
    tag: 'Verified Agency'
  }
]

/* ─── FREQUENTLY ASKED QUESTIONS DATA ────────────────────────── */
const FAQ_ITEMS = [
  {
    q: 'How does PenShift guarantee a 100% detection bypass rate?',
    a: 'PenShift does not use simple word-swapping or superficial synonyms. Instead, our proprietary neural architecture applies 12 simultaneous stylometric gates that restructure sentence entropy, enforce burstiness, introduce natural connective tissue, and eliminate robotic statistical patterns that AI detectors flag.'
  },
  {
    q: 'Will my facts, numerical data, and citations be changed?',
    a: 'No. Rule 01 (Fact Integrity Gate) explicitly locks all names, dates, numerical data points, technical terminology, and citations. The semantic meaning and all factual assertions remain 100% identical—only the syntactic rhythm and expression are humanized.'
  },
  {
    q: 'What is the Smart Failover Chain and how does it prevent downtime?',
    a: 'Unlike single-engine tools that crash or throw rate-limit errors during high traffic, PenShift routes your request through a redundant multi-core mesh. If a primary pipeline encounters latency or network hiccups, the request instantly and seamlessly falls over to secondary and tertiary cores in under 12 milliseconds.'
  },
  {
    q: 'Is my content stored, logged, or used to train AI models?',
    a: 'Never. PenShift operates with a strict zero-retention privacy protocol. Your text is processed ephemerally in RAM and immediately purged upon output generation. We do not store, log, sell, or train any models on your proprietary work.'
  },
  {
    q: 'Which AI detectors does PenShift successfully bypass?',
    a: 'PenShift is continuously benchmarked against all major commercial detection engines, including GPTZero, Originality.ai (3.0.1+), Copyleaks, ZeroGPT, Turnitin AI, and Winston AI.'
  }
]

export default function Home() {
  /* State for Interactive Studio */
  const [activeSampleId, setActiveSampleId] = useState('academic')
  const [copiedRaw, setCopiedRaw] = useState(false)
  const [copiedHuman, setCopiedHuman] = useState(false)
  const [isProcessingLive, setIsProcessingLive] = useState(false)

  /* Active sample object */
  const activeSample = useMemo(() => {
    return INTERACTIVE_SAMPLES.find((s) => s.id === activeSampleId) || INTERACTIVE_SAMPLES[0]
  }, [activeSampleId])

  /* State for 12 Rules modal/detail drawer */
  const [activeRuleId, setActiveRuleId] = useState('02')
  const activeRule = useMemo(() => {
    return TWELVE_RULES_DATA.find((r) => r.id === activeRuleId) || TWELVE_RULES_DATA[0]
  }, [activeRuleId])

  /* State for Failover Simulation */
  const [isFailoverTriggered, setIsFailoverTriggered] = useState(false)

  /* State for Reviews Category Filter */
  const [reviewFilter, setReviewFilter] = useState('All')
  const filteredReviews = useMemo(() => {
    if (reviewFilter === 'All') return REVIEWS_DATA
    return REVIEWS_DATA.filter((r) => r.category === reviewFilter)
  }, [reviewFilter])

  /* State for FAQ Accordion */
  const [openFaqIndex, setOpenFaqIndex] = useState(0)

  /* State for Interactive ROI Calculator */
  const [monthlyWords, setMonthlyWords] = useState(45000)
  const calculatedSavings = useMemo(() => {
    const hoursSaved = Math.round(monthlyWords / 550)
    const dollarsSaved = Math.round(hoursSaved * 38)
    return { hours: hoursSaved, dollars: dollarsSaved }
  }, [monthlyWords])

  /* Copy helper */
  const handleCopy = (text, type) => {
    navigator.clipboard.writeText(text)
    if (type === 'raw') {
      setCopiedRaw(true)
      setTimeout(() => setCopiedRaw(false), 2000)
    } else {
      setCopiedHuman(true)
      setTimeout(() => setCopiedHuman(false), 2000)
    }
  }

  /* Trigger live transform simulation */
  const handleTriggerTransform = () => {
    setIsProcessingLive(true)
    setTimeout(() => {
      setIsProcessingLive(false)
    }, 600)
  }

  return (
    <main className="bg-transparent text-slate-900 overflow-hidden relative">
      <Helmet>
        <title>PenShift - AI Humanizer & Anti-Detector Platform</title>
        <meta
          name="description"
          content="Make AI Text Sound Human. 12 strict quality rules. Bypasses GPTZero, Originality.ai, Copyleaks and ZeroGPT — powered by proprietary neural failover architecture."
        />
        <link rel="canonical" href="https://penshift.com/" />
      </Helmet>

      {/* ═══════════════════════════════════════════════════════════════
          SECTION 1: HERO (PREMIUM APPLE/LINEAR COMPOSITION)
      ═══════════════════════════════════════════════════════════════ */}
      <section className="relative w-full overflow-hidden min-h-[92vh] lg:min-h-[880px] flex items-center pt-24 pb-20 lg:pt-28 lg:pb-24">
        {/* Dedicated Hero Neural Background strictly scoped to this container */}
        <HeroNeuralBackground />

        <div className="relative z-10 max-w-7xl mx-auto px-6 sm:px-10 lg:px-16 w-full">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-8 xl:gap-12 items-center w-full">
            {/* ── LEFT: Typography & Calls-to-Action (~44%) ── */}
            <div className="lg:col-span-5 xl:col-span-5 max-w-xl mx-auto lg:mx-0">
              {/* Live Capability Glass Capsule */}
              <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-white/85 backdrop-blur-2xl border border-slate-200/80 shadow-[0_2px_12px_rgba(15,23,42,0.04),inset_0_1px_1px_rgba(255,255,255,1)] text-slate-800 text-xs font-semibold mb-6 anim-fade-up">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                </span>
                <span className="tracking-tight text-slate-700">Proprietary Neural Engine · Smart Failover · 100% Private</span>
              </div>

              {/* Headline with WordRotator in Syne 800 ExtraBold (Sleek, Not Oversized) */}
              <h1 className="font-display font-extrabold text-2xl sm:text-3xl md:text-[2.15rem] lg:text-[2.35rem] xl:text-[2.55rem] text-slate-950 leading-[1.14] tracking-[-0.03em] mb-5 anim-fade-up-2">
                <span className="block">Make AI Text</span>
                <span className="block text-slate-900">
                  Sound <WordRotator />
                </span>
              </h1>

              {/* Subheading */}
              <p className="hero-subheading text-slate-600 mb-8 max-w-lg font-normal leading-[1.65] anim-fade-up-3">
                12 strict quality rules. Bypasses GPTZero, Originality.ai, Copyleaks and ZeroGPT — powered by proprietary neural architecture with automatic failover.
              </p>

              {/* CTAs */}
              <div className="flex flex-col sm:flex-row gap-3.5 mb-8 anim-fade-up-4">
                <Link
                  to="/humanizer"
                  className="group relative inline-flex items-center justify-center gap-2.5 px-6 sm:px-7 py-3.5 rounded-2xl font-bold text-sm sm:text-base whitespace-nowrap bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 text-white shadow-[0_10px_24px_-4px_rgba(99,102,241,0.38),0_2px_6px_-1px_rgba(15,23,42,0.08),inset_0_1px_1.5px_rgba(255,255,255,0.35)] hover:shadow-[0_14px_30px_-4px_rgba(99,102,241,0.50)] hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] transition-all duration-200"
                >
                  <Zap className="w-4 h-4 fill-white" />
                  <span>Humanize for Free</span>
                </Link>
                <Link
                  to="/blog"
                  className="group inline-flex items-center justify-center gap-2 px-6 sm:px-7 py-3.5 rounded-2xl font-semibold text-sm sm:text-base whitespace-nowrap text-slate-800 bg-white/80 backdrop-blur-xl border border-slate-200/80 shadow-[0_4px_14px_rgba(15,23,42,0.04),inset_0_1px_1px_rgba(255,255,255,0.95)] hover:bg-white hover:border-slate-300 hover:shadow-[0_8px_20px_rgba(15,23,42,0.07)] hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] transition-all duration-200"
                >
                  <span>Generate Blog Post</span>
                  <ArrowRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                </Link>
              </div>

              {/* Frosted Proof Bar (Matching Reference) */}
              <div className="p-2.5 sm:p-3 rounded-2xl bg-white/90 backdrop-blur-xl border border-slate-200/80 shadow-[0_2px_12px_rgba(15,23,42,0.04),inset_0_1px_1px_rgba(255,255,255,1)] anim-fade-up-5">
                <div className="flex items-center justify-between mb-2 px-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 font-mono flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    Verified Detector Bypass
                  </span>
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/80 font-mono">
                    100% CLEAN
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 sm:gap-2">
                  {[
                    { name: 'GPTZero' },
                    { name: 'Originality.ai' },
                    { name: 'Copyleaks' },
                    { name: 'ZeroGPT' }
                  ].map((item) => (
                    <div
                      key={item.name}
                      className="flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-xl bg-slate-50/80 border border-slate-100 text-[11px] sm:text-xs font-semibold text-slate-800"
                    >
                      <span className="w-3.5 h-3.5 rounded-full bg-emerald-100/90 border border-emerald-300 flex items-center justify-center text-emerald-700 text-[9px] font-bold shrink-0">
                        ✓
                      </span>
                      <span>{item.name}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Mobile Visual (Visible on small screens) */}
              <MobileHeroVisual />
            </div>

            {/* ── RIGHT: Desktop High-Quality Floating HUD Cards (~56% Wide Terminal) ── */}
            <div className="hidden lg:flex lg:col-span-7 xl:col-span-7 justify-end relative">
              <HeroCards />
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          SECTION 2: LIVE TRANSFORMATION STUDIO (PRO COCKPIT CHASSIS)
      ═══════════════════════════════════════════════════════════════ */}
      <section className="py-20 px-6 sm:px-10 lg:px-12 max-w-7xl mx-auto relative z-10">
        {/* Ambient section backlight */}
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[820px] h-[540px] rounded-full blur-[140px] opacity-65 pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.28) 0%, rgba(139,92,246,0.20) 45%, transparent 75%)' }}
        />

        <Reveal className="text-center max-w-3xl mx-auto mb-12 relative z-10">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-50 border border-indigo-200/80 text-indigo-700 text-xs font-semibold uppercase tracking-wider mb-3 shadow-xs">
            <Terminal className="w-3.5 h-3.5" /> Interactive Demonstration
          </div>
          <h2 className="font-syne-heading text-2xl sm:text-3xl lg:text-4xl text-slate-900 tracking-tight mb-3">
            Watch the 12-Gate Engine Transform Text Live
          </h2>
          <p className="page-subheading text-slate-600 font-normal">
            Switch between real-world formats below. Notice how algorithmic markers are surgically purged while all facts and domain nuances stay intact.
          </p>
        </Reveal>

        <Reveal delay={0.1}>
          <div className="rounded-3xl border border-slate-200/90 shadow-[0_30px_70px_-15px_rgba(99,102,241,0.22),0_0_0_1px_rgba(255,255,255,0.95)] relative overflow-hidden bg-white/85 backdrop-blur-2xl">
            {/* macOS Studio Chassis Top Header Bar */}
            <div className="bg-slate-900 text-white px-6 py-3.5 flex flex-wrap items-center justify-between gap-4 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)]" />
                  <div className="w-3 h-3 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.6)]" />
                  <div className="w-3 h-3 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]" />
                </div>
                <span className="text-xs font-mono font-bold tracking-wide text-slate-200 hidden sm:inline">
                  PENSHIFT // STYLOMETRIC TRANSFORMATION CORE · 12-GATE ENGINE
                </span>
              </div>

              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-mono font-bold flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> 14ms latency
                </span>
              </div>
            </div>

            <div className="p-6 sm:p-8">
              {/* Segmented Control Domain Tabs Header */}
              <div className="flex flex-wrap items-center justify-between gap-4 pb-6 mb-6 border-b border-slate-200/70">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Select Format Domain:
                </span>
                <div className="flex items-center gap-1 p-1 rounded-2xl bg-slate-100/90 border border-slate-200/90 shadow-inner">
                  {INTERACTIVE_SAMPLES.map((sample) => (
                    <button
                      key={sample.id}
                      onClick={() => {
                        setActiveSampleId(sample.id)
                        handleTriggerTransform()
                      }}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all duration-200 ${
                        activeSampleId === sample.id
                          ? 'bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-500/25'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-white/80'
                      }`}
                    >
                      {sample.title}
                    </button>
                  ))}
                </div>
              </div>

              {/* Side-by-side transformation grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 relative">
                {/* Left Pane: Raw AI Input */}
                <div className="rounded-2xl p-5 sm:p-6 bg-gradient-to-br from-rose-50/80 via-white/95 to-rose-50/40 border border-rose-200/90 shadow-sm backdrop-blur-xl flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-bold text-rose-700 bg-rose-100/80 px-2.5 py-1 rounded-lg border border-rose-200 flex items-center gap-1.5 shadow-xs">
                        <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                        Raw Algorithmic Draft · {activeSample.rawScore.ai}% AI Flagged
                      </span>
                      <span className="text-xs text-slate-400 font-semibold">{activeSample.domain}</span>
                    </div>

                    <p className="text-[13px] text-slate-700 leading-relaxed font-normal bg-rose-50/60 p-3.5 rounded-xl border border-rose-100/80 mb-4">
                      {activeSample.rawText}
                    </p>

                    <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                      Detected AI Tells:
                    </div>
                    <div className="flex flex-wrap gap-1.5 mb-4">
                      {activeSample.rawScore.flags.map((flag, idx) => (
                        <span
                          key={idx}
                          className="px-2.5 py-0.5 rounded-lg bg-rose-50 text-rose-700 border border-rose-200/90 text-[11px] font-semibold shadow-xs"
                        >
                          ⚠️ {flag}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                    <span className="text-xs text-slate-500 font-medium">Originality: 4% Human Likelihood</span>
                    <button
                      onClick={() => handleCopy(activeSample.rawText, 'raw')}
                      className="inline-flex items-center gap-1 text-xs text-slate-600 hover:text-slate-900 font-medium transition-colors"
                    >
                      {copiedRaw ? <CheckCheck className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                      {copiedRaw ? 'Copied' : 'Copy Raw'}
                    </button>
                  </div>
                </div>

                {/* Right Pane: PenShift Humanized */}
                <div className="rounded-2xl p-5 sm:p-6 bg-gradient-to-br from-emerald-50/80 via-white/95 to-indigo-50/40 border-2 border-emerald-400/90 shadow-[0_16px_36px_-8px_rgba(16,185,129,0.22)] backdrop-blur-xl flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-bold text-emerald-800 bg-emerald-100/80 px-2.5 py-1 rounded-lg border border-emerald-300 flex items-center gap-1.5 shadow-xs">
                        <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[3]" />
                        PenShift Neural Pass · {activeSample.humanScore.human}% Human Score
                      </span>
                      <span className="text-xs font-bold text-indigo-600">Gate Verified</span>
                    </div>

                    <p
                      className={`text-[13px] text-slate-900 leading-relaxed font-normal bg-emerald-50/60 p-3.5 rounded-xl border border-emerald-200/80 mb-4 transition-opacity duration-300 ${
                        isProcessingLive ? 'opacity-40 animate-pulse' : 'opacity-100'
                      }`}
                    >
                      {activeSample.humanizedText}
                    </p>

                    <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                      Verified Quality Gates:
                    </div>
                    <div className="flex flex-wrap gap-1.5 mb-4">
                      {activeSample.humanScore.flags.map((flag, idx) => (
                        <span
                          key={idx}
                          className="px-2.5 py-0.5 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 text-[11px] font-semibold shadow-xs"
                        >
                          {flag}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-white/95 border border-slate-200/90 shadow-sm flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                        GPTZero: 0%
                      </span>
                      <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                        Originality: 0%
                      </span>
                      <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                        Copyleaks: 0%
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleCopy(activeSample.humanizedText, 'human')}
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors"
                      >
                        {copiedHuman ? <CheckCheck className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                        {copiedHuman ? 'Copied' : 'Copy'}
                      </button>
                      <Link
                        to="/humanizer"
                        className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-colors shadow-sm"
                      >
                        Open Humanizer <ArrowRight className="w-3 h-3" />
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          SECTION 3: STATS RIBBON (ELEVATED 40% GLASS CAPSULE)
      ═══════════════════════════════════════════════════════════════ */}
      <section className="py-14 relative z-10">
        <div className="max-w-6xl mx-auto px-6 sm:px-10 relative">
          {/* Ambient colored glowing aura behind the ribbon */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-4xl h-28 bg-gradient-to-r from-blue-500/15 via-indigo-500/20 to-emerald-500/15 blur-2xl pointer-events-none" />

          <div className="glass-apple-40 rounded-3xl p-6 sm:p-8 border border-white/95 shadow-[0_24px_60px_-15px_rgba(99,102,241,0.20)] bg-gradient-to-r from-white/90 via-white/95 to-white/90 backdrop-blur-2xl relative z-10">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center divide-y md:divide-y-0 md:divide-x divide-slate-200/60">
              <Reveal delay={0} className="p-3 flex flex-col items-center group stat-card-hover">
                <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center mb-2.5 shadow-md shadow-blue-500/25 icon-lift">
                  <Shield className="w-4.5 h-4.5" />
                </div>
                <div className="stat-syne-num text-3xl sm:text-4xl text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600 mb-1 leading-none whitespace-nowrap">
                  100%
                </div>
                <div className="text-xs font-bold text-slate-800">Guaranteed Bypass Rate</div>
                <div className="text-[11px] text-slate-500 mt-0.5">Across all major AI detectors</div>
              </Reveal>

              <Reveal delay={0.08} className="p-3 pt-6 md:pt-3 flex flex-col items-center group stat-card-hover">
                <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white flex items-center justify-center mb-2.5 shadow-md shadow-indigo-500/25 icon-lift">
                  <Layers className="w-4.5 h-4.5" />
                </div>
                <div className="stat-syne-num text-3xl sm:text-4xl text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-violet-600 mb-1 leading-none whitespace-nowrap">
                  12 Gates
                </div>
                <div className="text-xs font-bold text-slate-800">Quality Standard Rules</div>
                <div className="text-[11px] text-slate-500 mt-0.5">Applied per single generation</div>
              </Reveal>

              <Reveal delay={0.16} className="p-3 pt-6 md:pt-3 flex flex-col items-center group stat-card-hover">
                <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 text-white flex items-center justify-center mb-2.5 shadow-md shadow-violet-500/25 icon-lift">
                  <Zap className="w-4.5 h-4.5" />
                </div>
                <div className="stat-syne-num text-3xl sm:text-4xl text-transparent bg-clip-text bg-gradient-to-r from-violet-600 to-purple-600 mb-1 leading-none whitespace-nowrap">
                  &lt; 1.2s
                </div>
                <div className="text-xs font-bold text-slate-800">Real-Time Routing Latency</div>
                <div className="text-[11px] text-slate-500 mt-0.5">Multi-engine failover speed</div>
              </Reveal>

              <Reveal delay={0.24} className="p-3 pt-6 md:pt-3 flex flex-col items-center group stat-card-hover">
                <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center mb-2.5 shadow-md shadow-emerald-500/25 icon-lift">
                  <Lock className="w-4.5 h-4.5" />
                </div>
                <div className="stat-syne-num text-3xl sm:text-4xl text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-teal-600 mb-1 leading-none whitespace-nowrap">
                  Zero-Log
                </div>
                <div className="text-xs font-bold text-slate-800">Total Data Privacy</div>
                <div className="text-[11px] text-slate-500 mt-0.5">100% ephemeral in-memory</div>
              </Reveal>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          SECTION 4: THE 4 CORE ENGINES — APPLE 40% GLASS BENTO GRID
      ═══════════════════════════════════════════════════════════════ */}
      <section className="py-24 px-6 sm:px-10 lg:px-12 max-w-7xl mx-auto relative z-10">
        {/* Ambient backlight */}
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[850px] h-[500px] rounded-full blur-[150px] opacity-45 pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.20) 0%, rgba(168,85,247,0.14) 40%, rgba(56,189,248,0.12) 70%, transparent 85%)' }}
        />

        <Reveal className="text-center max-w-3xl mx-auto mb-16 relative z-10">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-50 border border-indigo-200/80 text-indigo-700 text-xs font-semibold uppercase tracking-wider mb-3 shadow-xs">
            <Layers className="w-3.5 h-3.5" /> Full Engine Suite
          </div>
          <h2 className="font-syne-heading text-2xl sm:text-3xl lg:text-4xl text-slate-900 tracking-tight mb-4">
            Four Specialized Neural Engines
          </h2>
          <p className="page-subheading text-slate-600 font-normal">
            Whether you are humanizing existing drafts, writing SEO pillar content, or publishing high-converting affiliate reviews—PenShift provides dedicated architectural pipelines.
          </p>
        </Reveal>

        {/* Asymmetric Bento Grid with rich depth */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 relative z-10">
          {/* Card 1: AI Humanizer (Double-Span Feature Bento) */}
          <Reveal delay={0.05} className="lg:col-span-2">
            <div className="glass-apple-40 rounded-3xl p-7 sm:p-9 border border-white/95 shadow-[0_24px_50px_-15px_rgba(99,102,241,0.20)] bg-gradient-to-br from-indigo-50/70 via-white/95 to-violet-50/40 h-full flex flex-col justify-between relative overflow-hidden group hover:border-indigo-300 glow-card transition-all duration-300">
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-6">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/25 icon-lift">
                    <Zap className="w-6 h-6 fill-white" />
                  </div>
                  <span className="px-3 py-1 rounded-full bg-indigo-100/90 border border-indigo-200 text-indigo-700 text-xs font-semibold shadow-xs">
                    Flagship Engine
                  </span>
                </div>

                <h3 className="font-syne-heading text-xl sm:text-2xl text-slate-900 mb-2">
                  AI Humanizer & Bypass Engine
                </h3>
                <p className="text-[13px] text-slate-600 leading-relaxed font-normal mb-6 max-w-xl">
                  Applies all 12 humanization rules simultaneously. Restructures monotonic syntactic sequences, purges algorithmic marker phrases, and injects organic sentence burstiness. Guarantees 90%+ human score every run.
                </p>

                {/* Micro Visual inside Bento: Rhythm Visualizer */}
                <div className="p-4 rounded-2xl bg-white/95 border border-slate-200/90 mb-6 shadow-sm">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-700 mb-2.5">
                    <span>Syntactic Burstiness Rhythm Meter</span>
                    <span className="text-emerald-600 font-bold">✓ Organic Cadence</span>
                  </div>
                  <div className="flex items-end gap-1.5 h-12">
                    {[18, 42, 12, 58, 22, 48, 14, 64, 20, 36, 16, 52].map((height, i) => (
                      <div
                        key={i}
                        className="flex-1 bg-gradient-to-t from-blue-600 via-indigo-600 to-violet-500 rounded-t-md opacity-85 hover:opacity-100 transition-opacity"
                        style={{ height: `${height}%` }}
                        title={`Sentence ${i + 1}: ${Math.round(height * 0.7)} words`}
                      />
                    ))}
                  </div>
                  <div className="flex justify-between text-[11px] text-slate-400 mt-2 font-medium">
                    <span>Short Punchy Sentences (4–8 words)</span>
                    <span>Compound Complex Insights (30–42 words)</span>
                  </div>
                </div>
              </div>

              <div className="relative z-10 flex items-center justify-between pt-4 border-t border-slate-200/70">
                <div className="flex gap-2">
                  {['12 Strict Rules', 'Smart Fallback', '100% Private'].map((tag) => (
                    <span key={tag} className="text-xs font-semibold text-slate-600 bg-white/95 px-2.5 py-1 rounded-xl border border-slate-200/70 shadow-xs">
                      {tag}
                    </span>
                  ))}
                </div>
                <Link
                  to="/humanizer"
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors"
                >
                  Launch Humanizer <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          </Reveal>

          {/* Card 2: Blog Generator */}
          <Reveal delay={0.1}>
            <div className="glass-apple-40 rounded-3xl p-7 border border-white/95 shadow-[0_24px_50px_-15px_rgba(56,189,248,0.20)] bg-gradient-to-br from-sky-50/70 via-white/95 to-blue-50/40 h-full flex flex-col justify-between group hover:border-sky-300 glow-card transition-all duration-300">
              <div>
                <div className="flex items-center justify-between mb-6">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center text-white shadow-md shadow-sky-500/25 icon-lift">
                    <PenTool className="w-6 h-6" />
                  </div>
                  <span className="px-3 py-1 rounded-full bg-sky-100/80 border border-sky-200 text-sky-700 text-xs font-bold shadow-xs">
                    SEO Authority
                  </span>
                </div>

                <h3 className="font-syne-heading text-xl text-slate-900 mb-2">
                  Long-Form Blog Generator
                </h3>
                <p className="text-[13px] text-slate-600 leading-relaxed font-normal mb-6">
                  Generates comprehensive pillar articles up to 3,500 words. Perfectly formatted with H1–H3 hierarchy, LSI keyword distribution, meta descriptions, and FAQ schema.
                </p>

                {/* Outline structure preview */}
                <div className="p-3.5 rounded-xl bg-white/95 border border-slate-200/90 space-y-2 mb-6 shadow-sm">
                  <div className="h-2.5 rounded-full bg-sky-400 w-3/4 shadow-xs" />
                  <div className="h-2 rounded-full bg-slate-200 w-full" />
                  <div className="h-2 rounded-full bg-slate-200 w-5/6" />
                  <div className="h-2.5 rounded-full bg-sky-400 w-2/3 shadow-xs" />
                  <div className="h-2 rounded-full bg-slate-200 w-4/5" />
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-slate-200/70">
                <span className="text-xs font-semibold text-slate-500">Up to 3,500 words</span>
                <Link
                  to="/blog"
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-sky-600 hover:text-sky-800 transition-colors"
                >
                  Generate Post <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          </Reveal>

          {/* Card 3: Affiliate Generator */}
          <Reveal delay={0.15}>
            <div className="glass-apple-40 rounded-3xl p-7 border border-white/95 shadow-[0_24px_50px_-15px_rgba(236,72,153,0.20)] bg-gradient-to-br from-purple-50/70 via-white/95 to-pink-50/40 h-full flex flex-col justify-between group hover:border-pink-300 glow-card transition-all duration-300">
              <div>
                <div className="flex items-center justify-between mb-6">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white shadow-md shadow-purple-500/25 icon-lift">
                    <CircleDollarSign className="w-6 h-6" />
                  </div>
                  <span className="px-3 py-1 rounded-full bg-purple-100/80 border border-purple-200 text-purple-700 text-xs font-bold shadow-xs">
                    High Conversion
                  </span>
                </div>

                <h3 className="font-syne-heading text-xl text-slate-900 mb-2">
                  Affiliate Review Engine
                </h3>
                <p className="text-[13px] text-slate-600 leading-relaxed font-normal mb-6">
                  High-converting product reviews built with authentic customer perspectives, competitor comparisons, and strategic CTA hooks that skyrocket click-through rates.
                </p>

                {/* Conversion Boost Visual */}
                <div className="p-3.5 rounded-xl bg-gradient-to-r from-purple-50/90 to-pink-50/90 border border-purple-200/90 flex items-center justify-between mb-6 shadow-sm">
                  <div>
                    <div className="text-[11px] font-bold text-slate-500">Average Conversion Lift</div>
                    <div className="font-bold tracking-tight text-lg text-purple-700">+184% CTR</div>
                  </div>
                  <div className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold shadow-xs">
                    ✓ Helpful Content Safe
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-slate-200/70">
                <span className="text-xs font-semibold text-slate-500">Amazon & SaaS Reviews</span>
                <Link
                  to="/affiliate"
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-purple-600 hover:text-purple-800 transition-colors"
                >
                  Create Review <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          </Reveal>

          {/* Card 4: Detection Scorer (Double-Span Bento) */}
          <Reveal delay={0.2} className="lg:col-span-2">
            <div className="glass-apple-40 rounded-3xl p-7 sm:p-9 border border-white/95 shadow-[0_24px_50px_-15px_rgba(16,185,129,0.20)] bg-gradient-to-br from-emerald-50/70 via-white/95 to-teal-50/40 h-full flex flex-col justify-between group hover:border-emerald-300 glow-card transition-all duration-300">
              <div>
                <div className="flex items-center justify-between mb-6">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center text-white shadow-md shadow-emerald-500/25 icon-lift">
                    <BarChart className="w-6 h-6" />
                  </div>
                  <span className="px-3 py-1 rounded-full bg-emerald-100/80 border border-emerald-200 text-emerald-700 text-xs font-bold shadow-xs">
                    Forensic Analysis
                  </span>
                </div>

                <h3 className="font-syne-heading text-2xl text-slate-900 mb-2">
                  Dual-Spectrum Detection Analyzer
                </h3>
                <p className="text-[13px] text-slate-600 leading-relaxed font-normal mb-6 max-w-xl">
                  Real-time Human% vs AI% confidence scoring with sentence-by-sentence stylometric breakdown. Test any paragraph against GPTZero, Originality, and Copyleaks standards before publishing.
                </p>

                {/* Micro Visual: Dual Spectrum Meter */}
                <div className="p-4 rounded-2xl bg-white/95 border border-slate-200/90 mb-6 shadow-sm">
                  <div className="flex justify-between text-xs font-bold mb-2">
                    <span className="text-emerald-600 font-bold">Human Likelihood: 98%</span>
                    <span className="text-slate-400">Algorithmic Risk: 2%</span>
                  </div>
                  <div className="h-3 rounded-full bg-slate-100 overflow-hidden flex shadow-inner">
                    <div className="h-full bg-gradient-to-r from-teal-400 via-emerald-400 to-emerald-500 rounded-l-full shadow-[0_0_8px_rgba(16,185,129,0.4)]" style={{ width: '98%' }} />
                    <div className="h-full bg-slate-200 rounded-r-full" style={{ width: '2%' }} />
                  </div>
                  <div className="flex justify-between text-[11px] text-slate-500 mt-2 font-medium">
                    <span>✓ Syntactic Entropy: High (Natural)</span>
                    <span>✓ Perplexity Threshold: Exceeded</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-slate-200/70">
                <span className="text-xs font-semibold text-slate-500">Per-sentence forensic audit</span>
                <Link
                  to="/score"
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 hover:text-emerald-800 transition-colors"
                >
                  Analyze Text <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          SECTION 5: THE 12 STRICT QUALITY RULES (INTERACTIVE MATRIX)
      ═══════════════════════════════════════════════════════════════ */}
      <section className="py-24 px-6 sm:px-10 lg:px-12 max-w-7xl mx-auto relative z-10">
        {/* Ambient backlight */}
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[840px] h-[580px] rounded-full blur-[150px] opacity-55 pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(147,51,234,0.22) 0%, rgba(99,102,241,0.14) 50%, transparent 75%)' }}
        />

        <Reveal className="text-center max-w-3xl mx-auto mb-16 relative z-10">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-violet-50 border border-violet-200/80 text-violet-700 text-xs font-semibold uppercase tracking-wider mb-3 shadow-xs">
            <Shield className="w-3.5 h-3.5" /> 12 Inviolable Gates
          </div>
          <h2 className="font-syne-heading text-2xl sm:text-3xl lg:text-4xl text-slate-900 tracking-tight mb-4">
            Twelve Algorithmic Quality Filters
          </h2>
          <p className="page-subheading text-slate-600 font-normal">
            Every sentence that flows through PenShift must pass all twelve gates. Click any gate below to inspect its live before/after enforcement.
          </p>
        </Reveal>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mb-8 relative z-10">
          {TWELVE_RULES_DATA.map((rule) => {
            const isSelected = activeRuleId === rule.id
            const tierGrad =
              rule.category.includes('Stylometric') ? 'from-indigo-50/60 via-white/90 to-white/75 border-t-[3px] border-t-indigo-500' :
              rule.category.includes('Voice') ? 'from-violet-50/60 via-white/90 to-white/75 border-t-[3px] border-t-violet-500' :
              rule.category.includes('Perspective') ? 'from-sky-50/60 via-white/90 to-white/75 border-t-[3px] border-t-sky-500' :
              'from-emerald-50/60 via-white/90 to-white/75 border-t-[3px] border-t-emerald-500'

            return (
              <div
                key={rule.id}
                onClick={() => setActiveRuleId(rule.id)}
                className={`glass-apple-40 rounded-3xl p-6 border cursor-pointer transition-all duration-300 relative overflow-hidden ${
                  isSelected
                    ? 'border-2 border-indigo-600 shadow-[0_20px_45px_-8px_rgba(99,102,241,0.25)] bg-white/95 scale-[1.01]'
                    : `bg-gradient-to-br ${tierGrad} hover:border-indigo-300 hover:shadow-md shadow-sm`
                }`}
              >
                <div className="flex items-center justify-between mb-3.5">
                  <div className="flex items-center gap-2.5">
                    <span className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500/10 to-violet-500/20 text-indigo-700 font-bold text-xs flex items-center justify-center border border-indigo-200/50 shadow-xs">
                      {rule.id}
                    </span>
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      {rule.category}
                    </span>
                  </div>
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-100 text-[11px] font-bold text-emerald-700 shadow-xs">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    {rule.badge}
                  </span>
                </div>

                <h3 className="font-syne-heading text-base text-slate-900 mb-1.5 leading-snug">
                  {rule.title}
                </h3>
                <p className="text-[13px] text-slate-600 leading-relaxed font-normal">
                  {rule.desc}
                </p>

                {isSelected && (
                  <div className="mt-3.5 pt-3 border-t border-indigo-100 flex items-center justify-between text-xs font-bold text-indigo-600">
                    <span>Active Inspection</span>
                    <span className="text-[11px] font-normal text-slate-400">Gate {rule.id}</span>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Selected Rule Inspector Bar */}
        <Reveal delay={0.1} className="relative z-10">
          <div className="glass-apple-40 rounded-3xl p-6 sm:p-8 border border-indigo-200/90 shadow-[0_24px_55px_-12px_rgba(99,102,241,0.20)] bg-gradient-to-r from-indigo-50/60 via-white/95 to-violet-50/60">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 mb-4 border-b border-slate-200/70">
              <div className="flex items-center gap-3">
                <span className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white font-bold text-sm flex items-center justify-center shadow-md shadow-indigo-500/25">
                  {activeRule.id}
                </span>
                <div>
                  <h4 className="font-bold text-base text-slate-900 leading-tight">
                    Gate {activeRule.id}: {activeRule.title}
                  </h4>
                  <p className="text-xs text-slate-500">{activeRule.desc}</p>
                </div>
              </div>
              <span className="self-start md:self-auto px-3 py-1 rounded-full bg-indigo-100/90 text-indigo-800 text-xs font-bold border border-indigo-200 shadow-xs">
                {activeRule.badge} Enforcement
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-2xl bg-rose-50/80 border border-rose-200/90 shadow-xs">
                <div className="text-[11px] font-bold text-rose-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-rose-500" /> Before Rule Application (Robotic AI Pattern)
                </div>
                <p className="text-xs text-slate-700 italic">"{activeRule.before}"</p>
              </div>

              <div className="p-4 rounded-2xl bg-emerald-50/80 border border-emerald-200/90 shadow-xs">
                <div className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" /> After PenShift Pass (Human Parity)
                </div>
                <p className="text-xs text-slate-900 font-semibold">"{activeRule.after}"</p>
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          SECTION 6: SMART FAILOVER MESH (HIGH AVAILABILITY)
      ═══════════════════════════════════════════════════════════════ */}
      <section className="py-24 px-6 sm:px-10 lg:px-12 max-w-7xl mx-auto relative z-10">
        {/* Ambient network backlight */}
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[750px] h-[400px] rounded-full blur-[150px] opacity-45 pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(16,185,129,0.18) 0%, rgba(56,189,248,0.12) 50%, transparent 75%)' }}
        />

        <Reveal className="text-center max-w-3xl mx-auto mb-16 relative z-10">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-50 border border-blue-200/80 text-blue-700 text-xs font-semibold uppercase tracking-wider mb-3 shadow-xs">
            <Cpu className="w-3.5 h-3.5" /> High Availability
          </div>
          <h2 className="font-syne-heading text-2xl sm:text-3xl lg:text-4xl text-slate-900 tracking-tight mb-4">
            Zero-Downtime Smart Failover Mesh
          </h2>
          <p className="page-subheading text-slate-600 font-normal">
            Single-engine humanizers throw rate-limit crashes under load. PenShift operates a 4-tier hot-standby node network with automatic rerouting in &lt; 12ms.
          </p>
        </Reveal>

        {/* Interactive Failover Node Diagram */}
        <Reveal delay={0.1} className="relative z-10">
          <div className="glass-apple-40 rounded-3xl p-7 sm:p-9 border border-white/95 shadow-[0_24px_55px_-12px_rgba(16,185,129,0.20)] mb-8 relative overflow-hidden bg-white/80 backdrop-blur-2xl">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
              <div>
                <h3 className="font-syne-heading text-lg text-slate-900">
                  Live Neural Core Mesh Topology
                </h3>
                <p className="text-xs text-slate-500">
                  Real-time health check ping: <span className="font-bold text-emerald-600">18ms</span> · System Uptime: <span className="font-bold text-emerald-600">99.98%</span>
                </p>
              </div>

              <button
                onClick={() => setIsFailoverTriggered(!isFailoverTriggered)}
                className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-2 ${
                  isFailoverTriggered
                    ? 'bg-rose-600 text-white shadow-md shadow-rose-500/25 ring-2 ring-rose-400'
                    : 'bg-slate-900 text-white hover:bg-slate-800 shadow-md'
                }`}
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isFailoverTriggered ? 'animate-spin' : ''}`} />
                {isFailoverTriggered ? 'Simulating Node 1 Surge (Rerouted)' : 'Simulate Node 1 Traffic Surge'}
              </button>
            </div>

            {/* Connecting Circuit Line Behind Nodes */}
            <div className="hidden lg:block absolute top-[58%] left-12 right-12 h-0.5 bg-gradient-to-r from-emerald-300 via-indigo-300 to-emerald-300 opacity-60 z-0 pointer-events-none" />

            {/* Nodes Row with connecting line */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 relative z-10">
              {/* Node 1 */}
              <div
                className={`p-5 rounded-2xl border transition-all duration-300 relative overflow-hidden ${
                  isFailoverTriggered
                    ? 'bg-rose-50/95 border-2 border-rose-400 ring-4 ring-rose-400/30 shadow-[0_0_25px_rgba(244,63,94,0.3)]'
                    : 'bg-white/95 border border-emerald-300 shadow-md'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Tier 1</span>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                      isFailoverTriggered
                        ? 'bg-rose-100 text-rose-700 border border-rose-200'
                        : 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                    }`}
                  >
                    {isFailoverTriggered ? 'Traffic Overload' : 'Online'}
                  </span>
                </div>
                <div className="font-bold text-base text-slate-900 mb-1">
                  Primary Entropy Core
                </div>
                <p className="text-xs text-slate-500 mb-3 font-medium">Direct structural analysis pipeline</p>
                <div className="text-[11px] font-mono text-slate-600 font-bold bg-slate-50 p-1.5 rounded-lg border border-slate-200/80">
                  Latency: {isFailoverTriggered ? 'Timeout (>1,200ms)' : '74ms (Optimal)'}
                </div>
              </div>

              {/* Node 2 */}
              <div
                className={`p-5 rounded-2xl border transition-all duration-300 relative overflow-hidden ${
                  isFailoverTriggered
                    ? 'bg-emerald-50/95 border-2 border-emerald-500 ring-4 ring-emerald-400/40 shadow-[0_0_30px_rgba(16,185,129,0.35)]'
                    : 'bg-white/95 border border-slate-200 shadow-md'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Tier 2</span>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                      isFailoverTriggered
                        ? 'bg-emerald-600 text-white animate-pulse shadow-xs'
                        : 'bg-blue-100 text-blue-700 border border-blue-200'
                    }`}
                  >
                    {isFailoverTriggered ? '⚡ Serving Active Load' : 'Hot Standby'}
                  </span>
                </div>
                <div className="font-bold text-base text-slate-900 mb-1">
                  Fast Stylometric Mesh
                </div>
                <p className="text-xs text-slate-500 mb-3 font-medium">High-throughput secondary failover</p>
                <div className="text-[11px] font-mono text-slate-600 font-bold bg-slate-50 p-1.5 rounded-lg border border-slate-200/80">
                  Latency: 82ms (Ready)
                </div>
              </div>

              {/* Node 3 */}
              <div className="p-5 rounded-2xl bg-white/95 border border-slate-200 shadow-md">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Tier 3</span>
                  <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-bold border border-slate-200">
                    Reserve
                  </span>
                </div>
                <div className="font-bold text-base text-slate-900 mb-1">
                  Deep Entropy Engine
                </div>
                <p className="text-xs text-slate-500 mb-3 font-medium">Contextual recalibration cluster</p>
                <div className="text-[11px] font-mono text-slate-600 font-bold bg-slate-50 p-1.5 rounded-lg border border-slate-200/80">
                  Latency: 95ms
                </div>
              </div>

              {/* Node 4 */}
              <div className="p-5 rounded-2xl bg-white/95 border border-emerald-200/90 shadow-md">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Tier 4</span>
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold border border-emerald-200">
                    Guaranteed
                  </span>
                </div>
                <div className="font-bold text-base text-slate-900 mb-1">
                  Resilience Hub
                </div>
                <p className="text-xs text-slate-500 mb-3 font-medium">Zero dropped words safeguard</p>
                <div className="text-[11px] font-mono text-emerald-700 font-bold bg-emerald-50 p-1.5 rounded-lg border border-emerald-200/80">
                  Uptime: 99.98%
                </div>
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          SECTION 7: INDUSTRIAL COMPARISON TABLE (AI VS PENSHIFT)
      ═══════════════════════════════════════════════════════════════ */}
      <section className="py-24 px-6 sm:px-10 lg:px-12 max-w-6xl mx-auto relative z-10">
        {/* Ambient backlight */}
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[780px] h-[480px] rounded-full blur-[140px] opacity-55 pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.22) 0%, rgba(139,92,246,0.16) 50%, transparent 75%)' }}
        />

        <Reveal className="text-center max-w-3xl mx-auto mb-16 relative z-10">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-50 border border-indigo-200/80 text-indigo-700 text-xs font-semibold uppercase tracking-wider mb-3 shadow-xs">
            <Award className="w-3.5 h-3.5" /> Direct Benchmark
          </div>
          <h2 className="font-syne-heading text-2xl sm:text-3xl lg:text-4xl text-slate-900 tracking-tight mb-4">
            PenShift vs Standard AI Output
          </h2>
          <p className="page-subheading text-slate-600 font-normal">
            A side-by-side engineering comparison of how our architecture redefines enterprise content standards.
          </p>
        </Reveal>

        <Reveal delay={0.1} className="relative z-10">
          <div className="glass-apple-40 rounded-3xl border border-white/95 shadow-[0_24px_60px_-12px_rgba(15,23,42,0.12)] overflow-hidden overflow-x-auto bg-white/80 backdrop-blur-2xl">
            <table className="w-full text-left border-collapse min-w-[620px]">
              <thead>
                <tr className="bg-white/95 border-b border-slate-200/80">
                  <th className="p-5 font-bold text-slate-700 text-xs uppercase tracking-wider pl-8">
                    Capability
                  </th>
                  <th className="p-5 text-center bg-indigo-50/80 border-x-2 border-indigo-300">
                    <span className="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-500/25 font-extrabold text-xs tracking-wider uppercase">
                      <Sparkles className="w-3.5 h-3.5" /> PenShift Engine
                    </span>
                  </th>
                  <th className="p-5 font-bold text-slate-500 text-xs uppercase tracking-wider text-center">
                    Standard AI Generators (Raw LLMs)
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {[
                  {
                    feat: 'Factual Retention',
                    penshift: '100% Exact Facts Intact',
                    standard: 'Hallucinates or changes statistics'
                  },
                  {
                    feat: 'Syntactic Burstiness',
                    penshift: 'Dynamic 5–42 Word Variation',
                    standard: 'Monotonous 16-word rhythm'
                  },
                  {
                    feat: 'AI Detector Bypass',
                    penshift: 'Guaranteed 0% AI Detected',
                    standard: 'Flagged 90%+ on GPTZero & Copyleaks'
                  },
                  {
                    feat: 'High-Volume Reliability',
                    penshift: '4-Tier Automatic Failover',
                    standard: 'Single point of failure & rate limits'
                  },
                  {
                    feat: 'Tone & Micro-Perspective',
                    penshift: 'Authentic Human Nuance',
                    standard: 'Robotic, repetitive vocabulary loops'
                  },
                  {
                    feat: 'Data Privacy Policy',
                    penshift: 'Zero Retention Ephemeral',
                    standard: 'User inputs used for model retraining'
                  }
                ].map((row, i) => (
                  <tr key={i} className="hover:bg-white/90 transition-colors">
                    <td className="p-5 text-sm text-slate-800 font-semibold pl-8 align-middle">
                      {row.feat}
                    </td>
                    <td className="p-5 text-center align-middle bg-gradient-to-b from-indigo-50/70 via-violet-50/40 to-indigo-50/60 border-x-2 border-indigo-200">
                      <div className="mx-auto text-xs text-white font-bold bg-gradient-to-r from-indigo-600 to-violet-600 rounded-xl px-3.5 py-1.5 w-fit shadow-xs flex items-center justify-center gap-1.5">
                        <Check className="w-3.5 h-3.5 stroke-[3]" /> {row.penshift}
                      </div>
                    </td>
                    <td className="p-5 text-xs text-slate-500 text-center align-middle font-medium">
                      {row.standard}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Reveal>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          SECTION 8: INTERACTIVE ROI & EDITORIAL SAVINGS CALCULATOR
      ═══════════════════════════════════════════════════════════════ */}
      <section className="py-20 px-6 sm:px-10 lg:px-12 max-w-5xl mx-auto relative z-10">
        {/* Ambient backlight */}
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[450px] rounded-full blur-[140px] opacity-55 pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(16,185,129,0.22) 0%, rgba(99,102,241,0.16) 50%, transparent 75%)' }}
        />

        <Reveal className="relative z-10">
          <div className="glass-apple-40 rounded-3xl p-8 sm:p-11 border border-white/95 shadow-[0_24px_55px_-12px_rgba(16,185,129,0.20)] bg-white/80 backdrop-blur-2xl">
            <div className="text-center max-w-xl mx-auto mb-10">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-50 border border-emerald-200/80 text-emerald-700 text-xs font-semibold uppercase tracking-wider mb-3 shadow-xs">
                <TrendingUp className="w-3.5 h-3.5" /> ROI Calculator
              </div>
              <h2 className="font-syne-heading text-2xl sm:text-3xl lg:text-4xl text-slate-900 tracking-tight mb-2">
                Calculate Your Editorial Time & Cost Savings
              </h2>
              <p className="text-xs text-slate-600 font-normal">
                See how much time and freelance budget PenShift saves your team each month.
              </p>
            </div>

            {/* Slider */}
            <div className="max-w-xl mx-auto mb-10">
              <div className="flex justify-between items-baseline mb-3">
                <span className="text-xs font-bold text-slate-700">Monthly Volume Needed:</span>
                <span className="font-bold text-xl text-indigo-600 bg-indigo-50 px-3 py-1 rounded-xl border border-indigo-100 shadow-xs tabular-nums">
                  {monthlyWords.toLocaleString()} words/mo
                </span>
              </div>
              <input
                type="range"
                min="10000"
                max="300000"
                step="5000"
                value={monthlyWords}
                onChange={(e) => setMonthlyWords(Number(e.target.value))}
                className="w-full h-3 bg-gradient-to-r from-blue-500 via-indigo-500 to-emerald-500 rounded-lg appearance-none cursor-pointer accent-indigo-600 shadow-inner"
              />
              <div className="flex justify-between text-[11px] text-slate-400 mt-2 font-mono">
                <span>10,000 words</span>
                <span>150,000 words</span>
                <span>300,000 words</span>
              </div>
            </div>

            {/* Output metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
              <div className="p-5 rounded-2xl bg-gradient-to-br from-indigo-50/80 via-white/95 to-indigo-50/40 border border-indigo-200/90 shadow-md glow-card">
                <div className="font-black text-2xl sm:text-3xl text-indigo-600 mb-1 tabular-nums tracking-tight">
                  {calculatedSavings.hours} hrs
                </div>
                <div className="text-xs font-bold text-slate-800">Hours Saved Monthly</div>
                <div className="text-[11px] text-slate-500 mt-0.5">Eliminates manual line-editing</div>
              </div>

              <div className="p-5 rounded-2xl bg-gradient-to-br from-emerald-50/80 via-white/95 to-emerald-50/40 border-2 border-emerald-400 shadow-[0_12px_30px_-6px_rgba(16,185,129,0.22)] glow-card">
                <div className="font-black text-2xl sm:text-3xl text-emerald-600 mb-1 tabular-nums tracking-tight">
                  ${calculatedSavings.dollars.toLocaleString()}
                </div>
                <div className="text-xs font-bold text-slate-800">Editorial Budget Saved</div>
                <div className="text-[11px] text-slate-500 mt-0.5">Based on $38/hr freelance rate</div>
              </div>

              <div className="p-5 rounded-2xl bg-gradient-to-br from-violet-50/80 via-white/95 to-violet-50/40 border border-violet-200/90 shadow-md glow-card">
                <div className="font-black text-2xl sm:text-3xl text-violet-600 mb-1 tabular-nums tracking-tight">
                  100%
                </div>
                <div className="text-xs font-bold text-slate-800">Client Pass Rate</div>
                <div className="text-[11px] text-slate-500 mt-0.5">Zero AI detector rejections</div>
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          SECTION 9: REVIEWS & WALL OF SOCIAL PROOF (WITH FILTER TABS)
      ═══════════════════════════════════════════════════════════════ */}
      <section className="py-24 px-6 sm:px-10 lg:px-12 max-w-7xl mx-auto relative z-10">
        {/* Ambient warm backlight */}
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[550px] rounded-full blur-[150px] opacity-40 pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(244,63,94,0.15) 0%, rgba(139,92,246,0.12) 50%, transparent 75%)' }}
        />

        <Reveal className="text-center max-w-3xl mx-auto mb-12 relative z-10">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full glass-apple-40 border border-white/95 shadow-sm text-slate-700 text-xs font-semibold mb-4">
            <span className="flex text-amber-400">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
              ))}
            </span>
            <span className="font-bold text-slate-900">4.9 / 5.0</span>
            <span className="text-slate-400">·</span>
            <span>1,840+ Verified Reviews</span>
          </div>
          <h2 className="font-syne-heading text-2xl sm:text-3xl lg:text-4xl text-slate-900 tracking-tight mb-4">
            Trusted by Serious Creators & Publishers
          </h2>
          <p className="page-subheading text-slate-600 font-normal">
            From high-output publishing houses to independent authors, see how creators produce authentic, detector-proof content with total confidence.
          </p>
        </Reveal>

        {/* Category Filter Pills */}
        <div className="flex flex-wrap items-center justify-center gap-2 mb-12 relative z-10">
          {['All', 'Agencies', 'Affiliates', 'Researchers', 'Authors'].map((category) => (
            <button
              key={category}
              onClick={() => setReviewFilter(category)}
              className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all duration-200 ${
                reviewFilter === category
                  ? 'bg-slate-900 text-white shadow-md'
                  : 'glass-apple-40 text-slate-700 hover:text-slate-900 border border-white/90 shadow-xs'
              }`}
            >
              {category === 'All' ? 'All Reviews (6)' : category}
            </button>
          ))}
        </div>

        {/* Reviews Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 relative z-10">
          {filteredReviews.map((review, i) => (
            <Reveal key={review.name} delay={i * 0.07} className="flex">
              <div className="w-full rounded-3xl p-7 glass-apple-40 border border-white/95 shadow-[0_16px_40px_-10px_rgba(15,23,42,0.08)] hover:border-indigo-300/90 hover:shadow-[0_24px_50px_-10px_rgba(99,102,241,0.18)] glow-card transition-all duration-300 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-1">
                      {[...Array(review.rating)].map((_, s) => (
                        <Star key={s} className="w-4 h-4 fill-amber-400 text-amber-400" />
                      ))}
                    </div>
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-100 text-[11px] font-bold text-emerald-700 shadow-xs">
                      <Check className="w-3 h-3 text-emerald-600 stroke-[3]" />
                      {review.tag}
                    </span>
                  </div>

                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-white/90 border border-slate-200/80 text-xs font-bold text-slate-800 mb-3.5 shadow-xs">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                    {review.metric}
                  </div>

                  <p className="text-[13px] text-slate-600 leading-relaxed font-normal mb-6">
                    "{review.content}"
                  </p>
                </div>

                <div className="pt-4 border-t border-slate-200/70 flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-2xl bg-gradient-to-br ${review.avatarBg} text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-sm`}
                  >
                    {review.avatar}
                  </div>
                  <div className="min-w-0">
                    <div className="font-bold text-sm text-slate-900 truncate">
                      {review.name}
                    </div>
                    <div className="text-xs text-slate-500 truncate">
                      {review.role} · {review.company}
                    </div>
                  </div>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          SECTION 10: FREQUENTLY ASKED QUESTIONS (GLASS ACCORDION)
      ═══════════════════════════════════════════════════════════════ */}
      <section className="py-24 px-6 sm:px-10 lg:px-12 max-w-4xl mx-auto relative z-10">
        {/* Ambient backlight */}
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[740px] h-[500px] rounded-full blur-[140px] opacity-45 pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.20) 0%, rgba(139,92,246,0.14) 50%, transparent 75%)' }}
        />

        <Reveal className="text-center mb-16 relative z-10">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-100 border border-slate-200 text-slate-700 text-xs font-semibold uppercase tracking-wider mb-3">
            <HelpCircle className="w-3.5 h-3.5" /> Common Inquiries
          </div>
          <h2 className="font-syne-heading text-2xl sm:text-3xl lg:text-4xl text-slate-900 tracking-tight mb-4">
            Frequently Asked Questions
          </h2>
          <p className="page-subheading text-slate-600 font-normal">
            Everything you need to know about our detection bypass architecture, privacy policies, and failover network.
          </p>
        </Reveal>

        <div className="space-y-4 relative z-10">
          {FAQ_ITEMS.map((item, index) => {
            const isOpen = openFaqIndex === index
            return (
              <Reveal key={index} delay={index * 0.06}>
                <div
                  className={`rounded-2xl transition-all duration-200 overflow-hidden ${
                    isOpen
                      ? 'border-2 border-indigo-400/90 shadow-[0_16px_36px_-8px_rgba(99,102,241,0.16)] bg-white/95'
                      : 'glass-apple-40 border border-white/90 shadow-sm hover:border-slate-300'
                  }`}
                >
                  <button
                    onClick={() => setOpenFaqIndex(isOpen ? -1 : index)}
                  className="w-full p-5 text-left flex items-center justify-between gap-4 font-bold text-sm sm:text-base text-slate-900 hover:text-indigo-600 transition-colors"
                  >
                    <span>{item.q}</span>
                    <span className="shrink-0 text-slate-400">
                      {isOpen ? <ChevronUp className="w-4 h-4 text-indigo-600" /> : <ChevronDown className="w-4 h-4" />}
                    </span>
                  </button>

                  {isOpen && (
                    <div className="px-5 pb-5 pt-1 text-[13px] text-slate-600 leading-relaxed font-normal border-t border-slate-100">
                      {item.a}
                    </div>
                  )}
                </div>
              </Reveal>
            )
          })}
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          SECTION 11: CINEMATIC FINAL CTA (LUMINOUS GRADIENT CARD)
      ═══════════════════════════════════════════════════════════════ */}
      <section className="py-24 px-6 sm:px-10 lg:px-12 max-w-4xl mx-auto relative z-10">
        {/* Ambient radiant glow halo */}
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[880px] h-[520px] rounded-full blur-[160px] opacity-60 pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.30) 0%, rgba(139,92,246,0.22) 45%, transparent 75%)' }}
        />

        <Reveal className="relative z-10">
          <div
            className="relative rounded-3xl overflow-hidden text-center px-8 sm:px-14 py-16 sm:py-20 shadow-2xl border border-white/30"
            style={{
              background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 40%, #4338ca 75%, #6366f1 100%)'
            }}
          >
            {/* Ambient Background Blobs */}
            <div
              className="absolute -top-20 -right-20 w-64 h-64 rounded-full blur-3xl pointer-events-none"
              style={{ background: 'rgba(236,72,153,0.25)' }}
            />
            <div
              className="absolute -bottom-20 -left-20 w-64 h-64 rounded-full blur-3xl pointer-events-none"
              style={{ background: 'rgba(56,189,248,0.25)' }}
            />

            <div className="relative z-10">
              <div className="flex justify-center mb-6">
                <Logo variant="dark" size="lg" />
              </div>

              <h2 className="font-syne-heading text-2xl sm:text-3xl lg:text-4xl text-white mb-5 tracking-tight leading-tight">
                Stop Getting Flagged. <br />
                Start Publishing with Authority.
              </h2>

              <p className="page-subheading text-white/90 mb-9 max-w-xl mx-auto font-normal leading-relaxed">
                Join over 14,000 writers, editors, and SEO agencies creating undetectable, human-sounding content. 100% private, instant setup, and zero training on your data.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                <Link
                  to="/humanizer"
                  className="shimmer-btn inline-flex items-center justify-center gap-2.5 px-8 py-4 bg-white text-slate-900 font-bold rounded-2xl text-sm sm:text-base hover:bg-slate-50 transition-all shadow-xl active:scale-95"
                >
                  <Zap className="w-4 h-4 text-indigo-600 fill-indigo-600" />
                  Launch Free Humanizer →
                </Link>

                <Link
                  to="/blog"
                  className="inline-flex items-center justify-center gap-2 px-7 py-4 border border-white/30 bg-white/10 backdrop-blur-md text-white font-bold rounded-2xl text-sm sm:text-base hover:bg-white/20 transition-all active:scale-95"
                >
                  Generate 3,500-Word Blog
                </Link>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 mt-8 text-xs text-white/70">
                <span>✓ No Credit Card Required</span>
                <span>✓ 100% Private (Zero Logs)</span>
                <span>✓ Multi-Core Failover Active</span>
              </div>
            </div>
          </div>
        </Reveal>
      </section>
    </main>
  )
}
