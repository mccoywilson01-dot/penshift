import React from 'react'

/**
 * HeroNeuralBackground — Dedicated Scoped Background for PenShift Homepage Hero
 *
 * Exclusively mounted inside <section className="hero"> on the Homepage.
 * Features:
 * 1. Engineering grid canvas with radial mask
 * 2. Atmospheric lighting fields (Sky Blue, Violet, Signature Ambient Lime Halo)
 * 3. Semantic vector line system with cubic bezier curved pathways, gradient stroke,
 *    multi-ring neural nodes, and reference-matching labeled annotations.
 *
 * pointer-events: none (zero interaction interference)
 */
export default React.memo(function HeroNeuralBackground() {
  return (
    <div
      className="hero-neural-bg absolute inset-0 pointer-events-none overflow-hidden select-none z-0"
      aria-hidden="true"
    >
      {/* ── Base Clean Off-White Canvas ── */}
      <div className="absolute inset-0 bg-[#fafbfc]" />

      {/* ── Layer 1: Architectural Engineering Grid ── */}
      <div className="hero-grid-canvas" />

      {/* ── Layer 2: Atmospheric Lighting Fields ── */}
      {/* Sky Blue Illumination (Top-Left) */}
      <div className="hero-atm-layer hero-atm-blue" />

      {/* Violet / Lilac Illumination (Top-Right) */}
      <div className="hero-atm-layer hero-atm-violet" />

      {/* Signature Radiant Ambient Lime / Mint Light Field (Lower-Right behind Cockpit) */}
      <div className="hero-atm-layer hero-atm-lime" />

      {/* Central Soft Violet Atmosphere */}
      <div className="hero-atm-layer hero-atm-center-violet" />

      {/* Soft Text Readability Protection (Left Area) */}
      <div className="hero-atm-layer hero-atm-readability" />

      {/* ── Layer 3: Neural Semantic Line System (Vector SVG Canvas) ── */}
      <div className="absolute inset-0 pointer-events-none">
        <svg
          className="hero-neural-svg"
          viewBox="0 0 1440 900"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          preserveAspectRatio="xMidYMid slice"
        >
          {/* Subtle Ambient Curved Glow Pathways (80% Dimmed per user instruction) */}
          <g stroke="url(#heroNeuralGrad)" strokeWidth="1.15" strokeLinecap="round" opacity="0.18">
            {/* Top wave curving gracefully above the headline through center */}
            <path d="M-80,110 C200,60 420,95 690,140 C910,85 1160,175 1520,115" />

            {/* Branching pathway swooping around cockpit top */}
            <path d="M690,140 C760,215 735,310 705,390 C675,470 610,590 450,760" />

            {/* Upper right extension */}
            <path d="M690,140 C890,125 1060,70 1240,90 C1340,100 1440,170 1520,210" />

            {/* Lower sweep under headline connecting to Neural Processing */}
            <path d="M-40,580 C140,630 280,740 420,830" />

            {/* Loop under cockpit toward bottom right into the lime aura */}
            <path d="M420,830 C620,860 840,840 1060,755" />

            {/* Soft secondary connector from cockpit side up into top right */}
            <path d="M1060,755 C1180,700 1300,560 1460,420" />
            <path d="M420,830 C350,865 270,885 190,895" />

            {/* Faint dashed cross-link */}
            <path d="M140,320 C280,240 480,210 690,140" strokeOpacity="0.3" strokeDasharray="3 4" />
          </g>

          {/* Neural Connection Nodes (Dimmed) */}
          <g opacity="0.25">
            {/* Upper central node: Semantic Analysis */}
            <circle cx="690" cy="140" r="4" fill="#6366f1" fillOpacity="0.8" />
            <circle cx="690" cy="140" r="8" fill="#6366f1" fillOpacity="0.2" />

            {/* Sub-node along upper pathway */}
            <circle cx="1060" cy="85" r="3" fill="#8b5cf6" fillOpacity="0.7" />
            <circle cx="1060" cy="85" r="6" fill="#8b5cf6" fillOpacity="0.15" />

            {/* Mid pathway node near cockpit */}
            <circle cx="705" cy="390" r="2.5" fill="#6366f1" fillOpacity="0.5" />

            {/* Lower node: Neural Processing */}
            <circle cx="420" cy="830" r="4" fill="#3b82f6" fillOpacity="0.8" />
            <circle cx="420" cy="830" r="8" fill="#3b82f6" fillOpacity="0.2" />

            {/* Bottom right node: Human-Like Output */}
            <circle cx="1060" cy="755" r="4" fill="#10b981" fillOpacity="0.85" />
            <circle cx="1060" cy="755" r="8" fill="#10b981" fillOpacity="0.25" />

            {/* Auxiliary side nodes */}
            <circle cx="1320" cy="480" r="2.5" fill="#6366f1" fillOpacity="0.4" />
            <circle cx="140" cy="320" r="2.5" fill="#6366f1" fillOpacity="0.4" />
          </g>

          {/* Labeled Semantic Annotations (Subtle / Semi-transparent) */}
          <g className="hero-semantic-labels hidden sm:block" opacity="0.45" style={{ userSelect: 'none' }}>
            {/* Semantic Analysis Pill + Label */}
            <g transform="translate(670, 108)">
              <rect
                x="-8"
                y="-13"
                width="128"
                height="22"
                rx="11"
                fill="rgba(255, 255, 255, 0.90)"
                stroke="rgba(99, 102, 241, 0.28)"
                strokeWidth="1"
              />
              <circle cx="2" cy="-2" r="2.5" fill="#6366f1" />
              <text
                x="11"
                y="1.5"
                fill="#4338ca"
                fontSize="10.5"
                fontFamily="Inter, -apple-system, sans-serif"
                fontWeight="700"
                letterSpacing="0.02em"
              >
                Semantic Analysis
              </text>
            </g>

            {/* Neural Processing Pill + Label */}
            <g transform="translate(435, 825)">
              <rect
                x="-8"
                y="-13"
                width="130"
                height="22"
                rx="11"
                fill="rgba(255, 255, 255, 0.90)"
                stroke="rgba(71, 85, 105, 0.28)"
                strokeWidth="1"
              />
              <circle cx="2" cy="-2" r="2.5" fill="#3b82f6" />
              <text
                x="11"
                y="1.5"
                fill="#334155"
                fontSize="10.5"
                fontFamily="Inter, -apple-system, sans-serif"
                fontWeight="700"
                letterSpacing="0.02em"
              >
                Neural Processing
              </text>
            </g>

            {/* Human-Like Output Pill + Label */}
            <g transform="translate(1075, 755)">
              <rect
                x="-8"
                y="-13"
                width="134"
                height="22"
                rx="11"
                fill="rgba(255, 255, 255, 0.94)"
                stroke="rgba(16, 185, 129, 0.38)"
                strokeWidth="1"
              />
              <circle cx="2" cy="-2" r="2.5" fill="#10b981" />
              <text
                x="11"
                y="1.5"
                fill="#047857"
                fontSize="10.5"
                fontFamily="Inter, -apple-system, sans-serif"
                fontWeight="700"
                letterSpacing="0.02em"
              >
                Human-Like Output
              </text>
            </g>
          </g>

          {/* Gradients */}
          <defs>
            <linearGradient id="heroNeuralGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.75" />
              <stop offset="35%" stopColor="#6366f1" stopOpacity="0.85" />
              <stop offset="70%" stopColor="#8b5cf6" stopOpacity="0.80" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0.75" />
            </linearGradient>
          </defs>
        </svg>
      </div>
    </div>
  )
})
