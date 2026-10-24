import React from 'react';

/** If a page crashes, show a way back instead of a blank screen. */
export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.error('page crashed:', error);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="min-h-dvh bg-[#151515] text-white flex flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="font-mono text-[11px] tracking-[0.3em] text-white/45">SOMETHING BROKE</p>
        <p className="font-body italic text-2xl">oops, that page tripped over itself :&lt;</p>
        <p className="font-body text-white/50">your drafts are saved as you type, so a reload is safe</p>
        <button
          type="button"
          onClick={() => location.reload()}
          className="h-11 px-6 rounded-xl bg-brand-cyan text-black font-mono text-[11px] tracking-wider font-bold cursor-pointer"
        >
          RELOAD
        </button>
      </div>
    );
  }
}
