import React from 'react';

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center max-w-md mx-auto">
          <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center mb-4">
            <span className="text-2xl">⚠</span>
          </div>
          <h2 className="text-lg font-extrabold text-slate-800 mb-2">エラーが発生しました</h2>
          <p className="text-sm text-slate-500 mb-6">
            予期しないエラーが発生しました。下のボタンで復帰を試みてください。
          </p>
          <button
            onClick={this.handleReset}
            className="bg-brand-500 hover:bg-brand-600 text-white font-bold px-6 py-3 rounded-2xl transition-colors"
          >
            アプリを再開する
          </button>
          {this.state.error && (
            <p className="mt-4 text-xs text-slate-400 break-all max-w-sm">
              {this.state.error.message}
            </p>
          )}
        </div>
      );
    }
    return this.props.children;
  }
}
