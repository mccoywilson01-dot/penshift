import React from 'react'
import { Link } from 'react-router-dom'
import { Logo } from './Logo.jsx'

const TOOLS = [
  { label:'AI Humanizer',     path:'/humanizer', badge:'Core' },
  { label:'Blog Generator',   path:'/blog',      badge:'SEO'  },
  { label:'Affiliate Writer', path:'/affiliate', badge:'$$$'  },
  { label:'Detection Score',  path:'/score',     badge:'New'  },
]

const ENGINE_CAPABILITIES = [
  { n:'Syntactic Entropy',   c:'bg-blue-950/60 text-blue-300 border border-blue-800/40 hover:bg-blue-900/40'   },
  { n:'Stylometric Parity',  c:'bg-violet-950/60 text-violet-300 border border-violet-800/40 hover:bg-violet-900/40'},
  { n:'Burstiness Shaping',  c:'bg-emerald-950/60 text-emerald-300 border border-emerald-800/40 hover:bg-emerald-900/40'},
]

const BYPASSES = ['GPTZero', 'Originality.ai', 'Copyleaks', 'ZeroGPT', 'Turnitin', 'Writer.com'];

const STATS = [
  { val: '99.4%', label: 'Human Score Rate' },
  { val: '12',    label: 'Quality Rules'    },
  { val: '<1.2s', label: 'Average Latency'  },
  { val: '0',     label: 'Data Retention'   },
];

const CURRENT_YEAR = new Date().getFullYear();

const Footer = React.memo(function Footer() {
  return (
    <footer className="bg-slate-950 text-slate-400 relative overflow-hidden">
      {/* Top gradient line */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-violet-500/30 to-transparent" />

      <div className="max-w-7xl mx-auto px-4 sm:px-8 lg:px-14 pt-16 pb-10 relative z-10">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10 mb-12">

          {/* Brand */}
          <div className="col-span-1 sm:col-span-2">
            <Link to="/" className="inline-flex items-center gap-3 mb-5 group outline-none focus-visible:ring-2 focus-visible:ring-violet-500 rounded-2xl transition-opacity hover:opacity-90">
              <Logo variant="dark" size="default" />
            </Link>
            <p className="text-sm text-slate-300 leading-relaxed max-w-sm mb-6 font-normal">
              Transform AI-generated content into natural, undetectable human writing. Industrial-grade quality rules with automatic failover routing.
            </p>
            {/* Engine capability badges */}
            <div className="flex flex-wrap gap-2">
              {ENGINE_CAPABILITIES.map(p => (
                <span key={p.n} className={`text-xs px-3 py-1.5 rounded-lg font-semibold transition-all duration-300 cursor-default ${p.c}`}>{p.n}</span>
              ))}
            </div>
          </div>

          {/* Tools */}
          <div>
            <h4 className="text-white text-sm font-bold uppercase tracking-wider mb-4">Tools</h4>
            <ul className="space-y-3">
              {TOOLS.map(({label,path,badge})=>(
                <li key={label}>
                  <Link to={path} className="flex items-center gap-2.5 text-sm text-slate-300 hover:text-white transition-colors group outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 rounded">
                    <span className="font-medium text-slate-300 group-hover:text-white transition-colors">{label}</span>
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-900 text-slate-300 font-bold group-hover:bg-violet-500/20 group-hover:text-violet-300 transition-colors duration-300 border border-slate-800 group-hover:border-violet-500/30">{badge}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Bypasses */}
          <div>
            <h4 className="text-white text-sm font-bold uppercase tracking-wider mb-4">Bypasses</h4>
            <ul className="space-y-3">
              {BYPASSES.map(d=>(
                <li key={d} className="flex items-center gap-2.5 group cursor-default">
                  <span className="w-2 h-2 rounded-full bg-emerald-500/60 group-hover:bg-emerald-400 group-hover:shadow-[0_0_8px_rgba(52,211,153,0.8)] shrink-0 transition-all duration-300" />
                  <span className="text-sm text-slate-300 group-hover:text-white transition-colors font-medium">{d}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Stats bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-10 py-6 px-4 border border-slate-800/80 bg-slate-900/40 backdrop-blur-md rounded-3xl">
          {STATS.map(({val,label})=>(
            <div key={label} className="text-center group cursor-default p-2">
              <p className="font-display font-black text-2xl sm:text-3xl text-white mb-1 stat-val">{val}</p>
              <p className="text-sm text-slate-300 font-medium group-hover:text-slate-100 transition-colors">{label}</p>
            </div>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex flex-col sm:flex-row items-center gap-2">
            <p className="text-sm text-slate-400">© {CURRENT_YEAR} PenShift. All rights reserved.</p>
            <span className="hidden sm:inline text-slate-700 text-sm">·</span>
            <p className="text-sm text-slate-400">Built by <a href="https://github.com/Satyajishu" target="_blank" rel="noopener noreferrer" className="font-semibold text-slate-300 hover:text-white transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-violet-500 rounded">Satyajishu</a></p>
          </div>
          <div className="flex items-center gap-3">
          </div>
        </div>
      </div>
    </footer>
  )
})

export default Footer
