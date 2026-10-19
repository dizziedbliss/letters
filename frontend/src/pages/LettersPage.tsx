import React from 'react';
import { useNavigate } from 'react-router-dom';
import { LetterView } from '../components/letters/LetterView';
import { useRandomLetter } from '../hooks/useRandomLetter';

interface LettersPageProps {
  onBack?: () => void;
}

export const LettersPage: React.FC<LettersPageProps> = ({ onBack }) => {
  const navigate = useNavigate();
  const { letter, status, next } = useRandomLetter();

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      navigate('/letters');
    }
  };

  return (
    <div className="relative w-full min-h-dvh py-8 bg-[#151515] text-white flex items-center justify-center p-6 sm:p-12 overflow-x-hidden selection:bg-brand-cyan selection:text-black">
      {/* Back button */}
      <button
        type="button"
        onClick={handleBack}
        className="absolute top-6 left-6 text-white/50 hover:text-white transition-colors duration-200 text-sm font-body cursor-pointer flex items-center gap-1.5"
      >
        <span>&larr;</span>
        <span>Back</span>
      </button>

      {/* Central Card / Layout Container */}
      <div className="w-full max-w-[960px] flex flex-col md:flex-row items-center md:items-end justify-between gap-10 md:gap-14 my-auto">
        
        {/* Left Column: Heading, Subtitle & Action */}
        <div className="flex-1 flex flex-col items-start text-left max-w-[580px] max-w-full break-words">
          {/* Main Title: "Hello, Saumiiiiii" */}
          <h1 className="text-4xl sm:text-5xl md:text-[52px] font-normal tracking-tight text-white mb-8 leading-tight">
            <span className="font-heading font-medium">Hello, </span>
            <span className="font-body italic font-normal">Saumiiiiii</span>
          </h1>

          {/* Intro until she asks for a letter, then the shuffled letters */}
          <div className="mb-8 min-h-[4rem]">
            {letter ? (
              <LetterView key={letter.id} letter={letter} />
            ) : (
              <div className="space-y-6 text-base sm:text-lg md:text-[21px] text-[#e8e8e8] font-body leading-relaxed">
                <p>
                  ILOVEYOUUUUUUUUUUUUUUUUUUUUUUUUUUSOOOOOOOOOOOOOOOMCUHHHHHHHHHHHHHHHHHHHHHHHH ILOVEYOUSOOMUCHHHHH ILOVEYOUSOOOSOSOSOOSSOOSSOOSOMUCHHHH ILOVEYOUUSOOOOMUCHHHHMUCHMUHCUHCHCHH ILOVEYOUUUUUUUUUUUUUUUUUSAUUMMMIIIIIIII HEHHE &lt;3
                </p>
              </div>
            )}
            {status === 'error' && (
              <p className="font-body italic text-rose-300 text-lg">couldn't fetch a letter, try again?</p>
            )}
          </div>

          {/* Action Button: "more?" */}
          <button
            type="button"
            onClick={next}
            disabled={status === 'loading'}
            className={`inline-flex items-center justify-center px-6 py-2 rounded-full font-body text-base sm:text-lg font-semibold tracking-wide transition-all duration-200 hover:scale-105 active:scale-95 disabled:opacity-60 disabled:hover:scale-100 cursor-pointer ${
              status === 'empty'
                ? 'bg-rose-500 text-white hover:shadow-[0_0_20px_rgba(244,63,94,0.6)]'
                : 'bg-brand-cyan text-black hover:shadow-[0_0_20px_rgba(0,216,255,0.6)]'
            }`}
          >
            {status === 'loading' ? '...' : status === 'empty' ? 'uhm sorry- me still writing down- sabar karo' : 'more?'}
          </button>
        </div>

        {/* Right Column: Character Illustration */}
        {/* <div className="flex-shrink-0 flex items-center justify-center md:justify-end pb-2">
          <img
            src={charactersImg}
            alt="Illustration"
            className="w-[170px] sm:w-[220px] md:w-[280px] h-auto object-contain select-none pointer-events-none drop-shadow-md"
          />
        </div> */}

      </div>
    </div>
  );
};

export default LettersPage;
