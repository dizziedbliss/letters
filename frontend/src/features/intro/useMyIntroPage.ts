import { useEffect, useState } from 'react';
import { myIntroPage, myName } from '../../utils/api';
import { parseDoc, placeholderDoc, type IntroDoc } from './doc';

/** My published intro page, or a placeholder until the other person publishes one. */
export function useMyIntroPage() {
  const [doc, setDoc] = useState<IntroDoc | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([myIntroPage(), myName()])
      .then(([raw, name]) => !cancelled && setDoc(parseDoc(raw) ?? placeholderDoc(name)))
      .catch(() => !cancelled && setDoc(placeholderDoc(null)));
    return () => {
      cancelled = true;
    };
  }, []);

  return doc;
}
