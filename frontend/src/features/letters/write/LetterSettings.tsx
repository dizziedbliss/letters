import React, { useState } from 'react';
import type { LetterGroup, LetterRule, MyLetter } from '../../../utils/api';
import { FieldLabel, Segmented, inputClass } from './controls';
import { DateTimePicker } from '../../../components/common/DateTimePicker';

type When = 'now' | LetterRule['kind'];

const WHEN_OPTIONS: { value: When; label: string; hint: string }[] = [
  { value: 'now', label: 'Right away', hint: 'they can open it as soon as you send it' },
  { value: 'date', label: 'On a date', hint: 'stays locked until the day you pick' },
  { value: 'after', label: 'After another letter', hint: 'like chapters, in order' },
  { value: 'manual', label: 'When I say', hint: 'you unlock it yourself, e.g. on a call' },
];

/** Default for a new date lock: this time tomorrow. */
const tomorrow = () => new Date(Date.now() + 86400e3).toISOString();

const periodWord = { day: 'a day', week: 'a week', month: 'a month' } as const;
const groupLine = (g: LetterGroup | undefined) =>
  !g ? 'no limit' : g.quota ? `${g.name} · ${g.quota} ${periodWord[g.period]}` : `${g.name} · no limit`;

interface LetterSettingsProps {
  letter: MyLetter;
  letters: MyLetter[];
  groups: LetterGroup[];
  reader: string | null;
  onPatch: (patch: Partial<MyLetter>) => void;
  onUnlock: () => void;
  onUnsend: () => void;
  onManageGroups: () => void;
}

