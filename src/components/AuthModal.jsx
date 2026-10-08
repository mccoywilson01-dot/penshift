import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X, Mail, Lock, Loader2, LogOut } from 'lucide-react'
import { supabase } from '../lib/supabase.js'
import { getSafeAuthRedirectUrl } from '../lib/authRedirect.js'

export default function AuthModal({ open, onClose, session, initialMsg = null }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [isSignUp, setIsSignUp] = useState(false)
  const [msg, setMsg] = useState(initialMsg)

  // Track mount status with ref (not state) to prevent stale closures in async handlers
  const mountedRef = useRef(true)
  const modalRef = useRef(null)

  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  useEffect(() => {
    if (open) {
      if (initialMsg) setMsg(initialMsg);
    } else {
      setEmail(''); setPassword(''); setMsg(null); setLoading(false);
    }
  }, [open, initialMsg]);

  const focusableRef = useRef([])

  useEffect(() => {
    if (open && modalRef.current) {
      focusableRef.current = Array.from(modalRef.current.querySelectorAll(
        'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])'
      )).filter(el => !el.hasAttribute('disabled'))
    }
  }, [open, isSignUp, loading])

  useEffect(() => {
    if (open) {
      const original = document.body.style.overflow
      const originalPadding = document.body.style.paddingRight
      const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth
      
      document.body.style.overflow = 'hidden'
      document.body.style.paddingRight = `${scrollbarWidth}px`
      
      const previousFocus = document.activeElement;
      const rootEl = document.getElementById('root');
      
      if (rootEl) {
        rootEl.setAttribute('inert', 'true');
        rootEl.setAttribute('aria-hidden', 'true');
      }

      const handleKeyDown = (e) => {
        if (e.key === 'Escape') {
          e.stopPropagation()
          onCloseRef.current()
        }
        
        if (e.key === 'Tab' && modalRef.current) {
          const focusable = focusableRef.current
          if (focusable.length > 0) {
            const first = focusable[0]
            const last = focusable[focusable.length - 1]

            if (!modalRef.current.contains(document.activeElement)) {
              first.focus()
              e.preventDefault()
            } else if (e.shiftKey) {
              if (document.activeElement === first) {
                last.focus()
                e.preventDefault()
              }
            } else {
              if (document.activeElement === last) {
                first.focus()
                e.preventDefault()
              }
            }
          }
        }
      }

      document.addEventListener('keydown', handleKeyDown)
      
      return () => {
        document.body.style.overflow = original
        document.body.style.paddingRight = originalPadding
        document.removeEventListener('keydown', handleKeyDown)
        
        if (rootEl) {
          rootEl.removeAttribute('inert');
          rootEl.removeAttribute('aria-hidden');
        }
        
        if (previousFocus && typeof previousFocus.focus === 'function') {
          previousFocus.focus();
        }
      }
    }
  }, [open])

  if (!open) return null

  const handleAuth = async (e) => {
    e.preventDefault()
    setLoading(true)
    setMsg(null)
    try {
      if (isSignUp) {
        if (password.length < 6) throw new Error('Password must be at least 6 characters')
        if (!supabase) throw new Error('Authentication is not configured')
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: getSafeAuthRedirectUrl(),
          },
        })
        if (error) throw error
        setMsg({ type: 'success', text: 'Check your email for the confirmation link!' })
        setPassword('')
      } else {
        if (!supabase) throw new Error('Authentication is not configured')
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        onCloseRef.current()
      }
    } catch (error) {
      if (mountedRef.current) setMsg({ type: 'error', text: error.message || 'Authentication failed' })
    } finally {
      if (mountedRef.current) setLoading(false)
    }
  }

  const handleSignOut = async () => {
    try {
      if (supabase) await supabase.auth.signOut()
    } catch (e) {
      console.error('Sign out failed', e)
    }
    onCloseRef.current()
  }

  const modalContent = (
    <div className="fixed inset-0 z-[200] flex items-center justify-center" ref={modalRef} role="dialog" aria-modal="true" aria-labelledby="auth-title">
      <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md transition-opacity" onClick={onClose} />
      
      <div className="relative w-full max-w-md bg-white/95 backdrop-blur-2xl rounded-3xl shadow-[0_24px_60px_-12px_rgba(15,23,42,0.18)] border border-slate-200/80 p-8 m-4 anim-scale-in">
        <button type="button" onClick={onClose} aria-label="Close authentication dialog" className="absolute top-6 right-6 text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-full hover:bg-slate-100">
          <X className="w-5 h-5" />
        </button>

        {session ? (
          <div className="text-center space-y-6">
            <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto border border-indigo-100 shadow-sm">
              <Mail className="w-8 h-8" />
            </div>
            <div>
              <h2 id="auth-title" className="text-2xl font-bold text-slate-900 tracking-tight">Signed In</h2>
              <p className="text-slate-500 mt-2 text-sm">{session.user.email}</p>
            </div>
            <button type="button" onClick={handleSignOut}
              autoFocus
              className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95"
            >
              <LogOut className="w-4 h-4" /> Sign Out
            </button>
          </div>
        ) : (
          <div>
            <h2 id="auth-title" className="text-2xl font-bold text-slate-900 mb-2 tracking-tight">
              {isSignUp ? 'Create an Account' : 'Welcome Back'}
            </h2>
            <p className="text-slate-500 mb-6 text-sm">
              {isSignUp ? 'Sign up to sync your history across devices.' : 'Sign in to access your cloud history.'}
            </p>

            <form onSubmit={handleAuth} className="space-y-4">
              <div>
                <label htmlFor="auth-email" className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1.5">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input 
                    id="auth-email"
                    type="email" 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={loading}
                    autoFocus
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200/80 bg-slate-50/70 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-sm font-medium text-slate-900 placeholder:text-slate-400"
                    placeholder="you@example.com"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="auth-password" className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1.5">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input 
                    id="auth-password"
                    type="password" 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    disabled={loading}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200/80 bg-slate-50/70 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-sm font-medium text-slate-900 placeholder:text-slate-400"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              {msg && (
                <div role="alert" className={`p-3 rounded-xl text-xs font-semibold ${msg.type === 'error' ? 'bg-red-50 text-red-600 border border-red-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>
                  {msg.text}
                </div>
              )}

              <button type="submit" 
                disabled={loading}
                className="w-full py-2.5 px-4 ps-btn-primary text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-all shadow-sm active:scale-[0.98] disabled:opacity-70 disabled:pointer-events-none mt-2 text-sm"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : (isSignUp ? 'Sign Up' : 'Sign In')}
              </button>
            </form>

            <div className="mt-6 text-center text-sm text-slate-500">
              {isSignUp ? 'Already have an account? ' : "Don't have an account? "}
              <button type="button"
                onClick={() => { setIsSignUp(!isSignUp); setMsg(null); setPassword(''); }}
                className="text-indigo-600 font-semibold hover:underline"
              >
                {isSignUp ? 'Sign In' : 'Sign Up'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : null
}
