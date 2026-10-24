import React, { useEffect, useRef, useState } from 'react';
import { groupsApi, type LetterGroup } from '../../../utils/api';
import { Sheet } from '../../intro/editor/ui';
import { inputClass } from './controls';
import { useConfirm } from '../../../components/common/useConfirm';

/** Named limits like "Open when: 2 per week". Letters join one group; opens count per group. */
export const GroupsSheet: React.FC<{ groups: LetterGroup[]; onChange: (groups: LetterGroup[]) => void; onClose: () => void }> = ({
  groups,
  onChange,
  onClose,
}) => {
  const [error, setError] = useState<string | null>(null);
  const { confirm, dialog } = useConfirm();
  const [created, setCreated] = useState<number | null>(null);
  const newNameRef = useRef<HTMLInputElement>(null);

  // A freshly made group lands at the bottom: bring it into view with its name selected
  useEffect(() => {
    if (created == null || !newNameRef.current) return;
    newNameRef.current.scrollIntoView({ block: 'center', behavior: 'smooth' });
    newNameRef.current.select();
  }, [created]);

  const patch = (id: number, p: Partial<LetterGroup>) => {
    onChange(groups.map((g) => (g.id === id ? { ...g, ...p } : g)));
    groupsApi.update(id, p).catch((e) => setError(e.message));
  };

  const add = () =>
    groupsApi
      .create({ name: 'New group', quota: 1, period: 'week' })
      .then((g) => {
        onChange([...groups, g]);
        setCreated(g.id);
      })
      .catch((e) => setError(e.message));

  const remove = async (g: LetterGroup) => {
    if (!(await confirm({ title: `Delete "${g.name}"?`, body: 'Its letters become unlimited.', confirmLabel: 'Delete', danger: true }))) return;
    groupsApi
      .remove(g.id)
      .then(() => onChange(groups.filter((x) => x.id !== g.id)))
      .catch((e) => setError(e.message));
  };

  return (
    <Sheet title="Groups & limits" onClose={onClose}>
      <p className="font-body text-white/50 mb-4">how many letters from a group they can open per day, week or month. weeks start Monday.</p>
      <div className="space-y-3">
        {groups.map((g) => (
          <div key={g.id} className="rounded-2xl bg-white/[0.05] p-3 space-y-2">
            <div className="flex gap-2">
              <input
                ref={g.id === created ? newNameRef : undefined}
                className={`${inputClass} ${g.id === created ? 'ring-2 ring-brand-cyan' : ''}`}
                value={g.name}
                onChange={(e) => patch(g.id, { name: e.target.value })}
                aria-label="group name"
              />
              {!g.defaultFor && (
                <button type="button" onClick={() => remove(g)} className="shrink-0 h-10 px-3 rounded-xl bg-white/[0.06] text-rose-300 font-mono text-[11px] cursor-pointer">
                  DELETE
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                className={`${inputClass} w-24`}
                value={g.quota ?? ''}
                placeholder="∞"
                aria-label="opens allowed"
                onChange={(e) => patch(g.id, { quota: e.target.value ? Math.max(1, Number(e.target.value)) : null })}
              />
              <span className="font-body text-white/50">per</span>
              <select className={`${inputClass} w-32`} value={g.period} onChange={(e) => patch(g.id, { period: e.target.value as LetterGroup['period'] })}>
                <option value="day">day</option>
                <option value="week">week</option>
                <option value="month">month</option>
              </select>
              {g.defaultFor && <span className="font-mono text-[10px] tracking-wider text-white/35">DEFAULT</span>}
            </div>
          </div>
        ))}
      </div>
      <button type="button" onClick={add} className="mt-4 w-full h-11 rounded-xl border border-dashed border-white/25 font-mono text-[11px] tracking-[0.2em] text-white/70 hover:text-white cursor-pointer">
        + NEW GROUP
      </button>
      {error && <p className="mt-3 font-body text-rose-300">{error}</p>}
      {dialog}
    </Sheet>
  );
};

export default GroupsSheet;
