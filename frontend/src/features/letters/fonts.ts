// Fonts offered in the letter editor. Cardo, Outfit and Anton are already on every page;
// the rest load only when a letter is being written or read.

export const LETTER_FONTS: { label: string; family: string }[] = [
  { label: 'Cardo', family: '"Cardo", serif' },
  { label: 'Outfit', family: '"Outfit", sans-serif' },
  { label: 'Anton', family: '"Anton", sans-serif' },
  { label: 'Caveat', family: '"Caveat", cursive' },
  { label: 'Pacifico', family: '"Pacifico", cursive' },
  { label: 'Playfair', family: '"Playfair Display", serif' },
  { label: 'DM Serif', family: '"DM Serif Display", serif' },
  { label: 'Space Grotesk', family: '"Space Grotesk", sans-serif' },
  { label: 'Courier Prime', family: '"Courier Prime", monospace' },
  { label: 'Marker', family: '"Permanent Marker", cursive' },
  { label: 'Indie Flower', family: '"Indie Flower", cursive' },
];

export const LETTER_SIZES: { label: string; value: string | null }[] = [
  { label: 'Small', value: '14px' },
  { label: 'Normal', value: null },
  { label: 'Large', value: '24px' },
  { label: 'XL', value: '32px' },
  { label: 'Huge', value: '44px' },
];

const HREF =
  'https://fonts.googleapis.com/css2?family=Caveat:wght@400..700&family=Pacifico&family=Playfair+Display:ital,wght@0,400..900;1,400..900&family=DM+Serif+Display:ital@0;1&family=Space+Grotesk:wght@300..700&family=Courier+Prime:ital,wght@0,400;0,700;1,400&family=Permanent+Marker&family=Indie+Flower&display=swap';

export function ensureLetterFonts() {
  if (document.querySelector(`link[data-letter-fonts]`)) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = HREF;
  link.dataset.letterFonts = '';
  document.head.appendChild(link);
}
