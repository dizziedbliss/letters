import React from 'react';

/** Segmented control: a row of options, one active. */
export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="flex rounded-xl bg-white/[0.06] p-1 gap-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
          className={`flex-1 min-w-0 truncate h-9 px-2 rounded-lg font-mono text-[11px] tracking-wider transition-colors cursor-pointer ${
            value === o.value ? 'bg-brand-cyan text-black' : 'text-white/70 hover:bg-white/10'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export const FieldLabel: React.FC<{ children: React.ReactNode; hint?: string }> = ({ children, hint }) => (
  <div className="flex items-baseline justify-between mb-2">
    <span className="font-mono text-[10px] tracking-[0.22em] text-white/45 uppercase">{children}</span>
    {hint && <span className="font-body text-xs text-white/35 italic">{hint}</span>}
  </div>
);

export const inputClass =
  'w-full h-10 bg-white/[0.06] rounded-xl px-3 outline-none font-body text-base text-white placeholder:text-white/30 focus:bg-white/10 [color-scheme:dark]';
