import React, { useState } from 'react';
import { loginWithCode } from '../../utils/auth';

interface SecretCodeInputProps {
  onUnlock?: (code: string) => void;
}

export const SecretCodeInput: React.FC<SecretCodeInputProps> = ({ onUnlock }) => {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isShaking, setIsShaking] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = code.trim();

    if (!trimmed) {
      setError('Our Secret...? :<');
      triggerShake();
      return;
    }

    const success = loginWithCode(trimmed);

    if (success) {
      setError(null);
      setIsSuccess(true);
      setTimeout(() => {
        if (onUnlock) {
          onUnlock(trimmed);
        }
      }, 350);
    } else {
      setError("you're not my special one, please...");
      triggerShake();
    }
  };

  const triggerShake = () => {
    setIsShaking(true);
    setTimeout(() => setIsShaking(false), 500);
  };

  return (
    <div className="w-full max-w-[620px] pointer-events-auto flex flex-col items-center select-text">
      <form
        onSubmit={handleSubmit}
        className={`relative w-full flex items-center transition-transform duration-200 ${
          isShaking ? 'animate-shake' : ''
        }`}
      >
        <input
          type="text"
          value={code}
          onChange={(e) => {
            setCode(e.target.value);
            if (error) setError(null);
          }}
          placeholder="type your secret code here"
          autoComplete="off"
          autoCapitalize="off"
          spellCheck="false"
          className={`w-full h-12 sm:h-[54px] pl-6 pr-14 text-center text-text-input-sm sm:text-text-input text-brand-black placeholder:text-brand-black/50 font-body italic border-2 rounded-2xl outline-none transition-all duration-200 cursor-text select-text ${
            isSuccess
              ? 'bg-emerald-400/25 border-emerald-600 shadow-[0_0_22px_rgba(16,185,129,0.5)]'
              : error
              ? 'bg-rose-400/20 border-rose-600 shadow-[0_0_18px_rgba(225,29,72,0.4)]'
              : 'bg-brand-cyan/20 backdrop-blur-xs border-brand-black focus:bg-brand-cyan/30 focus:shadow-[0_0_18px_rgba(0,216,255,0.45)]'
          }`}
        />

        {/* Submit Arrow / Unlock Button */}
        <button
          type="submit"
          aria-label="Unlock"
          className="absolute right-2.5 sm:right-3 w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-xl bg-brand-black text-white hover:bg-brand-purple hover:scale-105 active:scale-95 transition-all duration-150 cursor-pointer shadow-sm"
        >
          <svg
            className="w-4 h-4 sm:w-4.5 sm:h-4.5 fill-none stroke-current stroke-2"
            viewBox="0 0 24 24"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </button>
      </form>

      {/* Helpful & Playful Error Feedback */}
      {error && (
        <p className="mt-3 text-sm sm:text-base font-body text-rose-600 font-medium select-none text-center animate-fade-in">
          {error}
        </p>
      )}
    </div>
  );
};

export default SecretCodeInput;
