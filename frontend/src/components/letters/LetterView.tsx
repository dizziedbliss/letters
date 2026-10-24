import React from 'react';
import type { Letter } from '../../utils/api';

interface LetterViewProps {
  letter: Letter;
  author?: string | null;
}

/** One letter: italic title over a body that keeps the writer's line breaks. */
export const LetterView: React.FC<LetterViewProps> = ({ letter, author }) => (
  <article className="animate-fade-in">
    <h2 className="font-body italic text-2xl sm:text-3xl text-white mb-4 leading-snug">{letter.title}</h2>
    <p className="whitespace-pre-wrap text-base sm:text-lg md:text-[21px] text-[#e8e8e8] font-body leading-relaxed">
      {letter.body}
    </p>
    {author && <p className="mt-5 font-body italic text-white/50 text-lg">&mdash; {author}</p>}
  </article>
);

export default LetterView;
