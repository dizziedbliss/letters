import React from 'react';

/** Tiny shared controls for the editor's sheets and toolbar (dark, thumb-sized). */

export const Chip: React.FC<{ active?: boolean; onClick: () => void; children: React.ReactNode; label?: string; disabled?: boolean }> = ({
  active,
  onClick,
  children,
  label,
  disabled,
}) => (
  <button
    type="button"
    aria-label={label}
    aria-pressed={active}
    disabled={disabled}
    onClick={onClick}
    className={`min-w-10 h-10 px-3 rounded-xl font-mono text-xs tracking-wider transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed ${
      active ? 'bg-brand-cyan text-black' : 'bg-white/8 text-white/85 hover:bg-white/15'
    }`}
  >
    {children}
  </button>
);

export const Row: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
    <span className="shrink-0 w-14 font-mono text-[10px] tracking-[0.2em] text-white/40 uppercase">{label}</span>
    <div className="flex items-center gap-1.5">{children}</div>
  </div>
);

export const TextInput: React.FC<{
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  label: string;
  multiline?: boolean;
}> = ({ value, onChange, placeholder, label, multiline }) => (
  <label className="block">
    <span className="block font-mono text-[10px] tracking-[0.2em] text-white/40 uppercase mb-1.5">{label}</span>
    {multiline ? (
      <textarea
        value={value}
        rows={3}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-white/8 rounded-xl px-3 py-2.5 outline-none font-body text-base text-white placeholder:text-white/30 focus:bg-white/12 resize-y"
      />
    ) : (
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full h-11 bg-white/8 rounded-xl px-3 outline-none font-body text-base text-white placeholder:text-white/30 focus:bg-white/12"
      />
    )}
  </label>
);

/** A bottom sheet over the page. Tapping the backdrop closes it. */
export const Sheet: React.FC<{ title: string; onClose: () => void; children: React.ReactNode }> = ({ title, onClose, children }) => (
  <div className="fixed inset-0 z-40 flex flex-col justify-end" role="dialog" aria-label={title}>
    <button type="button" aria-label="Close" className="absolute inset-0 bg-black/50 cursor-default" onClick={onClose} />
    <div className="relative bg-[#1c1c1f] text-white rounded-t-3xl px-5 pt-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] max-h-[80dvh] overflow-y-auto animate-fade-in">
      <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/20" />
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display uppercase text-2xl tracking-wide">{title}</h2>
        <button type="button" onClick={onClose} className="font-mono text-xs text-white/50 hover:text-white cursor-pointer">
          DONE
        </button>
      </div>
      {children}
    </div>
  </div>
);
