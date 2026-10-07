import { Suspense, lazy, useEffect, useRef, useState, useCallback, memo } from 'react'
import { BrowserRouter, Routes, Route, useLocation, Link, useNavigationType } from 'react-router-dom'
import { History, X, Trash2 } from 'lucide-react'
import Navbar from './components/Navbar.jsx'
import Footer from './components/Footer.jsx'
import { loadHistory, deleteHistoryItem } from './lib/supabase.js'
import { SettingsProvider } from './hooks/SettingsContext.jsx'
import ErrorBoundary from './ErrorBoundary.jsx'

const Home      = lazy(() => import('./pages/Home.jsx'))
const Humanizer = lazy(() => import('./pages/Humanizer.jsx'))
const Blog      = lazy(() => import('./pages/Blog.jsx'))
const Affiliate = lazy(() => import('./pages/Affiliate.jsx'))
const Score     = lazy(() => import('./pages/Score.jsx'))


function PageTransition({ children }) {
  const location = useLocation()
  const navType = useNavigationType()

  useEffect(() => {
    if (navType !== 'POP') {
      window.scrollTo({ top: 0, behavior: 'instant' })
    }
  }, [location.pathname, navType])

  return <div className="w-full">{children}</div>
}

function LoadingScreen() {
  return (
    <div className="flex items-center justify-center min-h-[70vh] anim-fade-in" role="status" aria-live="polite">
      <div className="flex flex-col items-center gap-4">
        <div className="relative w-11 h-11">
          <div className="absolute inset-0 rounded-full border-2 border-slate-200 border-t-indigo-600 spin transition-all" />
          <div className="absolute inset-1.5 rounded-full border-2 border-transparent border-b-violet-500 spin-rev transition-all" />
        </div>
        <span className="text-xs text-slate-500 font-semibold tracking-wider uppercase animate-pulse">Loading PenShift...</span>
      </div>
    </div>
  )
}

function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] gap-4 text-center px-4 anim-fade-in">
      <div className="text-8xl sm:text-9xl font-black text-slate-200/80 tracking-tight select-none">404</div>
      <p className="text-slate-600 text-lg -mt-3 font-semibold">Page not found</p>
      <Link to="/" className="ps-btn-primary px-6 py-2.5 text-white font-bold text-sm shadow-sm active:scale-95 transition-all mt-2">
        ← Back Home
      </Link>
    </div>
  )
}

