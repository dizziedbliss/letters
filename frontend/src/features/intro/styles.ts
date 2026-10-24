import type { Align } from './doc';

export const justify: Record<Align, string> = { left: 'justify-start', center: 'justify-center', right: 'justify-end' };
export const textAlign: Record<Align, string> = { left: 'text-left', center: 'text-center', right: 'text-right' };

/** Text colour swatches offered in the editor (undefined = the background's default). */
export const SWATCHES: (string | undefined)[] = [undefined, '#ffffff', '#00D8FF', '#6100D8', '#ff8fb1', '#111114'];
