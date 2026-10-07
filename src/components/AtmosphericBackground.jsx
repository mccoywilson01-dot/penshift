/**
 * AtmosphericBackground — PenShift Global Background System
 *
 * A single reusable atmospheric background that unifies the visual
 * identity across all pages. Uses only CSS gradients + a static SVG
 * neural field embedded as a CSS background-image (zero JS overhead).
 *
 * Usage:
 *   <AtmosphericBackground variant="hero"    />  ← Full strength (homepage)
 *   <AtmosphericBackground variant="tool"    />  ← Calm (Humanizer, Blog, etc.)
 *   <AtmosphericBackground variant="minimal" />  ← Very subtle (settings, legal)
 */

import React from 'react'

const VARIANT_CLASS = {
  hero:    'is-hero',
  tool:    'is-tool',
  minimal: 'is-minimal',
}

export default React.memo(function AtmosphericBackground({ variant = 'tool' }) {
  const mod = VARIANT_CLASS[variant] || VARIANT_CLASS.tool
  const isHero = variant === 'hero'

  return (
    <>
      {/* ── Base Atmospheric Canvas with Delicate Engineering Grid ── */}
      <div className={`ps-atm ${mod}`} aria-hidden="true">
        {/* Layer 1: Delicate architectural grid */}
        <div className="ps-grid-canvas" />

        {/* Layer 2: Top-left sky-blue atmospheric illumination */}
        <div className="atm-blue ps-atm-layer" />

        {/* Layer 3: Top-right violet atmospheric illumination */}
        <div className="atm-violet ps-atm-layer" />

        {/* Layer 4: Signature radiant lime environmental accent (behind right cockpit window) */}
        <div className="atm-lime ps-atm-layer" />

        {/* Layer 5: Mid-depth violet pulse */}
        <div className="atm-deep ps-atm-layer" />

        {/* Layer 6: Lower emerald aura */}
        <div className="atm-emerald ps-atm-layer" />

        {/* Layer 7: Apple architectural depth arc */}
        <div className="atm-arc ps-atm-layer" />
      </div>

      {/* ── Neural Semantic Line System (Vector SVG Canvas) ── */}
      <div className={`ps-neural-field ${mod}`} aria-hidden="true">
        <svg
          className="ps-neural-svg"
          viewBox="0 0 1440 900"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          preserveAspectRatio="xMidYMid slice"
        >
          {/* Subtle Ambient Curved Glow Pathways */}
          <g stroke="url(#neuralGrad)" strokeWidth="1.2" strokeLinecap="round" opacity="0.75">
            {/* Top wave curving down through center */}
            <path d="M-80,190 C220,130 420,240 700,155 C920,95 1160,190 1520,130" />
            
            {/* Branching pathway swooping around cockpit top */}
            <path d="M700,155 C770,230 740,320 710,400 C680,480 660,600 620,740" />
            
            {/* Upper right extension */}
            <path d="M700,155 C910,140 1070,80 1250,100 C1350,110 1450,180 1520,220" />
            
            {/* Lower sweep under headline connecting to Neural Processing */}
            <path d="M-40,480 C180,520 420,650 620,740" />
            
            {/* Loop under cockpit toward bottom right */}
            <path d="M620,740 C760,780 960,820 1200,740 C1300,705 1400,640 1500,580" />
            
            {/* Soft secondary connector from cockpit side */}
            <path d="M1200,740 C1280,620 1360,460 1480,410" />
            <path d="M620,740 C550,790 470,830 380,850" />
            
            {/* Faint cross-link */}
            <path d="M160,360 C320,280 520,250 700,155" strokeOpacity="0.4" strokeDasharray="3 4" />
          </g>

          {/* Neural Connection Nodes */}
          <g>
            {/* Upper central node: Semantic Analysis */}
            <circle cx="700" cy="155" r="4" fill="#6366f1" fillOpacity="0.9" />
            <circle cx="700" cy="155" r="9" fill="#6366f1" fillOpacity="0.25" />
            <circle cx="700" cy="155" r="16" fill="#6366f1" fillOpacity="0.08" />

            {/* Sub-node along upper pathway */}
            <circle cx="1080" cy="95" r="3.5" fill="#8b5cf6" fillOpacity="0.75" />
            <circle cx="1080" cy="95" r="7" fill="#8b5cf6" fillOpacity="0.2" />

            {/* Mid pathway node near cockpit */}
            <circle cx="710" cy="400" r="3" fill="#6366f1" fillOpacity="0.6" />

            {/* Lower node: Neural Processing */}
            <circle cx="620" cy="740" r="4.5" fill="#3b82f6" fillOpacity="0.9" />
            <circle cx="620" cy="740" r="10" fill="#3b82f6" fillOpacity="0.25" />
            <circle cx="620" cy="740" r="18" fill="#3b82f6" fillOpacity="0.08" />

            {/* Bottom right node: Human-Like Output */}
            <circle cx="1200" cy="740" r="4.5" fill="#10b981" fillOpacity="0.95" />
            <circle cx="1200" cy="740" r="10" fill="#10b981" fillOpacity="0.3" />
            <circle cx="1200" cy="740" r="20" fill="#10b981" fillOpacity="0.1" />

            {/* Auxiliary side nodes */}
            <circle cx="1360" cy="485" r="3" fill="#6366f1" fillOpacity="0.5" />
            <circle cx="160" cy="360" r="3" fill="#6366f1" fillOpacity="0.5" />
          </g>

          {/* Labeled Semantic Annotations (Matching Reference) */}
          {isHero && (
            <g className="ps-neural-labels" style={{ userSelect: 'none' }}>
              {/* Semantic Analysis Label */}
              <text
                x="680"
                y="132"
                fill="#4f46e5"
                fillOpacity="0.85"
                fontSize="11"
                fontFamily="Inter, -apple-system, sans-serif"
                fontWeight="600"
                letterSpacing="0.03em"
              >
                Semantic Analysis
              </text>

              {/* Neural Processing Label */}
              <text
                x="638"
                y="745"
                fill="#475569"
                fillOpacity="0.85"
                fontSize="11"
                fontFamily="Inter, -apple-system, sans-serif"
                fontWeight="600"
                letterSpacing="0.03em"
              >
                Neural Processing
              </text>

              {/* Human-Like Output Label */}
              <text
                x="1218"
                y="745"
                fill="#059669"
                fillOpacity="0.95"
                fontSize="11"
                fontFamily="Inter, -apple-system, sans-serif"
                fontWeight="600"
                letterSpacing="0.03em"
              >
                Human-Like Output
              </text>
            </g>
          )}

          {/* Gradients */}
          <defs>
            <linearGradient id="neuralGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.75" />
              <stop offset="35%" stopColor="#6366f1" stopOpacity="0.85" />
              <stop offset="70%" stopColor="#8b5cf6" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0.75" />
            </linearGradient>
          </defs>
        </svg>
      </div>
    </>
  )
})
