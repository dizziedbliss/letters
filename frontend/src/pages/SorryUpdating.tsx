import React from 'react';
import { useNavigate } from 'react-router-dom';
import { usePageTransition } from '../components/transition/context';
import { IntroRenderer } from '../features/intro/IntroRenderer';
import { themeFor } from '../features/intro/doc';
import { useMyIntroPage } from '../features/intro/useMyIntroPage';
import { useMediaUrl } from '../features/intro/useMediaUrl';

interface LettersPageProps {
  onBack?: () => void;
}

/** My intro page ("Hello, ___"), built by the other person in the intro builder. */
export const LettersPage: React.FC<LettersPageProps> = ({ onBack }) => {
  const navigate = useNavigate();
  const { go } = usePageTransition();
  const doc = useMyIntroPage();
  const theme = doc ? themeFor(doc.background) : themeFor({ kind: 'preset', value: 'dark' });

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      go('/home', { label: 'Home', code: '00' });
    }
  };

  return (
    <div
      className="relative w-full min-h-dvh overflow-x-hidden selection:bg-brand-cyan selection:text-black bg-cover bg-center"
      style={{ backgroundColor: theme.bg }}
    >
      {theme.image && <IntroBackgroundImage src={theme.image} />}

      {/* Back button */}
      <button
        type="button"
        onClick={handleBack}
        className="absolute top-6 left-6 z-20 transition-opacity duration-200 opacity-60 hover:opacity-100 text-sm font-body cursor-pointer flex items-center gap-1.5"
        style={{ color: theme.strong }}
      >
        <span>&larr;</span>
        <span>Back</span>
      </button>

      <main className="relative z-10 min-h-dvh flex flex-col justify-center pt-20 pb-12">
        {doc && (
          <div className="animate-fade-in">
            <IntroRenderer doc={doc} onButton={() => navigate('/lettersPage')} />
          </div>
        )}
      </main>
    </div>
  );
};

/** Uploaded background image, dimmed so text stays readable. */
const IntroBackgroundImage: React.FC<{ src: string }> = ({ src }) => {
  const url = useMediaUrl(src);
  if (!url) return null;
  return (
    <div className="fixed inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${url})` }}>
      <div className="absolute inset-0 bg-black/35" />
    </div>
  );
};

export default LettersPage;
