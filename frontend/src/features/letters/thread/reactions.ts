import type { Reaction } from '../../../utils/api';

export const QUICK_REACTIONS = ['😭', '🫠', '🥺', '😂', '💖', '😞'];

export interface Chip {
  emoji: string;
  count: number;
  mine: boolean;
}

/** Reactions on one thing (the letter, or one reply), grouped: 💖 2. */
export function chipsFor(reactions: Reaction[], replyId: number | null, me: string | null): Chip[] {
  const chips: Chip[] = [];
  for (const r of reactions) {
    if (r.replyId !== replyId) continue;
    let chip = chips.find((c) => c.emoji === r.emoji);
    if (!chip) chips.push((chip = { emoji: r.emoji, count: 0, mine: false }));
    chip.count++;
    if (r.userId === me) chip.mine = true;
  }
  return chips;
}
