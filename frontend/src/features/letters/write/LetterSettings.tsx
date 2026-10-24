import React from 'react';
import type { LetterGroup, LetterRule, MyLetter } from '../../../utils/api';
import { FieldLabel, Segmented, inputClass } from './controls';

type RuleKind = 'none' | LetterRule['kind'];

const toLocalInput = (iso: string) => {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const groupLabel = (g: LetterGroup) => `${g.name} · ${g.quota ? `${g.quota} per ${g.period}` : 'unlimited'}`;

interface LetterSettingsProps {
  letter: MyLetter;
  letters: MyLetter[];
  groups: LetterGroup[];
  reader: string | null;
  onPatch: (patch: Partial<MyLetter>) => void;
  onUnlock: () => void;
  onManageGroups: () => void;
}

/** Everything about a letter that isn't its words: where it lives, how it's locked. */
export const LetterSettings: React.FC<LetterSettingsProps> = ({ letter, letters, groups, reader, onPatch, onUnlock, onManageGroups }) => {
  const ruleKind: RuleKind = letter.rule?.kind ?? 'none';
  const others = letters.filter((l) => l.id !== letter.id);

  const setRule = (kind: RuleKind) => {
    if (kind === 'none') onPatch({ rule: null });
    else if (kind === 'date') onPatch({ rule: { kind: 'date', at: new Date(Date.now() + 86400e3).toISOString() } });
    else if (kind === 'after') {
      if (others[0]) onPatch({ rule: { kind: 'after', letter_id: others[0].id } });
    }
    else onPatch({ rule: { kind: 'manual' } });
  };

  return (
    <div className="space-y-6">
      <div>
        <FieldLabel>Section</FieldLabel>
        <Segmented
          value={letter.section}
          onChange={(section) => onPatch({ section })}
          options={[
            { value: 'random', label: 'RANDOM' },
            { value: 'open_when', label: 'OPEN WHEN' },
          ]}
        />
        {letter.section === 'open_when' && (
          <p className="font-body text-sm text-white/40 mt-2">the title is the feeling, e.g. "sick", "sad", "can't sleep"</p>
        )}
      </div>

      <div>
        <FieldLabel hint={letter.sealed ? 'title hidden until opened' : undefined}>In the list</FieldLabel>
        <Segmented
          value={letter.sealed ? 'sealed' : 'titled'}
          onChange={(v) => onPatch({ sealed: v === 'sealed' })}
          options={[
            { value: 'titled', label: 'TITLED' },
            { value: 'sealed', label: 'SEALED' },
          ]}
        />
      </div>

      <div>
        <FieldLabel>Unlocks</FieldLabel>
        <Segmented
          value={ruleKind}
          onChange={setRule}
          options={[
            { value: 'none', label: 'ANY' },
            { value: 'date', label: 'DATE' },
            { value: 'after', label: 'AFTER' },
            { value: 'manual', label: 'BY ME' },
          ]}
        />
        {letter.rule?.kind === 'date' && (
          <input
            type="datetime-local"
            className={`${inputClass} mt-2`}
            value={toLocalInput(letter.rule.at)}
            onChange={(e) => e.target.value && onPatch({ rule: { kind: 'date', at: new Date(e.target.value).toISOString() } })}
          />
        )}
        {letter.rule?.kind === 'after' && (
          <select
            className={`${inputClass} mt-2`}
            value={letter.rule.letter_id}
            onChange={(e) => onPatch({ rule: { kind: 'after', letter_id: Number(e.target.value) } })}
          >
            {others.map((l) => (
              <option key={l.id} value={l.id}>
                after reading "{l.title || 'untitled'}"
              </option>
            ))}
          </select>
        )}
        {ruleKind === 'after' && !others.length && <p className="font-body text-sm text-white/40 mt-2">write another letter first</p>}
        {letter.rule?.kind === 'manual' && (
          <div className="mt-2 flex items-center gap-3">
            {letter.unlockedByWriter ? (
              <span className="font-mono text-[11px] tracking-wider text-brand-cyan">UNLOCKED ✓</span>
            ) : (
              <button
                type="button"
                onClick={() => window.confirm(`Unlock this for ${reader ?? 'them'} now? It can't be locked again.`) && onUnlock()}
                className="h-10 px-4 rounded-xl bg-brand-cyan text-black font-mono text-[11px] tracking-wider font-bold cursor-pointer hover:shadow-[0_0_16px_rgba(0,216,255,0.5)]"
              >
                UNLOCK NOW
              </button>
            )}
            <span className="font-body text-sm text-white/40">{letter.unlockedByWriter ? 'they can open it' : 'locked until you tap this'}</span>
          </div>
        )}
      </div>

      <div>
        <FieldLabel>Limit group</FieldLabel>
        <select className={inputClass} value={letter.groupId ?? ''} onChange={(e) => onPatch({ groupId: e.target.value ? Number(e.target.value) : null })}>
          <option value="">no limit</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {groupLabel(g)}
            </option>
          ))}
        </select>
        <button type="button" onClick={onManageGroups} className="mt-2 font-mono text-[10px] tracking-[0.2em] text-white/45 hover:text-white cursor-pointer">
          EDIT GROUPS & LIMITS →
        </button>
      </div>

      <div className="rounded-xl bg-white/[0.04] px-4 py-3 font-body text-sm text-white/60">
        {letter.openedAt
          ? `${reader ?? 'They'} opened this on ${new Date(letter.openedAt).toLocaleDateString([], { day: 'numeric', month: 'short' })} ♡`
          : `${reader ?? 'They'} hasn't opened this yet`}
      </div>
    </div>
  );
};

export default LetterSettings;