const HistoryDrawer = memo(function HistoryDrawer({ open, onClose }) {
  const [history, setHistory] = useState([])
  const drawerRef = useRef(null)
  
  useEffect(() => {
    let mounted = true;
    if (open) {
      Promise.allSettled([
        loadHistory('penshift_history'),
        loadHistory('penshift_history_humanizer'),
        loadHistory('penshift_history_score')
      ])
        .then((results) => {
          if (mounted) {
            const data1 = results[0].status === 'fulfilled' ? results[0].value : [];
            const data2 = results[1].status === 'fulfilled' ? results[1].value : [];
            const data3 = results[2].status === 'fulfilled' ? results[2].value : [];
            const allData = [
              ...(Array.isArray(data1) ? data1 : []),
              ...(Array.isArray(data2) ? data2 : []),
              ...(Array.isArray(data3) ? data3 : [])
            ].map(item => {
              const t = item.timestamp || item.ts || Date.now();
              return { item, time: typeof t === 'number' ? t : new Date(t).getTime() || 0 };
            });
            
            allData.sort((a, b) => b.time - a.time);
            setHistory(allData.map(obj => obj.item));
          }
        })
    }
    return () => { mounted = false }
  }, [open])

  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
      if (e.key === 'Tab' && drawerRef.current) {
        const focusableElements = drawerRef.current.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusableElements.length === 0) {
          drawerRef.current.focus();
          e.preventDefault();
          return;
        }
        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === firstElement || document.activeElement === drawerRef.current) {
            lastElement.focus();
            e.preventDefault();
          }
        } else {
          if (document.activeElement === lastElement) {
            firstElement.focus();
            e.preventDefault();
          }
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    if (drawerRef.current) drawerRef.current.focus();
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
      if (previousFocus && previousFocus.focus) previousFocus.focus();
    };
  }, [open, onClose])

  const handleDeleteItem = useCallback(async (item) => {
    const key = item.type === 'Score' ? 'penshift_history_score' : (item.type === 'Humanizer' ? 'penshift_history_humanizer' : 'penshift_history');
    await deleteHistoryItem(item.id || item.timestamp || item.ts, key);
    setHistory(prev => prev.filter(h => (h.id || h.timestamp || h.ts) !== (item.id || item.timestamp || item.ts)));
  }, []);

  return (
    <>
      <div 
        className={`fixed inset-0 bg-slate-950/25 backdrop-blur-xs z-[100] transition-opacity duration-300 ${open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />
      <div 
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        tabIndex="-1"
        inert={!open ? '' : undefined}
        className={`fixed top-0 right-0 h-full w-full max-w-md bg-white/95 backdrop-blur-2xl border-l border-slate-200/80 shadow-2xl z-[101] transform transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] flex flex-col outline-none ${open ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <div className="p-5 border-b border-slate-200/60 flex items-center justify-between bg-white/70 backdrop-blur-md">
          <div className="flex items-center gap-2.5 text-slate-950">
            <History className="w-5 h-5 text-indigo-600" />
            <h2 className="font-bold text-lg tracking-tight">Generation History</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close history" className="p-2 rounded-xl hover:bg-slate-100 text-slate-500 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {history.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-400">
              <History className="w-12 h-12 mb-3 opacity-20" />
              <p className="text-sm font-semibold text-slate-600">No history yet</p>
              <p className="text-xs text-slate-400 mt-1">Generations will appear here</p>
            </div>
          ) : (
            history.map(item => (
              <div key={item.id || item.timestamp || item.ts} className="bg-white/90 backdrop-blur-sm border border-slate-200/80 rounded-2xl p-4 shadow-xs hover:shadow-md hover:border-indigo-200/70 transition-all">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-xs font-bold px-2.5 py-0.5 bg-indigo-50 text-indigo-700 rounded-lg border border-indigo-100">
                    {item.type || 'History'}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400 font-medium tabular-nums">
                      {item.timestamp ? new Date(item.timestamp).toLocaleString() : (item.ts || '')}
                    </span>
                    <button
                      type="button"
                      aria-label="Delete history item"
                      onClick={() => handleDeleteItem(item)}
                      className="p-1 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <p className="text-sm text-slate-800 font-medium mb-3 line-clamp-2">
                  {item.prompt || item.input || item.text}
                </p>
                <div className="relative">
                  <div className="text-xs text-slate-600 bg-slate-50 rounded-xl p-3 max-h-32 overflow-hidden whitespace-pre-wrap font-mono border border-slate-200/60">
                    {item.output || (item.score ? JSON.stringify(item.score) : '')}
                    <div className="absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-slate-50 to-transparent" />
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  )
})

function AppContent() {
  const [isHistoryOpen, setIsHistoryOpen] = useState(false)
  const location = useLocation()
  
  const handleCloseHistory = useCallback(() => {
    setIsHistoryOpen(false)
  }, [])
  
  return (
    <>
      <Navbar />
      <main className="flex-1 w-full max-w-screen-2xl mx-auto overflow-hidden relative" inert={isHistoryOpen ? '' : undefined}>
        <ErrorBoundary resetKey={location.pathname}>
          <PageTransition>
            <Routes>
              <Route path="/"          element={<Suspense fallback={<LoadingScreen />}><Home /></Suspense>} />
              <Route path="/humanizer" element={<Suspense fallback={<LoadingScreen />}><Humanizer /></Suspense>} />
              <Route path="/blog"      element={<Suspense fallback={<LoadingScreen />}><Blog /></Suspense>} />
              <Route path="/affiliate" element={<Suspense fallback={<LoadingScreen />}><Affiliate /></Suspense>} />
              <Route path="/score"     element={<Suspense fallback={<LoadingScreen />}><Score /></Suspense>} />
              <Route path="*"          element={<NotFound />} />
            </Routes>
          </PageTransition>
        </ErrorBoundary>
      </main>
      <Footer />
      
      <button type="button" onClick={() => setIsHistoryOpen(true)}
        aria-label="Open generation history"
        className="fixed bottom-5 right-5 sm:bottom-6 sm:right-6 z-40 p-3 sm:p-3.5 bg-white/90 hover:bg-white text-slate-700 hover:text-indigo-600 rounded-full shadow-[0_4px_16px_rgba(15,23,42,0.1),0_1px_2px_rgba(0,0,0,0.05)] border border-slate-200/80 active:scale-95 transition-all group"
      >
        <History className="w-5 h-5 group-hover:rotate-[-12deg] transition-transform" />
      </button>

      <HistoryDrawer open={isHistoryOpen} onClose={handleCloseHistory} />
    </>
  )
}

export default function App() {
  const [isOffline, setIsOffline] = useState(typeof navigator !== 'undefined' ? !navigator.onLine : false)

  useEffect(() => {
    const handleOnline = () => setIsOffline(false)
    const handleOffline = () => setIsOffline(true)
    
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  return (
    <SettingsProvider>
      <BrowserRouter>
        <div className="min-h-screen flex flex-col bg-transparent text-slate-900 font-sans antialiased selection:bg-blue-100 selection:text-blue-900">
          {isOffline && (
            <div className="bg-red-500 text-white text-center py-2 text-xs font-bold z-[1000] sticky top-0 w-full shadow-md transition-all">
              ⚠️ You are currently offline. Please check your internet connection.
            </div>
          )}
          <AppContent />
        </div>
      </BrowserRouter>
    </SettingsProvider>
  )
}
