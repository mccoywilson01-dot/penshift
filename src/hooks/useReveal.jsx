import { useEffect, useRef, forwardRef, memo, useCallback, useState } from 'react'

const observer = typeof IntersectionObserver !== 'undefined' 
  ? new IntersectionObserver(
      (entries) => {
        entries.forEach(e => {
          if (e.isIntersecting) {
            requestAnimationFrame(() => {
              if (e.target.isConnected) e.target.classList.add('visible')
            })
            observer.unobserve(e.target)
          }
        })
      },
      { threshold: 0.05, rootMargin: '150px 0px 60px 0px' }
    )
  : null;

/**
 * <Reveal> wrapper component — safe to use inside JSX and .map().
 * Never call useReveal() directly inside render — use this instead.
 */
export const Reveal = memo(forwardRef(({ 
  children, 
  delay = 0, 
  className = '', 
  as: Tag = 'div', 
  style
}, ref) => {
  const internalRef = useRef(null)

  const setRefs = useCallback((node) => {
    internalRef.current = node
    if (typeof ref === 'function') {
      ref(node)
    } else if (ref) {
      ref.current = node
    }
  }, [ref])

  useEffect(() => {
    const el = internalRef.current
    if (!el) return

    // Accessibility: Respect prefers-reduced-motion
    const prefersReducedMotion = typeof window !== 'undefined' && window.matchMedia 
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches 
      : false

    if (prefersReducedMotion) {
      el.classList.add('visible')
      return
    }

    // Immediate check if element is already within or near viewport
    const rect = el.getBoundingClientRect()
    if (rect.top <= (window.innerHeight || document.documentElement.clientHeight) + 150) {
      el.classList.add('visible')
      return
    }

    if (observer) {
      observer.observe(el)
      // Safety fallback: ensure element is visible after 800ms
      const timer = setTimeout(() => {
        if (el && el.isConnected) el.classList.add('visible')
      }, 800)
      return () => {
        observer.unobserve(el)
        clearTimeout(timer)
      }
    } else {
      el.classList.add('visible')
    }
  }, [delay])

  const combinedStyle = delay 
    ? { ...style, transitionDelay: typeof delay === 'number' ? `${delay}s` : delay } 
    : style

  return (
    <Tag ref={setRefs} className={`reveal ${className}`.trim()} style={combinedStyle}>
      {children}
    </Tag>
  )
}))

Reveal.displayName = 'Reveal'

/**
 * Stagger reveal — attach to container. Children need className="reveal-item reveal".
 */
export function useStaggerReveal(threshold = 0.05, rootMargin = '150px 0px 60px 0px', baseDelay = 0.05) {
  const ref = useRef(null)
  
  useEffect(() => {
    const container = ref.current
    if (!container) return
    
    // Accessibility: Respect prefers-reduced-motion
    const prefersReducedMotion = typeof window !== 'undefined' && window.matchMedia 
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches 
      : false

    if (prefersReducedMotion) {
      let mutTimeout;
      const mutObs = new MutationObserver(() => {
        clearTimeout(mutTimeout);
        mutTimeout = setTimeout(() => {
          container.querySelectorAll('.reveal-item:not(.visible)').forEach(el => el.classList.add('visible'));
        }, 50);
      });
      mutObs.observe(container, { childList: true, subtree: true });
      container.querySelectorAll('.reveal-item:not(.visible)').forEach(el => el.classList.add('visible'));
      return () => {
        mutObs.disconnect();
        clearTimeout(mutTimeout);
      };
    }

    if (typeof IntersectionObserver === 'undefined') {
      const items = container.querySelectorAll('.reveal-item')
      items.forEach(el => el.classList.add('visible'))
      return
    }

    let intersectIndex = 0;
    let intersectTimeout;
    const observedNodes = new WeakSet();

    const obs = new IntersectionObserver(
      (entries) => {
        let anyIntersecting = false;
        entries.forEach(e => {
          if (e.isIntersecting) { 
            anyIntersecting = true;
            const delay = Math.min(intersectIndex * baseDelay, 0.5);
            intersectIndex++;

            e.target.style.transitionDelay = `${delay}s`;
            requestAnimationFrame(() => {
              if (e.target.isConnected) e.target.classList.add('visible')
            })
            obs.unobserve(e.target) 
          }
        })
        if (anyIntersecting) {
          clearTimeout(intersectTimeout);
          intersectTimeout = setTimeout(() => { intersectIndex = 0 }, 400); // Increased from 100 to 400 to fix stutter
        }
      },
      { threshold, rootMargin }
    )
    
    const observeItems = () => {
      const items = container.querySelectorAll('.reveal-item:not(.visible)')
      items.forEach((el) => { 
        if (!observedNodes.has(el)) {
          observedNodes.add(el)
          obs.observe(el)
        }
      })
    }

    observeItems()

    let mutTimeout;
    const mutObs = new MutationObserver((mutations) => {
      mutations.forEach(mut => {
        mut.removedNodes.forEach(node => {
          if (node.nodeType === 1) {
            if (observedNodes.has(node)) obs.unobserve(node);
            node.querySelectorAll?.('.reveal-item').forEach(child => {
              if (observedNodes.has(child)) obs.unobserve(child);
            });
          }
        });
      });
      clearTimeout(mutTimeout);
      mutTimeout = setTimeout(observeItems, 50);
    })
    
    mutObs.observe(container, { childList: true, subtree: true })

    const safetyTimer = setTimeout(() => {
      if (container) {
        container.querySelectorAll('.reveal-item:not(.visible)').forEach(el => el.classList.add('visible'))
      }
    }, 1000)
    
    return () => {
      obs.disconnect()
      mutObs.disconnect()
      clearTimeout(mutTimeout)
      clearTimeout(intersectTimeout)
      clearTimeout(safetyTimer)
    }
  }, [threshold, rootMargin, baseDelay])
  
  return ref
}

export function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(true)

  useEffect(() => {
    if (typeof window === 'undefined') return
    setIsDesktop(window.innerWidth >= 768)
    
    const mql = window.matchMedia('(min-width: 768px)')
    const handleChange = (e) => setIsDesktop(e.matches)
    
    mql.addEventListener('change', handleChange)
    return () => mql.removeEventListener('change', handleChange)
  }, [])

  return isDesktop
}
