import React from 'react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error.message || 'An unexpected error occurred.',
    };
  }

  override componentDidCatch(error: Error): void {
    console.error('EduCare ErrorBoundary caught:', error);
  }

  override render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen w-full bg-[#F1F6FC] dark:bg-slate-950 flex items-center justify-center px-4">
          <div className="max-w-md w-full bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-lg p-7 text-center">
            <h1 className="text-xl font-bold text-[#153B70] dark:text-slate-100">
              Something went wrong
            </h1>
            <p className="mt-2 text-sm text-[#44566C] dark:text-slate-300">
              We encountered an error while syncing your session. Please reload to continue.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-5 min-h-[44px] px-5 py-2.5 rounded-xl bg-[#1D6CE0] hover:bg-[#1557B8] text-white font-semibold text-sm cursor-pointer"
            >
              Reload EduCare
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
