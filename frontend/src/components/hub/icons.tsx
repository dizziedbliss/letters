const base = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

export const IconLetter = () => (
  <svg {...base}>
    <rect x="3" y="5" width="18" height="14" rx="1.5" />
    <path d="M3.5 6.5 12 13l8.5-6.5" />
  </svg>
);
export const IconWrite = () => (
  <svg {...base}>
    <path d="M4 20l1-4L16.5 4.5a2 2 0 0 1 3 3L8 19l-4 1z" />
    <path d="M14 7l3 3" />
  </svg>
);
export const IconStar = () => (
  <svg {...base}>
    <path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 16.9 6.8 19.7l1-5.9L3.5 9.7l5.9-.8L12 3.5z" />
  </svg>
);
export const IconPuzzle = () => (
  <svg {...base}>
    <path d="M9 4h3a2 2 0 1 1 4 0h3v4a2 2 0 1 1 0 4v8H9v-3a2 2 0 1 0-4 0H4V4h5z" />
  </svg>
);
export const IconPin = () => (
  <svg {...base}>
    <rect x="4" y="7" width="16" height="13" rx="1" />
    <path d="M9 3.5l6 3M12 4v5" />
  </svg>
);
export const IconUs = () => (
  <svg {...base}>
    <circle cx="9" cy="12" r="5" />
    <circle cx="15" cy="12" r="5" />
  </svg>
);
export const IconLock = () => (
  <svg {...base}>
    <rect x="5" y="11" width="14" height="9" rx="1.5" />
    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
  </svg>
);