/** Everything about a letter that isn't its words, as few decisions as possible. */
export const LetterSettings: React.FC<LetterSettingsProps> = ({ letter, letters, groups, reader, onPatch, onUnlock, onUnsend, onManageGroups }) => {
  const [limitOpen, setLimitOpen] = useState(false);
  const when: When = letter.rule?.kind ?? 'now';
  const others = letters.filter((l) => l.id !== letter.id);
  const group = groups.find((g) => g.id === letter.groupId);
  const who = reader ?? 'they';

  const setWhen = (w: When) => {
    if (w === 'now') onPatch({ rule: null });
    else if (w === 'date') onPatch({ rule: { kind: 'date', at: tomorrow() } });
    else if (w === 'after') {
      if (others[0]) onPatch({ rule: { kind: 'after', letter_id: others[0].id } });
    } else onPatch({ rule: { kind: 'manual' } });
  };

  const status = !letter.publishedAt
    ? { text: 'DRAFT · only you can see it', tone: 'bg-amber-300/15 text-amber-200' }
    : letter.openedAt
      ? { text: `${who.toUpperCase()} READ IT ${new Date(letter.openedAt).toLocaleDateString([], { day: 'numeric', month: 'short' }).toUpperCase()} ♡`, tone: 'bg-brand-cyan/15 text-brand-cyan' }
      : { text: 'SENT · not opened yet', tone: 'bg-white/[0.06] text-white/70' };

  return (
    <div className="space-y-6">
      <div className={`flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 font-mono text-[10px] tracking-wider ${status.tone}`}>
        <span>{status.text}</span>
        {letter.publishedAt && !letter.openedAt && (
          <button type="button" onClick={onUnsend} className="underline underline-offset-4 opacity-80 hover:opacity-100 cursor-pointer">
            UNSEND
          </button>
        )}
      </div>

      <div>
        <FieldLabel>Where it goes</FieldLabel>
        <Segmented
          value={letter.section}
          onChange={(section) => onPatch({ section })}
          options={[
            { value: 'random', label: 'RANDOM' },
            { value: 'open_when', label: 'OPEN WHEN…' },
          ]}
        />
        <p className="font-body text-sm text-white/40 mt-2">
          {letter.section === 'open_when' ? 'the title is the feeling, e.g. "sick", "sad", "can\'t sleep"' : 'any letter, any time you feel like writing'}
        </p>
      </div>

      <button
        type="button"
        role="switch"
        aria-checked={letter.sealed}
        onClick={() => onPatch({ sealed: !letter.sealed })}
        className="w-full flex items-center justify-between gap-3 rounded-xl bg-white/[0.04] hover:bg-white/[0.07] px-4 py-3 text-left cursor-pointer"
      >
        <span>
          <span className="block font-body text-base">Keep the title secret</span>
          <span className="block font-body text-sm text-white/40">shows as a sealed envelope until opened</span>
        </span>
        <span className={`relative w-11 h-6 rounded-full shrink-0 transition-colors ${letter.sealed ? 'bg-brand-cyan' : 'bg-white/15'}`}>
          <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${letter.sealed ? 'left-[22px]' : 'left-0.5'}`} />
        </span>
      </button>

      <div>
        <FieldLabel>When can {who} open it?</FieldLabel>
        <div className="space-y-1.5">
          {WHEN_OPTIONS.map((o) => {
            const active = when === o.value;
            const disabled = o.value === 'after' && !others.length;
            return (
              <div key={o.value} className={`rounded-xl transition-colors ${active ? 'bg-white/[0.08] ring-1 ring-brand-cyan/60' : 'bg-white/[0.03]'}`}>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => setWhen(o.value)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-left cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed"
                >
                  <span className={`w-4 h-4 rounded-full border-2 shrink-0 ${active ? 'border-brand-cyan bg-brand-cyan shadow-[inset_0_0_0_3px_#19191c]' : 'border-white/30'}`} />
                  <span className="min-w-0">
                    <span className="block font-body text-base">{o.label}</span>
                    <span className="block font-body text-xs text-white/40">{disabled ? 'write another letter first' : o.hint}</span>
                  </span>
                </button>

                {active && o.value === 'date' && letter.rule?.kind === 'date' && (
                  <div className="px-3 pb-3">
                    <DateTimePicker value={letter.rule.at} onChange={(at) => onPatch({ rule: { kind: 'date', at } })} />
                  </div>
                )}
                {active && o.value === 'after' && letter.rule?.kind === 'after' && (
                  <div className="px-3 pb-3">
                    <select
                      className={inputClass}
                      value={letter.rule.letter_id}
                      onChange={(e) => onPatch({ rule: { kind: 'after', letter_id: Number(e.target.value) } })}
                    >
                      {others.map((l) => (
                        <option key={l.id} value={l.id}>
                          after "{l.title || 'untitled'}"
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                {active && o.value === 'manual' && (
                  <div className="px-3 pb-3">
                    {letter.unlockedByWriter ? (
                      <span className="font-mono text-[11px] tracking-wider text-brand-cyan">UNLOCKED ✓ {who} can open it</span>
                    ) : (
                      <button
                        type="button"
                        onClick={onUnlock}
                        className="h-9 px-4 rounded-xl bg-brand-cyan text-black font-mono text-[11px] tracking-wider font-bold cursor-pointer hover:shadow-[0_0_16px_rgba(0,216,255,0.5)]"
                      >
                        UNLOCK NOW
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded-xl bg-white/[0.03] px-3 py-2.5">
        <div className="flex items-center justify-between gap-3">
          <span className="font-body text-sm text-white/60">
            counts toward <span className="text-white/90">{groupLine(group)}</span>
          </span>
          <button type="button" onClick={() => setLimitOpen((o) => !o)} className="font-mono text-[10px] tracking-wider text-white/45 hover:text-white cursor-pointer">
            {limitOpen ? 'DONE' : 'CHANGE'}
          </button>
        </div>
        {limitOpen && (
          <div className="mt-3 space-y-2">
            <select className={inputClass} value={letter.groupId ?? ''} onChange={(e) => onPatch({ groupId: e.target.value ? Number(e.target.value) : null })}>
              <option value="">no limit</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {groupLine(g)}
                </option>
              ))}
            </select>
            <button type="button" onClick={onManageGroups} className="font-mono text-[10px] tracking-[0.2em] text-white/45 hover:text-white cursor-pointer">
              EDIT LIMITS →
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default LetterSettings;
