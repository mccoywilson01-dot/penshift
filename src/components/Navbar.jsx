import { useState, useEffect } from 'react'
import { Logo } from './Logo.jsx'
import { Link, useLocation } from 'react-router-dom'
import { User, Home, Zap, FileText, ShoppingBag, BarChart2 } from 'lucide-react'
import { supabase } from '../lib/supabase.js'
import AuthModal from './AuthModal.jsx'

const LINKS = [
  { to:'/',          label:'Home',      Icon: Home        },
  { to:'/humanizer', label:'Humanizer', Icon: Zap         },
  { to:'/blog',      label:'Blog Gen',  Icon: FileText    },
  { to:'/affiliate', label:'Affiliate', Icon: ShoppingBag },
  { to:'/score',     label:'AI Score',  Icon: BarChart2   },
]

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen]         = useState(false)
  const [session, setSession]   = useState(null)
  const [showAuth, setShowAuth] = useState(false)
  const [authError, setAuthError] = useState(null)
  const location = useLocation()

  useEffect(() => {
    fetch('/api/health').catch(() => {});

    if (typeof window !== 'undefined') {
      const hash = window.location.hash;
      if (hash && hash.includes('error=')) {
        const params = new URLSearchParams(hash.replace(/^#/, ''));
        const desc = params.get('error_description') || params.get('error') || 'Authentication link is invalid or has expired.';
        setAuthError({ type: 'error', text: desc.replace(/\+/g, ' ') });
        setShowAuth(true);
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
      } else if (hash && hash.includes('access_token=')) {
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
      }
    }

    if (supabase) {
      supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
        setSession(currentSession);
      }).catch(() => {});
      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
        setSession(newSession);
      });
      return () => {
        subscription?.unsubscribe();
      };
    }
  }, [])

  useEffect(() => {
    let raf
    const fn = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => setScrolled(prev => prev !== (window.scrollY > 16) ? (window.scrollY > 16) : prev))
    }
    window.addEventListener('scroll', fn, { passive: true })
    return () => { window.removeEventListener('scroll', fn); cancelAnimationFrame(raf) }
  }, [])

  useEffect(() => {
    if (!open) return;
    const original = document.body.style.overflow;
    const originalPadding = document.body.style.paddingRight;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    
    document.body.style.overflow = 'hidden';
    document.body.style.paddingRight = `${scrollbarWidth}px`;
    
    const mediaQuery = window.matchMedia('(min-width: 768px)');
    const handleResize = (e) => { if (e.matches) setOpen(false); };
    mediaQuery.addEventListener('change', handleResize);
    
    const handleEscape = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', handleEscape);
    
    return () => { 
      document.body.style.overflow = original;
      document.body.style.paddingRight = originalPadding;
      mediaQuery.removeEventListener('change', handleResize);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open]);

  useEffect(() => setOpen(false), [location.pathname])

  return (
    <>
      <header className={`fixed top-0 w-full z-50 transition-all duration-300 ${
        (scrolled || open)
          ? 'bg-white/85 backdrop-blur-2xl shadow-[0_4px_20px_-4px_rgba(15,23,42,0.08),inset_0_1px_1px_rgba(255,255,255,1)] border-b border-slate-200/80 py-3'
          : 'bg-white/60 backdrop-blur-xl border-b border-slate-200/50 py-3.5 md:py-4'
      }`}>
        <div className="max-w-6xl mx-auto px-4 md:px-6">
          <div className="flex items-center justify-between">
            
            <Link to="/" className="logo-link group flex items-center outline-none border-none focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 py-1 transition-opacity hover:opacity-90">
              <Logo variant="light" size="default" />
            </Link>

            {/* Desktop nav — Apple pill capsule */}
            <nav className="hidden md:flex items-center gap-1 bg-slate-900/[0.04] p-1.5 rounded-2xl border border-slate-200/70 shadow-[inset_0_1px_2px_rgba(0,0,0,0.04),0_1px_1px_rgba(255,255,255,0.8)] backdrop-blur-md">
              {LINKS.map(({ to, label, Icon }) => {
                const active = to === '/' ? location.pathname === '/' : (location.pathname === to || location.pathname.startsWith(to + '/'))
                return (
                  <Link key={to} to={to}
                    className={`relative flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
                      active
                        ? 'bg-white text-slate-950 font-bold shadow-[0_2px_10px_-2px_rgba(15,23,42,0.12),inset_0_1px_1px_rgba(255,255,255,1)] border border-slate-200/80'
                        : 'text-slate-600 hover:text-slate-950 hover:bg-white/70'
                    }`}>
                    <Icon className={`w-4 h-4 transition-colors ${active ? 'text-indigo-600' : 'text-slate-400 group-hover:text-slate-600'}`} />
                    {label}
                  </Link>
                )
              })}
            </nav>

            {/* Desktop CTA */}
            <div className="hidden md:flex items-center gap-3">
              <button type="button" onClick={() => setShowAuth(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all shadow-sm text-white bg-slate-950 hover:bg-slate-900 hover:shadow-md active:scale-95 border border-slate-800"
              >
                <User className="w-4 h-4 text-indigo-400" />
                {session ? 'Account' : 'Sign In'}
              </button>
            </div>

            {/* Mobile toggle */}
            <button type="button" onClick={() => setOpen(v => !v)}
              className="md:hidden p-2 rounded-xl text-slate-600 hover:bg-slate-100 active:bg-slate-200 transition-colors"
              aria-expanded={open}
              aria-controls="mobile-nav-drawer"
              aria-label="Toggle menu">
              <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                {open
                  ? <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
                  : <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16"/>}
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile backdrop overlay */}
        {open && (
          <div
            className="md:hidden fixed inset-0 top-[57px] bg-slate-950/20 backdrop-blur-xs z-[-1]"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
        )}

        {/* Mobile drawer */}
        <div id="mobile-nav-drawer" aria-hidden={!open} style={{ gridTemplateRows: open ? '1fr' : '0fr' }} className={`md:hidden grid transition-all duration-300 ease-in-out ${open ? 'opacity-100 border-t border-slate-200/50 mt-3 visible pointer-events-auto' : 'opacity-0 invisible pointer-events-none'}`}>
          <div className="overflow-hidden">
            <div className="bg-white/95 backdrop-blur-2xl px-4 py-3 space-y-1.5 border-b border-slate-200/60 shadow-xl max-h-[calc(100dvh-5rem)] overflow-y-auto">
            {LINKS.map(({ to, label, Icon }) => {
              const active = to === '/' ? location.pathname === '/' : (location.pathname === to || location.pathname.startsWith(to + '/'))
              return (
                <Link key={to} to={to} tabIndex={open ? 0 : -1}
                  className={`flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-semibold transition-all ${
                    active
                      ? 'bg-indigo-50/80 text-indigo-950 font-bold border border-indigo-100/80 shadow-xs'
                      : 'text-slate-700 hover:bg-slate-50 hover:text-slate-950'
                  }`}>
                  <Icon className={`w-4 h-4 ${active ? 'text-indigo-600' : 'text-slate-400'}`} />
                  {label}
                  {active && <span className="ml-auto text-[11px] font-bold px-2 py-0.5 rounded-md bg-indigo-100/80 text-indigo-700 border border-indigo-200/60">Active</span>}
                </Link>
              )
            })}
            
            <div className="pt-2 border-t border-slate-100 mt-2">
              <button type="button" onClick={() => { setOpen(false); setShowAuth(true); }}
                tabIndex={open ? 0 : -1}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 text-sm font-bold rounded-2xl ps-btn-primary text-white shadow-sm active:scale-[0.98] transition-all"
              >
                <User className="w-4 h-4" />
                {session ? 'Account' : 'Sign In'}
              </button>
            </div>
            </div>
          </div>
        </div>
      </header>

      <AuthModal 
        open={showAuth} 
        onClose={() => { setShowAuth(false); setAuthError(null); }} 
        session={session} 
        initialMsg={authError} 
      />
    </>
  )
}
