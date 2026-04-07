'use client';

import { Component, type ReactNode } from 'react';

type Props = {
  children: ReactNode;
  fallback?: ReactNode;
};

type State = {
  hasError: boolean;
  error: Error | null;
};

export class GameErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error('[GameErrorBoundary]', error, errorInfo);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90">
          <div className="max-w-md rounded-xl border border-red-500/30 bg-dm-dark p-8 text-center">
            <h2 className="mb-4 text-xl font-bold text-red-400">
              Bir hata oluştu
            </h2>
            <p className="mb-4 text-sm text-gray-400">
              {this.state.error?.message ?? 'Bilinmeyen bir hata'}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="rounded-lg bg-red-600 px-6 py-2 text-sm font-bold text-white transition hover:bg-red-500"
            >
              Sayfayı Yenile
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
