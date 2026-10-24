import { createContext } from 'react';

/** What the letters-button block does when tapped (navigate to the letters). Unset while editing. */
export const LettersButtonContext = createContext<(() => void) | undefined>(undefined);
