import { newId, type Block, type IntroDoc } from '../doc';

/** Small pure helpers so every edit is one `update(fn)` call. */

export const patchBlock =
  (id: string, patch: Record<string, unknown>) =>
  (d: IntroDoc): IntroDoc => ({
    ...d,
    blocks: d.blocks.map((b) => (b.id === id ? ({ ...b, props: { ...b.props, ...patch } } as Block) : b)),
  });

export const removeBlock =
  (id: string) =>
  (d: IntroDoc): IntroDoc => ({
    ...d,
    // the letters button can't be deleted
    blocks: d.blocks.filter((b) => b.id !== id || b.type === 'button'),
  });

export const moveBlock =
  (from: number, to: number) =>
  (d: IntroDoc): IntroDoc => {
    if (to < 0 || to >= d.blocks.length) return d;
    const blocks = [...d.blocks];
    const [b] = blocks.splice(from, 1);
    blocks.splice(to, 0, b);
    return { ...d, blocks };
  };

/** Insert after `afterId` (or at the end), returning the new doc. */
export const insertBlock =
  (block: Block, afterId: string | null) =>
  (d: IntroDoc): IntroDoc => {
    const at = afterId ? d.blocks.findIndex((b) => b.id === afterId) + 1 : d.blocks.length;
    const blocks = [...d.blocks];
    blocks.splice(at || blocks.length, 0, block);
    return { ...d, blocks };
  };

export const duplicateBlock =
  (id: string, newBlockId: string) =>
  (d: IntroDoc): IntroDoc => {
    const i = d.blocks.findIndex((b) => b.id === id);
    if (i < 0 || d.blocks[i].type === 'button') return d;
    const copy = { ...d.blocks[i], id: newBlockId, props: { ...d.blocks[i].props } } as Block;
    const blocks = [...d.blocks];
    blocks.splice(i + 1, 0, copy);
    return { ...d, blocks };
  };

export const NEW_BLOCKS: Record<'heading' | 'text' | 'image' | 'embed', () => Block> = {
  heading: () => ({ id: newId(), type: 'heading', props: { text: 'A new ', accent: 'heading' } }),
  text: () => ({ id: newId(), type: 'text', props: { text: '', size: 'md' } }),
  image: () => ({ id: newId(), type: 'image', props: { src: '', width: 0.8, align: 'center', rounded: true } }),
  embed: () => ({ id: newId(), type: 'embed', props: { url: '' } }),
};
