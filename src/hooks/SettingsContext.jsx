import { createContext, useState, useEffect, useContext, useCallback, useMemo } from 'react';

const VALID_PROVIDERS = ['auto', 'gemini', 'groq'];
const SettingsContext = createContext();

export function SettingsProvider({ children }) {
  const [apiProvider, setApiProviderState] = useState(() => {
    try {
      const stored = localStorage.getItem('hai_provider');
      return VALID_PROVIDERS.includes(stored) ? stored : 'auto';
    } catch (e) {
      console.warn('Failed to load hai_provider from localStorage', e);
      return 'auto';
    }
  });

  const setApiProvider = useCallback((val) => {
    if (!VALID_PROVIDERS.includes(val)) return;
    setApiProviderState(val);
    try {
      localStorage.setItem('hai_provider', val);
    } catch (e) {
      console.warn('Failed to save hai_provider to localStorage', e);
    }
  }, []);

  // Multi-tab synchronization
  useEffect(() => {
    const handleStorage = (e) => {
      if (e.key === 'hai_provider' && e.newValue && VALID_PROVIDERS.includes(e.newValue)) {
        setApiProviderState(e.newValue);
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const contextValue = useMemo(() => ({ apiProvider, setApiProvider }), [apiProvider, setApiProvider]);

  return (
    <SettingsContext.Provider value={contextValue}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (context === undefined) throw new Error('useSettings must be used within a SettingsProvider');
  return context;
}
