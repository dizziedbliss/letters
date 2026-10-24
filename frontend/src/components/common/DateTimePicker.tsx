import React, { useEffect, useRef, useState } from 'react';
import { DayPicker } from 'react-day-picker';
import 'react-day-picker/style.css';
import './date-time-picker.css';

const pad = (n: number) => String(n).padStart(2, '0');

const fmt = (d: Date) =>
  `${d.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' })} · ${d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;

/** Quick picks, all in the writer's local time. */
const QUICK: { label: string; at: () => Date }[] = [
  { label: 'tonight 9pm', at: () => withTime(new Date(), 21, 0) },
  { label: 'tomorrow 9am', at: () => withTime(addDays(new Date(), 1), 9, 0) },
  { label: 'this sunday', at: () => withTime(addDays(new Date(), (7 - new Date().getDay()) % 7 || 7), 10, 0) },
  { label: 'in a week', at: () => withTime(addDays(new Date(), 7), 9, 0) },
];

function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
function withTime(d: Date, h: number, m: number) {
  const x = new Date(d);
  x.setHours(h, m, 0, 0);
  return x;
}

interface DateTimePickerProps {
  value: string; // ISO
  onChange: (iso: string) => void;
}

/** Date + time picker in the site's style (the native one can't be themed). */
export const DateTimePicker: React.FC<DateTimePickerProps> = ({ value, onChange }) => {
  const date = new Date(value);
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const hours12 = date.getHours() % 12 || 12;
  const pm = date.getHours() >= 12;

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => !wrap.current?.contains(e.target as Node) && setOpen(false);
    window.addEventListener('pointerdown', close);
    return () => window.removeEventListener('pointerdown', close);
  }, [open]);

  const set = (d: Date) => onChange(d.toISOString());
  const setTime = (h12: number, m: number, isPm: boolean) => set(withTime(date, (h12 % 12) + (isPm ? 12 : 0), m));

  const chip = (active: boolean) =>
    `h-8 min-w-9 px-2 rounded-lg font-mono text-[11px] cursor-pointer transition-colors ${active ? 'bg-brand-cyan text-black' : 'bg-white/[0.06] text-white/75 hover:bg-white/12'}`;

  return (
    <div ref={wrap} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full h-10 rounded-xl bg-white/[0.06] hover:bg-white/10 px-3 flex items-center justify-between font-body text-base text-white cursor-pointer"
      >
        <span>{fmt(date)}</span>
        <span className="font-mono text-[10px] text-white/40">{open ? 'CLOSE' : 'CHANGE'}</span>
      </button>

      {open && (
        <div className="absolute z-40 mt-2 inset-x-0 min-w-0 rounded-2xl bg-[#19191c] border border-white/10 shadow-[0_18px_50px_rgba(0,0,0,0.55)] p-3 space-y-3 animate-fade-in">
          <div className="flex flex-wrap gap-1.5">
            {QUICK.map((q) => (
              <button key={q.label} type="button" onClick={() => set(q.at())} className="h-7 px-2.5 rounded-full bg-brand-purple/40 hover:bg-brand-purple/70 font-mono text-[10px] text-white cursor-pointer">
                {q.label}
              </button>
            ))}
          </div>
          <DayPicker
            className="letters-daypicker"
            mode="single"
            required
            weekStartsOn={1}
            selected={date}
            defaultMonth={date}
            disabled={{ before: new Date() }}
            onSelect={(d) => d && set(withTime(d, date.getHours(), date.getMinutes()))}
          />
          <div className="space-y-2 border-t border-white/5 pt-3">
            <div className="flex flex-wrap gap-1">
              {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => (
                <button key={h} type="button" onClick={() => setTime(h, date.getMinutes(), pm)} className={chip(h === hours12)}>
                  {h}
                </button>
              ))}
            </div>
            <div className="flex gap-1 items-center">
              {[0, 15, 30, 45].map((m) => (
                <button key={m} type="button" onClick={() => setTime(hours12, m, pm)} className={chip(m === date.getMinutes())}>
                  :{pad(m)}
                </button>
              ))}
              <span className="flex-1" />
              <button type="button" onClick={() => setTime(hours12, date.getMinutes(), false)} className={chip(!pm)}>
                AM
              </button>
              <button type="button" onClick={() => setTime(hours12, date.getMinutes(), true)} className={chip(pm)}>
                PM
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DateTimePicker;
