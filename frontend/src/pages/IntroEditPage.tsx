import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { isAuthError, saveTheirIntro, theirIntro, type Intro } from '../utils/api';

const EMPTY: Intro = { nickname: '', intro: '', aside: '', note: '' };

const label = 'block font-mono text-[11px] tracking-[0.2em] text-white/40 mb-2';
const field =
  'w-full bg-white/5 rounded-xl px-4 py-3 outline-none font-body text-lg text-[#e8e8e8] placeholder:text-white/25 focus:bg-white/10 transition-colors';

/** Write the other person's "Hello, ___" intro page. */
export const IntroEditPage: React.FC = () => {
  const navigate = useNavigate();
  const [name, setName] = useState<string | null>(null);
  const [draft, setDraft] = useState<Intro>(EMPTY);
  const [saved, setSaved] = useState<Intro>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const dirty = (Object.keys(EMPTY) as (keyof Intro)[]).some((k) => draft[k] !== saved[k]);

  useEffect(() => {
    theirIntro()
      .then(({ name, intro }) => {
        setName(name);
        const start = intro ?? { ...EMPTY, nickname: name ?? '' };
        setDraft(start);
        setSaved(start);
      })
      .catch((err) => (isAuthError(err) ? navigate('/', { replace: true }) : setStatus(err.message)))
      .finally(() => setLoading(false));
  }, [navigate]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const set = (key: keyof Intro) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setDraft({ ...draft, [key]: e.target.value });

  const save = async () => {
    if (saving) return;
    setSaving(true);
    setStatus(null);
    try {
      await saveTheirIntro(draft);
      setSaved(draft);
      setStatus('saved <3');
    } catch (err) {
      if (isAuthError(err)) navigate('/', { replace: true });
      else setStatus(err instanceof Error ? err.message : 'something went wrong');
    } finally {
      setSaving(false);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      save();
    }
  };

  return (
    <div onKeyDown={onKeyDown} className="min-h-dvh bg-[#151515] text-white selection:bg-brand-cyan selection:text-black">
      <div className="max-w-[720px] mx-auto px-5 sm:px-8 py-6">
        <div className="flex items-center justify-between gap-3 mb-8">
          <button
            type="button"
            onClick={() => (!dirty || window.confirm('Discard unsaved changes?')) && navigate('/write')}
            className="text-white/50 hover:text-white text-sm font-body cursor-pointer"
          >
            &larr; back to letters
          </button>
          <div className="flex items-center gap-3">
            <span className="text-sm font-body text-white/50">{status ?? (dirty ? 'unsaved changes' : '')}</span>
            <button
              type="button"
              onClick={save}
              disabled={saving || !dirty}
              className="px-4 py-1.5 rounded-full text-sm font-body font-semibold bg-brand-cyan text-black transition-all duration-200 hover:shadow-[0_0_20px_rgba(0,216,255,0.5)] active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              {saving ? 'saving...' : 'save'}
            </button>
          </div>
        </div>

        <h1 className="font-heading font-medium text-3xl mb-2">
          {name ? (
            <>
              <span className="font-body italic font-normal">{name}</span>'s intro page
            </>
          ) : (
            'their intro page'
          )}
        </h1>
        <p className="font-body text-white/50 text-lg mb-8">
          what they see when they open Letters. only you can write this one :3
        </p>

        {loading ? (
          <p className="font-body italic text-white/40">loading...</p>
        ) : (
          <div className="space-y-6">
            <div>
              <label className={label} htmlFor="nickname">HELLO, ___</label>
              <input id="nickname" value={draft.nickname} onChange={set('nickname')} maxLength={60} placeholder="nickname" className={`${field} italic`} />
            </div>
            <div>
              <label className={label} htmlFor="intro">INTRO (blank line = new paragraph)</label>
              <textarea id="intro" value={draft.intro} onChange={set('intro')} rows={7} placeholder="say hi..." className={`${field} resize-y leading-relaxed`} />
            </div>
            <div>
              <label className={label} htmlFor="aside">SMALL LINE ABOVE THE BUTTON</label>
              <input id="aside" value={draft.aside} onChange={set('aside')} maxLength={160} placeholder="until then u can read these :3" className={field} />
            </div>
            <div>
              <label className={label} htmlFor="note">NOTE BEFORE THE FIRST LETTER</label>
              <textarea id="note" value={draft.note} onChange={set('note')} rows={4} placeholder="shown on the letters page before they press more?" className={`${field} resize-y leading-relaxed`} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default IntroEditPage;
