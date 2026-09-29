import React from 'react';
import { TileGridBackground } from '../components/background/TileGridBackground';
import { HeroContent } from '../components/landing/HeroContent';
import { SecretCodeInput } from '../components/landing/SecretCodeInput';

interface LandingPageProps {
  onUnlock?: (code: string) => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onUnlock }) => {
  return (
    <div className="fixed inset-0 w-screen h-screen overflow-hidden bg-white flex items-center justify-center">
      {/* 1. Interactive Responsive Background Tile Grid */}
      <TileGridBackground />

      {/* 2. Floating Foreground Content Layer */}
      <div className="relative z-10 pointer-events-none flex flex-col items-center text-center px-4 sm:px-6 w-full max-w-[760px] mx-auto">
        <HeroContent />
        <SecretCodeInput onUnlock={onUnlock} />
      </div>
    </div>
  );
};

export default LandingPage;
