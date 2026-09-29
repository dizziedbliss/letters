import React from 'react';
import { useNavigate } from 'react-router-dom';
  
interface LettersPageProps {
  onBack?: () => void;
}

export const LettersPage: React.FC<LettersPageProps> = ({ onBack }) => {
  const navigate = useNavigate();

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      navigate('/letters');
    }
  };

  return (
    <div className="relative min-h-screen w-screen bg-[#151515] text-white flex items-center justify-center p-6 sm:p-12 overflow-x-hidden selection:bg-brand-cyan selection:text-black">
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
        <div className="flex-1 flex flex-col items-start text-left max-w-[580px]">
          {/* Main Title: "Hello, Saumiiiiii" */}
          <h1 className="text-4xl sm:text-5xl md:text-[52px] font-normal tracking-tight text-white mb-8 leading-tight">
            <span className="font-heading font-medium">Hello, </span>
            <span className="font-body italic font-normal">Saumiiiiii</span>
          </h1>

          {/* Description Body in Cardo */}
          <div className="space-y-6 text-base sm:text-lg md:text-[21px] text-[#e8e8e8] font-body leading-relaxed mb-8">
            <p>
              
            </p>
            <p>
              ILOVEYOUUUUUUUUUUUUUUUUUUUUUUUUUUSOOOOOOOOOOOOOOOMCUHHHHHHHHHHHHHHHHHHHHHHHH ILOVEYOUSOOMUCHHHHH ILOVEYOUSOOOSOSOSOOSSOOSSOOSOMUCHHHH ILOVEYOUUSOOOOMUCHHHHMUCHMUHCUHCHCHH ILOVEYOUUUUUUUUUUUUUUUUUSAUUMMMIIIIIIII HEHHE  &lt;3
            </p>
        
          </div>

          {/* Action Button: "This :3" */}
          <button
            type="button"
            className="inline-flex items-center justify-center px-6 py-2 rounded-full bg-brand-cyan text-black font-body text-base sm:text-lg font-semibold tracking-wide transition-all duration-200 hover:scale-105 hover:shadow-[0_0_20px_rgba(0,216,255,0.6)] active:scale-95 cursor-pointer"
          >
            more?
          </button>
          
        </div>

        {/* Right Column: Character Illustration */}
        {/* <div className="flex-shrink-0 flex items-center justify-center md:justify-end pb-2">
          <img
            src={charactersImg}
            alt="Illustration"
            className="w-[220px] sm:w-[260px] md:w-[290px] h-auto object-contain select-none pointer-events-none drop-shadow-md"
          />
        </div> */}

      </div>
    </div>
  );
};

export default LettersPage;
