import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(_error) {
    return { hasError: true }
  }

  componentDidCatch(error, errorInfo) {
    console.error('React ErrorBoundary Caught Error:', error, errorInfo)
  }

  componentDidUpdate(prevProps) {
    // Sentry/Datadog integration could be added here or in componentDidCatch
    if (this.props.resetKey !== prevProps.resetKey && this.state.hasError) {
      this.setState({ hasError: false })
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div role="alert" className="flex flex-col items-center justify-center min-h-[70vh] gap-4 text-center px-4 anim-fade-in">
          <div className="text-6xl font-display font-black text-slate-100 select-none">Oops!</div>
          <h2 className="text-xl font-bold text-slate-800 -mt-2">Something went wrong</h2>
          <p className="text-slate-500 max-w-md">We encountered an unexpected error. Please refresh the page to try again.</p>
          <button type="button"             onClick={() => { window.location.href = '/'; }} 
            className="px-6 py-2.5 bg-blue-600 text-white rounded-2xl font-semibold text-sm hover:bg-blue-700 transition-colors mt-2 shadow-sm hover:shadow active:scale-95"
          >
            ← Go Home
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
