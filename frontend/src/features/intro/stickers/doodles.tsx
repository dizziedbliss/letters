import React from 'react';

// Hand-drawn-ish stickers in the site's colours, no image files needed.
export const DOODLES: Record<string, React.ReactNode> = {
  heart: (
    <svg viewBox="0 0 100 100"><path d="M50 88C20 66 6 50 6 32 6 18 17 8 30 8c9 0 16 5 20 12 4-7 11-12 20-12 13 0 24 10 24 24 0 18-14 34-44 56z" fill="#ff8fb1" stroke="#111114" strokeWidth="4" /></svg>
  ),
  star: (
    <svg viewBox="0 0 100 100"><path d="M50 6l12 28 31 3-23 21 7 31-27-16-27 16 7-31L7 37l31-3z" fill="#00D8FF" stroke="#111114" strokeWidth="4" strokeLinejoin="round" /></svg>
  ),
  sparkle: (
    <svg viewBox="0 0 100 100"><path d="M50 4c4 26 12 36 46 46-34 10-42 20-46 46-4-26-12-36-46-46 34-10 42-20 46-46z" fill="#ffffff" stroke="#6100D8" strokeWidth="4" strokeLinejoin="round" /></svg>
  ),
  burst: (
    <svg viewBox="0 0 100 100"><path d="M50 2l9 20 18-14-3 23 23-2-15 17 18 13-23 4 9 21-21-9-6 22-9-21-17 15 1-23-23 4 14-18L2 41l22-6-13-19 23 5z" fill="#6100D8" stroke="#111114" strokeWidth="3" strokeLinejoin="round" /></svg>
  ),
  squiggle: (
    <svg viewBox="0 0 100 40"><path d="M4 28c10-24 18-24 24 0s14 24 22 0 16-24 22 0 14 24 24 0" fill="none" stroke="#00D8FF" strokeWidth="7" strokeLinecap="round" /></svg>
  ),
  arrow: (
    <svg viewBox="0 0 100 60"><path d="M6 44c20-30 50-38 78-22M70 10l16 12-18 9" fill="none" stroke="#ff8fb1" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" /></svg>
  ),
  flower: (
    <svg viewBox="0 0 100 100">
      {[0, 60, 120, 180, 240, 300].map((a) => (
        <ellipse key={a} cx="50" cy="26" rx="14" ry="22" fill="#ffd1e3" stroke="#111114" strokeWidth="3" transform={`rotate(${a} 50 50)`} />
      ))}
      <circle cx="50" cy="50" r="12" fill="#ffd166" stroke="#111114" strokeWidth="3" />
    </svg>
  ),
  crown: (
    <svg viewBox="0 0 100 80"><path d="M8 66L4 18l26 22L50 6l20 34 26-22-4 48z" fill="#ffd166" stroke="#111114" strokeWidth="4" strokeLinejoin="round" /></svg>
  ),
};

export const EMOJI = ['💜', '🩵', '💗', '✨', '🌸', '🌙', '⭐', '🦋', '🍓', '🎀', '🧸', '🐱', '🐰', '🌷', '🫶', '😘', '🥺', '😭', '😤', '🤭', '🙈', '💌', '📸', '🎧', '☁️', '🔥', '🌈', '🍰', '🍜', '🎮', '🫧', '💫'];
