import React from 'react';

/** compact: signed in, so only the title (the "go away" note is for strangers, and the drawing needs the room). */
export const HeroContent: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  return (
    <>
      {/* Main Heading (Outfit) */}
      <h1 className="text-hero-sm sm:text-5xl md:text-hero font-extrabold tracking-tight text-brand-black leading-tight mb-4 font-heading drop-shadow-sm select-none">
        The Goated Website
      </h1>

      {/* Subtitle / Description (Cardo) */}
      {!compact && <p className="text-subtitle-sm sm:text-xl md:text-subtitle text-brand-black leading-relaxed font-body mb-8 max-w-[620px] select-none">
        This website is made for someone <span className="italic font-normal">special</span>, and only they can get in, not others. If you belong to <span className="italic font-normal">others</span>, please go away, you can't get in (unless you're an hacker).
      </p>}
    </>
  );
};

export default HeroContent;
